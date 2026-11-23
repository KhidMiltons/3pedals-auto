/* 3 Pedals Auto KE — Admin Console Core (Auth, Theme, Modals, Drawer, Print/PDF, Realtime, Global Search) */
(() => {
  "use strict";

  const CFG = window.SB_CONFIG || {};
  const sb =
    CFG.url && !/^PASTE/.test(CFG.url) && window.supabase
      ? window.supabase.createClient(CFG.url, CFG.key)
      : null;

  const THEME_KEY = "3pedals:theme";
  const SECTION_STORAGE_KEY = "adminActiveSection";
  const VALID_SECTIONS = [
    "overviewPanel",
    "requestsPanel",
    "listingsPanel",
    "bookingsPanel",
    "garageServicesPanel",
    "chauffeurPanel",
    "mechanicsPanel",
    "journalPanel",
    "projectsPanel",
    "contactPanel",
    "insightsPanel",
    "customersPanel",
    "calendarPanel",
    "auditPanel",
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  function safeUrl(url) {
    const raw = String(url ?? "").trim();
    if (!raw) return "";
    if (raw.startsWith("blob:") || raw.startsWith("/")) return raw;
    try {
      const parsed = new URL(raw, window.location.origin);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
    } catch (_) {}
    return "";
  }

  const fmt = (n) => Number(n || 0).toLocaleString("en-KE");
  const moneyKES = (n) =>
    "KES " + Number(n || 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });

  function fmtDate(value) {
    if (!value) return "Date unavailable";
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? "Date unavailable"
      : d.toLocaleString("en-KE", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Africa/Nairobi",
        });
  }

  function waNumber(value) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0")) digits = "254" + digits.slice(1);
    else if (digits.length === 9 && digits.startsWith("7")) digits = "254" + digits;
    return digits;
  }

  function debounce(fn, wait = 180) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  }

  function statusClass(raw) {
    const key = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    return key || "pending";
  }

  const state = {
    adminUserId: null,
    adminEmail: "",
    activeSection: "overviewPanel",
    listings: [],
    garageBookings: [],
    garageServices: [],
    chauffeurBookings: [],
    chauffeurDrivers: [],
    chauffeurFleet: [],
    chauffeurWaEvents: [],
    cancellations: [],
    contactEnquiries: [],
    mechanics: [],
    journalItems: [],
    projectItems: [],
    customers: [],
    loadedSections: new Set(),
    dirtyForms: new Set(),
    seenGarageIds: new Set(),
    garageInitialLoaded: false,
  };

  const sectionLoaders = new Map();
  let authCheckInProgress = false;
  let realtimeChannel = null;
  let periodicTimer = null;

  /* ===== Theme Toggle ===== */
  function getTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark") return t;
    } catch (_) {}
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f4efe4" : "#0c0e12");
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
    const btn = $("adminThemeToggle");
    if (btn) {
      btn.textContent = next === "light" ? "Dark theme" : "Light theme";
      btn.setAttribute("aria-pressed", String(next === "light"));
    }
  }

  /* ===== Notices & Toasts ===== */
  function showNotice(msg, type = "") {
    const n = $("notice");
    if (n) {
      n.textContent = msg;
      n.className = "notice" + (type ? " " + type : "");
      n.classList.remove("hidden");
    }
    toast(msg, type === "err" ? "err" : type === "ok" ? "ok" : "info");
  }

  function hideNotice() {
    $("notice")?.classList.add("hidden");
  }

  function toast(message, kind = "info", durationMs = 4200) {
    const text = String(message || "").trim();
    const host = $("adminToastHost");
    if (!text || !host) return;
    const el = document.createElement("div");
    el.className = `admin-toast admin-toast--${kind}`;
    el.setAttribute("role", kind === "err" ? "alert" : "status");
    el.innerHTML = `<span>${esc(text)}</span><button type="button" class="admin-toast-close" aria-label="Dismiss">×</button>`;
    const remove = () => {
      if (el.isConnected) el.remove();
    };
    el.querySelector(".admin-toast-close")?.addEventListener("click", remove);
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild?.remove();
    window.setTimeout(remove, durationMs);
  }

  function markSynced() {
    const el = $("adminLastSync");
    if (!el) return;
    el.textContent =
      "Synced " +
      new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
  }

  /* ===== Dirty Form Guard ===== */
  function markDirty(key, isDirty = true) {
    if (!key) return;
    if (isDirty) state.dirtyForms.add(key);
    else state.dirtyForms.delete(key);
  }

  async function confirmDiscardIfDirty() {
    if (!state.dirtyForms.size) return true;
    const ok = await confirm({
      eyebrow: "UNSAVED CHANGES",
      title: "Discard unsaved edits?",
      message:
        "You have unsaved changes in an open editor. Leave without saving?",
      confirmText: "Discard changes",
      danger: true,
    });
    if (ok) state.dirtyForms.clear();
    return ok;
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.dirtyForms.size) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ===== Confirmation & Prompt Dialogs (No Native confirm()) ===== */
  function openActionDialog(config) {
    const dlg = $("adminActionDlg");
    return new Promise((resolve) => {
      if (!dlg) {
        resolve(config?.mode === "confirm" ? false : null);
        return;
      }
      if (dlg.open) dlg.close();
      const {
        mode = "confirm",
        eyebrow = "Confirm action",
        title = "Please confirm",
        message = "",
        helperNote = "",
        confirmText = "Confirm",
        cancelText = "Cancel",
        danger = false,
        label = "",
        placeholder = "",
        inputType = "text",
        defaultValue = "",
        required = false,
        multiline = false,
      } = config || {};

      const fieldId = "adminActionInput";
      const fieldMarkup =
        mode === "prompt"
          ? `<div>
              ${label ? `<label for="${fieldId}">${esc(label)}</label>` : ""}
              ${
                multiline
                  ? `<textarea id="${fieldId}" rows="3" placeholder="${esc(placeholder)}">${esc(defaultValue)}</textarea>`
                  : `<input id="${fieldId}" type="${esc(inputType)}" value="${esc(defaultValue)}" placeholder="${esc(placeholder)}">`
              }
            </div>`
          : "";

      dlg.innerHTML = `
        <form class="admin-dialog-inner" novalidate>
          <div class="admin-dialog-head">
            <div>
              <span class="panel-eyebrow">${esc(eyebrow)}</span>
              <h2 id="adminActionTitle">${esc(title)}</h2>
            </div>
            <button type="button" class="admin-dialog-close" data-dlg-cancel aria-label="Close">×</button>
          </div>
          ${message ? `<p class="meta" style="margin:6px 0 0">${esc(message)}</p>` : ""}
          ${fieldMarkup}
          ${helperNote ? `<p class="meta" style="margin:8px 0 0">${esc(helperNote)}</p>` : ""}
          <p id="adminActionErr" class="notice err hidden" style="margin:12px 0 0" role="alert"></p>
          <div class="admin-dialog-btns">
            <button type="button" class="ghost" data-dlg-cancel>${esc(cancelText)}</button>
            <button type="submit" class="${danger ? "danger" : "primary"}">${esc(confirmText)}</button>
          </div>
        </form>`;

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        if (dlg.open) dlg.close();
        resolve(val);
      };

      const form = dlg.querySelector("form");
      const input = dlg.querySelector(`#${fieldId}`);
      const errEl = dlg.querySelector("#adminActionErr");

      dlg.querySelectorAll("[data-dlg-cancel]").forEach((btn) =>
        btn.addEventListener("click", () => finish(mode === "confirm" ? false : null))
      );
      dlg.addEventListener(
        "cancel",
        (ev) => {
          ev.preventDefault();
          finish(mode === "confirm" ? false : null);
        },
        { once: true }
      );
      dlg.addEventListener(
        "click",
        (ev) => {
          if (ev.target === dlg) finish(mode === "confirm" ? false : null);
        },
        { once: true }
      );

      form?.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (mode === "confirm") {
          finish(true);
          return;
        }
        const trimmed = String(input?.value || "").trim();
        if (required && !trimmed) {
          if (errEl) {
            errEl.textContent = "Please complete this field before continuing.";
            errEl.classList.remove("hidden");
          }
          input?.focus();
          return;
        }
        finish(trimmed);
      });

      dlg.showModal();
      window.requestAnimationFrame(() => {
        if (input) input.focus();
        else dlg.querySelector('[type="submit"]')?.focus();
      });
    });
  }

  const confirm = (opts) => openActionDialog({ ...(opts || {}), mode: "confirm" });
  const prompt = (opts) => openActionDialog({ ...(opts || {}), mode: "prompt" });

  /* ===== Slide-Over Detail & Triage Drawer ===== */
  let drawerReturnFocus = null;

  function openDrawer({ eyebrow = "", title = "Details", subtitle = "", bodyHtml = "", footerHtml = "", onMount = null }) {
    const drawer = $("adminDrawer");
    const backdrop = $("adminDrawerBackdrop");
    if (!drawer || !backdrop) return;
    drawerReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    $("adminDrawerEyebrow").textContent = eyebrow;
    $("adminDrawerTitle").textContent = title;
    $("adminDrawerSubtitle").textContent = subtitle;
    $("adminDrawerBody").innerHTML = bodyHtml;
    $("adminDrawerFoot").innerHTML = footerHtml;
    backdrop.classList.remove("hidden");
    drawer.classList.remove("hidden");
    window.requestAnimationFrame(() => drawer.classList.add("open"));
    if (typeof onMount === "function") onMount(drawer);
    $("adminDrawerClose")?.focus();
  }

  function closeDrawer() {
    const drawer = $("adminDrawer");
    const backdrop = $("adminDrawerBackdrop");
    if (!drawer || !backdrop) return;
    drawer.classList.remove("open");
    window.setTimeout(() => {
      if (!drawer.classList.contains("open")) {
        drawer.classList.add("hidden");
        backdrop.classList.add("hidden");
      }
    }, 200);
    if (drawerReturnFocus?.isConnected) drawerReturnFocus.focus();
  }

  /* ===== In-Page Print & PDF Summary Dialog (Replaces Blocked window.open) ===== */
  let currentPrintPayload = null;

  function openPrintSheet(title, subtitle, fields) {
    const dlg = $("adminPrintDlg");
    const sheet = $("adminPrintSheet");
    if (!dlg || !sheet) return;
    currentPrintPayload = { title, subtitle, fields };
    $("adminPrintTitle").textContent = title;
    const rowsHtml = (fields || [])
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v || "—")}</td></tr>`)
      .join("");
    sheet.innerHTML = `
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9b793b;font-weight:700">3 Pedals Auto KE</div>
      <h2 style="margin:4px 0;color:#171717;font-size:20px">${esc(title)}</h2>
      <p style="margin:0 0 14px;color:#555;font-size:13px">${esc(subtitle)}</p>
      <table>${rowsHtml}</table>
      <p style="margin:18px 0 0;color:#666;font-size:11px">Generated from the 3 Pedals Auto KE administration console on ${esc(
        fmtDate(new Date().toISOString())
      )}.</p>`;
    dlg.showModal();
  }

  function downloadPrintSheetPdf() {
    if (!currentPrintPayload) return;
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) {
      toast("PDF generator is still loading — please use Print sheet or retry in a moment.", "err");
      return;
    }
    const { title, subtitle, fields } = currentPrintPayload;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(154, 122, 62);
    doc.text("3 PEDALS AUTO KE", 44, y);
    y += 22;
    doc.setFontSize(18);
    doc.setTextColor(23, 23, 23);
    doc.text(String(title || "Summary"), 44, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(String(subtitle || ""), 44, y);
    y += 24;
    doc.setDrawColor(215, 210, 200);
    doc.line(44, y, 550, y);
    y += 18;

    for (const [label, value] of fields || []) {
      const wrappedVal = doc.splitTextToSize(String(value || "—"), 330);
      const rowHeight = Math.max(20, wrappedVal.length * 14 + 8);
      if (y + rowHeight > 780) {
        doc.addPage();
        y = 48;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(String(label || ""), 44, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(23, 23, 23);
      doc.text(wrappedVal, 210, y);
      y += rowHeight;
    }

    const safeName = String(title || "3pedals-sheet")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    doc.save(`${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast("PDF summary downloaded.", "ok");
  }

  /* ===== CSV Utilities (Formula-Injection Safe) ===== */
  function csvCell(value) {
    let v = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return '"' + v.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, headers, rows) {
    const csv =
      "\uFEFF" +
      [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ===== Photo Lightbox ===== */
  let lightboxPhotos = [];
  let lightboxIndex = 0;
  let lightboxReturnFocus = null;

  function showLightboxPhoto(idx) {
    if (!lightboxPhotos.length) return;
    lightboxIndex = (idx + lightboxPhotos.length) % lightboxPhotos.length;
    const img = $("photoLightboxImage");
    if (img) {
      img.src = lightboxPhotos[lightboxIndex];
      img.alt = `Vehicle photo ${lightboxIndex + 1} of ${lightboxPhotos.length}`;
    }
    const count = $("photoLightboxCount");
    if (count) count.textContent = `${lightboxIndex + 1} / ${lightboxPhotos.length}`;
    if ($("photoLightboxPrev")) $("photoLightboxPrev").hidden = lightboxPhotos.length < 2;
    if ($("photoLightboxNext")) $("photoLightboxNext").hidden = lightboxPhotos.length < 2;
  }

  function openLightbox(photos, idx = 0, triggerEl = null) {
    const box = $("photoLightbox");
    if (!box || !photos?.length) return;
    lightboxPhotos = photos;
    lightboxReturnFocus = triggerEl || document.activeElement;
    showLightboxPhoto(idx);
    box.classList.remove("hidden");
    box.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    $("photoLightboxClose")?.focus();
  }

  function closeLightbox() {
    const box = $("photoLightbox");
    if (!box || box.classList.contains("hidden")) return;
    box.classList.add("hidden");
    box.setAttribute("aria-hidden", "true");
    if ($("photoLightboxImage")) $("photoLightboxImage").src = "";
    document.body.style.overflow = "";
    if (lightboxReturnFocus?.isConnected) lightboxReturnFocus.focus();
  }

  /* ===== Reliable Verified Audit Logger ===== */
  async function recordAdminAudit(action, entityType, entityId, summary) {
    if (!state.adminUserId || !sb) return;
    const { error } = await sb.from("admin_audit_log").insert({
      actor_id: state.adminUserId,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      summary: String(summary || "Admin action").slice(0, 500),
    });
    if (error) console.warn("Admin audit log insert skipped:", error.message);
  }

  /* ===== Sidebar & Section Router (With Lazy Loading) ===== */
  function registerLoader(sectionId, loaderFn) {
    sectionLoaders.set(sectionId, loaderFn);
  }

  function toggleMobileMenu(forceOpen) {
    const sidebar = $("adminSidebar");
    const backdrop = $("adminMenuBackdrop");
    const toggle = $("adminMenuToggle");
    if (!sidebar || !backdrop) return;
    const isOpen =
      typeof forceOpen === "boolean" ? forceOpen : !sidebar.classList.contains("mobile-open");
    sidebar.classList.toggle("mobile-open", isOpen);
    backdrop.classList.toggle("open", isOpen);
    toggle?.setAttribute("aria-expanded", String(isOpen));
  }

  async function activateSection(sectionId, options = {}) {
    const target = VALID_SECTIONS.includes(sectionId) ? sectionId : "overviewPanel";
    if (target !== state.activeSection && !options.skipDirtyCheck) {
      const ok = await confirmDiscardIfDirty();
      if (!ok) return state.activeSection;
    }

    state.activeSection = target;
    try {
      sessionStorage.setItem(SECTION_STORAGE_KEY, target);
    } catch (_) {}

    let activeLabel = "Operations overview";
    document.querySelectorAll(".admin-nav-btn[data-section]").forEach((btn) => {
      const isMatch = btn.dataset.section === target;
      btn.classList.toggle("active", isMatch);
      if (isMatch) {
        btn.setAttribute("aria-current", "page");
        activeLabel = btn.dataset.label || btn.textContent.trim();
      } else {
        btn.removeAttribute("aria-current");
      }
    });

    if ($("adminBreadcrumbCurrent")) $("adminBreadcrumbCurrent").textContent = activeLabel;

    VALID_SECTIONS.forEach((id) => {
      const panel = $(id);
      if (panel) panel.classList.toggle("section-hidden", id !== target);
    });

    if (target === "bookingsPanel" && $("newBookingBadge")) {
      $("newBookingBadge").textContent = "";
    }

    toggleMobileMenu(false);

    const loader = sectionLoaders.get(target);
    if (loader && (options.forceRefresh || !state.loadedSections.has(target))) {
      state.loadedSections.add(target);
      try {
        await loader(options);
      } catch (err) {
        state.loadedSections.delete(target);
        showNotice("Could not load section: " + (err?.message || err), "err");
      }
    }

    const panel = $(target);
    if (panel) {
      panel.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    return target;
  }

  /* ===== Global Command Search (Ctrl+K, All Entities) ===== */
  function buildGlobalHits(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits = [];

    for (const x of state.listings) {
      if (
        [x.make, x.model, x.year, x.seller_name, x.seller_phone, x.yard_name, x.yard_location]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) {
        hits.push({
          title: [x.year, x.make, x.model].filter(Boolean).join(" ") || "Vehicle listing",
          sub: `${x.seller_name || x.yard_name || "Seller"} · ${x.status || ""}`,
          kind: "Vehicle",
          section: "listingsPanel",
          onSelect: () => {
            if ($("listingSearch")) $("listingSearch").value = x.make || x.model || query;
            window.ThreePedalsAdminListings?.setFilter("all");
          },
        });
        if (hits.length >= 24) break;
      }
    }

    for (const b of state.garageBookings) {
      if ([b.name, b.phone, b.service, b.car, b.ref, b.location].join(" ").toLowerCase().includes(q)) {
        hits.push({
          title: `${b.name || "Customer"} · ${b.service || "Garage job"}`,
          sub: `${b.ref || ""} · ${b.car || ""}`,
          kind: "Garage",
          section: "bookingsPanel",
          onSelect: () => {
            if ($("garageBookingSearch")) $("garageBookingSearch").value = b.ref || b.name || query;
            window.ThreePedalsAdminOps?.filterGarage?.();
          },
        });
      }
    }

    for (const s of state.garageServices) {
      if ([s.name, s.duration, s.description, s.price_kes].join(" ").toLowerCase().includes(q)) {
        hits.push({
          title: s.name || "Garage service",
          sub: `${moneyKES(s.price_kes || 0)} · ${s.duration || ""} · ${s.active !== false ? "Active" : "Hidden"}`,
          kind: "Service",
          section: "garageServicesPanel",
          onSelect: () => {
            if ($("garageServiceSearch")) $("garageServiceSearch").value = s.name || query;
            window.ThreePedalsAdminOps?.filterGarageServices?.();
          },
        });
      }
    }

    for (const c of state.chauffeurBookings) {
      if (
        [c.customer_name, c.customer_phone, c.booking_ref, c.pickup_location, c.destination]
          .join(" ")
          .toLowerCase()
          .includes(q)
      ) {
        hits.push({
          title: `${c.booking_ref || "Chauffeur"} · ${c.customer_name || "Customer"}`,
          sub: `${c.pickup_location || ""} → ${c.destination || ""}`,
          kind: "Chauffeur",
          section: "chauffeurPanel",
          onSelect: () => {
            window.ThreePedalsAdminOps?.setChauffeurTab?.("bookings");
            if ($("chauffeurBookingSearch")) $("chauffeurBookingSearch").value = c.booking_ref || c.customer_name || query;
            window.ThreePedalsAdminOps?.filterChauffeur?.();
          },
        });
      }
    }

    for (const a of state.journalItems) {
      if ([a.title, a.category, a.description].join(" ").toLowerCase().includes(q)) {
        hits.push({
          title: a.title || "Journal article",
          sub: `${a.category || "Article"} · ${a.published ? "Published" : "Draft"}`,
          kind: "Journal",
          section: "journalPanel",
        });
      }
    }

    for (const p of state.projectItems) {
      if ([p.title, p.category, p.description].join(" ").toLowerCase().includes(q)) {
        hits.push({
          title: p.title || "Project",
          sub: p.category || "Workshop project",
          kind: "Project",
          section: "projectsPanel",
        });
      }
    }

    for (const m of state.mechanics) {
      if ([m.name, m.specialty, m.vehicle_specialties, m.service_area].join(" ").toLowerCase().includes(q)) {
        hits.push({
          title: m.name || "Mechanic",
          sub: `${m.specialty || ""} · ${m.service_area || ""}`,
          kind: "Mechanic",
          section: "mechanicsPanel",
        });
      }
    }

    for (const e of state.contactEnquiries) {
      if ([e.name, e.email, e.phone, e.subject].join(" ").toLowerCase().includes(q)) {
        hits.push({
          title: e.subject || "Website enquiry",
          sub: `${e.name || ""} · ${e.status || ""}`,
          kind: "Enquiry",
          section: "requestsPanel",
          onSelect: () => {
            if ($("requestInboxSearch")) $("requestInboxSearch").value = e.name || e.subject || query;
          },
        });
      }
    }

    return hits.slice(0, 14);
  }

  /* ===== Multiplexed, Debounced Realtime Manager ===== */
  const debouncedRealtimeSync = debounce(async () => {
    if (document.hidden || !state.adminUserId) return;
    try {
      const ovLoader = sectionLoaders.get("overviewPanel");
      if (ovLoader) await ovLoader({ silent: true });
      const activeLoader = sectionLoaders.get(state.activeSection);
      if (activeLoader && state.activeSection !== "overviewPanel") {
        await activeLoader({ silent: true });
      }
      markSynced();
    } catch (err) {
      console.warn("Realtime sync failed:", err);
    }
  }, 450);

  function setupRealtime() {
    if (!sb) return;
    if (!realtimeChannel) {
      realtimeChannel = sb
        .channel("admin-ops-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
          if (payload.eventType === "INSERT" && payload.new?.id) {
            const id = String(payload.new.id);
            if (!state.seenGarageIds.has(id)) {
              state.seenGarageIds.add(id);
              if ($("newBookingBadge")) $("newBookingBadge").textContent = "NEW";
              toast(
                `New garage request: ${payload.new.service || "Service"}${
                  payload.new.name ? " from " + payload.new.name : ""
                }`,
                "ok"
              );
            }
          }
          debouncedRealtimeSync();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "chauffeur_bookings" }, () => {
          debouncedRealtimeSync();
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "contact_enquiries" }, (p) => {
          toast(`New website enquiry${p.new?.name ? " from " + p.new.name : ""}.`, "info");
          debouncedRealtimeSync();
        })
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chauffeur_cancellation_requests" },
          () => {
            toast("New chauffeur cancellation or restoration request received.", "info");
            debouncedRealtimeSync();
          }
        )
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" }, () => {
          toast("New vehicle listing submitted for moderation.", "info");
          debouncedRealtimeSync();
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listing_promotions" }, () => {
          debouncedRealtimeSync();
        })
        .subscribe();
    }

    if (!periodicTimer) {
      periodicTimer = window.setInterval(() => {
        if (!document.hidden && state.adminUserId) {
          sectionLoaders.get("overviewPanel")?.({ silent: true });
        }
      }, 60000);
    }
  }

  /* ===== Auth & Bootstrap ===== */
  async function checkAdmin() {
    if (!sb) {
      $("login")?.classList.remove("hidden");
      showNotice("Supabase is not configured. Ensure config.js is loaded.", "err");
      return;
    }
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      state.adminUserId = null;
      $("login")?.classList.remove("hidden");
      $("app")?.classList.add("hidden");
      return;
    }
    const { data: profile, error } = await sb
      .from("profiles")
      .select("is_admin,name,email")
      .eq("id", user.id)
      .single();
    if (error || !profile?.is_admin) {
      state.adminUserId = null;
      $("login")?.classList.remove("hidden");
      $("app")?.classList.add("hidden");
      if ($("loginErr")) {
        $("loginErr").textContent = "This account does not have administrator privileges.";
        $("loginErr").classList.remove("hidden");
      }
      await sb.auth.signOut();
      return;
    }

    state.adminUserId = user.id;
    state.adminEmail = profile.name || user.email || "Administrator";
    if ($("adminEmailLabel")) $("adminEmailLabel").textContent = state.adminEmail;

    $("login")?.classList.add("hidden");
    $("app")?.classList.remove("hidden");

    let saved = "overviewPanel";
    try {
      saved = sessionStorage.getItem(SECTION_STORAGE_KEY) || "overviewPanel";
    } catch (_) {}

    // Lightweight initial boot: load overview counters + active panel only; lazy-load remaining panels on demand.
    await activateSection(saved, { forceRefresh: true, skipDirtyCheck: true });
    if (saved !== "overviewPanel") {
      await sectionLoaders.get("overviewPanel")?.({ silent: true });
    }
    markSynced();
    setupRealtime();
  }

  async function runAdminCheck() {
    if (authCheckInProgress) return;
    authCheckInProgress = true;
    try {
      await checkAdmin();
    } finally {
      authCheckInProgress = false;
    }
  }

  /* ===== Wire Shell Events ===== */
  applyTheme(getTheme());

  $("adminThemeToggle")?.addEventListener("click", () => {
    applyTheme(getTheme() === "light" ? "dark" : "light");
  });

  $("adminMenuToggle")?.addEventListener("click", () => toggleMobileMenu());
  $("adminMenuBackdrop")?.addEventListener("click", () => toggleMobileMenu(false));

  document.querySelectorAll(".admin-nav-btn[data-section]").forEach((btn) => {
    btn.addEventListener("click", () => activateSection(btn.dataset.section));
  });

  document.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-jump-section],[data-empty-nav],[data-task-section]");
    if (jump) {
      const target =
        jump.dataset.jumpSection || jump.dataset.emptyNav || jump.dataset.taskSection;
      if (target) activateSection(target);
      return;
    }

    const photoLink = e.target.closest("a.admin-photo-open");
    if (photoLink) {
      e.preventDefault();
      const gallery = photoLink.closest(".photos");
      const urls = Array.from(gallery?.querySelectorAll("a.admin-photo-open") || []).map(
        (a) => a.href
      );
      openLightbox(urls, Number(photoLink.dataset.photoIndex) || 0, photoLink);
      return;
    }

    const lb = $("photoLightbox");
    if (e.target === lb || e.target.closest("#photoLightboxClose")) closeLightbox();
    else if (e.target.closest("#photoLightboxPrev")) showLightboxPhoto(lightboxIndex - 1);
    else if (e.target.closest("#photoLightboxNext")) showLightboxPhoto(lightboxIndex + 1);
  });

  $("adminDrawerClose")?.addEventListener("click", closeDrawer);
  $("adminDrawerBackdrop")?.addEventListener("click", closeDrawer);

  $("adminPrintClose")?.addEventListener("click", () => $("adminPrintDlg")?.close());
  $("adminPrintDismiss")?.addEventListener("click", () => $("adminPrintDlg")?.close());
  $("adminPrintBrowserBtn")?.addEventListener("click", () => window.print());
  $("adminPrintPdfBtn")?.addEventListener("click", downloadPrintSheetPdf);

  $("loginBtn")?.addEventListener("click", async () => {
    const email = $("email")?.value.trim();
    const password = $("password")?.value || "";
    const err = $("loginErr");
    err?.classList.add("hidden");
    if (!email || !password) {
      if (err) {
        err.textContent = "Enter your email and password.";
        err.classList.remove("hidden");
      }
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (err) {
        err.textContent = error.message;
        err.classList.remove("hidden");
      }
      return;
    }
    runAdminCheck();
  });

  $("password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      $("loginBtn")?.click();
    }
  });

  $("logout")?.addEventListener("click", async () => {
    if (!(await confirmDiscardIfDirty())) return;
    await sb?.auth.signOut();
    window.location.reload();
  });

  $("homeBtn")?.addEventListener("click", async () => {
    if (!(await confirmDiscardIfDirty())) return;
    try {
      sessionStorage.setItem("3pedals:account-open", "1");
      if (!sessionStorage.getItem("3pedals:account-page")) {
        sessionStorage.setItem("3pedals:account-page", "settings");
      }
    } catch (_) {}
    window.location.href = "/";
  });

  $("refresh")?.addEventListener("click", async () => {
    const btn = $("refresh");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = "Refreshing…";
    try {
      await sectionLoaders.get(state.activeSection)?.({ forceRefresh: true });
      if (state.activeSection !== "overviewPanel") {
        await sectionLoaders.get("overviewPanel")?.({ silent: true });
      }
      markSynced();
      toast("Current workspace refreshed.", "ok");
    } catch (err) {
      showNotice("Refresh failed: " + (err?.message || err), "err");
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  /* Global Search Events + Keyboard Shortcuts */
  let activeSearchHits = [];
  const searchInput = $("adminGlobalSearch");
  const searchOut = $("adminGlobalResults");

  const runGlobalSearch = debounce(() => {
    if (!searchInput || !searchOut) return;
    const q = searchInput.value || "";
    if (q.trim().length < 2) {
      searchOut.hidden = true;
      activeSearchHits = [];
      return;
    }
    activeSearchHits = buildGlobalHits(q);
    searchOut.innerHTML = activeSearchHits.length
      ? activeSearchHits
          .map(
            (hit, idx) => `
          <button type="button" class="admin-global-hit" data-global-hit="${idx}">
            <div>
              <strong>${esc(hit.title)}</strong>
              <span>${esc(hit.sub)}</span>
            </div>
            <em>${esc(hit.kind)}</em>
          </button>`
          )
          .join("")
      : `<div class="empty" style="padding:18px">No matching records in loaded admin datasets. Open a section to index its records or try another keyword.</div>`;
    searchOut.hidden = false;
  }, 140);

  searchInput?.addEventListener("input", runGlobalSearch);
  searchInput?.addEventListener("focus", () => {
    if (searchInput.value.trim().length >= 2) runGlobalSearch();
  });

  searchOut?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-global-hit]");
    if (!btn) return;
    const hit = activeSearchHits[Number(btn.dataset.globalHit)];
    if (!hit) return;
    searchOut.hidden = true;
    searchInput.blur();
    await activateSection(hit.section);
    hit.onSelect?.();
  });

  document.addEventListener("click", (e) => {
    if (searchOut && !searchOut.hidden && !e.target.closest(".admin-global-search")) {
      searchOut.hidden = true;
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
      return;
    }
    if (e.key === "Escape") {
      if (searchOut && !searchOut.hidden) {
        searchOut.hidden = true;
        searchInput?.blur();
      } else if ($("photoLightbox") && !$("photoLightbox").classList.contains("hidden")) {
        closeLightbox();
      } else if ($("adminDrawer")?.classList.contains("open")) {
        closeDrawer();
      }
      return;
    }
    const lb = $("photoLightbox");
    if (lb && !lb.classList.contains("hidden")) {
      if (e.key === "ArrowLeft") showLightboxPhoto(lightboxIndex - 1);
      else if (e.key === "ArrowRight") showLightboxPhoto(lightboxIndex + 1);
    }
  });

  window.ThreePedalsAdmin = {
    sb,
    $,
    esc,
    safeUrl,
    fmt,
    moneyKES,
    fmtDate,
    waNumber,
    debounce,
    statusClass,
    state,
    showNotice,
    hideNotice,
    toast,
    confirm,
    prompt,
    openDrawer,
    closeDrawer,
    openPrintSheet,
    openLightbox,
    csvCell,
    downloadCsv,
    recordAdminAudit,
    markDirty,
    markSynced,
    registerLoader,
    activateSection,
    boot: () => {
      sb?.auth.onAuthStateChange(() => window.setTimeout(runAdminCheck, 0));
      runAdminCheck();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.ThreePedalsAdmin.boot(), {
      once: true,
    });
  } else {
    queueMicrotask(() => window.ThreePedalsAdmin.boot());
  }
})();
