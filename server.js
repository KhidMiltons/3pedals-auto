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
    "You are 3P Yard & Inspection Locator for 3 Pedals Auto KE. Help buyers find reputable car yards, NTSA inspection centers, garages, and automotive service hubs across Kenya with grounded Google Maps place details and links.",
  inspection_tech:
    "You are 3P Pre-Purchase Mechanical Advisor. Give practical, itemized inspection checklists, common model faults, mileage verification tips, and logbook verification guidance for buyers in Kenya.",
};

function shouldRouteToMaps(text) {
  return /\b(near me|nearby|directions|route|distance|how far|map|maps|where is|locate|location|yards? in|showrooms? in|dealers? in|garages? in|mechanics? near|inspection cent(er|re)|ntsa|nairobi|mombasa|kisumu|nakuru|eldoret|westlands|kilimani|kiambu|thika|karen|ngong)\b/i.test(
    String(text || "")
  );
}

app.get("/api/maps-config", (_req, res) => {
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.MAPS_API_KEY ||
    "";
  res.json({
    configured: Boolean(apiKey),
    apiKey,
  });
});

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
    effectiveMode =
      roleKey === "yard_locator" || shouldRouteToMaps(lastUserMsg) ? "maps" : "search";
  }

  let model = "gemini-4-hydrogen";
  const config = { systemInstruction };

  if (effectiveMode === "fast") {
    model = "gemini-3.1-flash-lite";
  } else if (effectiveMode === "maps") {
    model = "gemini-4-hydrogen";
    config.tools = [{ googleMaps: {} }];
    const lat = Number(req.body?.location?.latitude);
    const lng = Number(req.body?.location?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: { latitude: lat, longitude: lng },
        },
      };
    }
  } else if (effectiveMode === "search") {
    model = "gemini-4-hydrogen";
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
      } else if (chunk?.maps?.uri && !seenUris.has(chunk.maps.uri)) {
        seenUris.add(chunk.maps.uri);
        const snippets = Array.isArray(chunk.maps.placeAnswerSources?.reviewSnippets)
          ? chunk.maps.placeAnswerSources.reviewSnippets
              .map((s) => s?.content || s?.text || "")
              .filter(Boolean)
              .slice(0, 2)
          : [];
        groundingSources.push({
          type: "maps",
          title: chunk.maps.title || "Google Maps Place",
          uri: chunk.maps.uri,
          snippets,
        });
      }
    }

    res.json({
      reply: reply || "I could not generate a response for that request. Please try rephrasing.",
      model,
      groundingMode: effectiveMode,
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
