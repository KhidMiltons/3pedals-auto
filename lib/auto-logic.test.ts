import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const logic = require("./auto-logic.js");

const {
  MAX_RECENT_VEHICLES,
  isHybridVehicle,
  is4wdVehicle,
  matchesKeywordQuery,
  matchesPrimarySearch,
  isUnderPriceCeiling,
  recordRecentVehicleList,
  isValidEmail,
  buildNewsletterPayload,
  computeAvailableTimeSlots,
  buildCalendarMonthMatrix,
  toggleInspectionScopeItem,
  hasInspectionScopeItem,
  resolveVehicleFromCaches
} = logic;

test("keyword search matches description features like sunroof and leather", () => {
  const harrier = {
    id: "1",
    make: "Toyota",
    model: "Harrier",
    year: 2018,
    fuel: "Petrol",
    price: 3200000,
    desc: "One owner, panoramic sunroof, brown leather interior, reverse camera.",
    seller: { yard: "Nairobi Motors", location: "Kilimani" }
  };
  const vitz = {
    id: "2",
    make: "Toyota",
    model: "Vitz",
    year: 2015,
    fuel: "Petrol",
    price: 780000,
    desc: "Clean city hatch, cloth seats, economical.",
    seller: { yard: "Mombasa Rd Yard", location: "Mombasa Road" }
  };

  assert.equal(matchesKeywordQuery(harrier, "sunroof"), true);
  assert.equal(matchesKeywordQuery(harrier, "sunroof leather"), true);
  assert.equal(matchesKeywordQuery(harrier, "kilimani"), true);
  assert.equal(matchesKeywordQuery(vitz, "sunroof"), false);
  assert.equal(matchesPrimarySearch(harrier, "harrier sunroof"), true);
});

test("quick filters identify 4WD, Hybrid, and Under 1M KES vehicles accurately", () => {
  const prius = { make: "Toyota", model: "Prius", fuel: "Hybrid", price: 1450000, desc: "Self-charging hybrid" };
  const forester = { make: "Subaru", model: "Forester", fuel: "Petrol", price: 1950000, desc: "Symmetrical AWD turbo" };
  const fit = { make: "Honda", model: "Fit", fuel: "Petrol", price: 850000, desc: "Clean 2WD hatchback" };

  assert.equal(isHybridVehicle(prius), true);
  assert.equal(isHybridVehicle(fit), false);
  assert.equal(is4wdVehicle(forester), true);
  assert.equal(is4wdVehicle(fit), false);
  assert.equal(matchesKeywordQuery(forester, "4wd"), true);
  assert.equal(isUnderPriceCeiling(fit, 1000000), true);
  assert.equal(isUnderPriceCeiling(forester, 1000000), false);
});

test("recently viewed list deduplicates and caps strictly at 5 vehicles", () => {
  assert.equal(MAX_RECENT_VEHICLES, 5);
  let list = [];
  for (let i = 1; i <= 7; i++) {
    list = recordRecentVehicleList(list, {
      id: String(i),
      year: 2015 + i,
      make: "Toyota",
      model: `Model ${i}`,
      price: 1000000 + i * 100000,
      km: 50000
    });
  }
  assert.equal(list.length, 5);
  assert.deepEqual(
    list.map((x) => x.id),
    ["7", "6", "5", "4", "3"]
  );

  // Re-opening id "4" moves it to top without exceeding 5
  list = recordRecentVehicleList(list, {
    id: "4",
    title: "2019 Toyota Model 4",
    price: 1400000,
    km: 50000
  });
  assert.equal(list.length, 5);
  assert.deepEqual(
    list.map((x) => x.id),
    ["4", "7", "6", "5", "3"]
  );
});

test("weekly newsletter email validation and payload sanitization", () => {
  assert.equal(isValidEmail("driver@3pedals.co.ke"), true);
  assert.equal(isValidEmail("bad-email"), false);
  assert.equal(isValidEmail(""), false);

  const payload = buildNewsletterPayload({
    email: "  Driver@Example.com ",
    topics: ["arrivals", "drops", "unknown", "arrivals"],
    lang: "sw",
    action: "subscribe"
  });
  assert.deepEqual(payload, {
    email: "driver@example.com",
    topics: ["arrivals", "drops"],
    cadence: "weekly",
    lang: "sw",
    action: "subscribe",
    source: "footer"
  });
});

test("inspection calendar blocks Sundays, past dates, past hours, and already booked slots", () => {
  const fakeNow = new Date(2026, 4, 15, 10, 30, 0); // Fri May 15, 2026 10:30 AM
  const todaySlots = computeAvailableTimeSlots({
    dateIso: "2026-05-15",
    bookedSlots: ["12:00 PM"],
    nowDate: fakeNow
  });
  assert.equal(todaySlots.find((s) => s.slot === "09:00 AM")?.available, false);
  assert.equal(todaySlots.find((s) => s.slot === "10:00 AM")?.available, false);
  assert.equal(todaySlots.find((s) => s.slot === "11:00 AM")?.available, true);
  assert.equal(todaySlots.find((s) => s.slot === "12:00 PM")?.available, false);
  assert.equal(todaySlots.find((s) => s.slot === "12:00 PM")?.booked, true);

  // Sunday May 17, 2026 must be closed
  const sundaySlots = computeAvailableTimeSlots({ dateIso: "2026-05-17", nowDate: fakeNow });
  assert.equal(sundaySlots.every((s) => !s.available && s.reason === "sunday_closed"), true);

  const matrix = buildCalendarMonthMatrix({
    year: 2026,
    monthIndex: 4,
    minDateIso: "2026-05-15",
    bookedByDate: { "2026-05-16": ["09:00 AM", "10:00 AM"] },
    nowDate: fakeNow
  });
  const sat16 = matrix.find((c) => c.iso === "2026-05-16");
  const sun17 = matrix.find((c) => c.iso === "2026-05-17");
  assert.equal(sat16?.bookedCount, 2);
  assert.equal(sat16?.availableCount, 7);
  assert.equal(sat16?.isDisabled, false);
  assert.equal(sun17?.isSunday, true);
  assert.equal(sun17?.isDisabled, true);
});

test("inspection scope chip toggles cleanly preserve custom text without duplicates", () => {
  let scope = toggleInspectionScopeItem("", "Engine only");
  assert.equal(scope, "Engine only");
  scope = toggleInspectionScopeItem(`${scope}, Compression test`, "Paintwork check");
  assert.equal(scope, "Engine only, Compression test, Paintwork check");
  assert.equal(hasInspectionScopeItem(scope, "paintwork check"), true);
  scope = toggleInspectionScopeItem(scope, "Engine only");
  assert.equal(scope, "Compression test, Paintwork check");
});

test("resolveVehicleFromCaches hydrates cold-start vehicle rows from recently viewed fallback", () => {
  const recent = [
    {
      id: "abc-123",
      title: "2020 Toyota Harrier",
      price: 5650000,
      km: 7000,
      fuel: "Petrol",
      photo: "https://example.com/harrier.webp"
    }
  ];
  const hydrated = resolveVehicleFromCaches("abc-123", [null, recent, []]);
  assert.ok(hydrated);
  assert.equal(hydrated.make, "Toyota");
  assert.equal(hydrated.model, "Harrier");
  assert.equal(hydrated.year, 2020);
  assert.deepEqual(hydrated.photos, ["https://example.com/harrier.webp"]);
});

test("filterFaqItemsByCategory filters Inspections, Selling, General, Booking, and All", () => {
  const items = [
    { id: 1, category: "inspections" },
    { id: 2, category: "selling" },
    { id: 3, category: "general" },
    { id: 4, category: "booking" },
    { id: 5, category: "inspections" }
  ];
  assert.equal(logic.filterFaqItemsByCategory(items, "all").length, 5);
  assert.equal(logic.filterFaqItemsByCategory(items, "unknown").length, 5);
  assert.deepEqual(
    logic.filterFaqItemsByCategory(items, "Inspections").map((x: { id: number }) => x.id),
    [1, 5]
  );
  assert.deepEqual(
    logic.filterFaqItemsByCategory(items, "selling").map((x: { id: number }) => x.id),
    [2]
  );
  assert.deepEqual(
    logic.filterFaqItemsByCategory(items, "general").map((x: { id: number }) => x.id),
    [3]
  );
});

test("computeInspectionBookingProgress tracks steps and percent from 25% to 100%", () => {
  const initial = logic.computeInspectionBookingProgress({
    activeStep: "vehicle",
    scopeText: "",
    serviceType: "Pre-purchase inspection",
    date: "2026-05-16",
    timeSlot: "09:00 AM",
    name: "",
    phone: ""
  });
  // vehicle (true) + schedule (Saturday + 09:00 AM) => 2 of 4 = 50%
  assert.equal(initial.completedCount, 2);
  assert.equal(initial.percent, 50);

  const complete = logic.computeInspectionBookingProgress({
    activeStep: "details",
    scopeText: "Engine only, Paintwork check",
    serviceType: "Pre-purchase inspection",
    date: "2026-05-16",
    timeSlot: "09:00 AM",
    name: "Jane Mwangi",
    phone: "0712 345 678",
    email: "jane@example.com"
  });
  assert.equal(complete.completedCount, 4);
  assert.equal(complete.percent, 100);
  assert.equal(complete.steps[3].active, true);
});

test("validateMechanicQuestion and validateInspectionBooking return exact per-field errors", () => {
  const badMech = logic.validateMechanicQuestion({ question: "hi", phone: "123" });
  assert.equal(badMech.valid, false);
  assert.ok(badMech.errors.question);
  assert.ok(badMech.errors.phone);
  assert.equal(badMech.firstErrorField, "question");

  const goodMech = logic.validateMechanicQuestion({
    question: "Any timing chain rattle on cold start?",
    phone: "0712 345 678"
  });
  assert.equal(goodMech.valid, true);
  assert.deepEqual(goodMech.errors, {});

  const badBooking = logic.validateInspectionBooking({
    date: "2026-05-17", // Sunday
    minDate: "2026-05-15",
    slotAvailable: false,
    timeSlot: "",
    name: "A",
    phone: "071",
    email: "not-an-email"
  });
  assert.equal(badBooking.valid, false);
  assert.ok(badBooking.errors.date);
  assert.ok(badBooking.errors.timeSlot);
  assert.ok(badBooking.errors.name);
  assert.ok(badBooking.errors.phone);
  assert.ok(badBooking.errors.email);
  assert.equal(badBooking.firstErrorField, "date");

  const goodBooking = logic.validateInspectionBooking({
    date: "2026-05-16",
    minDate: "2026-05-15",
    slotAvailable: true,
    timeSlot: "10:00 AM",
    name: "Jane Mwangi",
    phone: "0712345678",
    email: ""
  });
  assert.equal(goodBooking.valid, true);
  assert.equal(goodBooking.firstErrorField, null);
});

test("computeVehicleDocumentInspectionProgress tracks header fields, 12 checks, and summary", () => {
  const initial = logic.computeVehicleDocumentInspectionProgress({
    registration: "",
    vehicle: "",
    date: "2026-11-28",
    inspector: "",
    checks: new Array(12).fill("Not checked"),
    notes: new Array(12).fill(""),
    roadTest: "Not performed",
    limitations: ""
  });
  assert.equal(initial.completedCount, 1);
  assert.equal(initial.totalCount, 17);
  assert.equal(initial.percent, 6);
  assert.equal(initial.isComplete, false);

  const partial = logic.computeVehicleDocumentInspectionProgress({
    registration: "KDM 421X",
    vehicle: "2019 Toyota Harrier",
    date: "2026-11-28",
    inspector: "Alex Otieno",
    checks: ["Good at time of inspection", "Not checked", "Attention required", ...new Array(9).fill("Not checked")],
    notes: ["", "Minor belt squeak", ...new Array(10).fill("")],
    roadTest: "Not performed"
  });
  assert.equal(partial.detailsDone, 4);
  assert.equal(partial.checksDone, 3);
  assert.equal(partial.completedCount, 7);
  assert.equal(partial.percent, 41);

  const complete = logic.computeVehicleDocumentInspectionProgress({
    registration: "KDM 421X",
    vehicle: "2019 Toyota Harrier",
    date: "2026-11-28",
    inspector: "Alex Otieno",
    checks: new Array(12).fill("Good at time of inspection"),
    notes: new Array(12).fill(""),
    roadTest: "Performed"
  });
  assert.equal(complete.completedCount, 17);
  assert.equal(complete.percent, 100);
  assert.equal(complete.isComplete, true);
});


