/* 3 Pedals Auto KE — Analytics, Customer Directory, Operations Calendar & Audit History */
(() => {
  "use strict";

  const A = window.ThreePedalsAdmin;
  if (!A) return;
  const {
    $,
    esc,
    fmt,
    moneyKES,
    fmtDate,
    debounce,
    statusClass,
    state,
    showNotice,
    toast,
    downloadCsv,
    sb,
  } = A;

  const PAGE_SIZE = 25;
  let customerPage = 1;
  let auditRowsCache = [];

  /* =========================================================
     1. ANALYTICS & BUSINESS INTELLIGENCE
     ========================================================= */
  function weekKey(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return monday.toISOString().slice(0, 10);
  }

  async function loadInsights(opts = {}) {
    if (!sb) return;
    if (!opts.silent && $("insightsStatus")) {
      $("insightsStatus").innerHTML = '<div class="meta">Loading marketplace &amp; payment analytics…</div>';
    }

    const since = new Date(Date.now() - 42 * 86400000).toISOString();
    const results = await Promise.all([
      sb
        .from("seller_listing_analytics")
        .select("listing_id,event_type,created_at")
        .gte("created_at", since)
        .limit(5000),
      sb
        .from("listings")
        .select("id,make,model,year,price,status,seller_name,yard_name,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      sb
        .from("listing_promotions")
        .select("id,listing_id,amount,payment_status,status,created_at")
        .limit(1000),
      sb
        .from("seller_sales")
        .select("listing_id,reported_sale_price,created_at")
        .limit(1000),
      sb
        .from("chauffeur_bookings")
        .select("id,status,payment_status,final_amount,quoted_amount,created_at")
        .limit(1000),
    ]);

    const [evRes, lsRes, prRes, slRes, chRes] = results;
    const events = evRes.data || [];
    const listings = lsRes.data || state.listings || [];
    const promos = prRes.data || [];
    const sales = slRes.data || [];
    const chauffeur = chRes.data || [];

    if (!lsRes.error && lsRes.data) state.listings = lsRes.data;

    const views = events.filter((e) => e.event_type === "view");
    const waClicks = events.filter((e) => e.event_type === "whatsapp_click");
    const approved = listings.filter((l) => l.status === "approved");
    const paidPromos = promos.filter((p) =>
      ["paid", "verified"].includes(String(p.payment_status || "").toLowerCase())
    );
    const promoAttempted = promos.filter((p) => p.payment_status);
    const promoSuccessRate = promoAttempted.length
      ? Math.round((paidPromos.length / promoAttempted.length) * 100)
      : 0;
    const waRate = views.length ? ((waClicks.length / views.length) * 100).toFixed(1) : "0";

    const set = (id, v) => {
      if ($(id)) $(id).textContent = String(v);
    };
    set("insViews", fmt(views.length));
    set("insWhatsapp", fmt(waClicks.length));
    set("insWhatsappRate", `${waRate}%`);
    set("insListings", fmt(approved.length));
    set("insSales", fmt(sales.length));
    set("insPaidPromos", fmt(paidPromos.length));
    set("insConversion", `${promoSuccessRate}%`);

    if ($("insFunnel")) {
      const funnelSteps = [
        [fmt(listings.length), "Total listings submitted", "All marketplace vehicles"],
        [fmt(approved.length), "Approved & live", `${listings.filter((x) => x.status === "pending").length} currently pending`],
        [fmt(views.length), "Vehicle detail views (42d)", `${fmt(waClicks.length)} WhatsApp intent clicks`],
        [fmt(sales.length), "Seller-reported sales", "Recorded in seller dashboard"],
      ];
      $("insFunnel").innerHTML = funnelSteps
        .map(
          ([n, label, sub]) => `
        <div class="funnel-step">
          <strong>${n}</strong>
          <span>${esc(label)}</span>
          <small>${esc(sub)}</small>
        </div>`
        )
        .join("");
    }

    if ($("insightsStatus")) {
      const checks = [
        ["Listing events", evRes.error],
        ["Listings", lsRes.error],
        ["Promotions", prRes.error],
        ["Sales reports", slRes.error],
        ["Chauffeur", chRes.error],
      ];
      $("insightsStatus").innerHTML = `
        <strong>Data source health (last 42 days)</strong>
        <div class="admin-source-status">
          ${checks
            .map(
              ([name, err]) =>
                `<span class="${err ? "failed" : ""}">${esc(name)}: ${
                  err ? "Unavailable (" + esc(err.message) + ")" : "Connected"
                }</span>`
            )
            .join("")}
        </div>`;
    }

    // 6-Week Marketplace Activity Bars
    if ($("insMarketplace")) {
      const weeks = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.now() - i * 7 * 86400000);
        const wk = weekKey(d.toISOString());
        if (wk && !weeks.includes(wk)) weeks.push(wk);
      }
      const weekData = weeks.map((wk) => {
        const vCount = views.filter((e) => weekKey(e.created_at) === wk).length;
        const wCount = waClicks.filter((e) => weekKey(e.created_at) === wk).length;
        const lCount = listings.filter((l) => weekKey(l.created_at) === wk).length;
        return { wk, vCount, wCount, lCount };
      });
      const maxViews = Math.max(1, ...weekData.map((w) => w.vCount));
      $("insMarketplace").innerHTML = `
        <div class="insight-bars">
          ${weekData
            .map((w) => {
              const pct = Math.max(4, Math.round((w.vCount / maxViews) * 100));
              return `
              <div class="insight-bar-row">
                <span class="mono">${esc(w.wk.slice(5))}</span>
                <div><i style="width:${pct}%"></i></div>
                <span>${fmt(w.vCount)} views</span>
                <small class="meta">${fmt(w.wCount)} WA · ${fmt(w.lCount)} cars</small>
              </div>`;
            })
            .join("")}
        </div>`;
    }

    // Revenue & Payment Mix
    const promoRev = paidPromos.reduce((a, p) => a + Number(p.amount || 0), 0);
    const chPaid = chauffeur.filter((c) => c.payment_status === "paid");
    const chRev = chPaid.reduce((a, c) => a + Number(c.final_amount || 0), 0);
    const salesVal = sales.reduce((a, s) => a + Number(s.reported_sale_price || 0), 0);

    if ($("insRevenue")) {
      $("insRevenue").innerHTML = `
        <div class="overview-revenue" style="margin-bottom:14px">
          <div><strong>${esc(moneyKES(chRev))}</strong><span>Paid chauffeur (${chPaid.length})</span></div>
          <div><strong>${esc(moneyKES(promoRev))}</strong><span>Paid promos (${paidPromos.length})</span></div>
          <div><strong>${esc(moneyKES(salesVal))}</strong><span>Reported sales (${sales.length})</span></div>
        </div>`;
    }

    if ($("insPayments")) {
      const pendingPromos = promos.filter((p) =>
        ["pending", "pending_confirmation"].includes(
          String(p.payment_status || p.status || "").toLowerCase()
        )
      ).length;
      const failedPromos = promos.filter(
        (p) => String(p.payment_status || "").toLowerCase() === "failed"
      ).length;
      const awaitingChauffeur = chauffeur.filter(
        (c) => c.status === "approved_awaiting_payment"
      ).length;

      $("insPayments").innerHTML = `
        <div class="fields">
          <div class="field"><strong>Confirmed promo M-Pesa</strong>${paidPromos.length} paid</div>
          <div class="field"><strong>Pending promo callbacks</strong>${pendingPromos} awaiting</div>
          <div class="field"><strong>Failed promo STK pushes</strong>${failedPromos} failed</div>
          <div class="field"><strong>Awaiting chauffeur M-Pesa</strong>${awaitingChauffeur} quotes</div>
        </div>`;
    }

    // Top Vehicle Engagement Table
    if ($("insTopListings")) {
      const counts = new Map();
      events.forEach((e) => {
        if (!e.listing_id) return;
        const id = String(e.listing_id);
        const cur = counts.get(id) || { views: 0, wa: 0 };
        if (e.event_type === "view") cur.views++;
        else if (e.event_type === "whatsapp_click") cur.wa++;
        counts.set(id, cur);
      });

      const ranked = [...counts.entries()]
        .map(([id, c]) => {
          const item = listings.find((l) => String(l.id) === id);
          return {
            id,
            title: item
              ? [item.year, item.make, item.model].filter(Boolean).join(" ")
              : `Listing ${id.slice(0, 8)}`,
            seller: item?.seller_name || item?.yard_name || "—",
            price: item?.price || 0,
            status: item?.status || "unknown",
            views: c.views,
            wa: c.wa,
          };
        })
        .sort((a, b) => b.views + b.wa * 3 - (a.views + a.wa * 3))
        .slice(0, 12);

      $("insTopListings").innerHTML = ranked.length
        ? `<div class="admin-table-wrap"><table class="admin-data-table">
            <thead><tr><th>Vehicle</th><th>Seller</th><th>Price</th><th>Status</th><th>Views</th><th>WhatsApp</th></tr></thead>
            <tbody>
              ${ranked
                .map(
                  (r) => `<tr>
                  <td><strong>${esc(r.title)}</strong></td>
                  <td>${esc(r.seller)}</td>
                  <td>${esc(moneyKES(r.price))}</td>
                  <td><span class="status ${esc(statusClass(r.status))}">${esc(r.status)}</span></td>
                  <td>${fmt(r.views)}</td>
                  <td>${fmt(r.wa)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table></div>`
        : '<div class="empty">No listing view or WhatsApp events recorded in the past 42 days.</div>';
    }

    // Inventory Ageing & Attention
    if ($("insInventory")) {
      const stale = approved
        .filter((l) => l.created_at && Date.now() - new Date(l.created_at).getTime() > 30 * 86400000)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .slice(0, 12);

      $("insInventory").innerHTML = stale.length
        ? `<div class="admin-table-wrap"><table class="admin-data-table">
            <thead><tr><th>Vehicle</th><th>Seller</th><th>Price</th><th>Listed on</th><th>Age</th></tr></thead>
            <tbody>
              ${stale
                .map((l) => {
                  const days = Math.floor((Date.now() - new Date(l.created_at).getTime()) / 86400000);
                  return `<tr>
                    <td><strong>${esc([l.year, l.make, l.model].filter(Boolean).join(" "))}</strong></td>
                    <td>${esc(l.seller_name || l.yard_name || "Seller")}</td>
                    <td>${esc(moneyKES(l.price))}</td>
                    <td>${esc(fmtDate(l.created_at))}</td>
                    <td>${days} days</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table></div>`
        : '<div class="empty">All live listings are under 30 days old.</div>';
    }
  }

  $("refreshInsights")?.addEventListener("click", () => loadInsights());

  /* =========================================================
     2. CUSTOMER DIRECTORY (Profiles + Bookings + Enquiries)
     ========================================================= */
  function buildCustomerDirectory(profiles, garage, chauffeur, enquiries) {
    const map = new Map();

    const mergeRecord = (key, fields) => {
      if (!key) return;
      const cur = map.get(key) || {
        name: "",
        email: "",
        phone: "",
        accountType: "Customer",
        garageCount: 0,
        chauffeurCount: 0,
        enquiryCount: 0,
        lastSeen: "",
      };
      if (fields.name && !cur.name) cur.name = fields.name;
      if (fields.email && !cur.email) cur.email = fields.email;
      if (fields.phone && !cur.phone) cur.phone = fields.phone;
      if (fields.accountType) cur.accountType = fields.accountType;
      cur.garageCount += fields.garage || 0;
      cur.chauffeurCount += fields.chauffeur || 0;
      cur.enquiryCount += fields.enquiry || 0;
      if (fields.when && (!cur.lastSeen || new Date(fields.when) > new Date(cur.lastSeen))) {
        cur.lastSeen = fields.when;
      }
      map.set(key, cur);
    };

    const keyFor = (userId, email, phone, fallbackName) => {
      if (userId) return `u:${userId}`;
      const em = String(email || "").trim().toLowerCase();
      if (em) return `e:${em}`;
      const ph = String(phone || "").replace(/\D/g, "");
      if (ph.length >= 7) return `p:${ph.slice(-9)}`;
      return fallbackName ? `n:${String(fallbackName).trim().toLowerCase()}` : null;
    };

    profiles.forEach((p) => {
      mergeRecord(`u:${p.id}`, {
        name: p.yard_name || p.name || "",
        email: p.email || "",
        phone: p.phone || "",
        accountType: p.is_admin ? "Admin" : p.account_type || "Registered",
        when: p.created_at,
      });
    });

    garage.forEach((b) => {
      mergeRecord(keyFor(b.user_id, null, b.phone, b.name), {
        name: b.name,
        phone: b.phone,
        garage: 1,
        when: b.created_at,
      });
    });

    chauffeur.forEach((c) => {
      mergeRecord(keyFor(c.user_id, null, c.customer_phone, c.customer_name), {
        name: c.customer_name,
        phone: c.customer_phone,
        chauffeur: 1,
        when: c.created_at,
      });
    });

    enquiries.forEach((e) => {
      mergeRecord(keyFor(null, e.email, e.phone, e.name), {
        name: e.name,
        email: e.email,
        phone: e.phone,
        enquiry: 1,
        when: e.created_at,
      });
    });

    return [...map.values()].sort(
      (a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0)
    );
  }

  function renderCustomers() {
    const q = String($("customerSearch")?.value || "").trim().toLowerCase();
    const filtered = state.customers.filter(
      (c) =>
        !q ||
        [c.name, c.email, c.phone, c.accountType].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (customerPage > totalPages) customerPage = totalPages;
    const startIdx = (customerPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    if ($("customerCount")) {
      $("customerCount").textContent = `Showing ${pageItems.length} of ${filtered.length} (${state.customers.length} unique contacts)`;
    }

    const box = $("customerDirectory");
    if (!box) return;
    if (!filtered.length) {
      box.innerHTML = '<div class="empty">No customer records match your search.</div>';
      $("customersPagination")?.classList.add("hidden");
      return;
    }

    box.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Type</th>
              <th>Garage</th>
              <th>Chauffeur</th>
              <th>Enquiries</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems
              .map(
                (c) => `
              <tr>
                <td><strong>${esc(c.name || "Unnamed")}</strong></td>
                <td>${esc(c.phone || "—")}</td>
                <td>${esc(c.email || "—")}</td>
                <td>${esc(c.accountType)}</td>
                <td>${c.garageCount}</td>
                <td>${c.chauffeurCount}</td>
                <td>${c.enquiryCount}</td>
                <td>${c.lastSeen ? esc(fmtDate(c.lastSeen)) : "—"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    const pag = $("customersPagination");
    if (pag) {
      if (totalPages > 1) {
        pag.classList.remove("hidden");
        pag.innerHTML = `
          <span class="meta">Page ${customerPage} of ${totalPages} · ${filtered.length} customers</span>
          <div class="actions">
            <button type="button" class="ghost" data-cust-page="${customerPage - 1}" ${
          customerPage <= 1 ? "disabled" : ""
        }>Previous</button>
            <button type="button" class="ghost" data-cust-page="${customerPage + 1}" ${
          customerPage >= totalPages ? "disabled" : ""
        }>Next</button>
          </div>`;
      } else {
        pag.classList.add("hidden");
      }
    }
  }

  async function loadCustomers(opts = {}) {
    if (!sb) return;
    if (!opts.silent && $("customerDirectory")) {
      $("customerDirectory").innerHTML = '<div class="empty">Building customer directory…</div>';
    }

    const [pRes, gRes, cRes, eRes] = await Promise.all([
      sb.from("profiles").select("id,name,email,phone,account_type,yard_name,is_admin,created_at"),
      sb.from("bookings").select("user_id,name,phone,created_at"),
      sb.from("chauffeur_bookings").select("user_id,customer_name,customer_phone,created_at"),
      sb.from("contact_enquiries").select("name,email,phone,created_at"),
    ]);

    const profiles = pRes.data || [];
    const garage = gRes.data || state.garageBookings || [];
    const chauffeur = cRes.data || state.chauffeurBookings || [];
    const enquiries = eRes.data || state.contactEnquiries || [];

    state.customers = buildCustomerDirectory(profiles, garage, chauffeur, enquiries);
    if ($("customerSummary")) {
      $("customerSummary").innerHTML = `<strong>Directory summary:</strong> ${fmt(
        state.customers.length
      )} consolidated customer profiles across ${fmt(profiles.length)} registered accounts.`;
    }
    renderCustomers();
  }

  $("refreshCustomers")?.addEventListener("click", () => loadCustomers());
  $("customerSearch")?.addEventListener(
    "input",
    debounce(() => {
      customerPage = 1;
      renderCustomers();
    }, 150)
  );
  $("customersPagination")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cust-page]");
    if (!btn || btn.disabled) return;
    customerPage = Number(btn.dataset.custPage) || 1;
    renderCustomers();
    $("customersPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("exportCustomers")?.addEventListener("click", () => {
    const q = String($("customerSearch")?.value || "").trim().toLowerCase();
    const list = state.customers.filter(
      (c) =>
        !q ||
        [c.name, c.email, c.phone, c.accountType].some((v) =>
          String(v || "").toLowerCase().includes(q)
        )
    );
    downloadCsv(
      `3pedals-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Name", "Phone", "Email", "Account type", "Garage jobs", "Chauffeur trips", "Enquiries", "Last seen"],
      list.map((c) => [
        c.name,
        c.phone,
        c.email,
        c.accountType,
        c.garageCount,
        c.chauffeurCount,
        c.enquiryCount,
        c.lastSeen,
      ])
    );
    toast(`Exported ${list.length} customer record${list.length === 1 ? "" : "s"}.`, "ok");
  });

  /* =========================================================
     3. OPERATIONS CALENDAR
     ========================================================= */
  function renderCalendar() {
    const box = $("operationsCalendar");
    if (!box) return;
    const dateFilter = $("calendarDate")?.value || "";
    const kindFilter = $("calendarKind")?.value || "all";

    const items = [
      ...state.garageBookings.map((b) => ({
        kind: "garage",
        id: b.id,
        dateKey: b.date || (b.created_at ? b.created_at.slice(0, 10) : ""),
        timeLabel: b.time_slot || "All day",
        title: `${b.service || "Garage"} · ${b.car || "Vehicle"}`,
        sub: `${b.name || "Customer"} · ${b.ref || ""}`,
        status: b.service_status || b.status || "new",
      })),
      ...state.chauffeurBookings.map((c) => {
        const dt = c.start_at ? new Date(c.start_at) : null;
        const dateKey =
          dt && !Number.isNaN(dt.getTime())
            ? dt.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
            : "";
        const timeLabel =
          dt && !Number.isNaN(dt.getTime())
            ? dt.toLocaleTimeString("en-KE", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Nairobi",
              })
            : "Scheduled";
        return {
          kind: "chauffeur",
          id: c.id,
          dateKey,
          timeLabel,
          title: `${c.chauffeur_vehicles?.display_name || "Chauffeur"} · ${c.pickup_location || ""} → ${
            c.destination || ""
          }`,
          sub: `${c.customer_name || "Customer"} · ${c.booking_ref || ""}${
            c.assigned_driver_name ? " · Driver: " + c.assigned_driver_name : ""
          }`,
          status: c.status || "pending_approval",
        };
      }),
    ]
      .filter((it) => {
        if (kindFilter !== "all" && it.kind !== kindFilter) return false;
        if (dateFilter && it.dateKey !== dateFilter) return false;
        return !!it.dateKey;
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    if ($("calendarSummary")) {
      $("calendarSummary").innerHTML = `<strong>Schedule overview:</strong> ${fmt(
        items.length
      )} scheduled item${items.length === 1 ? "" : "s"}${dateFilter ? ` on ${esc(dateFilter)}` : ""}.`;
    }

    if (!items.length) {
      box.innerHTML = '<div class="empty">No scheduled garage or chauffeur items match these filters.</div>';
      return;
    }

    const grouped = new Map();
    items.forEach((it) => {
      if (!grouped.has(it.dateKey)) grouped.set(it.dateKey, []);
      grouped.get(it.dateKey).push(it);
    });

    box.innerHTML = [...grouped.entries()]
      .map(
        ([day, dayItems]) => `
        <article class="overview-card">
          <div class="overview-card-head">
            <div><span class="panel-eyebrow">${esc(day)}</span><h2>${dayItems.length} scheduled item${
          dayItems.length === 1 ? "" : "s"
        }</h2></div>
          </div>
          ${dayItems
            .map(
              (it) => `
            <div class="chauffeur-upcoming-row">
              <div>
                <strong>${esc(it.timeLabel)} · ${esc(it.title)}</strong>
                <div class="meta-line">
                  <span>${it.kind === "garage" ? "Garage service" : "Chauffeur hire"}</span><span class="sep">·</span>
                  <span>${esc(it.sub)}</span>
                </div>
              </div>
              <div class="actions">
                <span class="status ${esc(statusClass(it.status))}">${esc(
                it.status.replaceAll("_", " ")
              )}</span>
                <button type="button" class="ghost" data-cal-kind="${esc(
                  it.kind
                )}" data-cal-id="${esc(it.id)}">Open</button>
              </div>
            </div>`
            )
            .join("")}
        </article>`
      )
      .join("");
  }

  async function loadCalendar() {
    if (!sb) return;
    if ($("operationsCalendar")) {
      $("operationsCalendar").innerHTML = '<div class="empty">Loading operations schedule…</div>';
    }
    const [gRes, cRes] = await Promise.all([
      sb.from("bookings").select("*").order("date", { ascending: true }),
      sb
        .from("chauffeur_bookings")
        .select("*,chauffeur_vehicles(display_name,category)")
        .order("start_at", { ascending: true }),
    ]);
    if (!gRes.error && gRes.data) state.garageBookings = gRes.data;
    if (!cRes.error && cRes.data) state.chauffeurBookings = cRes.data;
    renderCalendar();
  }

  $("refreshCalendar")?.addEventListener("click", loadCalendar);
  $("calendarDate")?.addEventListener("change", renderCalendar);
  $("calendarKind")?.addEventListener("change", renderCalendar);
  $("operationsCalendar")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cal-id]");
    if (!btn) return;
    if (btn.dataset.calKind === "garage") {
      await window.ThreePedalsAdminOps?.openGarageDrawer?.(btn.dataset.calId);
    } else {
      await window.ThreePedalsAdminOps?.openChauffeurDrawer?.(btn.dataset.calId);
    }
  });

  /* =========================================================
     4. VERIFIED AUDIT HISTORY
     ========================================================= */
  function renderAuditHistory() {
    const q = String($("auditSearch")?.value || "").trim().toLowerCase();
    const entity = $("auditEntityFilter")?.value || "all";
    const filtered = auditRowsCache.filter(
      (r) =>
        (entity === "all" || r.entity_type === entity) &&
        (!q ||
          [r.action, r.entity_type, r.entity_id, r.summary].some((v) =>
            String(v || "").toLowerCase().includes(q)
          ))
    );

    if ($("auditSummary")) {
      $("auditSummary").innerHTML = `<strong>Audit log:</strong> Showing ${fmt(
        filtered.length
      )} of ${fmt(auditRowsCache.length)} recent verified admin records.`;
    }

    const box = $("auditHistory");
    if (!box) return;
    if (!filtered.length) {
      box.innerHTML = '<div class="empty">No matching audit log entries found.</div>';
      return;
    }

    box.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Record ID</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (r) => `
              <tr>
                <td>${esc(fmtDate(r.created_at))}</td>
                <td class="mono">${esc(r.action)}</td>
                <td>${esc(r.entity_type)}</td>
                <td class="mono">${esc(r.entity_id || "—")}</td>
                <td>${esc(r.summary || "")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`;
  }

  async function loadAuditHistory() {
    if (!sb) return;
    if ($("auditHistory")) {
      $("auditHistory").innerHTML = '<div class="empty">Loading audit records…</div>';
    }
    const { data, error } = await sb
      .from("admin_audit_log")
      .select("id,actor_id,action,entity_type,entity_id,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      showNotice("Could not load audit history: " + error.message, "err");
      return;
    }
    auditRowsCache = data || [];
    renderAuditHistory();
  }

  $("refreshAudit")?.addEventListener("click", loadAuditHistory);
  $("auditSearch")?.addEventListener("input", debounce(renderAuditHistory, 150));
  $("auditEntityFilter")?.addEventListener("change", renderAuditHistory);

  A.registerLoader("insightsPanel", loadInsights);
  A.registerLoader("customersPanel", loadCustomers);
  A.registerLoader("calendarPanel", loadCalendar);
  A.registerLoader("auditPanel", loadAuditHistory);

  window.ThreePedalsAdminInsights = {
    loadInsights,
    loadCustomers,
    loadCalendar,
    loadAuditHistory,
  };
})();
