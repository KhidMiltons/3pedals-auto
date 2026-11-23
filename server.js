import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function formatOsmAddressPart(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    // Some reverse-geocoder records append an internal ",dc" suffix to a locality.
    .replace(/,\s*dc$/i, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.split("/").map((part) => {
      if (/^[A-Z0-9]{2,4}$/.test(part)) return part;
      return part.charAt(0).toLocaleUpperCase("en") + part.slice(1).toLocaleLowerCase("en");
    }).join("/"))
    .join(" ");
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
  // Extract the place name separately from the rest of the user's instructions.
  // This prevents phrases such as "show their names and map links" being sent to Nominatim.
  const explicitArea = rawQuery.match(/\b(?:in|near|around)\s+([a-z][a-z\s-]*?)(?=[,.!?]|$)/i)?.[1] || "";
  // Stop the place-name capture before common follow-up instructions. Without
  // this, "garages in Nairobi and show map links" is sent to the geocoder as
  // "Nairobi and show map links", which can fail to resolve.
  const area = explicitArea
    .split(/\b(?:and|with|show|find|list|give|include|display|provide|return|for|that|which)\b/i)[0]
    .replace(/\b(kenya|republic of kenya)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  let center = null;
  if (area && !wantsNearMe) {
    // Try Nominatim first, then Photon if Nominatim is rate-limited or unavailable.
    try {
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
        signal: AbortSignal.timeout(7000),
      });
      if (response.ok) {
        const found = await response.json();
        const lat = Number(found?.[0]?.lat);
        const lon = Number(found?.[0]?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) center = { lat, lon };
      }
    } catch (error) {
      console.warn("Nominatim geocoding unavailable; trying Photon:", error?.message || error);
    }

    if (!center) {
      try {
        const photonUrl = new URL("https://photon.komoot.io/api/");
        photonUrl.search = new URLSearchParams({
          q: `${area}, Kenya`,
          limit: "5",
          lang: "en",
        });
        const response = await fetch(photonUrl, {
          headers: { "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)" },
          signal: AbortSignal.timeout(9000),
        });
        if (response.ok) {
          const payload = await response.json();
          const features = Array.isArray(payload?.features) ? payload.features : [];
          const match = features.find((feature) => {
            const props = feature?.properties || {};
            const coords = feature?.geometry?.coordinates || [];
            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            const country = String(props.country || "").toLowerCase();
            return country === "kenya" &&
              Number.isFinite(lat) && Number.isFinite(lon) &&
              lat >= -5.5 && lat <= 5.5 && lon >= 33.5 && lon <= 42.5;
          });
          if (match) {
            const [lon, lat] = match.geometry.coordinates.map(Number);
            center = { lat, lon };
          }
        }
      } catch (error) {
        console.warn("Photon fallback geocoding unavailable:", error?.message || error);
      }
    }

    // Stable fallback for Nairobi when public geocoders are unavailable or block Render.
    // This is the city centre, not a claimed business address; Overpass still supplies every result.
    if (!center && /^(nairobi|nairobi county|nairobi cbd)$/i.test(area)) {
      center = { lat: -1.2864, lon: 36.8172 };
      console.warn("Using the built-in Nairobi map centre because external geocoding did not respond.");
    }

    // If the user shared GPS, use it rather than failing the entire map lookup.
    if (!center && !hasLocation) {
      throw new Error("Could not locate that area using OpenStreetMap or the backup geocoder. Try a nearby neighbourhood or share your GPS location.");
    }
  }
  if (!center && hasLocation) {
    center = { lat: userLat, lon: userLng };
  }
  if (!center) center = { lat: -1.2921, lon: 36.8219 };

  // Keep the Overpass query focused: broad name searches and a 20 km radius
  // make public instances time out, especially around dense urban areas.
  const around = `around:12000,${center.lat},${center.lon}`;
  const query = `[out:json][timeout:12];(nwr["shop"="car_repair"](${around});nwr["craft"="car_repair"](${around});nwr["amenity"="vehicle_inspection"](${around});nwr["shop"="car"](${around});nwr["amenity"="fuel"](${around});nwr["shop"="tyres"](${around});nwr["shop"="car_parts"](${around});nwr["shop"="motorcycle"](${around});nwr["shop"="vehicle"](${around}););out center tags 60;`;
  let data = null;
  let lastError = null;
  // Prefer the Africa-focused extract, then use independent global instances.
  // Public Overpass endpoints are best-effort and may block or time out on some hosts.
  for (const endpoint of [
    "https://ovp.dresel.systems/api-af/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(16000),
      });
      if (!response.ok) {
        throw new Error(`Overpass returned HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (payload?.remark) {
        throw new Error(String(payload.remark).slice(0, 240));
      }
      if (!Array.isArray(payload?.elements)) {
        throw new Error("Unexpected Overpass response format.");
      }
      data = payload;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!data) {
    throw new Error(`Both OpenStreetMap search servers failed. ${lastError?.message || "Unknown Overpass error"}`);
  }
  const seen = new Set();
  const genericNames = new Set([
    "garage",
    "automotive location",
    "automotive",
    "car repair",
    "car dealership",
    "vehicle",
    "unnamed",
  ]);
  const places = (data.elements || [])
    .map((el) => {
      const tags = el.tags || {};
      const rawName = String(tags.name || tags.brand || "").trim();
      const shop = String(tags.shop || "").toLowerCase();
      const craft = String(tags.craft || "").toLowerCase();
      const amenity = String(tags.amenity || "").toLowerCase();
      let category = "";
      // Use the most specific mapped OSM tag; never infer services from the name.
      if (amenity === "fuel") {
        category = "OSM classification: fuel station (unverified)";
      } else if (shop === "tyres") {
        category = "OSM classification: tyre shop (unverified)";
      } else if (shop === "car_parts") {
        category = "OSM classification: automotive parts shop (unverified)";
      } else if (shop === "car_repair" || craft === "car_repair") {
        category = "OSM classification: car repair (unverified)";
      } else if (amenity === "vehicle_inspection") {
        category = "OSM classification: vehicle inspection (unverified)";
      } else if (shop === "motorcycle") {
        category = "OSM classification: motorcycle dealer (unverified)";
      } else if (shop === "car") {
        category = "OSM classification: car dealership or showroom (unverified)";
      } else if (shop === "vehicle") {
        category = "OSM classification: vehicle shop (unverified)";
      }
      return {
        name: rawName,
        lat: Number(el.lat ?? el.center?.lat),
        lon: Number(el.lon ?? el.center?.lon),
        address: (() => {
          // Prefer an explicit full address when the OSM mapper supplied one.
          const fullAddress = formatOsmAddressPart(tags["addr:full"]);
          const postcode = formatOsmAddressPart(tags["addr:postcode"]);
          const country = formatOsmAddressPart(tags["addr:country"]);
          const parts = fullAddress
            ? [fullAddress]
            : [
                tags["addr:housenumber"],
                tags["addr:street"],
                tags["addr:place"],
                tags["addr:suburb"] || tags["addr:neighbourhood"],
                tags["addr:hamlet"] || tags["addr:village"],
                tags["addr:city"] || tags["addr:town"] || tags["addr:municipality"] || tags["addr:district"],
                tags["addr:county"],
                tags["addr:province"],
                // Kenyan postal codes are five digits; discard malformed short values.
                /^\\d{5}$/.test(postcode) ? postcode : "",
                // OSM country values should be a country name or ISO alpha-2 code,
                // never a numeric calling code such as 254.
                /^[A-Za-z]{2}$/.test(country) || /^[A-Za-z][A-Za-z .'-]+$/.test(country) ? country : "",
              ].map(formatOsmAddressPart).filter(Boolean);
          return parts
            .map(formatOsmAddressPart)
            .filter(Boolean)
            .filter((part, index, all) => all.findIndex((item) => item.toLowerCase() === part.toLowerCase()) === index)
            .join(", ");
        })(),
        hasAddressLocality: Boolean(
          tags["addr:suburb"] || tags["addr:neighbourhood"] ||
          tags["addr:hamlet"] || tags["addr:village"] ||
          tags["addr:city"] || tags["addr:town"] || tags["addr:municipality"] ||
          tags["addr:district"] || tags["addr:county"] || tags["addr:province"]
        ),
        category,
        mapUrl: `https://www.openstreetmap.org/${encodeURIComponent(String(el.type || "node"))}/${encodeURIComponent(String(el.id || ""))}#map=19/${Number(el.lat ?? el.center?.lat)}/${Number(el.lon ?? el.center?.lon)}`,
      };
    })
    .filter((p) => {
      if (!p.name || genericNames.has(p.name.toLowerCase())) return false;
      if (!p.category || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
      const key = `${p.name.toLowerCase()}|${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);

  // Resolve missing OSM addresses only from distance-checked nearby OSM objects.
  // These are approximate nearby map references, never business-verified addresses.
  const missingAddresses = places.filter((place) => !place.address || !place.hasAddressLocality);

  // Enrich missing addresses only from nearby OpenStreetMap road and place objects.
  // Reverse-geocoder fallbacks are excluded because they do not pass the same explicit
  // distance and road-type checks. Returned references remain approximate.
  if (missingAddresses.length) {
    // Keep Overpass requests small. A single query containing many around()
    // selectors can overwhelm public instances and return HTTP 504.
    const distanceMetres = (a, b) => {
      const radians = (value) => value * Math.PI / 180;
      const dLat = radians(b.lat - a.lat);
      const dLon = radians(b.lon - a.lon);
      const value = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
      return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    };
    const endpoints = [
      "https://ovp.dresel.systems/api-af/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
    ];

    // Four business pins per request keeps each Overpass query manageable.
    for (let offset = 0; offset < missingAddresses.length; offset += 4) {
      const batch = missingAddresses.slice(offset, offset + 4);
      const selectors = batch.flatMap((place) => {
        const lat = place.lat.toFixed(6);
        const lon = place.lon.toFixed(6);
        return [
          `way["highway"]["name"](around:250,${lat},${lon});`,
          `nwr["place"~"^(neighbourhood|quarter)$"]["name"](around:350,${lat},${lon});`,
        ];
      });
      const nearbyQuery = `[out:json][timeout:10];(${selectors.join("")});out center tags;`;
      let nearbyData = null;
      let lastNearbyError = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
              "User-Agent": "3PedalsAutoKE/1.0 (https://3pedalsauto.co.ke)",
            },
            body: "data=" + encodeURIComponent(nearbyQuery),
            signal: AbortSignal.timeout(9000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          if (payload?.remark || !Array.isArray(payload?.elements)) {
            throw new Error(String(payload?.remark || "Unexpected nearby Overpass response").slice(0, 180));
          }
          nearbyData = payload;
          break;
        } catch (error) {
          lastNearbyError = error;
          console.warn("Nearby OSM enrichment endpoint failed:", endpoint, error?.message || error);
        }
      }

      if (!nearbyData) {
        console.warn("Nearby OSM enrichment skipped for this batch:", lastNearbyError?.message || "All Overpass endpoints failed");
        continue;
      }

      const candidates = nearbyData.elements.map((el) => ({
        tags: el.tags || {},
        lat: Number(el.lat ?? el.center?.lat),
        lon: Number(el.lon ?? el.center?.lon),
      })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon));

      for (const place of batch) {
        const roads = candidates
          .filter((item) => {
            const highway = String(item.tags.highway || "");
            // Major controlled-access roads and junction features are poor
            // neighbourhood references, even when they are the closest OSM way.
            return item.tags.name &&
              !/^(motorway|motorway_link|trunk|trunk_link|raceway|construction|proposed)$/i.test(highway) &&
              String(item.tags.junction || "").toLowerCase() !== "roundabout";
          })
          .map((item) => ({
            name: String(item.tags.name).trim(),
            highway: String(item.tags.highway || ""),
            distance: distanceMetres(place, item),
          }))
          .filter((item) => item.name && item.distance <= 250)
          .sort((a, b) => {
            const localRoads = new Set(["residential", "living_street", "unclassified", "service", "tertiary", "tertiary_link", "secondary", "secondary_link"]);
            const aScore = a.distance + (localRoads.has(a.highway) ? 0 : 80);
            const bScore = b.distance + (localRoads.has(b.highway) ? 0 : 80);
            return aScore - bScore;
          });
        const areas = candidates
          .filter((item) => /^(neighbourhood|quarter)$/.test(String(item.tags.place || "")) && item.tags.name)
          .map((item) => ({
            name: String(item.tags.name).trim(),
            type: String(item.tags.place || ""),
            distance: distanceMetres(place, item),
          }))
          .filter((item) => item.name && item.distance <= 350)
          // Prefer a true neighbourhood over a broader suburb when both are
          // genuinely close; distance remains the main ranking factor.
          .sort((a, b) => {
            const typePriority = { neighbourhood: 0, quarter: 1, suburb: 2 };
            const aScore = a.distance + (typePriority[a.type] * 100);
            const bScore = b.distance + (typePriority[b.type] * 100);
            return aScore - bScore;
          });
        place.nearbyStreet = place.nearbyStreet || roads[0]?.name || "";
        place.nearbyArea = areas[0]?.name || "";
      }
    }
  }


  return places;
}

app.post("/api/chat", async (req, res) => {
  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const cleanedHistory = rawMessages
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .slice(-8)
    .map((m) => ({
      role: m.role === "model" || m.role === "assistant" ? "assistant" : "user",
      content: m.text.trim().slice(0, 1600),
    }));

  if (!cleanedHistory.length) {
    return res.status(400).json({ error: "Please enter a message to start chatting." });
  }

  const lastUserMsg =
    [...cleanedHistory].reverse().find((m) => m.role === "user")?.content || "";
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
    effectiveMode = roleKey === "yard_locator" || shouldRouteToMaps(lastUserMsg) ? "maps" : "chat";
  }

  let osmPlaces = [];
  if (effectiveMode === "maps") {
    try {
      osmPlaces = await findOpenStreetMapPlaces(lastUserMsg, req.body?.location);
    } catch (error) {
      console.error("OpenStreetMap lookup failed:", error);
      return res.status(502).json({
        error: `OpenStreetMap lookup failed: ${error?.message || "Unknown error"}. Please try again shortly.`,
      });
    }
    if (osmPlaces.length) {
      const last = cleanedHistory[cleanedHistory.length - 1];
      if (last?.role === "user") {
        last.content += "\n\nOpenStreetMap place data (coverage may be incomplete; do not invent ratings or opening hours): " + JSON.stringify(osmPlaces);
      }
    }
  }

  // Maps mode returns only records actually retrieved from OpenStreetMap.
  // Do not ask the language model to invent missing businesses, addresses, ratings or approvals.
  if (effectiveMode === "maps") {
    const reply = osmPlaces.length
      ? [
          "Here are the named automotive businesses returned by OpenStreetMap. The category shown is based only on each record’s OSM tags; it does not confirm the business’s actual services. Coverage and address details may be incomplete, and OSM does not verify licensing, KEBS/KRA approval, service quality, opening hours or customer ratings.",
          "",
          ...osmPlaces.slice(0, 20).map((place, index) =>
            `${index + 1}. **${place.name}**\n   Category: ${place.category}\n   OSM-listed address: ${place.address || "Not provided in OpenStreetMap"}${place.nearbyStreet && (!place.address || !place.address.toLowerCase().replace(/[^a-z0-9]/g, "").includes(place.nearbyStreet.toLowerCase().replace(/[^a-z0-9]/g, ""))) ? `\n   Nearby mapped street (approximate, not a business address): ${formatOsmAddressPart(place.nearbyStreet)}` : ""}${place.nearbyArea && (!place.address || !place.hasAddressLocality) ? `\n   Nearby mapped neighbourhood (approximate): ${formatOsmAddressPart(place.nearbyArea)}` : ""}\n   View on OpenStreetMap: ${place.mapUrl}`
          ),
        ].join("\n\n")
      : "OpenStreetMap returned no matching automotive locations for this search area. Try a nearby neighbourhood or a broader search. I won't invent business names or locations.";
    const groundingSources = osmPlaces.slice(0, 20).map((place) => ({
      type: "osm",
      title: place.name,
      uri: place.mapUrl,
    }));
    return res.json({
      reply,
      model: "OpenStreetMap",
      groundingMode: "OpenStreetMap",
      groundingSources,
    });
  }

  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({
      error: "Groq API key is not configured. Add GROQ_API_KEY in your Render environment variables.",
    });
  }

  const model = "openai/gpt-oss-120b";
  const messages = [{ role: "system", content: systemInstruction }, ...cleanedHistory];
  const requestBody = {
    model,
    messages,
    temperature: 0.4,
    // GPT-OSS spends part of its completion budget on internal reasoning.
    // Low effort leaves more room for a visible answer on the free tier.
    reasoning_effort: "low",
    reasoning_format: "hidden",
    max_completion_tokens: 1400,
  };

  // Groq's browser_search tool replaces Gemini/Google Search grounding for Search mode.
  if (effectiveMode === "search") {
    requestBody.tools = [{ type: "browser_search" }];
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(60000),
    });

    const payload = await groqResponse.json().catch(() => ({}));
    if (!groqResponse.ok) {
      const apiMessage = payload?.error?.message || payload?.message || `Groq API request failed (${groqResponse.status}).`;
      const error = new Error(apiMessage);
      error.status = groqResponse.status;
      throw error;
    }

    const answer = payload?.choices?.[0]?.message;
    const reply = String(answer?.content || "").trim();
    const groundingSources = [];
    const seenUris = new Set();

    for (const annotation of answer?.annotations || []) {
      const citation = annotation?.url_citation || annotation?.urlCitation || annotation;
      const uri = citation?.url || citation?.uri;
      if (uri && !seenUris.has(uri)) {
        seenUris.add(uri);
        groundingSources.push({
          type: "web",
          title: citation.title || uri,
          uri,
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
    let message = err?.message || "Failed to generate response from Groq.";
    if (/invalid_api_key|authentication|unauthorized/i.test(message)) {
      message = "Groq API key was rejected. Check that GROQ_API_KEY in Render is correct and active.";
    } else if (/rate_limit|rate limit|tokens per day|requests per day/i.test(message)) {
      message = `Groq rate limit reached: ${message}`;
    }
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
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
