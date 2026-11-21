/* 3 Pedals Auto KE — Garage Bookings, Chauffeur Hire (Bookings, Fleet, Drivers) & Mechanics */
(() => {
  "use strict";

  const A = window.ThreePedalsAdmin;
  if (!A) return;
  const {
    $,
    esc,
    safeUrl,
    moneyKES,
    fmtDate,
    waNumber,
    debounce,
    statusClass,
    state,
    showNotice,
    toast,
    confirm,
    openDrawer,
    closeDrawer,
    openPrintSheet,
    downloadCsv,
    recordAdminAudit,
    markDirty,
    sb,
  } = A;

  const PAGE_SIZE = 25;
  let garagePage = 1;
  let garagePreset = "all";
  let chauffeurPage = 1;
  let activeChauffeurTab = "bookings";
  let fleetEditingVehicle = null;
  let currentMechanicPhotoUrl = "";

  const SERVICE_PROGRESS_STEPS = [
    ["new", "New request"],
    ["checked_in", "Checked in"],
    ["diagnosing", "Diagnosing"],
    ["awaiting_parts", "Awaiting parts"],
    ["in_progress", "In progress"],
    ["ready_for_pickup", "Ready for pickup"],
    ["completed", "Completed"],
    ["cancelled", "Cancelled"],
  ];

  const CHAUFFEUR_STATUSES = [
    ["pending_approval", "Pending approval"],
    ["approved_awaiting_payment", "Awaiting payment"],
    ["confirmed", "Confirmed"],
    ["declined", "Declined"],
    ["cancelled", "Cancelled"],
    ["completed", "Completed"],
  ];

  function toLocalDateStr(isoOrDate) {
    if (!isoOrDate) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(isoOrDate))) return String(isoOrDate);
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  }

  function isGarageOpen(b) {
    const st = String(b.status || "").toLowerCase();
    const prog = String(b.service_status || "").toLowerCase();
    return !["done", "cancelled"].includes(st) && !["completed", "cancelled"].includes(prog);
  }

  function isGarageOverdue(b) {
    if (!b.date || !isGarageOpen(b)) return false;
    const due = new Date(`${b.date}T23:59:59+03:00`);
    return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
  }

  /* =========================================================
     1. GARAGE BOOKINGS
     ========================================================= */
  function getFilteredGarageBookings() {
    const q = String($("garageBookingSearch")?.value || "").trim().toLowerCase();
    const status = $("garageBookingStatus")?.value || "all";
    const date = $("garageBookingDate")?.value || "";

    return state.garageBookings.filter((b) => {
      if (status !== "all" && String(b.status || "").toLowerCase() !== status) return false;
      if (date && toLocalDateStr(b.date) !== date) return false;
      if (garagePreset === "unassigned" && (b.mechanic_id || !isGarageOpen(b))) return false;
      if (garagePreset === "overdue" && !isGarageOverdue(b)) return false;
      if (garagePreset === "roadside" && b.request_type !== "roadside") return false;
      if (!q) return true;
      return [b.ref, b.name, b.phone, b.car, b.service, b.location, b.details]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  function updateGarageCompletedBtn() {
    const btn = $("clearCompletedBookings");
    if (!btn) return;
    const count = state.garageBookings.filter(
      (x) =>
        String(x.status || "").toLowerCase() === "done" ||
        String(x.service_status || "").toLowerCase() === "completed"
    ).length;
    btn.disabled = count === 0;
    btn.textContent = `Clear completed (${count})`;
  }

  function mechanicSelectOptions(selectedId) {
    const active = state.mechanics.filter((m) => m.active !== false || String(m.id) === String(selectedId));
    return [
      `<option value="">Unassigned mechanic</option>`,
      ...active.map(
        (m) =>
          `<option value="${esc(m.id)}" ${
            String(m.id) === String(selectedId || "") ? "selected" : ""
          }>${esc(m.name)}${m.specialty ? ` (${esc(m.specialty)})` : ""}${
            m.active === false ? " · Inactive" : ""
          }</option>`
      ),
    ].join("");
  }

  function renderGarageBookings() {
    const box = $("bookingList");
    if (!box) return;
    updateGarageCompletedBtn();

    const filtered = getFilteredGarageBookings();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (garagePage > totalPages) garagePage = totalPages;
    const startIdx = (garagePage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    if ($("garageBookingCount")) {
      $("garageBookingCount").textContent = `Showing ${pageItems.length} of ${filtered.length} (${state.garageBookings.length} total)`;
    }

    if (!filtered.length) {
      box.innerHTML = `<div class="empty">${
        state.garageBookings.length
          ? "No garage bookings match your current filters."
          : "No garage bookings have been submitted yet."
      }</div>`;
      $("bookingsPagination")?.classList.add("hidden");
      return;
    }

    box.innerHTML = pageItems
      .map((b) => {
        const id = esc(b.id);
        const mech = state.mechanics.find((m) => String(m.id) === String(b.mechanic_id));
        const st = String(b.status || "new").toLowerCase();
        const prog = String(b.service_status || "new").toLowerCase();
        const overdue = isGarageOverdue(b);
        const waDigits = waNumber(b.phone);
        const waHref = waDigits
          ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
              `Hello ${b.name || ""}, regarding your 3 Pedals Garage booking ${b.ref || ""} (${b.service || "Service"}).`
            )}`
          : "";

        return `
        <article class="listing" data-garage-card="${id}">
          <div class="summary">
            <div class="vehicle" style="min-width:0;flex:1">
              <div class="meta-line" style="margin-bottom:4px">
                <span class="mono">${esc(b.ref || "NO-REF")}</span>
                <span class="sep">·</span>
                <span>${b.request_type === "roadside" ? "Mobile mechanic" : "Workshop service"}</span>
                ${overdue ? `<span class="sep">·</span><span style="color:var(--ad-bad);font-weight:700">Overdue</span>` : ""}
              </div>
              <h3>${esc(b.service || "Garage service")} — ${esc(b.name || "Customer")}</h3>
              <div class="meta-line">
                <span>${esc(b.car || "Vehicle not specified")}</span><span class="sep">·</span>
                <span>${esc(b.date || "Date TBD")}${b.time_slot ? ` (${esc(b.time_slot)})` : ""}</span><span class="sep">·</span>
                <span>${esc(b.phone || "No phone")}</span>
                ${b.location ? `<span class="sep">·</span><span>${esc(b.location)}</span>` : ""}
              </div>
              <div class="actions" style="margin-top:8px">
                <span class="status ${esc(statusClass(st))}">${esc(st.replaceAll("_", " "))}</span>
                <span class="status ${esc(statusClass(prog))}">${esc(prog.replaceAll("_", " "))}</span>
                <span class="meta">${mech ? `Assigned: ${esc(mech.name)}` : "Needs mechanic"}</span>
              </div>
            </div>
            <div class="actions">
              <button type="button" class="ghost" data-garage-drawer="${id}">Quick edit</button>
              <button type="button" class="ghost" data-print-garage="${id}">Job sheet</button>
              ${waHref ? `<a class="ghost" href="${esc(waHref)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
            </div>
          </div>
          <div class="details" style="display:block">
            ${b.details ? `<p class="meta" style="margin:0 0 12px;white-space:pre-wrap"><strong>Notes:</strong> ${esc(b.details)}</p>` : ""}
            <div class="editor-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));align-items:end">
              <div>
                <label for="gb-st-${id}">Booking status</label>
                <select id="gb-st-${id}" data-gb-status="${id}">
                  ${["new", "confirmed", "done", "cancelled"]
                    .map(
                      (s) =>
                        `<option value="${s}" ${st === s ? "selected" : ""}>${
                          s[0].toUpperCase() + s.slice(1)
                        }</option>`
                    )
                    .join("")}
                </select>
              </div>
              <div>
                <label for="gb-prog-${id}">Service progress</label>
                <select id="gb-prog-${id}" data-gb-progress="${id}">
                  ${SERVICE_PROGRESS_STEPS.map(
                    ([val, label]) =>
                      `<option value="${val}" ${prog === val ? "selected" : ""}>${label}</option>`
                  ).join("")}
                </select>
              </div>
              <div>
                <label for="gb-mech-${id}">Assigned mechanic</label>
                <select id="gb-mech-${id}" data-gb-mech="${id}">${mechanicSelectOptions(b.mechanic_id)}</select>
              </div>
            </div>
            <div class="actions" style="margin-top:12px">
              <button type="button" class="primary" data-save-garage="${id}">Save booking update</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    const pag = $("bookingsPagination");
    if (pag) {
      if (totalPages > 1) {
        pag.classList.remove("hidden");
        pag.innerHTML = `
          <span class="meta">Page ${garagePage} of ${totalPages} · ${filtered.length} bookings</span>
          <div class="actions">
            <button type="button" class="ghost" data-garage-page="${garagePage - 1}" ${
          garagePage <= 1 ? "disabled" : ""
        }>Previous</button>
            <button type="button" class="ghost" data-garage-page="${garagePage + 1}" ${
          garagePage >= totalPages ? "disabled" : ""
        }>Next</button>
          </div>`;
      } else {
        pag.classList.add("hidden");
      }
    }
  }

  async function saveGarageBookingUpdate(id, overrides = null) {
    const current = state.garageBookings.find((b) => String(b.id) === String(id));
    if (!current) return false;

    const status =
      overrides?.status ?? document.querySelector(`[data-gb-status="${id}"]`)?.value ?? current.status;
    const service_status =
      overrides?.service_status ??
      document.querySelector(`[data-gb-progress="${id}"]`)?.value ??
      current.service_status;
    const mechRaw =
      overrides?.mechanic_id !== undefined
        ? overrides.mechanic_id
        : document.querySelector(`[data-gb-mech="${id}"]`)?.value ?? current.mechanic_id;
    const mechanic_id = mechRaw ? mechRaw : null;

    if (mechanic_id) {
      const m = state.mechanics.find((x) => String(x.id) === String(mechanic_id));
      if (!m || (m.active === false && String(current.mechanic_id) !== String(mechanic_id))) {
        showNotice("Selected mechanic is inactive. Choose an active mechanic.", "err");
        return false;
      }
      if (current.date && current.time_slot) {
        const conflict = state.garageBookings.find(
          (other) =>
            String(other.id) !== String(id) &&
            String(other.mechanic_id) === String(mechanic_id) &&
            other.date === current.date &&
            other.time_slot === current.time_slot &&
            isGarageOpen(other)
        );
        if (conflict) {
          const proceed = await confirm({
            eyebrow: "SCHEDULE OVERLAP",
            title: "Mechanic has another booking in this slot",
            message: `${m.name} is already assigned to ${conflict.ref || "another job"} (${conflict.car || "Vehicle"}) on ${current.date} at ${current.time_slot}. Assign anyway?`,
            confirmText: "Assign anyway",
          });
          if (!proceed) return false;
        }
      }
    }

    const { error } = await sb
      .from("bookings")
      .update({ status, service_status, mechanic_id })
      .eq("id", id);

    if (error) {
      showNotice("Could not update garage booking: " + error.message, "err");
      return false;
    }

    const mechName = state.mechanics.find((m) => String(m.id) === String(mechanic_id))?.name || "Unassigned";
    await recordAdminAudit(
      "update_garage_booking",
      "garage_booking",
      id,
      `Updated ${current.ref || id} → status: ${status}, progress: ${service_status}, mechanic: ${mechName}`
    );

    toast(`Garage booking ${current.ref || ""} saved.`, "ok");
    await loadBookings({ silent: true });
    window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    window.ThreePedalsAdminRequests?.loadRequestsInbox?.({ silent: true });
    return true;
  }

  function printGarageJobSheet(id) {
    const b = state.garageBookings.find((x) => String(x.id) === String(id));
    if (!b) return;
    const mech = state.mechanics.find((m) => String(m.id) === String(b.mechanic_id));
    openPrintSheet(
      `Garage Job Sheet · ${b.ref || "Ticket"}`,
      `${b.service || "Service"} — ${b.car || "Vehicle"}`,
      [
        ["Ticket Reference", b.ref || "—"],
        ["Request Type", b.request_type === "roadside" ? "Mobile Mechanic / Roadside" : "Workshop Service"],
        ["Customer Name", b.name || "—"],
        ["Customer Phone", b.phone || "—"],
        ["Vehicle", b.car || "—"],
        ["Service Requested", b.service || "—"],
        ["Preferred Date & Slot", [b.date, b.time_slot].filter(Boolean).join(" · ") || "—"],
        ["Location", b.location || "Workshop"],
        ["Booking Status", b.status || "new"],
        ["Service Progress", (b.service_status || "new").replaceAll("_", " ")],
        ["Assigned Mechanic", mech ? `${mech.name}${mech.phone ? " (" + mech.phone + ")" : ""}` : "Unassigned"],
        ["Customer Notes", b.details || "None"],
        ["Submitted At", fmtDate(b.created_at)],
      ]
    );
  }

  async function openGarageDrawer(id) {
    if (!state.mechanics.length && sb) {
      const { data } = await sb.from("mechanics").select("*").order("name");
      if (data) state.mechanics = data;
    }
    const b = state.garageBookings.find((x) => String(x.id) === String(id));
    if (!b) return;
    const st = String(b.status || "new").toLowerCase();
    const prog = String(b.service_status || "new").toLowerCase();
    const waDigits = waNumber(b.phone);

    openDrawer({
      eyebrow: "Quick triage · Garage booking",
      title: `${b.ref || "Ticket"} · ${b.name || "Customer"}`,
      subtitle: `${b.service || "Garage service"} · ${b.car || "Vehicle"}`,
      bodyHtml: `
        <div class="fields" style="margin-bottom:14px">
          <div class="field"><strong>Phone</strong>${esc(b.phone || "—")}</div>
          <div class="field"><strong>Date &amp; Slot</strong>${esc([b.date, b.time_slot].filter(Boolean).join(" · ") || "TBD")}</div>
          <div class="field"><strong>Type</strong>${b.request_type === "roadside" ? "Mobile mechanic" : "Workshop"}</div>
          <div class="field"><strong>Location</strong>${esc(b.location || "Workshop")}</div>
        </div>
        ${
          b.details
            ? `<div class="field" style="margin-bottom:14px"><strong>Notes</strong><div class="desc">${esc(b.details)}</div></div>`
            : ""
        }
        <form id="drawerGarageForm">
          <label for="dgStatus">Booking status</label>
          <select id="dgStatus">
            ${["new", "confirmed", "done", "cancelled"]
              .map((s) => `<option value="${s}" ${st === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
          <label for="dgProgress">Service progress</label>
          <select id="dgProgress">
            ${SERVICE_PROGRESS_STEPS.map(
              ([v, lbl]) => `<option value="${v}" ${prog === v ? "selected" : ""}>${lbl}</option>`
            ).join("")}
          </select>
          <label for="dgMechanic">Assigned mechanic</label>
          <select id="dgMechanic">${mechanicSelectOptions(b.mechanic_id)}</select>
          <div class="editor-actions">
            <button type="submit" class="primary" id="dgSaveBtn">Save garage update</button>
          </div>
        </form>`,
      footerHtml: `
        <button type="button" class="ghost" id="dgPrintBtn">Job sheet / PDF</button>
        ${
          waDigits
            ? `<a class="ghost" href="https://wa.me/${esc(waDigits)}" target="_blank" rel="noopener">Message WhatsApp</a>`
            : ""
        }`,
      onMount: (drawer) => {
        drawer.querySelector("#dgPrintBtn")?.addEventListener("click", () => printGarageJobSheet(b.id));
        drawer.querySelector("#drawerGarageForm")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const btn = drawer.querySelector("#dgSaveBtn");
          if (btn) btn.disabled = true;
          const ok = await saveGarageBookingUpdate(b.id, {
            status: drawer.querySelector("#dgStatus")?.value,
            service_status: drawer.querySelector("#dgProgress")?.value,
            mechanic_id: drawer.querySelector("#dgMechanic")?.value || null,
          });
          if (btn) btn.disabled = false;
          if (ok) closeDrawer();
        });
      },
    });
  }

  async function loadBookings(opts = {}) {
    if (!sb) return;
    if (!opts.silent && $("bookingList")) {
      $("bookingList").innerHTML = '<div class="empty">Loading garage bookings…</div>';
    }
    const [bRes, mRes] = await Promise.all([
      sb.from("bookings").select("*").order("created_at", { ascending: false }),
      sb.from("mechanics").select("*").order("name"),
    ]);
    if (bRes.error) {
      showNotice("Could not load garage bookings: " + bRes.error.message, "err");
      return;
    }
    state.garageBookings = bRes.data || [];
    if (!mRes.error && mRes.data) state.mechanics = mRes.data;
    if (!state.garageInitialLoaded) {
      state.seenGarageIds = new Set(state.garageBookings.map((x) => String(x.id)));
      state.garageInitialLoaded = true;
    }
    renderGarageBookings();
  }

  $("refreshBookings")?.addEventListener("click", () => loadBookings());
  $("garageBookingSearch")?.addEventListener(
    "input",
    debounce(() => {
      garagePage = 1;
      renderGarageBookings();
    }, 150)
  );
  $("garageBookingStatus")?.addEventListener("change", () => {
    garagePage = 1;
    renderGarageBookings();
  });
  $("garageBookingDate")?.addEventListener("change", () => {
    garagePage = 1;
    renderGarageBookings();
  });

  document.querySelectorAll("[data-garage-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      garagePreset = btn.dataset.garagePreset || "all";
      garagePage = 1;
      document
        .querySelectorAll("[data-garage-preset]")
        .forEach((b) => b.classList.toggle("active", b === btn));
      renderGarageBookings();
    });
  });

  $("bookingList")?.addEventListener("click", async (e) => {
    const drawerBtn = e.target.closest("[data-garage-drawer]");
    if (drawerBtn) {
      await openGarageDrawer(drawerBtn.dataset.garageDrawer);
      return;
    }
    const printBtn = e.target.closest("[data-print-garage]");
    if (printBtn) {
      printGarageJobSheet(printBtn.dataset.printGarage);
      return;
    }
    const saveBtn = e.target.closest("[data-save-garage]");
    if (saveBtn) {
      saveBtn.disabled = true;
      await saveGarageBookingUpdate(saveBtn.dataset.saveGarage);
      if (saveBtn.isConnected) saveBtn.disabled = false;
    }
  });

  $("bookingsPagination")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-garage-page]");
    if (!btn || btn.disabled) return;
    garagePage = Number(btn.dataset.garagePage) || 1;
    renderGarageBookings();
    $("bookingsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("exportGarageBookings")?.addEventListener("click", () => {
    const list = getFilteredGarageBookings();
    const headers = [
      "Reference",
      "Type",
      "Customer",
      "Phone",
      "Vehicle",
      "Service",
      "Preferred date",
      "Time slot",
      "Location",
      "Status",
      "Service progress",
      "Assigned mechanic",
      "Details",
      "Created at",
    ];
    downloadCsv(
      `3pedals-garage-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      list.map((b) => [
        b.ref,
        b.request_type === "roadside" ? "Mobile mechanic" : "Workshop",
        b.name,
        b.phone,
        b.car,
        b.service,
        b.date,
        b.time_slot,
        b.location,
        b.status,
        b.service_status,
        state.mechanics.find((m) => String(m.id) === String(b.mechanic_id))?.name || "Unassigned",
        b.details,
        b.created_at,
      ])
    );
    toast(`Exported ${list.length} garage booking${list.length === 1 ? "" : "s"}.`, "ok");
  });

  $("clearCompletedBookings")?.addEventListener("click", async () => {
    const completed = state.garageBookings.filter(
      (x) =>
        String(x.status || "").toLowerCase() === "done" ||
        String(x.service_status || "").toLowerCase() === "completed"
    );
    if (!completed.length) return;
    const ok = await confirm({
      eyebrow: "GARAGE BOOKINGS · CLEANUP",
      title: `Clear ${completed.length} completed booking${completed.length === 1 ? "" : "s"}?`,
      message: "Pending, confirmed, and cancelled bookings will remain. Completed service rows will be removed.",
      confirmText: "Clear completed",
      danger: true,
    });
    if (!ok) return;
    const ids = completed.map((x) => x.id);
    const { error } = await sb.from("bookings").delete().in("id", ids);
    if (error) {
      showNotice("Could not clear completed bookings: " + error.message, "err");
      return;
    }
    await recordAdminAudit(
      "clear_completed_garage_bookings",
      "garage_booking",
      ids.slice(0, 5).join(","),
      `Cleared ${ids.length} completed garage booking(s)`
    );
    toast(`Cleared ${ids.length} completed booking${ids.length === 1 ? "" : "s"}.`, "ok");
    await loadBookings({ silent: true });
    window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
  });

  /* =========================================================
     2. CHAUFFEUR HIRE (BOOKINGS, FLEET & RATES, DRIVERS)
     ========================================================= */
  function setChauffeurTab(tab) {
    const next = ["bookings", "fleet", "drivers"].includes(tab) ? tab : "bookings";
    activeChauffeurTab = next;
    document.querySelectorAll("[data-chauffeur-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.chauffeurTab === next);
    });
    $("chauffeurSubBookings")?.classList.toggle("section-hidden", next !== "bookings");
    $("chauffeurSubFleet")?.classList.toggle("section-hidden", next !== "fleet");
    $("chauffeurSubDrivers")?.classList.toggle("section-hidden", next !== "drivers");
  }

  function getFilteredChauffeurBookings() {
    const q = String($("chauffeurBookingSearch")?.value || "").trim().toLowerCase();
    const status = $("chauffeurBookingStatus")?.value || "all";
    const date = $("chauffeurBookingDate")?.value || "";

    return state.chauffeurBookings.filter((b) => {
      if (status !== "all" && String(b.status || "").toLowerCase() !== status) return false;
      if (date && toLocalDateStr(b.start_at) !== date) return false;
      if (!q) return true;
      return [
        b.booking_ref,
        b.customer_name,
        b.customer_phone,
        b.pickup_location,
        b.destination,
        b.chauffeur_vehicles?.display_name,
        b.assigned_driver_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  function driverOptionsHtml(selectedId) {
    const active = state.chauffeurDrivers.filter(
      (d) => d.is_active !== false || String(d.id) === String(selectedId)
    );
    return [
      `<option value="">Unassigned driver</option>`,
      ...active.map((d) => {
        const exp = d.licence_expiry ? ` · Lic exp ${d.licence_expiry}` : "";
        return `<option value="${esc(d.id)}" ${
          String(d.id) === String(selectedId || "") ? "selected" : ""
        }>${esc(d.full_name)}${esc(exp)}${d.is_active === false ? " · Inactive" : ""}</option>`;
      }),
    ].join("");
  }

  function renderChauffeurSchedule() {
    const box = $("chauffeurScheduleOverview");
    if (!box) return;
    const now = Date.now();
    const upcoming = state.chauffeurBookings
      .filter(
        (b) =>
          b.start_at &&
          new Date(b.start_at).getTime() >= now - 3600000 &&
          !["declined", "cancelled", "completed"].includes(String(b.status || "").toLowerCase())
      )
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at));

    const awaitingApproval = state.chauffeurBookings.filter(
      (b) => b.status === "pending_approval"
    ).length;
    const awaitingPay = state.chauffeurBookings.filter(
      (b) => b.status === "approved_awaiting_payment"
    ).length;

    box.innerHTML = `
      <div class="chauffeur-schedule-metrics">
        <div><strong>${awaitingApproval}</strong><span>Pending approval</span></div>
        <div><strong>${awaitingPay}</strong><span>Awaiting M-Pesa</span></div>
        <div><strong>${upcoming.length}</strong><span>Upcoming scheduled trips</span></div>
      </div>
      ${
        upcoming.length
          ? upcoming
              .slice(0, 5)
              .map(
                (b) => `
            <div class="chauffeur-upcoming-row">
              <div>
                <strong>${esc(b.booking_ref || "Trip")} · ${esc(b.customer_name || "Customer")}</strong>
                <div class="meta-line">
                  <span>${esc(fmtDate(b.start_at))}</span><span class="sep">·</span>
                  <span>${esc(b.chauffeur_vehicles?.display_name || "Vehicle")}</span><span class="sep">·</span>
                  <span>${esc(b.pickup_location || "")} → ${esc(b.destination || "")}</span>
                  ${
                    b.assigned_driver_name
                      ? `<span class="sep">·</span><span>Driver: ${esc(b.assigned_driver_name)}</span>`
                      : ""
                  }
                </div>
              </div>
              <span class="status ${esc(statusClass(b.status))}">${esc(
                  String(b.status || "").replaceAll("_", " ")
                )}</span>
            </div>`
              )
              .join("")
          : '<p class="meta" style="margin:0">No upcoming chauffeur trips scheduled right now.</p>'
      }`;
  }

  function renderChauffeurBookings() {
    renderChauffeurSchedule();
    const box = $("chauffeurAdminList");
    if (!box) return;

    const filtered = getFilteredChauffeurBookings();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (chauffeurPage > totalPages) chauffeurPage = totalPages;
    const startIdx = (chauffeurPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    if ($("chauffeurBookingCount")) {
      $("chauffeurBookingCount").textContent = `Showing ${pageItems.length} of ${filtered.length} (${state.chauffeurBookings.length} total)`;
    }

    if (!filtered.length) {
      box.innerHTML = `<div class="empty">${
        state.chauffeurBookings.length
          ? "No chauffeur bookings match your filters."
          : "No chauffeur hire bookings submitted yet."
      }</div>`;
      $("chauffeurPagination")?.classList.add("hidden");
      return;
    }

    box.innerHTML = pageItems
      .map((b) => {
        const id = esc(b.id);
        const quote = b.final_amount ?? b.quoted_amount ?? "";
        const waKey =
          b.status === "approved_awaiting_payment"
            ? "approved"
            : b.status === "declined"
            ? "declined"
            : b.driver_id
            ? "driver_assigned"
            : null;
        const waEvent = waKey
          ? state.chauffeurWaEvents.find(
              (ev) => String(ev.booking_id) === String(b.id) && ev.event_key === waKey
            )
          : null;
        const waSummary = !b.whatsapp_opt_in
          ? "Customer did not opt in to WhatsApp updates"
          : waEvent
          ? `WhatsApp (${waKey}): ${waEvent.delivery_status}${
              waEvent.error_message ? " — " + waEvent.error_message : ""
            }`
          : waKey
          ? "No WhatsApp attempt logged yet"
          : "WhatsApp notification triggers upon quote approval";
        const canRetryWa =
          waKey && b.whatsapp_opt_in && waEvent?.delivery_status !== "sent";

        return `
        <article class="listing" data-ch-card="${id}">
          <div class="summary">
            <div class="vehicle" style="min-width:0;flex:1">
              <div class="meta-line" style="margin-bottom:4px">
                <span class="mono">${esc(b.booking_ref || "NO-REF")}</span><span class="sep">·</span>
                <span>${esc(b.chauffeur_vehicles?.display_name || "Chauffeur vehicle")}</span><span class="sep">·</span>
                <span>${esc(b.pricing_method || "hourly")}</span>
              </div>
              <h3>${esc(b.customer_name || "Customer")} — ${esc(b.pickup_location || "")} → ${esc(b.destination || "")}</h3>
              <div class="meta-line">
                <span>${esc(fmtDate(b.start_at))}${b.end_at ? " – " + esc(fmtDate(b.end_at)) : ""}</span><span class="sep">·</span>
                <span>${esc(b.customer_phone || "No phone")}</span><span class="sep">·</span>
                <span>Payment: ${esc(b.payment_status || "pending")}</span>
                ${quote !== "" ? `<span class="sep">·</span><span>${esc(moneyKES(quote))}</span>` : ""}
              </div>
              <div class="actions" style="margin-top:8px">
                <span class="status ${esc(statusClass(b.status))}">${esc(
          String(b.status || "").replaceAll("_", " ")
        )}</span>
                <span class="meta">${
                  b.assigned_driver_name
                    ? `Driver: ${esc(b.assigned_driver_name)} (${esc(b.assigned_driver_phone || "")})`
                    : "Driver unassigned"
                }</span>
              </div>
            </div>
            <div class="actions">
              <button type="button" class="ghost" data-ch-drawer="${id}">Quick triage</button>
              <button type="button" class="ghost" data-print-ch="${id}">Trip sheet</button>
            </div>
          </div>
          <div class="details" style="display:block">
            ${b.customer_notes ? `<p class="meta" style="margin:0 0 10px;white-space:pre-wrap"><strong>Trip notes:</strong> ${esc(b.customer_notes)}</p>` : ""}
            <p class="meta" style="margin:0 0 12px">${esc(waSummary)}</p>
            <div class="editor-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));align-items:end">
              <div>
                <label for="ch-q-${id}">Confirmed quote (KES)</label>
                <input id="ch-q-${id}" type="number" min="0" step="1" data-ch-quote="${id}" value="${esc(quote)}">
              </div>
              <div>
                <label for="ch-st-${id}">Booking status</label>
                <select id="ch-st-${id}" data-ch-status="${id}">
                  ${CHAUFFEUR_STATUSES.map(
                    ([val, lbl]) =>
                      `<option value="${val}" ${b.status === val ? "selected" : ""}>${lbl}</option>`
                  ).join("")}
                </select>
              </div>
              <div>
                <label for="ch-dr-${id}">Assigned chauffeur</label>
                <select id="ch-dr-${id}" data-ch-driver="${id}">${driverOptionsHtml(b.driver_id)}</select>
              </div>
            </div>
            <div class="actions" style="margin-top:12px">
              <button type="button" class="primary" data-save-ch="${id}">Save &amp; notify</button>
              ${
                canRetryWa
                  ? `<button type="button" class="ghost" data-retry-wa="${id}" data-wa-event="${esc(
                      waKey
                    )}">Retry WhatsApp</button>`
                  : ""
              }
            </div>
          </div>
        </article>`;
      })
      .join("");

    const pag = $("chauffeurPagination");
    if (pag) {
      if (totalPages > 1) {
        pag.classList.remove("hidden");
        pag.innerHTML = `
          <span class="meta">Page ${chauffeurPage} of ${totalPages} · ${filtered.length} bookings</span>
          <div class="actions">
            <button type="button" class="ghost" data-ch-page="${chauffeurPage - 1}" ${
          chauffeurPage <= 1 ? "disabled" : ""
        }>Previous</button>
            <button type="button" class="ghost" data-ch-page="${chauffeurPage + 1}" ${
          chauffeurPage >= totalPages ? "disabled" : ""
        }>Next</button>
          </div>`;
      } else {
        pag.classList.add("hidden");
      }
    }
  }

  async function saveChauffeurBooking(id, overrides = null) {
    const old = state.chauffeurBookings.find((b) => String(b.id) === String(id));
    if (!old) return false;

    const qRaw =
      overrides?.quote !== undefined
        ? overrides.quote
        : document.querySelector(`[data-ch-quote="${id}"]`)?.value ?? "";
    const quote = qRaw === "" || qRaw === null ? null : Number(qRaw);
    const status =
      overrides?.status ?? document.querySelector(`[data-ch-status="${id}"]`)?.value ?? old.status;
    const driverId =
      overrides?.driverId !== undefined
        ? overrides.driverId
        : document.querySelector(`[data-ch-driver="${id}"]`)?.value ?? (old.driver_id || "");

    if (quote !== null && (!Number.isFinite(quote) || quote < 0)) {
      showNotice("Enter a valid non-negative KES quote.", "err");
      return false;
    }
    if (status === "approved_awaiting_payment" && quote === null) {
      showNotice("Enter a confirmed quote (KES) before approving for payment.", "err");
      return false;
    }
    if (status === "confirmed" && old.payment_status !== "paid") {
      showNotice("A chauffeur booking can only be confirmed after M-Pesa payment is marked paid.", "err");
      return false;
    }

    const driver = driverId
      ? state.chauffeurDrivers.find((d) => String(d.id) === String(driverId))
      : null;

    if (driverId && !driver) {
      showNotice("Selected driver could not be found in the roster.", "err");
      return false;
    }
    if (driver) {
      if (driver.is_active === false && String(old.driver_id) !== String(driver.id)) {
        showNotice(`${driver.full_name} is marked unavailable. Activate them first.`, "err");
        return false;
      }
      if (status !== "confirmed") {
        showNotice("Assign a driver only once the booking is confirmed after payment.", "err");
        return false;
      }
      if (driver.licence_expiry && new Date(`${driver.licence_expiry}T23:59:59+03:00`).getTime() < Date.now()) {
        const proceed = await confirm({
          eyebrow: "LICENCE EXPIRED",
          title: `${driver.full_name}'s licence is expired`,
          message: `Recorded expiry was ${driver.licence_expiry}. Assign this driver anyway?`,
          confirmText: "Assign anyway",
          danger: true,
        });
        if (!proceed) return false;
      }
      if (!old.start_at || !old.end_at) {
        showNotice("Trip start and end timestamps are required before checking driver availability.", "err");
        return false;
      }
      const startMs = new Date(old.start_at).getTime();
      const endMs = new Date(old.end_at).getTime();
      const overlap = state.chauffeurBookings.find(
        (other) =>
          String(other.id) !== String(id) &&
          String(other.driver_id) === String(driver.id) &&
          ["approved_awaiting_payment", "confirmed"].includes(other.status) &&
          other.end_at &&
          new Date(other.start_at).getTime() < endMs &&
          new Date(other.end_at).getTime() > startMs
      );
      if (overlap) {
        showNotice(
          `${driver.full_name} has an overlapping trip (${overlap.booking_ref || "Booking"}).`,
          "err"
        );
        return false;
      }
    }

    if (status === "declined" && old.status !== "declined") {
      const ok = await confirm({
        eyebrow: "DECLINE BOOKING",
        title: `Decline ${old.booking_ref || "this request"}?`,
        message: "The customer will be notified if they opted in to WhatsApp updates.",
        confirmText: "Decline booking",
        danger: true,
      });
      if (!ok) return false;
    }

    const payload = { status, quoted_amount: quote, final_amount: quote };
    if (status === "approved_awaiting_payment") {
      payload.payment_status = old.payment_status === "paid" ? "paid" : "pending";
      if (!old.approved_at) {
        payload.approved_by = state.adminUserId;
        payload.approved_at = new Date().toISOString();
      }
    }
    if (status === "declined" || status === "cancelled") {
      payload.payment_status = old.payment_status === "paid" ? "paid" : "not_due";
    }
    if (driver) {
      payload.driver_id = driver.id;
      payload.assigned_driver_name = driver.full_name;
      payload.assigned_driver_phone = driver.phone;
      payload.driver_assigned_at = new Date().toISOString();
    } else if (old.driver_id) {
      payload.driver_id = null;
      payload.assigned_driver_name = null;
      payload.assigned_driver_phone = null;
      payload.driver_assigned_at = null;
    }

    const { error } = await sb.from("chauffeur_bookings").update(payload).eq("id", id);
    if (error) {
      showNotice("Could not save chauffeur booking: " + error.message, "err");
      return false;
    }

    await recordAdminAudit(
      "update_chauffeur_booking",
      "chauffeur_booking",
      id,
      `Updated ${old.booking_ref || id} → status: ${status}${quote !== null ? `, quote: KES ${quote}` : ""}${
        driver ? `, driver: ${driver.full_name}` : ""
      }`
    );

    let whatsappEvent = null;
    if (status === "approved_awaiting_payment" && old.status !== "approved_awaiting_payment") {
      whatsappEvent = "approved";
    } else if (status === "declined" && old.status !== "declined") {
      whatsappEvent = "declined";
    } else if (status === "confirmed" && driver && String(driver.id) !== String(old.driver_id)) {
      whatsappEvent = "driver_assigned";
    }

    if (whatsappEvent) {
      try {
        const { data: waData, error: waError } = await sb.functions.invoke(
          "notify-chauffeur-whatsapp",
          { body: { booking_id: id, event_type: whatsappEvent } }
        );
        if (waError) throw waError;
        if (waData?.error) throw new Error(waData.error);
        toast(
          waData?.status === "skipped"
            ? "Booking saved (WhatsApp skipped: customer did not opt in)."
            : "Booking saved and WhatsApp update triggered.",
          "ok"
        );
      } catch (waErr) {
        showNotice(
          `Booking saved, but WhatsApp notification failed: ${waErr?.message || waErr}`,
          "err"
        );
      }
    } else {
      toast(`Chauffeur booking ${old.booking_ref || ""} updated.`, "ok");
    }

    await loadChauffeur({ silent: true });
    window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    window.ThreePedalsAdminRequests?.loadRequestsInbox?.({ silent: true });
    return true;
  }

  function printChauffeurTripSheet(id) {
    const b = state.chauffeurBookings.find((x) => String(x.id) === String(id));
    if (!b) return;
    openPrintSheet(
      `Chauffeur Trip Sheet · ${b.booking_ref || "Ref"}`,
      `${b.chauffeur_vehicles?.display_name || "Chauffeur Vehicle"} — ${b.customer_name || ""}`,
      [
        ["Booking Reference", b.booking_ref || "—"],
        ["Customer Name", b.customer_name || "—"],
        ["Customer Phone", b.customer_phone || "—"],
        ["Vehicle", b.chauffeur_vehicles?.display_name || "—"],
        ["Pricing Method", b.pricing_method || "—"],
        ["Pickup Location", b.pickup_location || "—"],
        ["Destination", b.destination || "—"],
        ["Pickup Time", fmtDate(b.start_at)],
        ["Expected End", b.end_at ? fmtDate(b.end_at) : "—"],
        ["Booking Status", (b.status || "").replaceAll("_", " ")],
        ["Payment Status", (b.payment_status || "").replaceAll("_", " ")],
        ["Confirmed Quote", b.final_amount != null ? moneyKES(b.final_amount) : b.quoted_amount != null ? moneyKES(b.quoted_amount) : "Pending"],
        ["Assigned Driver", b.assigned_driver_name ? `${b.assigned_driver_name} (${b.assigned_driver_phone || ""})` : "Unassigned"],
        ["Customer Notes", b.customer_notes || "None"],
      ]
    );
  }

  async function openChauffeurDrawer(id) {
    if (!state.chauffeurDrivers.length && sb) {
      const { data } = await sb.from("chauffeur_drivers").select("*").order("full_name");
      if (data) state.chauffeurDrivers = data;
    }
    const b = state.chauffeurBookings.find((x) => String(x.id) === String(id));
    if (!b) return;
    const quote = b.final_amount ?? b.quoted_amount ?? "";

    openDrawer({
      eyebrow: "Quick triage · Chauffeur hire",
      title: `${b.booking_ref || "Trip"} · ${b.customer_name || "Customer"}`,
      subtitle: `${b.pickup_location || ""} → ${b.destination || ""}`,
      bodyHtml: `
        <div class="fields" style="margin-bottom:14px">
          <div class="field"><strong>Phone</strong>${esc(b.customer_phone || "—")}</div>
          <div class="field"><strong>Vehicle</strong>${esc(b.chauffeur_vehicles?.display_name || "—")}</div>
          <div class="field"><strong>Pickup</strong>${esc(fmtDate(b.start_at))}</div>
          <div class="field"><strong>Payment</strong>${esc((b.payment_status || "pending").replaceAll("_", " "))}</div>
        </div>
        ${
          b.customer_notes
            ? `<div class="field" style="margin-bottom:14px"><strong>Notes</strong><div class="desc">${esc(b.customer_notes)}</div></div>`
            : ""
        }
        <form id="drawerChauffeurForm">
          <label for="dchQuote">Confirmed quote (KES)</label>
          <input id="dchQuote" type="number" min="0" step="1" value="${esc(quote)}">
          <label for="dchStatus">Booking status</label>
          <select id="dchStatus">
            ${CHAUFFEUR_STATUSES.map(
              ([v, lbl]) => `<option value="${v}" ${b.status === v ? "selected" : ""}>${lbl}</option>`
            ).join("")}
          </select>
          <label for="dchDriver">Assigned driver</label>
          <select id="dchDriver">${driverOptionsHtml(b.driver_id)}</select>
          <div class="editor-actions">
            <button type="submit" class="primary" id="dchSaveBtn">Save &amp; notify</button>
          </div>
        </form>`,
      footerHtml: `<button type="button" class="ghost" id="dchPrintBtn">Trip sheet / PDF</button>`,
      onMount: (drawer) => {
        drawer.querySelector("#dchPrintBtn")?.addEventListener("click", () => printChauffeurTripSheet(b.id));
        drawer.querySelector("#drawerChauffeurForm")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const btn = drawer.querySelector("#dchSaveBtn");
          if (btn) btn.disabled = true;
          const ok = await saveChauffeurBooking(b.id, {
            quote: drawer.querySelector("#dchQuote")?.value ?? "",
            status: drawer.querySelector("#dchStatus")?.value,
            driverId: drawer.querySelector("#dchDriver")?.value || "",
          });
          if (btn) btn.disabled = false;
          if (ok) closeDrawer();
        });
      },
    });
  }

  /* ---- Fleet & Rates Sub-Tab ---- */
  function renderFleetAdmin() {
    const box = $("chauffeurFleetAdmin");
    if (!box) return;
    const v = fleetEditingVehicle || {};
    const formOpen = !!fleetEditingVehicle;

    const formHtml = `
      <div class="panel-title">
        <div><span class="panel-eyebrow">Chauffeur Vehicles</span><h2>Fleet &amp; tariff rates</h2><p class="meta">Upload JPEG photos and manage category packages and KES rates.</p></div>
        <button type="button" class="primary" id="newFleetVehicleBtn">+ Add fleet vehicle</button>
      </div>
      <form id="fleetVehicleForm" class="editor ${formOpen ? "" : "section-hidden"}">
        <input id="fvId" type="hidden" value="${esc(v.id || "")}">
        <div class="editor-grid">
          <div><label for="fvDisplayName">Display name</label><input id="fvDisplayName" maxlength="120" value="${esc(v.display_name || "")}" placeholder="e.g. Executive Prado TX" required></div>
          <div><label for="fvMakeModel">Make &amp; model</label><input id="fvMakeModel" maxlength="120" value="${esc(v.make_model || "")}" placeholder="Toyota Land Cruiser Prado" required></div>
          <div><label for="fvCategory">Category</label><input id="fvCategory" maxlength="60" value="${esc(v.category || "Executive SUV")}" required></div>
          <div><label for="fvCapacity">Passenger capacity</label><input id="fvCapacity" type="number" min="1" max="50" value="${esc(v.passenger_capacity ?? 4)}" required></div>
          <div><label for="fvHourly">Hourly rate (KES)</label><input id="fvHourly" type="number" min="0" value="${esc(v.hourly_rate ?? "")}"></div>
          <div><label for="fvDaily">Daily rate (KES)</label><input id="fvDaily" type="number" min="0" value="${esc(v.daily_rate ?? "")}"></div>
          <div><label for="fvPerKm">Per km rate (KES)</label><input id="fvPerKm" type="number" min="0" value="${esc(v.per_km_rate ?? "")}"></div>
          <div><label for="fvAirport">Airport transfer (KES)</label><input id="fvAirport" type="number" min="0" value="${esc(v.airport_transfer_rate ?? "")}"></div>
          <div><label for="fvHalfDay">Half-day rate (KES)</label><input id="fvHalfDay" type="number" min="0" value="${esc(v.half_day_rate ?? "")}"></div>
          <div><label for="fvFullDay">Full-day rate (KES)</label><input id="fvFullDay" type="number" min="0" value="${esc(v.full_day_rate ?? "")}"></div>
          <div class="full"><label for="fvPhoto">Vehicle photo (JPEG only, max 8 MB)</label><input id="fvPhoto" type="file" accept="image/jpeg"><span class="meta">${v.photo_url ? `Current photo attached.` : "Upload a crisp JPEG photograph."}</span></div>
          <div class="full"><label for="fvDesc">Description</label><textarea id="fvDesc" rows="2" maxlength="500">${esc(v.description || "")}</textarea></div>
        </div>
        <label style="display:flex;gap:9px;align-items:center;margin-top:12px"><input id="fvActive" type="checkbox" ${v.is_active !== false ? "checked" : ""}> Active on public chauffeur booking page</label>
        <p id="fvErr" class="notice err hidden" style="margin-top:12px"></p>
        <div class="editor-actions">
          <button type="submit" class="primary" id="fvSaveBtn">Save vehicle</button>
          <button type="button" class="ghost" id="fvCancelBtn">Cancel</button>
        </div>
      </form>`;

    const listHtml = state.chauffeurFleet.length
      ? state.chauffeurFleet
          .map(
            (item) => `
        <article class="article-item">
          <div style="display:flex;gap:14px;align-items:flex-start;min-width:0;flex:1">
            ${
              safeUrl(item.photo_url)
                ? `<img src="${esc(safeUrl(item.photo_url))}" alt="" class="listing-thumb">`
                : `<div class="listing-thumb" style="display:grid;place-items:center;font-size:11px;color:var(--ad-mute)">No photo</div>`
            }
            <div style="min-width:0;flex:1">
              <h3>${esc(item.display_name || item.make_model)}</h3>
              <div class="meta-line">
                <span>${esc(item.category || "Category")}</span><span class="sep">·</span>
                <span>${esc(item.make_model || "")}</span><span class="sep">·</span>
                <span>${esc(item.passenger_capacity || 4)} seats</span><span class="sep">·</span>
                <span class="status ${item.is_active !== false ? "available" : "inactive"}">${
              item.is_active !== false ? "Active" : "Hidden"
            }</span>
              </div>
              <div class="meta-line" style="margin-top:6px">
                ${item.hourly_rate ? `<span>Hr: ${esc(moneyKES(item.hourly_rate))}</span>` : ""}
                ${item.daily_rate ? `<span>Day: ${esc(moneyKES(item.daily_rate))}</span>` : ""}
                ${item.airport_transfer_rate ? `<span>Airport: ${esc(moneyKES(item.airport_transfer_rate))}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="actions">
            <button type="button" class="ghost" data-fv-edit="${esc(item.id)}">Edit</button>
            <button type="button" class="ghost" data-fv-toggle="${esc(item.id)}">${
              item.is_active !== false ? "Hide" : "Activate"
            }</button>
            <button type="button" class="danger" data-fv-delete="${esc(item.id)}">Delete</button>
          </div>
        </article>`
          )
          .join("")
      : '<div class="empty">No chauffeur fleet vehicles added yet.</div>';

    box.innerHTML = formHtml + listHtml;
  }

  /* ---- Drivers Sub-Tab ---- */
  function renderDriversAdmin() {
    const now = Date.now();
    const soon = now + 30 * 86400000;
    let available = 0;
    let busy = 0;
    let unavailable = 0;
    let licenceAttention = 0;

    const busyIds = new Set(
      state.chauffeurBookings
        .filter((b) => b.driver_id && ["approved_awaiting_payment", "confirmed"].includes(b.status))
        .map((b) => String(b.driver_id))
    );

    const enriched = state.chauffeurDrivers.map((d) => {
      const expMs = d.licence_expiry ? new Date(`${d.licence_expiry}T23:59:59+03:00`).getTime() : null;
      const expired = expMs !== null && expMs < now;
      const expiringSoon = expMs !== null && !expired && expMs <= soon;
      if (expired || expiringSoon) licenceAttention++;
      let computedStatus = "available";
      if (d.is_active === false) {
        computedStatus = "unavailable";
        unavailable++;
      } else if (busyIds.has(String(d.id))) {
        computedStatus = "busy";
        busy++;
      } else {
        available++;
      }
      return { ...d, computedStatus, expired, expiringSoon };
    });

    if ($("chauffeurDriverMetrics")) {
      $("chauffeurDriverMetrics").innerHTML = [
        [enriched.length, "Total drivers"],
        [available, "Available"],
        [busy, "Assigned to trip"],
        [licenceAttention, "Licence attention"],
      ]
        .map(([n, l]) => `<div><strong>${n}</strong><span>${l}</span></div>`)
        .join("");
    }

    const q = String($("chauffeurDriverSearch")?.value || "").trim().toLowerCase();
    const filter = $("chauffeurDriverStatus")?.value || "all";
    const filtered = enriched.filter((d) => {
      if (filter === "licence_attention" && !d.expired && !d.expiringSoon) return false;
      if (["available", "busy", "unavailable"].includes(filter) && d.computedStatus !== filter) {
        return false;
      }
      if (!q) return true;
      return [d.full_name, d.phone, d.email, d.licence_number, d.notes]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    if ($("chauffeurDriverCount")) {
      $("chauffeurDriverCount").textContent = `${filtered.length} of ${enriched.length} drivers`;
    }

    const list = $("chauffeurDriverList");
    if (!list) return;
    if (!filtered.length) {
      list.innerHTML = `<div class="empty">${
        enriched.length ? "No drivers match your filters." : "No drivers added to the roster yet."
      }</div>`;
      return;
    }

    list.innerHTML = filtered
      .map(
        (d) => `
      <article class="article-item">
        <div style="min-width:0;flex:1">
          <h3>${esc(d.full_name)}</h3>
          <div class="meta-line">
            <span>${esc(d.phone || "No phone")}</span>
            ${d.email ? `<span class="sep">·</span><span>${esc(d.email)}</span>` : ""}
            ${d.licence_number ? `<span class="sep">·</span><span class="mono">Lic: ${esc(d.licence_number)}</span>` : ""}
            ${
              d.licence_expiry
                ? `<span class="sep">·</span><span style="${
                    d.expired ? "color:var(--ad-bad);font-weight:700" : d.expiringSoon ? "color:var(--ad-warn);font-weight:700" : ""
                  }">Exp: ${esc(d.licence_expiry)}${d.expired ? " (Expired)" : d.expiringSoon ? " (Expiring soon)" : ""}</span>`
                : ""
            }
          </div>
          ${d.notes ? `<p class="meta" style="margin:6px 0 0">${esc(d.notes)}</p>` : ""}
          <div style="margin-top:8px"><span class="status ${esc(d.computedStatus)}">${esc(d.computedStatus)}</span></div>
        </div>
        <div class="actions">
          <button type="button" class="ghost" data-drv-edit="${esc(d.id)}">Edit</button>
          <button type="button" class="ghost" data-drv-toggle="${esc(d.id)}">${
          d.is_active !== false ? "Deactivate" : "Activate"
        }</button>
          <button type="button" class="danger" data-drv-delete="${esc(d.id)}">Remove</button>
        </div>
      </article>`
      )
      .join("");
  }

  async function loadChauffeur(opts = {}) {
    if (!sb) return;
    if (!opts.silent && $("chauffeurAdminList")) {
      $("chauffeurAdminList").innerHTML = '<div class="empty">Loading chauffeur operations…</div>';
    }
    const [bRes, fRes, dRes, waRes] = await Promise.all([
      sb
        .from("chauffeur_bookings")
        .select("*,chauffeur_vehicles(display_name,category)")
        .order("created_at", { ascending: false }),
      sb.from("chauffeur_vehicles").select("*").order("category").order("display_name"),
      sb.from("chauffeur_drivers").select("*").order("full_name"),
      sb
        .from("chauffeur_notification_events")
        .select("id,booking_id,event_key,delivery_status,error_message,provider_message_id,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (bRes.error) {
      showNotice("Could not load chauffeur bookings: " + bRes.error.message, "err");
      return;
    }
    state.chauffeurBookings = bRes.data || [];
    if (!fRes.error) state.chauffeurFleet = fRes.data || [];
    if (!dRes.error) state.chauffeurDrivers = dRes.data || [];
    if (!waRes.error) state.chauffeurWaEvents = waRes.data || [];

    renderChauffeurBookings();
    renderFleetAdmin();
    renderDriversAdmin();
  }

  /* Chauffeur Events */
  document.querySelectorAll("[data-chauffeur-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setChauffeurTab(btn.dataset.chauffeurTab));
  });
  $("refreshChauffeur")?.addEventListener("click", () => loadChauffeur());
  $("chauffeurBookingSearch")?.addEventListener(
    "input",
    debounce(() => {
      chauffeurPage = 1;
      renderChauffeurBookings();
    }, 150)
  );
  $("chauffeurBookingStatus")?.addEventListener("change", () => {
    chauffeurPage = 1;
    renderChauffeurBookings();
  });
  $("chauffeurBookingDate")?.addEventListener("change", () => {
    chauffeurPage = 1;
    renderChauffeurBookings();
  });

  $("chauffeurAdminList")?.addEventListener("click", async (e) => {
    const drBtn = e.target.closest("[data-ch-drawer]");
    if (drBtn) {
      await openChauffeurDrawer(drBtn.dataset.chDrawer);
      return;
    }
    const prBtn = e.target.closest("[data-print-ch]");
    if (prBtn) {
      printChauffeurTripSheet(prBtn.dataset.printCh);
      return;
    }
    const saveBtn = e.target.closest("[data-save-ch]");
    if (saveBtn) {
      saveBtn.disabled = true;
      await saveChauffeurBooking(saveBtn.dataset.saveCh);
      if (saveBtn.isConnected) saveBtn.disabled = false;
      return;
    }
    const retry = e.target.closest("[data-retry-wa]");
    if (retry) {
      retry.disabled = true;
      retry.textContent = "Retrying…";
      try {
        const { data, error } = await sb.functions.invoke("notify-chauffeur-whatsapp", {
          body: { booking_id: retry.dataset.retryWa, event_type: retry.dataset.waEvent },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast("WhatsApp retry submitted: " + String(data?.status || "sent"), "ok");
        await loadChauffeur({ silent: true });
      } catch (err) {
        showNotice("WhatsApp retry failed: " + (err?.message || err), "err");
      } finally {
        if (retry.isConnected) {
          retry.disabled = false;
          retry.textContent = "Retry WhatsApp";
        }
      }
    }
  });

  $("chauffeurPagination")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ch-page]");
    if (!btn || btn.disabled) return;
    chauffeurPage = Number(btn.dataset.chPage) || 1;
    renderChauffeurBookings();
    $("chauffeurPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("exportChauffeurBookings")?.addEventListener("click", () => {
    const list = getFilteredChauffeurBookings();
    const headers = [
      "Ref",
      "Customer",
      "Phone",
      "Vehicle",
      "Pickup",
      "Destination",
      "Start",
      "End",
      "Pricing method",
      "Status",
      "Payment status",
      "Quoted KES",
      "Final KES",
      "Driver",
      "Driver phone",
      "Notes",
    ];
    downloadCsv(
      `3pedals-chauffeur-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      list.map((b) => [
        b.booking_ref,
        b.customer_name,
        b.customer_phone,
        b.chauffeur_vehicles?.display_name,
        b.pickup_location,
        b.destination,
        b.start_at,
        b.end_at,
        b.pricing_method,
        b.status,
        b.payment_status,
        b.quoted_amount,
        b.final_amount,
        b.assigned_driver_name,
        b.assigned_driver_phone,
        b.customer_notes,
      ])
    );
    toast(`Exported ${list.length} chauffeur booking${list.length === 1 ? "" : "s"}.`, "ok");
  });

  /* Fleet CRUD Events (delegated on #chauffeurFleetAdmin) */
  $("chauffeurFleetAdmin")?.addEventListener("click", async (e) => {
    if (e.target.closest("#newFleetVehicleBtn")) {
      fleetEditingVehicle = { is_active: true, passenger_capacity: 4 };
      renderFleetAdmin();
      markDirty("fleet", true);
      return;
    }
    if (e.target.closest("#fvCancelBtn")) {
      fleetEditingVehicle = null;
      markDirty("fleet", false);
      renderFleetAdmin();
      return;
    }
    const editBtn = e.target.closest("[data-fv-edit]");
    if (editBtn) {
      const item = state.chauffeurFleet.find((x) => String(x.id) === editBtn.dataset.fvEdit);
      if (item) {
        fleetEditingVehicle = { ...item };
        renderFleetAdmin();
      }
      return;
    }
    const togBtn = e.target.closest("[data-fv-toggle]");
    if (togBtn) {
      const item = state.chauffeurFleet.find((x) => String(x.id) === togBtn.dataset.fvToggle);
      if (!item) return;
      const next = item.is_active === false;
      const { error } = await sb
        .from("chauffeur_vehicles")
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) {
        showNotice("Could not update fleet status: " + error.message, "err");
        return;
      }
      await recordAdminAudit(
        "toggle_fleet_vehicle",
        "chauffeur_booking",
        item.id,
        `${next ? "Activated" : "Hid"} fleet vehicle ${item.display_name}`
      );
      toast(`${item.display_name} ${next ? "activated" : "hidden"}.`, "ok");
      await loadChauffeur({ silent: true });
      return;
    }
    const delBtn = e.target.closest("[data-fv-delete]");
    if (delBtn) {
      const item = state.chauffeurFleet.find((x) => String(x.id) === delBtn.dataset.fvDelete);
      if (!item) return;
      const ok = await confirm({
        eyebrow: "FLEET · DELETE VEHICLE",
        title: `Delete ${item.display_name}?`,
        message: "This permanently deletes the vehicle from chauffeur options.",
        confirmText: "Delete vehicle",
        danger: true,
      });
      if (!ok) return;
      const { error } = await sb.from("chauffeur_vehicles").delete().eq("id", item.id);
      if (error) {
        showNotice("Could not delete vehicle: " + error.message, "err");
        return;
      }
      await recordAdminAudit(
        "delete_fleet_vehicle",
        "chauffeur_booking",
        item.id,
        `Deleted fleet vehicle ${item.display_name}`
      );
      toast("Fleet vehicle deleted.", "ok");
      await loadChauffeur({ silent: true });
    }
  });

  $("chauffeurFleetAdmin")?.addEventListener("submit", async (e) => {
    const form = e.target.closest("#fleetVehicleForm");
    if (!form) return;
    e.preventDefault();
    const errEl = $("fvErr");
    errEl?.classList.add("hidden");
    const saveBtn = $("fvSaveBtn");
    const id = $("fvId")?.value.trim() || "";
    const existing = id ? state.chauffeurFleet.find((x) => String(x.id) === id) : null;
    const display_name = $("fvDisplayName")?.value.trim() || "";
    const make_model = $("fvMakeModel")?.value.trim() || "";
    const category = $("fvCategory")?.value.trim() || "Executive";
    const passenger_capacity = Number($("fvCapacity")?.value || 4);
    const numOrNull = (val) => (val === "" || val == null ? null : Number(val));

    if (!display_name || !make_model) {
      if (errEl) {
        errEl.textContent = "Display name and make/model are required.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const file = $("fvPhoto")?.files?.[0];
    if (file) {
      if (file.type !== "image/jpeg") {
        if (errEl) {
          errEl.textContent = "Fleet photos must be JPEG files (image/jpeg).";
          errEl.classList.remove("hidden");
        }
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        if (errEl) {
          errEl.textContent = "Photo exceeds the 8 MB limit.";
          errEl.classList.remove("hidden");
        }
        return;
      }
    }

    if (saveBtn) saveBtn.disabled = true;
    try {
      let photo_url = existing?.photo_url || null;
      const slugBase = display_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const targetId = id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));

      if (file) {
        const storagePath = `${state.adminUserId}/chauffeur-fleet/${targetId}.jpg`;
        const { error: upErr } = await sb.storage
          .from("car-photos")
          .upload(storagePath, file, { upsert: true, contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from("car-photos").getPublicUrl(storagePath);
        photo_url = pub?.publicUrl ? `${pub.publicUrl}?t=${Date.now()}` : null;
      }

      const payload = {
        slug: existing?.slug || `${slugBase || "vehicle"}-${targetId.slice(0, 6)}`,
        display_name,
        make_model,
        category,
        passenger_capacity,
        hourly_rate: numOrNull($("fvHourly")?.value),
        daily_rate: numOrNull($("fvDaily")?.value),
        per_km_rate: numOrNull($("fvPerKm")?.value),
        airport_transfer_rate: numOrNull($("fvAirport")?.value),
        half_day_rate: numOrNull($("fvHalfDay")?.value),
        full_day_rate: numOrNull($("fvFullDay")?.value),
        description: $("fvDesc")?.value.trim() || null,
        is_active: !!$("fvActive")?.checked,
        photo_url,
        updated_at: new Date().toISOString(),
      };

      const { error } = id
        ? await sb.from("chauffeur_vehicles").update(payload).eq("id", id)
        : await sb.from("chauffeur_vehicles").insert({ id: targetId, ...payload });
      if (error) throw error;

      await recordAdminAudit(
        id ? "update_fleet_vehicle" : "create_fleet_vehicle",
        "chauffeur_booking",
        targetId,
        `${id ? "Updated" : "Added"} chauffeur fleet vehicle ${display_name}`
      );
      fleetEditingVehicle = null;
      markDirty("fleet", false);
      toast("Fleet vehicle saved.", "ok");
      await loadChauffeur({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Could not save fleet vehicle.";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  /* Driver Roster CRUD */
  function openDriverForm(driver = null) {
    $("chauffeurDriverId").value = driver?.id || "";
    $("chauffeurDriverName").value = driver?.full_name || "";
    $("chauffeurDriverPhone").value = driver?.phone || "";
    $("chauffeurDriverEmail").value = driver?.email || "";
    $("chauffeurDriverLicence").value = driver?.licence_number || "";
    $("chauffeurDriverExpiry").value = driver?.licence_expiry || "";
    $("chauffeurDriverNotes").value = driver?.notes || "";
    $("chauffeurDriverActive").checked = driver ? driver.is_active !== false : true;
    $("chauffeurDriverForm")?.classList.remove("section-hidden");
    $("chauffeurDriverName")?.focus();
  }

  function closeDriverForm() {
    $("chauffeurDriverForm")?.classList.add("section-hidden");
    $("chauffeurDriverForm")?.reset();
    if ($("chauffeurDriverId")) $("chauffeurDriverId").value = "";
    markDirty("driver", false);
  }

  $("newChauffeurDriver")?.addEventListener("click", () => openDriverForm(null));
  $("cancelChauffeurDriver")?.addEventListener("click", closeDriverForm);
  $("chauffeurDriverForm")?.addEventListener("input", () => markDirty("driver", true));

  $("chauffeurDriverForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("chauffeurDriverId")?.value.trim();
    const full_name = $("chauffeurDriverName")?.value.trim();
    const phone = $("chauffeurDriverPhone")?.value.trim();
    if (!full_name || !phone) {
      showNotice("Driver name and phone number are required.", "err");
      return;
    }
    const payload = {
      full_name,
      phone,
      email: $("chauffeurDriverEmail")?.value.trim() || null,
      licence_number: $("chauffeurDriverLicence")?.value.trim() || null,
      licence_expiry: $("chauffeurDriverExpiry")?.value || null,
      notes: $("chauffeurDriverNotes")?.value.trim() || null,
      is_active: !!$("chauffeurDriverActive")?.checked,
      updated_at: new Date().toISOString(),
    };
    const btn = $("saveChauffeurDriver");
    if (btn) btn.disabled = true;
    const { data, error } = id
      ? await sb.from("chauffeur_drivers").update(payload).eq("id", id).select("id").single()
      : await sb
          .from("chauffeur_drivers")
          .insert({ ...payload, created_by: state.adminUserId })
          .select("id")
          .single();
    if (btn) btn.disabled = false;
    if (error) {
      showNotice("Could not save driver: " + error.message, "err");
      return;
    }
    await recordAdminAudit(
      id ? "update_chauffeur_driver" : "create_chauffeur_driver",
      "chauffeur_booking",
      data?.id || id,
      `${id ? "Updated" : "Added"} chauffeur driver ${full_name}`
    );
    closeDriverForm();
    toast("Chauffeur driver saved.", "ok");
    await loadChauffeur({ silent: true });
  });

  $("chauffeurDriverSearch")?.addEventListener("input", debounce(renderDriversAdmin, 150));
  $("chauffeurDriverStatus")?.addEventListener("change", renderDriversAdmin);

  $("chauffeurDriverList")?.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-drv-edit]");
    if (edit) {
      const d = state.chauffeurDrivers.find((x) => String(x.id) === edit.dataset.drvEdit);
      if (d) openDriverForm(d);
      return;
    }
    const tog = e.target.closest("[data-drv-toggle]");
    if (tog) {
      const d = state.chauffeurDrivers.find((x) => String(x.id) === tog.dataset.drvToggle);
      if (!d) return;
      const next = d.is_active === false;
      const { error } = await sb
        .from("chauffeur_drivers")
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq("id", d.id);
      if (error) {
        showNotice("Could not update driver availability: " + error.message, "err");
        return;
      }
      await recordAdminAudit(
        "toggle_chauffeur_driver",
        "chauffeur_booking",
        d.id,
        `Marked driver ${d.full_name} ${next ? "available" : "unavailable"}`
      );
      toast(`${d.full_name} marked ${next ? "available" : "unavailable"}.`, "ok");
      await loadChauffeur({ silent: true });
      return;
    }
    const del = e.target.closest("[data-drv-delete]");
    if (del) {
      const d = state.chauffeurDrivers.find((x) => String(x.id) === del.dataset.drvDelete);
      if (!d) return;
      const ok = await confirm({
        eyebrow: "ROSTER · REMOVE DRIVER",
        title: `Remove ${d.full_name}?`,
        message: "This permanently removes the driver profile from the roster.",
        confirmText: "Remove driver",
        danger: true,
      });
      if (!ok) return;
      const { error } = await sb.from("chauffeur_drivers").delete().eq("id", d.id);
      if (error) {
        showNotice("Could not delete driver: " + error.message, "err");
        return;
      }
      await recordAdminAudit(
        "delete_chauffeur_driver",
        "chauffeur_booking",
        d.id,
        `Removed driver ${d.full_name}`
      );
      toast("Driver removed.", "ok");
      await loadChauffeur({ silent: true });
    }
  });

  /* =========================================================
     3. MECHANICS DIRECTORY
     ========================================================= */
  function renderMechanics() {
    const box = $("mechanicAdminList");
    if (!box) return;
    if (!state.mechanics.length) {
      box.innerHTML = '<div class="empty">No mechanics registered in the directory yet.</div>';
      return;
    }

    box.innerHTML = state.mechanics
      .map((m) => {
        const photo = safeUrl(m.photo_url);
        return `
        <article class="article-item">
          <div style="display:flex;gap:14px;align-items:flex-start;min-width:0;flex:1">
            ${
              photo
                ? `<img src="${esc(photo)}" alt="" class="listing-thumb" style="width:68px;height:68px;flex:0 0 68px">`
                : `<div class="listing-thumb" style="width:68px;height:68px;flex:0 0 68px;display:grid;place-items:center;font-size:12px;color:var(--ad-mute)">Tech</div>`
            }
            <div style="min-width:0;flex:1">
              <h3>${esc(m.name)}</h3>
              <div class="meta-line">
                <span>${esc(m.specialty || "General specialist")}</span>
                ${m.service_area ? `<span class="sep">·</span><span>${esc(m.service_area)}</span>` : ""}
                ${m.phone ? `<span class="sep">·</span><span>${esc(m.phone)}</span>` : ""}
              </div>
              ${m.vehicle_specialties ? `<p class="meta" style="margin:5px 0 0">Cars: ${esc(m.vehicle_specialties)}</p>` : ""}
              ${m.bio ? `<p class="meta" style="margin:4px 0 0">${esc(m.bio)}</p>` : ""}
              <div class="actions" style="margin-top:8px">
                <span class="status ${m.active !== false ? "available" : "inactive"}">${
          m.active !== false ? "Active in directory" : "Hidden"
        }</span>
                ${
                  m.rating_count
                    ? `<span class="meta">${Number(m.rating_average || 0).toFixed(1)} ★ (${m.rating_count})</span>`
                    : ""
                }
              </div>
            </div>
          </div>
          <div class="actions">
            <button type="button" class="ghost" data-mech-edit="${esc(m.id)}">Edit</button>
            <button type="button" class="ghost" data-mech-toggle="${esc(m.id)}">${
          m.active !== false ? "Hide" : "Activate"
        }</button>
            <button type="button" class="danger" data-mech-delete="${esc(m.id)}">Delete</button>
          </div>
        </article>`;
      })
      .join("");
  }

  function openMechanicForm(m = null) {
    $("mechanicId").value = m?.id || "";
    $("mechanicName").value = m?.name || "";
    $("mechanicRole").value = m?.specialty || "";
    $("mechanicCars").value = m?.vehicle_specialties || "";
    $("mechanicArea").value = m?.service_area || "";
    $("mechanicPhone").value = m?.phone || "";
    $("mechanicBio").value = m?.bio || "";
    currentMechanicPhotoUrl = m?.photo_url || "";
    if ($("mechanicPhoto")) $("mechanicPhoto").value = "";
    if ($("mechanicPhotoCurrent")) {
      $("mechanicPhotoCurrent").textContent = currentMechanicPhotoUrl
        ? "Current profile photo attached. Choose a new image to replace it."
        : "Choose a photo up to 8 MB.";
    }
    $("mechanicError")?.classList.add("hidden");
    $("mechanicForm")?.classList.remove("section-hidden");
    $("mechanicName")?.focus();
  }

  function closeMechanicForm() {
    $("mechanicForm")?.classList.add("section-hidden");
    $("mechanicForm")?.reset();
    if ($("mechanicId")) $("mechanicId").value = "";
    currentMechanicPhotoUrl = "";
    markDirty("mechanic", false);
  }

  async function loadMechanics(opts = {}) {
    if (!sb) return;
    if (!opts.silent && $("mechanicAdminList")) {
      $("mechanicAdminList").innerHTML = '<div class="empty">Loading mechanics directory…</div>';
    }
    const { data, error } = await sb.from("mechanics").select("*").order("name");
    if (error) {
      showNotice("Could not load mechanics: " + error.message, "err");
      return;
    }
    state.mechanics = data || [];
    renderMechanics();
  }

  $("newMechanic")?.addEventListener("click", () => openMechanicForm(null));
  $("cancelMechanic")?.addEventListener("click", closeMechanicForm);
  $("mechanicForm")?.addEventListener("input", () => markDirty("mechanic", true));

  $("mechanicForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("mechanicError");
    errEl?.classList.add("hidden");
    const id = $("mechanicId")?.value.trim() || "";
    const name = $("mechanicName")?.value.trim() || "";
    const specialty = $("mechanicRole")?.value.trim() || "";

    if (!name || !specialty) {
      if (errEl) {
        errEl.textContent = "Mechanic name and specialty are required.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const file = $("mechanicPhoto")?.files?.[0];
    if (file && file.size > 8 * 1024 * 1024) {
      if (errEl) {
        errEl.textContent = "Profile photo must be 8 MB or smaller.";
        errEl.classList.remove("hidden");
      }
      return;
    }

    const btn = $("saveMechanic");
    if (btn) btn.disabled = true;
    try {
      let photo_url = currentMechanicPhotoUrl || null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const uid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
        const path = `${state.adminUserId}/${uid}.${ext}`;
        const { error: upErr } = await sb.storage
          .from("mechanics")
          .upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { data: pub } = sb.storage.from("mechanics").getPublicUrl(path);
        photo_url = pub?.publicUrl || photo_url;
      }

      const payload = {
        name,
        specialty,
        vehicle_specialties: $("mechanicCars")?.value.trim() || null,
        service_area: $("mechanicArea")?.value.trim() || null,
        phone: $("mechanicPhone")?.value.trim() || null,
        bio: $("mechanicBio")?.value.trim() || null,
        photo_url,
        verified: true,
        active: true,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = id
        ? await sb.from("mechanics").update(payload).eq("id", id).select("id").single()
        : await sb.from("mechanics").insert(payload).select("id").single();
      if (error) throw error;

      await recordAdminAudit(
        id ? "update_mechanic" : "create_mechanic",
        "mechanic",
        data?.id || id,
        `${id ? "Updated" : "Added"} verified mechanic ${name}`
      );
      closeMechanicForm();
      toast("Verified mechanic saved.", "ok");
      await loadMechanics({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    } catch (err) {
      if (errEl) {
        errEl.textContent = err?.message || "Could not save mechanic.";
        errEl.classList.remove("hidden");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  $("mechanicAdminList")?.addEventListener("click", async (e) => {
    const edit = e.target.closest("[data-mech-edit]");
    if (edit) {
      const m = state.mechanics.find((x) => String(x.id) === edit.dataset.mechEdit);
      if (m) openMechanicForm(m);
      return;
    }
    const tog = e.target.closest("[data-mech-toggle]");
    if (tog) {
      const m = state.mechanics.find((x) => String(x.id) === tog.dataset.mechToggle);
      if (!m) return;
      const next = m.active === false;
      const ok = await confirm({
        eyebrow: "MECHANIC VISIBILITY",
        title: `${next ? "Activate" : "Hide"} ${m.name}?`,
        message: next
          ? "They will appear in public directory listings and garage assignments."
          : "They will be hidden from the public directory while preserving past booking records.",
        confirmText: next ? "Activate mechanic" : "Hide mechanic",
      });
      if (!ok) return;
      const { error } = await sb
        .from("mechanics")
        .update({ active: next, updated_at: new Date().toISOString() })
        .eq("id", m.id);
      if (error) {
        showNotice("Could not update mechanic status: " + error.message, "err");
        return;
      }
      await recordAdminAudit(
        "toggle_mechanic",
        "mechanic",
        m.id,
        `${next ? "Activated" : "Hid"} mechanic ${m.name}`
      );
      toast(`${m.name} ${next ? "activated" : "hidden"}.`, "ok");
      await loadMechanics({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
      return;
    }
    const del = e.target.closest("[data-mech-delete]");
    if (del) {
      const m = state.mechanics.find((x) => String(x.id) === del.dataset.mechDelete);
      if (!m) return;
      const ok = await confirm({
        eyebrow: "MECHANICS · DELETE",
        title: `Delete ${m.name}?`,
        message: "This removes the mechanic from the directory permanently.",
        confirmText: "Delete mechanic",
        danger: true,
      });
      if (!ok) return;
      const { error } = await sb.from("mechanics").delete().eq("id", m.id);
      if (error) {
        showNotice("Could not delete mechanic: " + error.message, "err");
        return;
      }
      await recordAdminAudit("delete_mechanic", "mechanic", m.id, `Deleted mechanic ${m.name}`);
      toast("Mechanic deleted.", "ok");
      await loadMechanics({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    }
  });

  A.registerLoader("bookingsPanel", loadBookings);
  A.registerLoader("chauffeurPanel", loadChauffeur);
  A.registerLoader("mechanicsPanel", loadMechanics);

  window.ThreePedalsAdminOps = {
    loadBookings,
    filterGarage: renderGarageBookings,
    loadChauffeur,
    filterChauffeur: renderChauffeurBookings,
    setChauffeurTab,
    loadMechanics,
    openGarageDrawer,
    openChauffeurDrawer,
  };
})();
