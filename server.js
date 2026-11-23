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

const FAST_MODE_INSTRUCTIONS = [
  "Fast mode does not perform live web research or consult a verified vehicle database. Never claim or imply that you checked current classifieds, dealer stock, official databases, manufacturer catalogues, service bulletins, owner reports, or live prices unless relevant evidence was supplied in this conversation. Never invent sources, citations, listing counts, research dates, or observations.",
  "Use a strict conservative output policy. Accuracy is more important than completeness or sounding authoritative. Do not fill requested comparison-table cells merely to make the table look complete. It is acceptable and preferred to say 'Not verified for this exact variant' or 'I cannot establish this reliably in Fast mode.'",
  "For vehicle-specific technical specifications, do not state an engine code, generation, chassis/model code, trim, transmission, drivetrain, timing-chain/belt configuration, official power figure, service interval, or test-cycle fuel-economy figure unless the exact fact is explicitly supported by reliable source material included in the conversation. Model year plus engine size is not enough to establish an exact variant. Never infer a code from displacement or transfer specifications between markets or generations.",
  "For automotive comparisons where exact vehicle identity or specifications are not documented in the conversation, use this response structure: (1) 'Variant identification' — say what cannot be verified and request the chassis/model code or engine code; (2) 'Not verified' — list only the requested technical items that cannot be established; (3) 'Practical checks' — give general pre-purchase inspection checks without presenting them as known model-specific defects; (4) 'Next step' — recommend Search mode or manufacturer documentation for sourced specifications and current prices. Do not create a table headed 'Confirmed', 'Verified', 'Factory specifications', or 'Official figures'.",
  "Do not invent or assume common faults, rust patterns, component lifespans, mileage thresholds, maintenance schedules, parts prices, or service costs. Distinguish routine wear items from documented model-specific defects. If a model-specific weakness is not supported by evidence in the conversation, do not attribute it to that model.",
  "Do not provide precise or narrow numerical claims for Kenyan used-car prices, maintenance costs, component life, or real-world fuel consumption without evidence. Do not label any fuel-economy figure WLTP, NEDC, JC08, EPA, or another test cycle unless that cycle is documented for the exact market and variant in the conversation. If no basis is available, say a dependable figure cannot be established in Fast mode.",
  "Do not use labels such as 'confirmed fact', 'verified', 'manufacturer-backed', 'factory data', 'official', or 'based on owner reports' unless the supporting source is present in the conversation and directly supports that claim. Do not imply that a claim is verified merely because it sounds plausible or is commonly repeated online.",
  "For general used-car inspection advice, give qualitative checks only unless a source for the exact vehicle or current Kenyan rule is available. Never invent mileage thresholds, component wear limits, brake-disc thickness limits, tyre legal limits, service intervals, repair prices, or failure-after-X-kilometres claims. State that brake/disc wear must be compared with the manufacturer's minimum specification and that tyre legal limits must be checked against current Kenyan requirements; do not supply a universal number. Do not present MOT stickers, KRA clearance certificates, import declarations, or any named document as universally required for every private used-car sale. Distinguish identity/ownership checks from import-tax paperwork, and advise verifying the applicable documents and transfer process through NTSA/KRA or a qualified professional before payment.",
  "When correcting a previous answer, independently reassess each claim. Do not automatically accept a user's correction and do not replace one unsupported precise claim with another. Explicitly withdraw unsupported claims and preserve uncertainty.",
  "Check model-year and vehicle-age calculations against the current date. Keep the response concise and practical. For current Kenyan legal, tax, import, registration, safety requirements, or live market prices, explain that Fast mode cannot verify them and recommend Search mode for current official-source research."
].join(" ");

const SEARCH_MODE_INSTRUCTIONS = [
  "Search mode must perform live web research for factual, current, jurisdiction-specific questions. Do not answer a current legal, tax, import, registration, safety, pricing, or policy question from memory alone.",
  "Use primary sources first: the responsible government authority, current legislation or gazetted legal notice, regulator standards and official notices. For Kenya vehicle matters, prioritize KRA for customs/tax, KEBS for standards and import inspection, and NTSA for registration/ownership. Use secondary sources only for context, never to override a current primary source.",
  "Verify that each source directly supports the specific claim. Check the source's publication/effective date, jurisdiction, vehicle class, fuel/powertrain, engine-capacity band and whether it is a final rule, draft, archived page, FAQ, notice or guidance. A source about special-purpose vehicles must not be used to establish a rule for ordinary passenger cars. A draft standard must not be described as binding law unless adoption and commencement are confirmed.",
  "For Kenyan used-vehicle imports, distinguish the age limit measured from year of first registration from any separate manufacture-to-first-registration condition. Do not infer the latter from a draft or unrelated notice; state it only if a currently effective official source establishes it. Do not calculate eligibility from model year alone when first-registration evidence is required.",
  "For taxes and levies, identify the current rate, tax base and calculation order separately. Do not invent or infer a tax formula from a list of rates. Check for newer KRA procedures, Finance Act changes, gazetted amendments and effective dates. If an older KRA FAQ conflicts with a newer KRA procedure or notice, show the conflict, identify which source is newer and more directly applicable, and advise confirmation with KRA or a licensed clearing agent before payment. Never silently combine rates from different dates.",
  "For vehicle inspection in Kenya, distinguish pre-export/pre-shipment inspection in the country of supply from destination inspection after arrival. Do not claim every used vehicle receives a mandatory post-arrival port inspection unless a current KEBS rule expressly says so. Check the current KEBS PVoC Manual for country-specific routes and conditional destination-inspection cases, including missing or invalid CoC/CoR situations.",
  "When a KEBS document is labelled draft, DKS, draft for comments, template or public-review draft, do not describe its provisions as binding requirements. Verify formal adoption, publication/gazettement and commencement before treating it as law. In particular, do not apply proposed manufacture-year/first-registration-year conditions from a draft KS 1515 revision to an importer as an enforceable rule without confirmation that it has come into force.",
  "Do not state that no newer draft, notice or standard exists unless the search actually checked current KEBS publications and can cite the results. Absence of a search result is not proof that no draft exists.",
  "For import documents, distinguish documents KRA says should be attached 'including but not limited to' from an exhaustive mandatory checklist. Do not invent requirements or describe an implied payment receipt, certificate of origin, Certificate of Conformity, logbook, inspection certificate or PIN document as universally required unless a current official source explicitly applies it to the vehicle and import route. Check stated exceptions, including rules that may treat used motor vehicles differently.",
  "Do not invent inspection fees, processing timelines, contact details, penalties, exemptions, tax rates, CRSP values or valuation formulas. If an amount is not published in a reliable current source, say it is not verified rather than estimating.",
  "Attach a clickable link to an actual official source for every material legal, tax, technical or numerical claim. Use only URLs and source titles actually returned by live search or opened official pages. A citation marker without a usable source link is not enough for a binding legal claim. Never invent URLs, titles, quotations, line numbers, publication dates, manual sections, document names or citations. If the official source cannot be opened or its relevant wording cannot be checked, say 'not verified' and do not state the detail as a binding rule.",
  "For standards, manuals and notices, verify the exact document version, publication date, scope and relevant clause from the document itself. Do not infer a vehicle-specific rule from a general-goods manual, a document that expressly excludes motor vehicles, a special-purpose vehicle notice, or a search snippet. Never invent a clause number or paraphrase a clause that has not been checked.",
  "For Kenya used-vehicle inspection, distinguish PVoC/pre-export inspection, vehicle-specific roadworthiness certification, and destination inspection. Check the current KEBS vehicle-specific instructions and the exporting country's assigned inspection contractor. Do not generalize destination-inspection triggers or exemptions from general goods rules to used motor vehicles. If the current official sources do not establish the exact trigger for a vehicle's origin and certificate status, state that it needs confirmation with KEBS rather than inventing a CoC/CoR or logbook rule.",
  "For tax rates and tax bases, verify each independently against current legislation or official KRA material. Do not claim that a page lists a tax base next to a rate unless it explicitly does. If KRA pages show different rates or tax bases, display the exact conflict with links and dates; do not assume the page with the newer update date automatically supersedes legislation or a gazetted amendment. Avoid a numerical tax calculation until the applicable rate, base and order are verified.",
  "For age limits, if official KRA pages differ between manufacture year and first-registration year, explicitly disclose both wordings and their dates. Do not resolve the conflict by calling one page authoritative or superseding the other unless an official legal instrument establishes that hierarchy. Do not calculate a definitive eligible registration year while the measurement rule remains disputed.",
  "When calculating a strict 'less than N years' calendar-year limit, show the arithmetic and check it: eligible first-registration year must satisfy import year minus first-registration year < N. For an eight-year limit, 2026 requires 2019 or later; 2028 requires 2021 or later. Do not confuse 'not more than eight years' with 'less than eight years', and do not include the boundary year that makes the difference equal to eight.",
  "Never infer an exemption from one legal obligation from an exemption under a different obligation. In particular, an import-duty exemption for ambulances or hearses does not establish an exemption from the RHD requirement, age limit, KEBS conformity assessment or registration rules. State an RHD exception only when a current official source explicitly grants that exception to that vehicle class.",
  "Read the scope clause of every manual before applying it. A manual titled 'General Goods' that expressly excludes motor vehicles cannot establish destination-inspection rules, exemptions or triggers for used passenger cars. Do not reverse an exclusion into an exception (for example, do not claim motor vehicles are covered only when no PVoC provider exists unless a separate vehicle-specific official rule expressly says so).",
  "Do not state that a destination-inspection trigger is limited to a particular missing certificate, country or provider unless a current vehicle-specific KEBS rule explicitly identifies that trigger. If a general-goods manual excludes motor vehicles and no vehicle-specific rule is located, state that the exact destination-inspection position for the vehicle is not established by that manual and requires confirmation from KEBS. Crucially, an exclusion from a manual's scope does NOT prove that no destination inspection is required under a separate vehicle-specific rule, and it does NOT establish a missing-PVoC exception.",
  "A source's exclusion, silence or lack of a listed trigger is not affirmative proof of an exemption. Do not conclude 'therefore no inspection is required', 'only if...' or 'provided that...' unless a current vehicle-specific legal or regulatory source expressly supports that conclusion. Distinguish 'not established by the source checked' from 'not required by law'.",
  "Do not claim that a particular RHD exception exists based on an annex or notice unless you verify that the provision is final, currently effective, applies to the exact vehicle category and expressly exempts that category from the RHD rule. Diplomatic, special-purpose, military, ambulance or hearse provisions must not be generalized to ordinary private passenger-car imports. If scope or legal effect is unclear, list the exception as unverified, not as a binding rule.",
  "Do not relabel a roadworthiness inspection, PVoC verification, Certificate of Conformity, Pre-Export Verification certificate or Pre-Shipment Inspection Certificate as another document. Use the exact name used by the applicable official source and explain whether it is an inspection, certificate or clearance document. Do not claim that one certificate is mandatory for every used vehicle unless the current vehicle-specific rule says so.",
  "Source metadata discipline: state a publication, revision, update or effective date only when that exact date appears on the official page or document actually checked. Never infer a 2026 update date from the current year, search date or page availability. Do not invent annex numbers, line numbers, clause numbers, page references or document titles. Do not say 'no newer notice exists' unless current official publications were actually searched and the relevant search results are linked.",
  "In the final answer, provide actual clickable Markdown links using only the exact official URLs returned by live search or opened official sources. Do not present bare browser citation tokens such as '【1†L27-L28】' as the only source reference, and do not fabricate a URL to make a citation clickable. If the search system supplies a citation marker but no verifiable URL, explicitly say that a clickable official source could not be confirmed.",
  "Do not end with a blanket statement such as 'all statements are directly supported' unless every material statement has been checked against a directly linked source. Prefer a brief 'Confirmed / not established / requires confirmation' distinction over an unsupported declaration of certainty.",
  "For documents, preserve qualifying language such as 'including but not limited to'. Do not turn an illustrative list into an exhaustive checklist, and do not add documents to a source's list while claiming that source explicitly enumerates them.", 
  "When official sources conflict or are incomplete, explain exactly what conflicts, cite both sources, compare their dates and scope, and do not present a disputed point as settled. Separate confirmed requirements, calculations based on stated assumptions, and items requiring confirmation.",
  "Before finishing, check that every requested section has been answered, the response is not cut off, and all figures and documents have supporting sources. Prefer a concise complete answer over a long answer that ends mid-sentence.",
  "Search response length control: answer the exact question first. Normally use no more than 4 short sections and about 6-10 concise bullets total. Avoid repeating the same rule in the summary, explanation and conclusion. Do not add generic background, lengthy introductions, duplicated caveats, or an unsolicited checklist. Include only the most relevant verified sources, grouped beside the claims they support.",
  "For a broad or multi-part request, prioritize all essential answers over exhaustive detail: state the confirmed rule, its scope/effective date, the key exception or conflict, and the practical next step. Put unresolved details in a brief 'Not verified' note rather than expanding into speculative explanation. Never omit a requested part merely to meet a length target.",
  "Do not create extra numbered sections beyond those needed to answer the user's request. End with a complete sentence; if evidence is insufficient, say what could not be verified instead of filling space.",
  "Correction priority for legal/import answers: do not present an unresolved point as a binding rule. Use the labels \"Confirmed by the source checked\", \"Not established by the source checked\" and \"Requires confirmation\" where appropriate. A lack of evidence is not a legal exemption or proof that an obligation does not apply.",
  "RHD rule: state the ordinary passenger-car RHD requirement only to the extent the current applicable official source supports it. Do not list diplomatic, ambulance, hearse, special-purpose or other exemptions unless a final, currently effective official provision explicitly exempts that exact class from the RHD requirement. If the evidence is only a draft, say it is a draft and do not describe the exemption as current law. Never contradict this distinction in the summary.",
  "Destination inspection: never conclude that a used motor vehicle is exempt from destination inspection merely because a general-goods manual excludes motor vehicles. Never conclude that a valid PVoC certificate automatically removes all destination inspection, or that a missing/invalid certificate requires a new PVoC, unless a current vehicle-specific KEBS rule explicitly says so. If no vehicle-specific rule establishes the process for the vehicle origin and certificate status, state that the destination-inspection position and next procedure are not established by the source checked and require written confirmation from KEBS.",
  "Tax bases and order: report each levy rate separately from its tax base. For every rate, identify the exact applicable statutory/KRA provision supporting the base and calculation order. Do not infer CIF/customs value, VAT-inclusive bases, or a formula from a rate table or a source that merely lists percentages. If a base or order is not explicitly supported, mark that element not verified and do not calculate a total import-tax figure.",
  "Import documents: preserve the exact scope and qualifying words in KRA lists, including \"including but not limited to\". Do not say that a document is not required for customs merely because another authority uses it after clearance, and do not say a list is exhaustive unless the official source says it is. Separate documents expressly listed by KRA, documents required by KEBS for conformity assessment, and documents required by NTSA for registration; if the legal stage or necessity is unclear, mark it for confirmation rather than reclassifying it.",
  "Source integrity: do not invent or normalize source titles, dates, version numbers, quoted text, line references, links or legal effect. Include a publication/effective date only when visible on the actual official source. Link directly to the exact official page or document actually checked. If you cannot provide a verifiable clickable official link for a material claim, do not present that claim as confirmed. Never use a bare citation token as a substitute for a source link.",
  "Consistency check before sending: compare the main answer, table, comments/conflicts and summary. Remove any contradiction—for example, never call an exemption both binding and draft-only. Do not claim \"no conflict\" or \"no newer guidance\" unless current official sources were actually checked. If the response is long, shorten it without dropping any requested question, and ensure the final sentence and every table row are complete."
].join(" ");

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

function shouldUseFastVehicleSafetyFallback(text) {
  const value = String(text || "");
  const hasModelYear = /\b(?:19|20)\d{2}\b/.test(value);
  const asksVehicleSpecs =
    /\b(engine code|engine type|timing (?:chain|belt|system)|fuel (?:economy|consumption)|consumption|fuel efficiency|horsepower|\bhp\b|\bkw\b|transmission|gearbox|generation|chassis|specifications?|maintenance (?:cost|interval|concern)|common faults|used[- ]car price|market price|compare|comparison)\b/i.test(value);
  return hasModelYear && asksVehicleSpecs;
}

function shouldUseFastInspectionSafetyFallback(text) {
  const value = String(text || "");
  const asksInspectionAdvice =
    /\b(inspect|inspection|checklist|pre[- ]purchase|what should i check|what should i look for)\b/i.test(value);
  const aboutUsedCar =
    /\b(used[- ]car|second[- ]hand car|buying a car|buy a car|before buying|before i buy)\b/i.test(value);
  return asksInspectionAdvice && aboutUsedCar;
}

function buildFastInspectionSafetyReply(lang) {
  if (lang === "sw") {
    return [
      "**Orodha ya ukaguzi wa gari lililotumika**",
      "",
      "- **Umiliki na nyaraka:** linganisha VIN/chassis na namba ya injini kwenye gari na nyaraka. Thibitisha mmiliki na uhamisho kupitia njia rasmi za NTSA kabla ya kulipa. Nyaraka za uagizaji hutegemea historia ya gari; usidhani kila gari linahitaji hati zilezile.",
      "- **Mwili na chassis:** tafuta mapengo yasiyo sawa, rangi isiyolingana, welds, filler, dalili za ajali na kutu, hasa chini ya gari na sehemu za kubeba mzigo.",
      "- **Injini na fluids:** sikiliza cold start, angalia moshi usio wa kawaida, uvujaji wa mafuta au coolant, na dalili za kuchanganyika kwa fluids. Usihitimishe hali ya timing chain/belt kwa kuangalia sehemu inayoonekana pekee.",
      "- **Cooling system:** kagua radiator, hoses, coolant na dalili za overheating. Fundi athibitishe mfumo wa feni na thermostat kulingana na muundo wa gari.",
      "- **Gearbox na clutch:** jaribu gia zote na uangalie kuchelewa, kuteleza, vibration, grinding au sauti zisizo za kawaida.",
      "- **Brakes, steering na suspension:** angalia pulling, vibration, clunks, leaks na braking isiyo sawa. Fundi alinganishe brake/disc wear na kiwango cha mtengenezaji; usitumie kipimo kimoja kwa magari yote.",
      "- **Tyres na umeme:** tafuta uchakavu usio sawa, nyufa na bulges; jaribu taa, AC, madirisha, locks na dashboard warnings.",
      "- **Test drive na mileage:** endesha kwenye mazingira tofauti inapowezekana. Linganisha odometer na service records na hali ya gari; mileage pekee si uthibitisho.",
      "",
      "**Kabla ya kusaini au kulipa:** pata ukaguzi huru wa fundi, andika kasoro na pata makadirio ya maandishi ya gharama za matengenezo. Thibitisha mahitaji ya sasa ya kisheria na nyaraka husika kupitia NTSA/KRA; Fast mode haiwezi kuthibitisha sheria au viwango vya sasa.",
      "",
      "Usitumie namba za jumla za unene wa brake discs, kina cha tyre, mileage ya hitilafu au gharama za matengenezo bila specification ya gari au chanzo cha sasa."
    ].join("\n\n");
  }
  return [
    "**Used-car inspection checklist**",
    "",
    "- **Ownership and documents:** match the VIN/chassis and engine number on the vehicle to its documents. Verify the seller's ownership and the official NTSA transfer process before paying. Import paperwork depends on the vehicle's history; do not assume the same documents apply to every sale.",
    "- **Body and chassis:** look for uneven panel gaps, mismatched paint, welds, filler, signs of collision repair and corrosion, especially underneath and around structural mounting points.",
    "- **Engine and fluids:** listen to a cold start; check for unusual smoke, oil or coolant leaks, and signs of fluid contamination. Do not infer timing-chain or belt condition from a visible glance alone.",
    "- **Cooling system:** inspect the radiator, hoses, coolant and signs of overheating. Have a mechanic check fan and thermostat operation for that vehicle.",
    "- **Transmission and clutch:** test all gears and watch for delayed engagement, slipping, shudder, grinding or abnormal noises.",
    "- **Brakes, steering and suspension:** check for pulling, vibration, clunks, leaks and uneven braking. Have a mechanic compare disc/pad wear with the manufacturer's specification; there is no single disc-thickness limit for every car.",
    "- **Tyres and electrical systems:** look for uneven wear, cracks and bulges; test lights, air conditioning, windows, locks and dashboard warnings.",
    "- **Test drive and mileage:** drive in varied conditions where safe. Compare the odometer with service records and the vehicle's condition; mileage alone is not proof.",
    "",
    "**Before signing or paying:** arrange an independent mechanical inspection, document defects and obtain written repair estimates. Verify the current legal requirements and applicable paperwork through NTSA/KRA; Fast mode cannot confirm current rules.",
    "",
    "Do not rely on universal brake-disc thickness, tyre-depth, failure-mileage or repair-cost figures without the exact vehicle specification or a current source."
  ].join("\n\n");
}

function buildFastVehicleSafetyReply(lang) {
  if (lang === "sw") {
    return [
      "Siwezi kuthibitisha kwa usahihi vipimo vya gari hili katika Fast mode. Mwaka wa kutengenezwa na ukubwa wa injini pekee havitoshi kutambua toleo halisi, hasa kwa magari yaliyoagizwa kutoka masoko tofauti.",
      "",
      "**Taarifa zinazohitaji uthibitisho:** engine code, generation/chassis code, mfumo wa timing chain au belt, transmission, nguvu ya injini, takwimu rasmi za matumizi ya mafuta, na bei ya sasa Kenya. Sitakisia taarifa hizi.",
      "",
      "**Ukaguzi wa jumla kabla ya kununua:** thibitisha VIN/chassis na engine number kwenye gari na nyaraka; kagua historia ya service; fanya cold start na uchunguzi wa uvujaji; kagua gearbox, suspension, brakes, tyres, body repairs na kutu; pata ukaguzi huru wa fundi na uthibitisho wa umiliki.",
      "",
      "**Hatua inayofuata:** tumia Search mode kwa vyanzo vya mtengenezaji na bei za sasa. Ukiwa na chassis/model code au engine code kutoka kwenye logbook/plate, itasaidia kutambua toleo husika."
    ].join("\n\n");
  }
  return [
    "I can't reliably verify this exact vehicle variant in Fast mode. Model year and engine size alone are not enough to identify the correct specification, especially for imported vehicles that may come from different markets.",
    "",
    "**Not verified here:** engine code, generation/chassis code, timing-chain or belt configuration, transmission, engine output, official fuel-economy test figures, model-specific faults and current Kenyan market prices. I won't guess these details.",
    "",
    "**General pre-purchase checks:** match the VIN/chassis and engine number to the vehicle documents; review service records; inspect a cold start and check for leaks; test the gearbox; inspect suspension, brakes, tyres, body repairs and corrosion; and arrange an independent mechanical inspection and ownership verification.",
    "",
    "**Next step:** use Search mode for manufacturer documentation and current Kenyan listings. A chassis/model code or engine code from the vehicle plate or logbook will help identify the exact variant."
  ].join("\n\n");
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
  const query = `[out:json][timeout:12];(nwr["shop"="car_repair"](${around});nwr["craft"="car_repair"](${around});nwr["amenity"="vehicle_inspection"](${around});nwr["shop"="car"](${around});nwr["amenity"="fuel"](${around});nwr["shop"="tyres"](${around});nwr["shop"="car_parts"](${around});nwr["shop"="motorcycle"](${around});nwr["shop"="vehicle"](${around}););out center tags 120;`;
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
          const fullAddress = formatOsmAddressPart(tags["addr:full"]).replace(/\bP\.?\s*O\.?\s*Box\b[^,]*/i, "").replace(/\s*,\s*,/g, ",").replace(/^[,\s]+|[,\s]+$/g, "");
          const postcode = formatOsmAddressPart(tags["addr:postcode"]);
          const country = formatOsmAddressPart(tags["addr:country"]);
          const parts = (fullAddress
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
                /^\d{5}$/.test(postcode) ? postcode : "",
                /^[A-Za-z]{2}$/.test(country) || /^[A-Za-z][A-Za-z .'-]+$/.test(country) ? country : "",
              ])
            .map(formatOsmAddressPart)
            .filter(Boolean)
            // Postal-box text is contact/mailing information, not a street address.
            .filter((part) => !/\bP\.?\s*O\.?\s*Box\b/i.test(part));
          return parts.reduce((clean, part) => {
            const normalizeAddress = (value) => value.toLowerCase().replace(/\brd\b/g, "road").replace(/\bst\b/g, "street").replace(/[^a-z0-9]/g, "");
            const normalized = normalizeAddress(part);
            if (!normalized) return clean;
            const overlaps = clean.some((existing) => {
              const prior = normalizeAddress(existing);
              return prior === normalized || prior.includes(normalized) || normalized.includes(prior);
            });
            if (!overlaps) clean.push(part);
            return clean;
          }, []).join(", ");
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
    });

  // Balance the visible sample across OSM categories instead of allowing one
  // common category (often fuel stations) to occupy every result slot.
  const categoryBuckets = new Map();
  for (const place of places) {
    if (!categoryBuckets.has(place.category)) categoryBuckets.set(place.category, []);
    categoryBuckets.get(place.category).push(place);
  }
  const balancedPlaces = [];
  const categoryQueues = [...categoryBuckets.values()];
  while (balancedPlaces.length < 30 && categoryQueues.some((queue) => queue.length)) {
    for (const queue of categoryQueues) {
      if (queue.length && balancedPlaces.length < 30) balancedPlaces.push(queue.shift());
    }
  }
  places.length = 0;
  places.push(...balancedPlaces);

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
  const modeInstruction = requestedMode === "fast" ? FAST_MODE_INSTRUCTIONS : requestedMode === "search" ? SEARCH_MODE_INSTRUCTIONS : "";
  const currentDate = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const systemInstruction = `${baseInstruction}${langInstruction} Current date in Kenya: ${currentDate}. ${modeInstruction}`;

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

  // For year-specific vehicle specification or price questions, fail closed in Fast mode.
  // Fast mode has no verified specification database or live search, so returning a model-generated
  // comparison here would risk presenting plausible but unsupported details as facts.
  if (requestedMode === "fast" && shouldUseFastVehicleSafetyFallback(lastUserMsg)) {
    return res.json({
      reply: buildFastVehicleSafetyReply(lang),
      model: "3 Pedals Auto safety check",
      groundingMode: "fast",
      groundingSources: [],
    });
  }

  // General used-car inspection questions receive a conservative checklist.
  // This prevents unsupported universal wear limits, mileage thresholds and legal-document claims.
  if (requestedMode === "fast" && shouldUseFastInspectionSafetyFallback(lastUserMsg)) {
    return res.json({
      reply: buildFastInspectionSafetyReply(lang),
      model: "3 Pedals Auto safety check",
      groundingMode: "fast",
      groundingSources: [],
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
    temperature: requestedMode === "fast" ? 0.1 : 0.4,
    // GPT-OSS spends part of its completion budget on internal reasoning.
    // Low effort leaves more room for a visible answer on the free tier.
    reasoning_effort: "low",
    reasoning_format: "hidden",
    max_completion_tokens: effectiveMode === "search" ? 1800 : 1400,
  };

  // Groq's browser_search tool replaces Gemini/Google Search grounding for Search mode.
  if (effectiveMode === "search") {
    requestBody.tools = [{ type: "browser_search" }];
    // Search mode is explicitly a research mode: require the browser tool to run.
    requestBody.tool_choice = "required";
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

    const choice = payload?.choices?.[0];
    const answer = choice?.message;
    const reply = String(answer?.content || "").trim();

    // Log response metadata only. Never log prompts, generated content or API credentials.
    const usage = payload?.usage || {};
    console.info("Groq completion diagnostics:", {
      mode: effectiveMode,
      finishReason: choice?.finish_reason || "not provided",
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      hasToolCalls: Array.isArray(answer?.tool_calls) && answer.tool_calls.length > 0,
      hasContent: Boolean(reply),
    });

    if (choice?.finish_reason === "length") {
      console.warn("Groq completion stopped at the configured token limit.", {
        mode: effectiveMode,
        completionTokens: usage.completion_tokens ?? null,
      });
    }

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

    const finalReply = reply || "I could not generate a response for that request. Please try rephrasing.";
    const hasInlineCitations = /【\s*\d+\s*†[^】]*】/.test(finalReply);
    const hasMarkdownSourceLinks = /\[[^\]]+\]\(https?:\/\/[^)]+\)/i.test(finalReply);
    const searchReply = effectiveMode === "search" && groundingSources.length === 0 && !hasMarkdownSourceLinks
      ? `${finalReply}\n\n**Source verification warning:** Search mode did not return verifiable source metadata or clickable source links. Citation markers alone are not sufficient. Treat specific rates, legal requirements, dates and numerical claims as unverified until checked against the relevant official authority.`
      : finalReply;

    res.json({
      reply: searchReply,
      model,
      groundingMode: effectiveMode,
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
