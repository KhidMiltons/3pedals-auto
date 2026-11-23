/* 3 Pedals Auto KE — Admin Operations Overview, Smart Alerts, Task Centre & Combined CSV Export */
(() => {
  "use strict";

  const A = window.ThreePedalsAdmin;
  if (!A) return;
  const { $, esc, moneyKES, fmtDate, downloadCsv, showNotice, toast, markSynced, state, sb } = A;

  async function loadOverview(opts = {}) {
    const activity = $("overviewActivity");
    if (!sb) return;
    if (activity && !opts.silent) {
      activity.innerHTML = '<div class="empty">Refreshing business snapshot…</div>';
    }

    const tasks = await Promise.all([
      sb
        .from("listings")
        .select(
          "id,make,model,year,price,km,fuel,status,seller_name,seller_phone,seller_email,yard_location,description,photos,whatsapp,seller_type,yard_name,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      sb
        .from("bookings")
        .select("id,ref,name,phone,service,car,date,time_slot,location,details,request_type,status,service_status,mechanic_id,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      sb
        .from("chauffeur_bookings")
        .select("id,booking_ref,customer_name,customer_phone,pickup_location,destination,start_at,end_at,status,payment_status,final_amount,quoted_amount,assigned_driver_name,created_at,chauffeur_vehicles(display_name,category)")
        .order("created_at", { ascending: false })
        .limit(1000),
      sb
        .from("contact_enquiries")
        .select("id,name,email,phone,subject,message,status,admin_note,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      sb.from("chauffeur_vehicles").select("id,is_active"),
      sb.from("mechanics").select("id,name,specialty,active"),
      sb.from("listing_promotions").select("id,amount,payment_status,status").limit(1000),
      sb.from("seller_sales").select("listing_id,reported_sale_price").limit(1000),
      sb
        .from("projects")
        .select("id,title,type,published,category,description,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      sb
        .from("chauffeur_cancellation_requests")
        .select("id,status,created_at")
        .in("status", ["pending", "restoration_requested"])
        .limit(1000),
    ]);

    const [lr, gr, cr, er, fr, mr, pr, sr, jr, xr] = tasks;
    const ls = lr.data || [];
    const gs = gr.data || [];
    const cs = cr.data || [];
    const es = er.data || [];
    const fs = fr.data || [];
    const ms = mr.data || [];
    const ps = pr.data || [];
    const ss = sr.data || [];
    const js = jr.data || [];
    const cancellations = xr.data || [];

    // Hydrate core global caches for Global Command Search & badge counts immediately
    if (!lr.error) state.listings = ls;
    if (!gr.error) {
      state.garageBookings = gs;
      if (!state.garageInitialLoaded) {
        state.seenGarageIds = new Set(gs.map((x) => String(x.id)));
        state.garageInitialLoaded = true;
      }
    }
    if (!cr.error && !state.chauffeurBookings.length) state.chauffeurBookings = cs;
    if (!er.error) state.contactEnquiries = es;
    if (!mr.error && !state.mechanics.length) state.mechanics = ms;

    const pendingListings = ls.filter((x) => x.status === "pending").length;
    const openGarage = gs.filter(
      (x) =>
        !["done", "completed", "cancelled"].includes(
          String(x.service_status || x.status || "").toLowerCase()
        )
    );
    const openChauffeur = cs.filter((x) =>
      ["pending_approval", "approved_awaiting_payment", "confirmed"].includes(
        String(x.status || "").toLowerCase()
      )
    );
    const openEnquiries = es.filter(
      (x) => !["resolved", "spam"].includes(String(x.status || "").toLowerCase())
    );

    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = String(v);
    };

    set("ovPending", pendingListings);
    set("ovGarage", openGarage.length);
    set("ovChauffeur", openChauffeur.length);
    set("ovEnquiries", openEnquiries.length);
    set("ovFleet", fs.filter((x) => x.is_active !== false).length);
    set("ovMechanics", ms.filter((x) => x.active !== false).length);

    // Update sidebar nav counters
    if ($("pendingQuickCount")) {
      $("pendingQuickCount").textContent = pendingListings ? String(pendingListings) : "";
    }
    const inboxTotal =
      pendingListings +
      openGarage.length +
      cs.filter((x) => ["pending_approval", "approved_awaiting_payment"].includes(x.status)).length +
      cancellations.length +
      openEnquiries.length;
    if ($("requestsBadge")) {
      $("requestsBadge").textContent = inboxTotal ? String(inboxTotal) : "";
    }

    const overdueGarage = gs.filter(
      (x) =>
        x.date &&
        new Date(x.date + "T23:59:59") < new Date() &&
        !["done", "completed", "cancelled"].includes(
          String(x.service_status || x.status || "").toLowerCase()
        )
    ).length;
    const upcomingChauffeur = cs.filter(
      (x) =>
        x.start_at &&
        new Date(x.start_at) > new Date() &&
        ["confirmed", "approved_awaiting_payment"].includes(String(x.status || "").toLowerCase())
    ).length;
    const failedPayments = ps.filter(
      (x) => String(x.payment_status || "").toLowerCase() === "failed"
    ).length;
    const pendingPayments = ps.filter(
      (x) =>
        ["pending", "pending_confirmation"].includes(
          String(x.payment_status || "").toLowerCase()
        ) || String(x.status || "").toLowerCase() === "pending_confirmation"
    ).length;
    const staleListings = ls.filter(
      (x) =>
        x.status === "approved" &&
        x.created_at &&
        Date.now() - new Date(x.created_at).getTime() > 30 * 86400000
    ).length;

    const smart = $("adminSmartAlerts");
    if (smart) {
      smart.innerHTML = [
        [pendingListings, "Listings awaiting review"],
        [openGarage.length, "Open garage jobs"],
        [openChauffeur.length, "Chauffeur requests to action"],
        [openEnquiries.length, "Unresolved enquiries"],
        [overdueGarage, "Garage jobs past date"],
        [upcomingChauffeur, "Upcoming trips"],
        [failedPayments, "Failed promo payments"],
        [pendingPayments, "Pending promo callbacks"],
        [staleListings, "Approved listings > 30 days"],
      ]
        .map(([n, label]) => `<div><strong>${n}</strong><span>${label}</span></div>`)
        .join("");
    }

    const queue = [];
    if (pendingListings) {
      queue.push({
        count: pendingListings,
        label: "Vehicle listings awaiting approval",
        detail: "Review seller submissions before publishing to the marketplace.",
        section: "listingsPanel",
      });
    }
    if (overdueGarage) {
      queue.push({
        count: overdueGarage,
        label: "Garage jobs past requested date",
        detail: "Check progress, assign a mechanic, or update the customer.",
        section: "bookingsPanel",
      });
    }
    if (cancellations.length) {
      queue.push({
        count: cancellations.length,
        label: "Chauffeur cancellation / restoration requests",
        detail: "Review customer reasons and record an administrator decision.",
        section: "requestsPanel",
      });
    }
    if (openChauffeur.length) {
      queue.push({
        count: openChauffeur.length,
        label: "Chauffeur bookings awaiting action",
        detail: "Approve quotes, verify payments, or assign an active driver.",
        section: "chauffeurPanel",
      });
    }
    if (openEnquiries.length) {
      queue.push({
        count: openEnquiries.length,
        label: "Unresolved customer enquiries",
        detail: "Respond to incoming website contact messages.",
        section: "requestsPanel",
      });
    }
    if (failedPayments || pendingPayments) {
      queue.push({
        count: failedPayments + pendingPayments,
        label: "Promotion payment reconciliation",
        detail: `${pendingPayments} pending confirmation · ${failedPayments} failed STK attempts.`,
        section: "insightsPanel",
      });
    }
    if (staleListings) {
      queue.push({
        count: staleListings,
        label: "Ageing approved vehicle listings",
        detail: "Check availability and refresh details older than 30 days.",
        section: "listingsPanel",
      });
    }

    const taskBox = $("adminTaskCenter");
    if (taskBox) {
      taskBox.innerHTML = queue.length
        ? queue
            .map(
              (x) => `
          <article class="admin-task-row">
            <div class="admin-task-count">${x.count}</div>
            <div class="admin-task-copy">
              <strong>${esc(x.label)}</strong>
              <span>${esc(x.detail)}</span>
            </div>
            <button type="button" class="ghost" data-task-section="${esc(x.section)}">Review</button>
          </article>`
            )
            .join("")
        : '<div class="empty">All caught up — no outstanding operational tasks detected.</div>';
      if (xr.error) {
        taskBox.insertAdjacentHTML(
          "beforeend",
          `<p class="meta">Cancellation requests unavailable: ${esc(xr.error.message)}</p>`
        );
      }
    }

    set(
      "ovChauffeurRevenue",
      moneyKES(
        cs
          .filter((x) => x.payment_status === "paid")
          .reduce((a, x) => a + Number(x.final_amount || 0), 0)
      )
    );
    set(
      "ovPromotionRevenue",
      moneyKES(
        ps
          .filter((x) =>
            ["verified", "paid"].includes(String(x.payment_status || "").toLowerCase())
          )
          .reduce((a, x) => a + Number(x.amount || 0), 0)
      )
    );
    set(
      "ovVehicleSales",
      moneyKES(ss.reduce((a, x) => a + Number(x.reported_sale_price || 0), 0))
    );

    const articles = js.filter((x) => x.type === "article" && x.category !== "garage_service");
    const projects = js.filter((x) => ["photo", "video"].includes(x.type));
    set("ovArticles", articles.filter((x) => x.published === true).length);
    set("ovDrafts", articles.filter((x) => x.published !== true).length);
    set("ovProjects", projects.length);

    if (activity) {
      const feed = [
        ...ls.map((x) => ({
          title: [x.year, x.make, x.model].filter(Boolean).join(" ") || "Vehicle listing",
          kind: "Vehicle listing",
          state: x.status || "submitted",
          date: x.created_at,
          icon: "V",
        })),
        ...gs.map((x) => ({
          title: x.service || "Garage service request",
          kind: "Garage job",
          state: x.service_status || x.status || "new",
          date: x.created_at,
          icon: "G",
        })),
        ...cs.map((x) => ({
          title: x.booking_ref || x.customer_name || "Chauffeur booking",
          kind: "Chauffeur hire",
          state: x.status || "new",
          date: x.created_at,
          icon: "C",
        })),
        ...es.map((x) => ({
          title: x.subject || "Website enquiry",
          kind: "Enquiry",
          state: (x.name || "Customer") + " · " + (x.status || "new"),
          date: x.created_at,
          icon: "E",
        })),
      ]
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
        .slice(0, 10);

      activity.innerHTML = feed.length
        ? `<div class="overview-activity-list">${feed
            .map(
              (x) => `
          <div class="overview-activity-row">
            <div class="overview-activity-icon">${esc(x.icon)}</div>
            <div>
              <strong>${esc(x.title)}</strong>
              <span>${esc(x.kind)} · ${esc(String(x.state).replaceAll("_", " "))}</span>
            </div>
            <time>${esc(fmtDate(x.date))}</time>
          </div>`
            )
            .join("")}</div>`
        : '<div class="empty">No recent activity recorded yet.</div>';

      const errors = tasks.filter((x) => x.error);
      if (errors.length) {
        activity.insertAdjacentHTML(
          "beforeend",
          `<p class="meta" style="margin-top:12px">${errors.length} data source(s) could not be read cleanly.</p>`
        );
      }
    }

    set(
      "overviewUpdated",
      "Updated " +
        new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
    );
  }

  async function exportCombinedOperationsReport() {
    const btn = $("exportOperationsReport");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Preparing CSV…";
    }
    try {
      const [garageRes, chauffeurRes, mechRes] = await Promise.all([
        sb.from("bookings").select("*").order("created_at", { ascending: false }),
        sb
          .from("chauffeur_bookings")
          .select("*,chauffeur_vehicles(display_name,category)")
          .order("created_at", { ascending: false }),
        sb.from("mechanics").select("id,name"),
      ]);
      if (garageRes.error) throw garageRes.error;
      if (chauffeurRes.error) throw chauffeurRes.error;
      const garage = garageRes.data || [];
      const chauffeur = chauffeurRes.data || [];
      const mechanics = mechRes.data || state.mechanics || [];
      if (!garage.length && !chauffeur.length) {
        showNotice("No garage or chauffeur records to export yet.", "err");
        return;
      }
      const headers = [
        "Service type",
        "Reference",
        "Customer",
        "Customer phone",
        "Vehicle / service",
        "Category",
        "Pickup / location",
        "Destination",
        "Start / requested date",
        "End / time slot",
        "Booking status",
        "Service progress",
        "Payment status",
        "Quoted KES",
        "Final KES",
        "Assigned staff",
        "Staff phone",
        "Notes",
        "Created at",
      ];
      const rows = [
        ...garage.map((b) => [
          "Garage · " + (b.request_type === "roadside" ? "Roadside" : "Workshop"),
          b.ref,
          b.name,
          b.phone,
          [b.car, b.service].filter(Boolean).join(" · "),
          "",
          b.location,
          "",
          b.date,
          b.time_slot,
          b.status,
          b.service_status,
          "",
          "",
          "",
          mechanics.find((m) => String(m.id) === String(b.mechanic_id))?.name || "Unassigned",
          "",
          b.details,
          b.created_at,
        ]),
        ...chauffeur.map((b) => [
          "Chauffeur hire",
          b.booking_ref,
          b.customer_name,
          b.customer_phone,
          b.chauffeur_vehicles?.display_name,
          b.chauffeur_vehicles?.category,
          b.pickup_location,
          b.destination,
          b.start_at,
          b.end_at,
          b.status,
          "",
          b.payment_status,
          b.quoted_amount,
          b.final_amount,
          b.assigned_driver_name,
          b.assigned_driver_phone,
          b.customer_notes,
          b.created_at,
        ]),
      ];
      downloadCsv(
        `3pedals-combined-operations-${new Date().toISOString().slice(0, 10)}.csv`,
        headers,
        rows
      );
      toast(
        `Exported ${garage.length} garage jobs and ${chauffeur.length} chauffeur bookings.`,
        "ok"
      );
    } catch (err) {
      showNotice("Could not export operations report: " + err.message, "err");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Export operations CSV";
      }
    }
  }

  $("refreshTaskCenter")?.addEventListener("click", () => loadOverview());
  $("exportOperationsReport")?.addEventListener("click", exportCombinedOperationsReport);

  $("refreshAllAdmin")?.addEventListener("click", async () => {
    const btn = $("refreshAllAdmin");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = "Refreshing all…";
    try {
      await loadOverview();
      state.loadedSections.clear();
      state.loadedSections.add("overviewPanel");
      await A.activateSection(state.activeSection, { forceRefresh: true, skipDirtyCheck: true });
      markSynced();
      toast("Overview and active workspace refreshed.", "ok");
    } catch (err) {
      showNotice("Could not refresh all data: " + (err?.message || err), "err");
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });

  A.registerLoader("overviewPanel", loadOverview);
  window.ThreePedalsAdminOverview = { loadOverview };
})();
