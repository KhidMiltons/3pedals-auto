import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

const BLOCKED_PREFIXES = ["/.git", "/.github", "/github", "/outputs", "/scripts", "/supabase", "/.gmp_cache"];
const BLOCKED_FILES = new Set(["/package.json", "/package-lock.json", "/server.js", "/PROJECTS_SETUP.sql", "/.env", "/.env.local"]);

const ALLOWED_ORIGINS = new Set([
  "https://3pedalsauto.co.ke",
  "https://www.3pedalsauto.co.ke",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  } else if (origin) {
    return res.status(403).json({ error: "This website is not allowed to access the 3 Pedals Auto API." });
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "3 Pedals Auto API" });
});

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const reqPath = req.path;
  if (
    BLOCKED_FILES.has(reqPath) ||
    reqPath.endsWith(".sql") ||
    BLOCKED_PREFIXES.some((prefix) => reqPath === prefix || reqPath.startsWith(prefix + "/"))
  ) {
    return res.status(404).send("Not found");
  }
  next();
});

function getGenAiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ROLE_INSTRUCTIONS = {
  buyer_advisor:
    "You are 3P Auto Advisor, an expert Kenya automotive buyer concierge for 3 Pedals Auto KE. Help buyers compare cars, estimate running costs, fuel economy, spare parts availability in Kenya, and pre-purchase inspection checks. Prices are in KES. Keep answers clear, well-structured, and concise.",
  import_specialist:
    "You are 3P Import & Duty Specialist for Kenya. Explain KRA/KEBS/NTSA rules, 8-year age limits, CRSP valuation factors, import duty, excise, VAT, IDF, RDL, and registration steps in Kenya accurately using Search grounding when current rates or policies are asked.",
  yard_locator:
    "You are 3P Yard & Inspection Locator for 3 Pedals Auto KE. Help buyers find reputable car yards, NTSA inspection centers, garages, and automotive service hubs across Kenya with OpenStreetMap place data and links. Clearly identify incomplete map coverage and never invent ratings or opening hours.",
  inspection_tech:
    "You are 3P Pre-Purchase Mechanical Advisor. Give practical, itemized inspection checklists, common model faults, mileage verification tips, and logbook verification guidance for buyers in Kenya.",
};

function shouldRouteToMaps(text) {
  return /\b(near me|nearby|directions|route|distance|how far|map|maps|where is|locate|location|yards? in|showrooms? in|dealers? in|garages? in|mechanics? near|inspection cent(er|re)|ntsa|nairobi|mombasa|kisumu|nakuru|eldoret|westlands|kilimani|kiambu|thika|karen|ngong)\b/i.test(
    String(text || "")
  );
}

async function findOpenStreetMapPlaces(queryText, location) {
  const userLat = Number(location?.latitude), userLng = Number(location?.longitude);
  const hasLocation = Number.isFinite(userLat) && Number.isFinite(userLng);
  const area = String(queryText || "").replace(/\b(near me|nearby|car yards?|dealers?|dealerships?|garages?|mechanics?|inspection centers?|ntsa|showrooms?|directions|map|maps)\b/ig, " ").replace(/\s+/g, " ").trim() || "Nairobi";
  let center = hasLocation ? { lat: userLat, lon: userLng } : null;
  if (!center) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "ke", q: area + ", Kenya" });
    const response = await fetch(url, { headers: { "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)", Accept: "application/json" } });
    if (!response.ok) throw new Error("OpenStreetMap location search is unavailable.");
    const found = await response.json();
    if (found[0]) center = { lat: Number(found[0].lat), lon: Number(found[0].lon) };
  }
  if (!center) center = { lat: -1.2921, lon: 36.8219 };
  const pattern = "car|auto|motor|vehicle|garage|inspection|ntsa|toyota|subaru|mazda|mitsubishi|nissan|dealer|showroom";
  const query = '[out:json][timeout:20];(nwr["name"~"' + pattern + '",i](around:12000,' + center.lat + ',' + center.lon + '););out center tags 50;';
  const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)" }, body: "data=" + encodeURIComponent(query) });
  if (!response.ok) throw new Error("OpenStreetMap place search is unavailable.");
  const data = await response.json();
  return (data.elements || []).map(el => {
    const tags = el.tags || {};
    return { name: tags.name || tags.brand || "Automotive location", lat: Number(el.lat ?? el.center?.lat), lon: Number(el.lon ?? el.center?.lon), address: [tags["addr:street"], tags["addr:suburb"], tags["addr:city"]].filter(Boolean).join(", "), category: tags.amenity || tags.shop || tags.office || tags.craft || "automotive", mapUrl: "https://www.openstreetmap.org/" + el.type + "/" + el.id };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).slice(0, 30);
}

app.post("/api/chat", async (req, res) => {
  const ai = getGenAiClient();
  if (!ai) {
    return res.status(503).json({
      error: "Gemini API key is not configured yet. Set GEMINI_API_KEY in Settings > Secrets.",
    });
  }

  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const cleanedHistory = rawMessages
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(-16)
    .map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.text.trim().slice(0, 4000) }],
    }));

  if (!cleanedHistory.length) {
    return res.status(400).json({ error: "Please enter a message to start chatting." });
  }

  const lastUserMsg =
    [...cleanedHistory].reverse().find((m) => m.role === "user")?.parts?.[0]?.text || "";
  const requestedMode = String(req.body?.mode || "auto").toLowerCase();
  const roleKey = String(req.body?.role || "buyer_advisor");
  const lang = req.body?.lang === "sw" ? "sw" : "en";

  const baseInstruction = ROLE_INSTRUCTIONS[roleKey] || ROLE_INSTRUCTIONS.buyer_advisor;
  const langInstruction =
    lang === "sw"
      ? " Respond primarily in natural Kenyan Swahili (keeping automotive model names and KES currency clear) unless the user writes purely in English."
      : "";
  const systemInstruction = `${baseInstruction}${langInstruction}`;

  let effectiveMode = requestedMode;
  if (effectiveMode === "auto") {
    effectiveMode = roleKey === "yard_locator" || shouldRouteToMaps(lastUserMsg) ? "maps" : "search";
  }
  let osmPlaces = [];
  if (effectiveMode === "maps") {
    try { osmPlaces = await findOpenStreetMapPlaces(lastUserMsg, req.body?.location); }
    catch (error) { console.warn("OpenStreetMap lookup failed:", error); }
    if (osmPlaces.length) {
      const last = cleanedHistory[cleanedHistory.length - 1];
      if (last?.role === "user") last.parts[0].text += "\n\nOpenStreetMap place data (coverage may be incomplete; do not invent ratings or opening hours): " + JSON.stringify(osmPlaces);
    }
  }

  let model = "gemini-2.5-flash-lite";
  const config = { systemInstruction };

  if (effectiveMode === "fast") {
    model = "gemini-3.1-flash-lite";
  } else if (effectiveMode === "maps") {
    model = "gemini-2.5-flash-lite";
    config.tools = [{ googleSearch: {} }];
  } else if (effectiveMode === "search") {
    model = "gemini-2.5-flash-lite";
    config.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: cleanedHistory,
      config,
    });

    const reply = (response.text || "").trim();
    const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources = [];
    const seenUris = new Set();

    for (const chunk of rawChunks) {
      if (chunk?.web?.uri && !seenUris.has(chunk.web.uri)) {
        seenUris.add(chunk.web.uri);
        groundingSources.push({
          type: "web",
          title: chunk.web.title || chunk.web.uri,
          uri: chunk.web.uri,
        });
      }
    }
    if (effectiveMode === "maps") {
      for (const place of osmPlaces.slice(0, 8)) {
        if (place.mapUrl && !seenUris.has(place.mapUrl)) {
          seenUris.add(place.mapUrl);
          groundingSources.push({ type: "osm", title: place.name, uri: place.mapUrl });
        }
      }
    }

    res.json({
      reply: reply || "I could not generate a response for that request. Please try rephrasing.",
      model,
      groundingMode: effectiveMode === "maps" ? "OpenStreetMap" : effectiveMode,
      groundingSources,
    });
  } catch (err) {
    const status = Number(err?.status) || 500;
    let message = err?.message || "Failed to generate response from Gemini.";
    try {
      const parsed = JSON.parse(message);
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
    } catch (_) {}
    if (/api key not valid|api_key_invalid/i.test(message)) {
      message =
        "Gemini API key is invalid or not yet activated in Settings > Secrets (GEMINI_API_KEY).";
    }
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message,
    });
  }
});

app.get("/vendor/jspdf.umd.min.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "node_modules/jspdf/dist/jspdf.umd.min.js"));
});

app.use(
  express.static(__dirname, {
    extensions: ["html"],
    index: "index.html",
  })
);

app.listen(port, host, () => {
  console.log(`3 Pedals Auto KE listening on http://${host}:${port}`);
});
