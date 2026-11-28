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
    const photos = Array.isArray(item.photos)
      ? item.photos.filter((p) => typeof p === "string" && p.trim()).slice(0, 4)
      : item.photo
        ? [String(item.photo)]
        : [];
    const entry = {
      id: String(item.id),
      title: String(
        item.title || `${item.year || ""} ${item.make || ""} ${item.model || ""}`.trim() || "Vehicle"
      ),
      make: item.make ? String(item.make) : "",
      model: item.model ? String(item.model) : "",
      year: item.year ? item.year : "",
      price: Number(item.price || 0),
      km: Number(item.km || 0),
      fuel: String(item.fuel || ""),
      desc: String(item.desc ?? item.description ?? "").slice(0, 500),
      photo: String(item.photo || photos[0] || ""),
      photos,
      seller: item.seller && typeof item.seller === "object"
        ? {
            type: String(item.seller.type || ""),
            name: String(item.seller.name || ""),
            yard: String(item.seller.yard || ""),
            location: String(item.seller.location || ""),
            phone: String(item.seller.phone || ""),
            whatsapp: String(item.seller.whatsapp || ""),
            email: String(item.seller.email || ""),
            web: String(item.seller.web || ""),
            contact: String(item.seller.contact || ""),
            logo: String(item.seller.logo || "")
          }
        : undefined,
      status: String(item.status || "approved"),
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

  const INSPECTION_TIME_SLOTS = [
    "08:00 AM",
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM"
  ];

  const INSPECTION_SCOPE_PRESETS = [
    "Engine only",
    "Full chassis",
    "Paintwork check",
    "OBD-II & Electronics",
    "Suspension & Brakes",
    "Road test"
  ];

  function toIsoDateString(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function parseIsoDateParts(iso) {
    const m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    const check = new Date(year, monthIndex, day);
    if (
      !Number.isFinite(check.getTime()) ||
      check.getFullYear() !== year ||
      check.getMonth() !== monthIndex ||
      check.getDate() !== day
    ) {
      return null;
    }
    return { year, monthIndex, day, dayOfWeek: check.getDay() };
  }

  function parseTimeSlotHour24(slot) {
    const m = String(slot || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return -1;
    let hour = Number(m[1]);
    const ampm = m[3].toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return hour;
  }

  function normalizeSlotKey(slot) {
    return String(slot || "").trim().replace(/\s+/g, " ").toUpperCase();
  }

  function computeAvailableTimeSlots({ dateIso, bookedSlots = [], nowDate = new Date() } = {}) {
    const parts = parseIsoDateParts(dateIso);
    const todayIso = toIsoDateString(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const bookedSet = new Set(
      (Array.isArray(bookedSlots) ? bookedSlots : Array.from(bookedSlots || [])).map(normalizeSlotKey)
    );
    const isSunday = parts ? parts.dayOfWeek === 0 : false;
    const isPastDate = !parts || dateIso < todayIso;
    const isToday = Boolean(parts && dateIso === todayIso);
    const currentHour = nowDate.getHours();

    return INSPECTION_TIME_SLOTS.map((slot) => {
      const hour24 = parseTimeSlotHour24(slot);
      const booked = bookedSet.has(normalizeSlotKey(slot));
      const pastCutoff = isToday && hour24 <= currentHour;
      const closed = isSunday || isPastDate;
      const available = !closed && !booked && !pastCutoff;
      let reason = "available";
      if (isSunday) reason = "sunday_closed";
      else if (isPastDate) reason = "past_date";
      else if (booked) reason = "booked";
      else if (pastCutoff) reason = "past_hour";
      return { slot, available, booked, pastCutoff, reason };
    });
  }

  function buildCalendarMonthMatrix({
    year,
    monthIndex,
    minDateIso,
    bookedByDate = {},
    nowDate = new Date()
  }) {
    const todayIso = toIsoDateString(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const minIso = minDateIso || todayIso;
    const firstOfMonth = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    // Monday-first grid: Monday=0 .. Sunday=6
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const cells = [];

    for (let i = 0; i < 42; i++) {
      const dayNumber = i - startOffset + 1;
      const d = new Date(year, monthIndex, dayNumber);
      const cellYear = d.getFullYear();
      const cellMonth = d.getMonth();
      const cellDay = d.getDate();
      const iso = toIsoDateString(cellYear, cellMonth, cellDay);
      const inMonth = cellMonth === monthIndex && dayNumber >= 1 && dayNumber <= daysInMonth;
      const isSunday = d.getDay() === 0;
      const isPast = iso < minIso;
      const isToday = iso === todayIso;
      const rawBooked = bookedByDate && bookedByDate[iso];
      const bookedList = Array.isArray(rawBooked)
        ? rawBooked
        : rawBooked instanceof Set
          ? Array.from(rawBooked)
          : [];
      const slotStates = inMonth && !isSunday && !isPast
        ? computeAvailableTimeSlots({ dateIso: iso, bookedSlots: bookedList, nowDate })
        : [];
      const availableCount = slotStates.filter((s) => s.available).length;
      const bookedCount = bookedList.length;
      const isDisabled = !inMonth || isSunday || isPast || availableCount === 0;
      cells.push({
        iso,
        day: cellDay,
        inMonth,
        isSunday,
        isPast,
        isToday,
        bookedCount,
        availableCount,
        totalSlots: INSPECTION_TIME_SLOTS.length,
        isDisabled
      });
    }

    // Trim trailing row if entire 6th row is outside current month
    const lastWeekInMonth = cells.slice(35).some((c) => c.inMonth);
    return lastWeekInMonth ? cells : cells.slice(0, 35);
  }

  function parseInspectionScopeList(text) {
    const parts = String(text || "")
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const part of parts) {
      const key = part.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(part);
      }
    }
    return out;
  }

  function hasInspectionScopeItem(text, item) {
    const target = String(item || "").trim().toLowerCase();
    if (!target) return false;
    return parseInspectionScopeList(text).some((p) => p.toLowerCase() === target);
  }

  function toggleInspectionScopeItem(text, item) {
    const clean = String(item || "").trim();
    if (!clean) return parseInspectionScopeList(text).join(", ");
    const target = clean.toLowerCase();
    const current = parseInspectionScopeList(text);
    const exists = current.some((p) => p.toLowerCase() === target);
    const next = exists
      ? current.filter((p) => p.toLowerCase() !== target)
      : [...current, clean];
    return next.join(", ");
  }

  function buildVehicleCacheRow(raw) {
    if (!raw || !raw.id) return null;
    const seller = raw.seller && typeof raw.seller === "object" ? raw.seller : {};
    let make = String(raw.make || "").trim();
    let model = String(raw.model || "").trim();
    let year = raw.year || "";
    if ((!make || !model) && raw.title) {
      const titleParts = String(raw.title).trim().split(/\s+/);
      if (!year && /^\d{4}$/.test(titleParts[0] || "")) {
        year = Number(titleParts.shift());
      }
      if (!make && titleParts.length) make = titleParts.shift() || "";
      if (!model && titleParts.length) model = titleParts.join(" ");
    }
    const photos = Array.isArray(raw.photos) && raw.photos.length
      ? raw.photos.filter((p) => typeof p === "string" && p.trim())
      : raw.photo
        ? [String(raw.photo)]
        : [];
    const sellerType = raw.seller_type || seller.type || (raw.yard_name || seller.yard ? "yard" : "private");
    return {
      id: String(raw.id),
      make: make || "Vehicle",
      model,
      year,
      price: Number(raw.price || 0),
      km: Number(raw.km || 0),
      fuel: String(raw.fuel || ""),
      description: String(raw.description ?? raw.desc ?? ""),
      photos,
      whatsapp: raw.whatsapp || seller.whatsapp || "",
      seller_name: raw.seller_name || seller.name || "",
      seller_phone: raw.seller_phone || raw.phone || seller.phone || "",
      seller_email: raw.seller_email || raw.email || seller.email || "",
      yard_name: raw.yard_name || seller.yard || (sellerType === "yard" ? seller.name || "" : ""),
      yard_location: raw.yard_location || raw.location || seller.location || "",
      yard_web: raw.yard_web || raw.web || seller.web || "",
      yard_logo_url: raw.yard_logo_url || raw.seller_logo_url || seller.logo || "",
      contact: raw.contact || seller.contact || "",
      seller_type: sellerType,
      status: String(raw.status || "approved")
    };
  }

  function resolveVehicleFromCaches(id, candidateLists) {
    const targetId = String(id || "").trim();
    if (!targetId) return null;
    for (const candidate of candidateLists || []) {
      if (!candidate) continue;
      if (Array.isArray(candidate)) {
        const hit = candidate.find((item) => item && String(item.id) === targetId);
        if (hit) return buildVehicleCacheRow(hit);
      } else if (typeof candidate === "object") {
        const row = candidate.row && candidate.row.id ? candidate.row : candidate;
        if (row && String(row.id) === targetId) return buildVehicleCacheRow(row);
      }
    }
    return null;
  }

  const FAQ_CATEGORIES = ["all", "inspections", "selling", "general", "booking"];
  const INSPECTION_BOOKING_STEPS = ["vehicle", "scope", "schedule", "details"];

  function normalizeFaqCategory(category) {
    const clean = String(category || "").trim().toLowerCase();
    return FAQ_CATEGORIES.includes(clean) ? clean : "all";
  }

  function filterFaqItemsByCategory(items, category) {
    const list = Array.isArray(items) ? items : [];
    const target = normalizeFaqCategory(category);
    if (target === "all") return list.slice();
    return list.filter((item) => normalizeFaqCategory(item && item.category) === target);
  }

  function computeInspectionBookingProgress({
    activeStep = "vehicle",
    scopeText = "",
    serviceType = "Pre-purchase inspection",
    date = "",
    timeSlot = "",
    name = "",
    phone = "",
    email = ""
  } = {}) {
    const stepOrder = INSPECTION_BOOKING_STEPS;
    const normalizedActive = stepOrder.includes(activeStep) ? activeStep : "vehicle";
    const activeIndex = stepOrder.indexOf(normalizedActive);

    const hasScope = Boolean(String(serviceType || "").trim() && String(scopeText || "").trim());
    const dateParts = parseIsoDateParts(date);
    const hasSchedule = Boolean(dateParts && dateParts.dayOfWeek !== 0 && String(timeSlot || "").trim());
    const cleanEmail = String(email || "").trim();
    const hasDetails = Boolean(
      String(name || "").trim().length >= 2 &&
      String(phone || "").replace(/\D/g, "").length >= 9 &&
      (!cleanEmail || isValidEmail(cleanEmail))
    );

    const completedMap = {
      vehicle: true,
      scope: hasScope,
      schedule: hasSchedule,
      details: hasDetails
    };

    const steps = stepOrder.map((key, index) => ({
      key,
      index,
      completed: Boolean(completedMap[key]),
      active: key === normalizedActive
    }));
    const completedCount = steps.filter((s) => s.completed).length;
    const percent = Math.round((completedCount / stepOrder.length) * 100);

    return {
      steps,
      activeStep: normalizedActive,
      activeIndex,
      completedCount,
      totalCount: stepOrder.length,
      percent
    };
  }

  function validateMechanicQuestion({ question = "", phone = "", lang = "en" } = {}) {
    const sw = lang === "sw";
    const q = String(question || "").trim();
    const digits = String(phone || "").replace(/\D/g, "");
    const errors = {};

    if (!q) {
      errors.question = sw
        ? "Andika swali lako la kiufundi kabla ya kutuma."
        : "Please enter your technical question before sending.";
    } else if (q.length < 5) {
      errors.question = sw
        ? "Swali ni fupi sana — andika walau herufi 5 ili mekanika aelewe cha kukagua."
        : "Your question is too short — add at least 5 characters so our mechanic knows what to check.";
    }

    if (!digits) {
      errors.phone = sw
        ? "Weka namba ya simu au WhatsApp ili mekanika akujibu."
        : "Enter a phone or WhatsApp number so our mechanic can reply.";
    } else if (digits.length < 9) {
      errors.phone = sw
        ? "Namba ya simu lazima iwe na tarakimu zisizopungua 9 (mf. 0712 345 678)."
        : "Phone number must have at least 9 digits (e.g. 0712 345 678).";
    }

    const firstErrorField = errors.question ? "question" : errors.phone ? "phone" : null;
    return {
      valid: !firstErrorField,
      errors,
      firstErrorField
    };
  }

  function validateInspectionBooking({
    date = "",
    minDate = "",
    slotAvailable = true,
    timeSlot = "",
    name = "",
    phone = "",
    email = "",
    lang = "en"
  } = {}) {
    const sw = lang === "sw";
    const errors = {};
    const dateParts = parseIsoDateParts(date);

    if (!date || !dateParts) {
      errors.date = sw
        ? "Tafadhali chagua tarehe halali kwenye kalenda."
        : "Select a valid inspection date on the calendar.";
    } else if (minDate && date < minDate) {
      errors.date = sw
        ? "Tarehe iliyochaguliwa imepita — chagua kuanzia leo au siku zijazo."
        : "That date is in the past — choose today or an upcoming day.";
    } else if (dateParts.dayOfWeek === 0) {
      errors.date = sw
        ? "Gereji imefungwa Jumapili — tafadhali chagua Jumatatu hadi Jumamosi."
        : "The workshop is closed on Sundays — pick Monday through Saturday.";
    }

    if (!String(timeSlot || "").trim()) {
      errors.timeSlot = sw
        ? "Chagua muda wa ukaguzi unaopatikana hapo juu."
        : "Select one of the open time slots above.";
    } else if (!slotAvailable) {
      errors.timeSlot = sw
        ? "Muda huo tayari umejaa au umepita — chagua nafasi nyingine iliyo wazi."
        : "That time slot is already booked or passed — choose another open slot.";
    }

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      errors.name = sw
        ? "Weka jina lako kamili ili tuandae fomu ya miadi."
        : "Enter your full name for the booking confirmation.";
    } else if (cleanName.length < 2) {
      errors.name = sw
        ? "Jina linahitaji walau herufi 2."
        : "Name must be at least 2 characters long.";
    }

    const phoneDigits = String(phone || "").replace(/\D/g, "");
    if (!phoneDigits) {
      errors.phone = sw
        ? "Weka namba yako ya simu au WhatsApp kwa uthibitisho."
        : "Enter your phone or WhatsApp number for booking confirmation.";
    } else if (phoneDigits.length < 9) {
      errors.phone = sw
        ? "Namba ya simu ina tarakimu chache — weka walau tarakimu 9 (mf. 0712 345 678)."
        : "Phone number is incomplete — enter at least 9 digits (e.g. 0712 345 678).";
    }

    const cleanEmail = String(email || "").trim();
    if (cleanEmail && !isValidEmail(cleanEmail)) {
      errors.email = sw
        ? "Barua pepe si sahihi — hakiki mfano you@example.com au acha wazi."
        : "Email format looks invalid (e.g. you@example.com), or leave it blank.";
    }

    const order = ["date", "timeSlot", "name", "phone", "email"];
    const firstErrorField = order.find((k) => Boolean(errors[k])) || null;
    return {
      valid: !firstErrorField,
      errors,
      firstErrorField
    };
  }

  function computeVehicleDocumentInspectionProgress({
    registration = "",
    vehicle = "",
    date = "",
    inspector = "",
    checks = [],
    notes = [],
    roadTest = "Not performed",
    limitations = "",
    totalCheckAreas = 12
  } = {}) {
    const clean = (v) => String(v || "").trim();
    const headerFields = [registration, vehicle, date, inspector];
    const detailsDone = headerFields.filter((v) => clean(v).length > 0).length;
    const detailsTotal = headerFields.length;

    const checksArr = Array.isArray(checks) ? checks : [];
    const notesArr = Array.isArray(notes) ? notes : [];
    const checksTotal = Math.max(1, Number(totalCheckAreas) || checksArr.length || 12);
    let checksDone = 0;
    for (let i = 0; i < checksTotal; i++) {
      const val = clean(checksArr[i]);
      const note = clean(notesArr[i]);
      if ((val && val.toLowerCase() !== "not checked") || note.length > 0) {
        checksDone += 1;
      }
    }

    const roadClean = clean(roadTest);
    const summaryDone = (roadClean.length > 0 && roadClean.toLowerCase() !== "not performed") || clean(limitations).length > 0;
    const summaryTotal = 1;

    const totalCount = detailsTotal + checksTotal + summaryTotal;
    const completedCount = detailsDone + checksDone + (summaryDone ? 1 : 0);
    const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;

    return {
      completedCount,
      totalCount,
      percent,
      detailsDone,
      detailsTotal,
      checksDone,
      checksTotal,
      summaryDone,
      summaryTotal,
      isComplete: completedCount >= totalCount
    };
  }

  return {
    MAX_RECENT_VEHICLES,
    INSPECTION_TIME_SLOTS,
    INSPECTION_SCOPE_PRESETS,
    FAQ_CATEGORIES,
    INSPECTION_BOOKING_STEPS,
    normalizeTokens,
    isHybridVehicle,
    is4wdVehicle,
    buildVehicleSearchCorpus,
    matchesKeywordQuery,
    matchesPrimarySearch,
    isUnderPriceCeiling,
    recordRecentVehicleList,
    isValidEmail,
    buildNewsletterPayload,
    toIsoDateString,
    parseIsoDateParts,
    parseTimeSlotHour24,
    computeAvailableTimeSlots,
    buildCalendarMonthMatrix,
    parseInspectionScopeList,
    hasInspectionScopeItem,
    toggleInspectionScopeItem,
    buildVehicleCacheRow,
    resolveVehicleFromCaches,
    normalizeFaqCategory,
    filterFaqItemsByCategory,
    computeInspectionBookingProgress,
    validateMechanicQuestion,
    validateInspectionBooking,
    computeVehicleDocumentInspectionProgress
  };
});
