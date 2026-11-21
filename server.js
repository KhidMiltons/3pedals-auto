import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = "0.0.0.0";

const BLOCKED_PREFIXES = ["/.git", "/.github", "/github", "/outputs", "/scripts", "/supabase"];
const BLOCKED_FILES = new Set(["/package.json", "/package-lock.json", "/server.js", "/PROJECTS_SETUP.sql", "/.env", "/.env.local"]);

const EXTRA_ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  "https://3pedalsauto.co.ke",
  "https://www.3pedalsauto.co.ke",
  "https://threepedals-auto.onrender.com",
  ...EXTRA_ALLOWED_ORIGINS,
]);

function isAllowedOrigin(origin, req) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const reqHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (reqHost && parsed.host.toLowerCase() === reqHost) return true;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".run.app")) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin, req)) {
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
  const userLat = Number(location?.latitude);
  const userLng = Number(location?.longitude);
  const hasLocation =
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    Math.abs(userLat) <= 90 &&
    Math.abs(userLng) <= 180;
  const rawQuery = String(queryText || "");
  const wantsNearMe = /\b(near me|nearby|around me|closest|karibu nami)\b/i.test(rawQuery);
  const area = rawQuery
    .replace(/\b(near me|nearby|around me|closest|karibu nami|car yards?|dealers?|dealerships?|garages?|mechanics?|inspection cent(er|re)s?|motor vehicle|ntsa|showrooms?|reputable|find|where is|directions|map|maps|kenya)\b/gi, " ")
    .replace(/\b(in|near|around|along|at|for|to|the|of)\b/gi, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let center = null;
  if (area && !wantsNearMe) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      countrycodes: "ke",
      q: `${area}, Kenya`,
    });
    const response = await fetch(url, {
      headers: {
        "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error("OpenStreetMap location search is unavailable.");
    const found = await response.json();
    if (found[0]) center = { lat: Number(found[0].lat), lon: Number(found[0].lon) };
  }
  if (!center && hasLocation) {
    center = { lat: userLat, lon: userLng };
  }
  if (!center) center = { lat: -1.2921, lon: 36.8219 };

  const pattern = "car|auto|motor|vehicle|garage|inspection|ntsa|toyota|subaru|mazda|mitsubishi|nissan|dealer|showroom";
  const around = `around:12000,${center.lat},${center.lon}`;
  const query = `[out:json][timeout:15];(nwr["shop"~"^(car|car_repair|car_parts|tyres)$"](${around});nwr["amenity"~"^(car_rental|car_wash|vehicle_inspection)$"](${around});nwr["office"="automotive"](${around});nwr["name"~"${pattern}",i](${around}););out center tags 60;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)",
    },
    body: "data=" + encodeURIComponent(query),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("OpenStreetMap place search is unavailable.");
  const data = await response.json();
  const seen = new Set();
  return (data.elements || [])
    .map((el) => {
      const tags = el.tags || {};
      return {
        name: tags.name || tags.brand || "Automotive location",
        lat: Number(el.lat ?? el.center?.lat),
        lon: Number(el.lon ?? el.center?.lon),
        address: [tags["addr:street"], tags["addr:suburb"], tags["addr:city"]]
          .filter(Boolean)
          .join(", "),
        category: tags.amenity || tags.shop || tags.office || tags.craft || "automotive",
        mapUrl: `https://www.openstreetmap.org/${encodeURIComponent(String(el.type || "node"))}/${encodeURIComponent(String(el.id || ""))}`,
      };
    })
    .filter((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
      const key = `${p.name}|${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
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

  let model = "gemini-3.5-flash-lite";
  const config = { systemInstruction };

  if (effectiveMode === "fast") {
    model = "gemini-3.5-flash-lite";
  } else if (effectiveMode === "maps") {
    model = "gemini-3.5-flash-lite";
    config.tools = [{ googleSearch: {} }];
  } else if (effectiveMode === "search") {
    model = "gemini-3.5-flash-lite";
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
