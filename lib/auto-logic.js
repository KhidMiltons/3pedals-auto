(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ThreePedalsLogic = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MAX_RECENT_VEHICLES = 5;

  function normalizeTokens(query) {
    return String(query || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }

  function isHybridVehicle(car) {
    if (!car) return false;
    const text = `${car.fuel || ""} ${car.make || ""} ${car.model || ""} ${car.desc || car.description || ""}`;
    return /\b(hybrid|e-power|epower|e:hev|phev)\b/i.test(text);
  }

  function is4wdVehicle(car) {
    if (!car) return false;
    const text = `${car.make || ""} ${car.model || ""} ${car.fuel || ""} ${car.desc || car.description || ""}`;
    if (/\b(4wd|4x4|awd|all[- ]wheel|four[- ]wheel|quattro|xdrive|4matic|symmetrical)\b/i.test(text)) {
      return true;
    }
    if (/\b(2wd|two[- ]wheel|fwd)\b/i.test(text)) {
      return false;
    }
    return /\b(land\s*cruiser|prado|hilux|fortuner|pajero|forester|defender|wrangler|discovery|patrol|range\s*rover)\b/i.test(
      text
    );
  }

  function buildVehicleSearchCorpus(car) {
    if (!car) return "";
    const seller = car.seller || {};
    const derivedTags = [];
    if (isHybridVehicle(car)) derivedTags.push("hybrid");
    if (is4wdVehicle(car)) derivedTags.push("4wd awd 4x4");
    if (car.garageChecked) derivedTags.push("inspected checked 3p garage");
    return [
      car.year,
      car.make,
      car.model,
      car.fuel,
      car.desc,
      car.description,
      seller.yard,
      seller.location,
      seller.name,
      derivedTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function matchesKeywordQuery(car, query) {
    const tokens = normalizeTokens(query);
    if (!tokens.length) return true;
    const corpus = buildVehicleSearchCorpus(car);
    return tokens.every((token) => corpus.includes(token));
  }

  function matchesPrimarySearch(car, query) {
    const tokens = normalizeTokens(query);
    if (!tokens.length) return true;
    const corpus = buildVehicleSearchCorpus(car);
    return tokens.every((token) => corpus.includes(token));
  }

  function isUnderPriceCeiling(car, ceiling) {
    const price = Number(car?.price || 0);
    return Number.isFinite(price) && price >= 0 && price <= Number(ceiling || 0);
  }

  function recordRecentVehicleList(existingList, item, limit = MAX_RECENT_VEHICLES) {
    if (!item || !item.id) return Array.isArray(existingList) ? existingList.slice(0, limit) : [];
    const cap = Math.max(1, Number(limit) || MAX_RECENT_VEHICLES);
    const entry = {
      id: String(item.id),
      title: String(
        item.title || `${item.year || ""} ${item.make || ""} ${item.model || ""}`.trim() || "Vehicle"
      ),
      price: Number(item.price || 0),
      km: Number(item.km || 0),
      fuel: String(item.fuel || ""),
      photo: String(item.photo || ""),
      viewedAt: Number(item.viewedAt || Date.now())
    };
    const safeExisting = Array.isArray(existingList) ? existingList.filter((x) => x && x.id) : [];
    return [entry, ...safeExisting.filter((x) => String(x.id) !== entry.id)].slice(0, cap);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || "").trim());
  }

  function buildNewsletterPayload({ email, topics, lang, action = "subscribe" }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const allowedTopics = new Set(["arrivals", "duty", "drops"]);
    const cleanTopics = Array.isArray(topics)
      ? topics.map((x) => String(x || "").trim().toLowerCase()).filter((x) => allowedTopics.has(x))
      : [];
    return {
      email: cleanEmail,
      topics: cleanTopics.length ? Array.from(new Set(cleanTopics)) : ["arrivals"],
      cadence: "weekly",
      lang: lang === "sw" ? "sw" : "en",
      action: action === "unsubscribe" ? "unsubscribe" : "subscribe",
      source: "footer"
    };
  }

  return {
    MAX_RECENT_VEHICLES,
    normalizeTokens,
    isHybridVehicle,
    is4wdVehicle,
    buildVehicleSearchCorpus,
    matchesKeywordQuery,
    matchesPrimarySearch,
    isUnderPriceCeiling,
    recordRecentVehicleList,
    isValidEmail,
    buildNewsletterPayload
  };
});
