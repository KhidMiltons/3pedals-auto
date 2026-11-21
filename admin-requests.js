/* 3 Pedals Auto KE — Unified Requests Inbox, Local Debounced Filtering & Inline Triage */
(() => {
  "use strict";

  const A = window.ThreePedalsAdmin;
  if (!A) return;
  const {
    $,
    esc,
    debounce,
    statusClass,
    state,
    showNotice,
    toast,
    confirm,
    activateSection,
    recordAdminAudit,
    sb,
  } = A;

  let contactRowsCache = [];
  let cancellationRowsCache = [];

  function renderInbox() {
    const box = $("requestsQueue");
    if (!box) return;

    const pendingListings = state.listings.filter(
      (x) => String(x.status || "").toLowerCase() === "pending"
    );
    const openGarage = state.garageBookings.filter(
      (x) =>
        !["done", "cancelled"].includes(String(x.status || "").toLowerCase()) &&
        !["completed", "cancelled"].includes(String(x.service_status || "").toLowerCase())
    );
    const openChauffeur = state.chauffeurBookings.filter((x) =>
      ["pending_approval", "approved_awaiting_payment"].includes(x.status)
    );
    const pendingCancellations = cancellationRowsCache.filter((x) =>
      ["pending", "restoration_requested"].includes(x.status)
    );
    const openContacts = contactRowsCache.filter((x) =>
      ["new", "in_progress"].includes(x.status)
    );

    const total =
      pendingListings.length +
      openGarage.length +
      openChauffeur.length +
      pendingCancellations.length +
      openContacts.length;

    const set = (id, v) => {
      if ($(id)) $(id).textContent = String(v);
    };
    set("inboxListingCount", pendingListings.length);
    set("inboxGarageCount", openGarage.length);
    set("inboxChauffeurCount", openChauffeur.length);
    set("inboxCancellationCount", pendingCancellations.length);
    set("inboxContactCount", openContacts.length);
    set("inboxTotalCount", total);
    if ($("requestsBadge")) $("requestsBadge").textContent = total ? String(total) : "";

    const items = [
      ...pendingListings.map((x) => ({
        kind: "Vehicle listing",
        detail: [x.year, x.make, x.model].filter(Boolean).join(" ") || "Vehicle submission",
        person: x.seller_name || x.yard_name || "Seller",
        when: x.created_at,
        section: "listingsPanel",
        status: x.status || "pending",
        triageType: "listing",
        triageId: x.id,
        action: "Open listings",
      })),
      ...openGarage.map((x) => ({
        kind: x.request_type === "roadside" ? "Mobile mechanic" : "Garage service",
        detail: [x.service, x.car, x.date].filter(Boolean).join(" · "),
        person: x.name || "Customer",
        when: x.created_at,
        section: "bookingsPanel",
        status: x.service_status || x.status || "new",
        triageType: "garage",
        triageId: x.id,
        action: "Open bookings",
      })),
      ...openChauffeur.map((x) => ({
        kind: "Chauffeur hire",
        detail: [
          x.chauffeur_vehicles?.display_name,
          `${x.pickup_location || ""} → ${x.destination || ""}`,
          x.start_at ? new Date(x.start_at).toLocaleString("en-KE") : "",
        ]
          .filter(Boolean)
          .join(" · "),
        person: x.customer_name || "Customer",
        when: x.created_at,
        section: "chauffeurPanel",
        status: x.status,
        triageType: "chauffeur",
        triageId: x.id,
        action: "Open chauffeur",
      })),
      ...pendingCancellations.map((x) => ({
        kind:
          x.status === "restoration_requested"
            ? "Chauffeur booking restoration"
            : "Chauffeur cancellation",
        detail: [
          x.chauffeur_bookings?.booking_ref,
          `${x.chauffeur_bookings?.pickup_location || ""} → ${
            x.chauffeur_bookings?.destination || ""
          }`,
          x.reason,
        ]
          .filter(Boolean)
          .join(" · "),
        person: x.chauffeur_bookings?.customer_name || "Customer",
        when: x.created_at,
        status: x.status,
        cancellationId: x.id,
        bookingId: x.booking_id,
        restoration: x.status === "restoration_requested",
      })),
      ...openContacts.map((x) => ({
        kind: "Website contact enquiry",
        detail: x.subject,
        person: `${x.name || "Visitor"} · ${x.email || ""}`,
        when: x.created_at,
        status: x.status || "new",
        contactId: x.id,
        contactRow: x,
      })),
    ].sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));

    const kindFilter = $("requestInboxKind")?.value || "all";
    const q = String($("requestInboxSearch")?.value || "").trim().toLowerCase();

    const filtered = items.filter(
      (x) =>
        (kindFilter === "all" || x.kind === kindFilter) &&
        (!q ||
          [x.kind, x.detail, x.person, x.status].some((v) =>
            String(v || "")
              .toLowerCase()
              .includes(q)
          ))
    );

    if ($("requestInboxCount")) {
      $("requestInboxCount").textContent = `Showing ${filtered.length} of ${items.length} open requests`;
    }

    if (!filtered.length) {
      box.innerHTML = items.length
        ? '<div class="empty">No open requests match these filters.</div>'
        : '<div class="empty">You are all caught up. There are no requests awaiting attention.</div>';
      return;
    }

    box.innerHTML = filtered
      .map((x) => {
        const statusCls = statusClass(x.status);
        const statusLabel = String(x.status || "open").replaceAll("_", " ");
        let controls = "";

        if (x.cancellationId) {
          controls = x.restoration
            ? `<div class="request-inbox-controls">
                <label class="request-inbox-response">Administrator decision reason
                  <textarea rows="2" id="restore-note-${esc(x.cancellationId)}" placeholder="Explain the restoration decision to the customer (required)"></textarea>
                </label>
                <div class="request-inbox-actions">
                  <button class="approve" type="button" data-restore-accept="${esc(
                    x.cancellationId
                  )}" data-booking="${esc(x.bookingId)}">Accept &amp; restore</button>
                  <button class="danger" type="button" data-restore-decline="${esc(
                    x.cancellationId
                  )}">Decline restoration</button>
                </div>
              </div>`
            : `<div class="request-inbox-controls">
                <label class="request-inbox-response">Administrator decision reason
                  <textarea rows="2" id="cancel-note-${esc(x.cancellationId)}" placeholder="Explain the cancellation decision to the customer (required)"></textarea>
                </label>
                <div class="request-inbox-actions">
                  <button class="approve" type="button" data-cancel-accept="${esc(
                    x.cancellationId
                  )}" data-booking="${esc(x.bookingId)}">Accept &amp; cancel</button>
                  <button class="danger" type="button" data-cancel-decline="${esc(
                    x.cancellationId
                  )}">Decline &amp; keep</button>
                </div>
              </div>`;
        } else if (x.contactId) {
          controls = `
            <div class="actions">
              <button class="primary" type="button" data-contact-open="${esc(
                x.contactId
              )}">Open enquiry</button>
            </div>`;
        } else {
          controls = `
            <div class="actions">
              ${
                x.triageType
                  ? `<button class="primary" type="button" data-inbox-triage="${esc(
                      x.triageType
                    )}" data-triage-id="${esc(x.triageId)}">Quick triage</button>`
                  : ""
              }
              <button class="ghost" type="button" data-open-request="${esc(x.section)}">${esc(
            x.action
          )}</button>
            </div>`;
        }

        const contactDetail = x.contactId
          ? `<div id="contact-detail-${esc(x.contactId)}" hidden style="padding-top:12px;border-top:1px solid var(--ad-line)">
              <p style="margin:0 0 8px;white-space:pre-wrap">${esc(x.contactRow?.message || "")}</p>
              <div class="meta-line" style="margin-bottom:8px">
                <span>Phone: ${esc(x.contactRow?.phone || "Not provided")}</span>
              </div>
              <label for="contact-note-${esc(x.contactId)}">Admin note</label>
              <textarea id="contact-note-${esc(x.contactId)}" rows="2">${esc(
              x.contactRow?.admin_note || ""
            )}</textarea>
              <div class="actions" style="margin-top:10px">
                <button class="ghost" type="button" data-contact-status="in_progress" data-id="${esc(
                  x.contactId
                )}">Mark in progress</button>
                <button class="approve" type="button" data-contact-status="resolved" data-id="${esc(
                  x.contactId
                )}">Resolve</button>
                <button class="danger" type="button" data-contact-status="spam" data-id="${esc(
                  x.contactId
                )}">Mark spam</button>
              </div>
            </div>`
          : "";

        return `
        <article class="article-item request-inbox-item">
          <div class="request-inbox-head">
            <div style="min-width:0;flex:1">
              <div class="meta-line">
                <span>${esc(x.kind)}</span><span class="sep">·</span>
                <span>${x.when ? esc(A.fmtDate(x.when)) : "Recent"}</span>
              </div>
              <h3>${esc(x.detail || x.kind)}</h3>
              <div class="meta-line">
                <span>${esc(x.person)}</span><span class="sep">·</span>
                <span class="status ${esc(statusCls)}">${esc(statusLabel)}</span>
              </div>
            </div>
            ${!x.cancellationId ? controls : ""}
          </div>
          ${x.cancellationId ? controls : ""}
          ${contactDetail}
        </article>`;
      })
      .join("");
  }

  async function loadRequestsInbox(opts = {}) {
    const box = $("requestsQueue");
    if (!sb) return;
    if (box && !opts.silent) {
      box.innerHTML = '<div class="empty">Refreshing request queue…</div>';
    }
    const [listingRes, garageRes, chauffeurRes, cancelRes, contactRes] = await Promise.all([
      sb
        .from("listings")
        .select(
          "id,make,model,year,price,km,fuel,status,seller_name,seller_phone,seller_email,yard_location,description,photos,whatsapp,seller_type,yard_name,created_at"
        )
        .order("created_at", { ascending: false }),
      sb.from("bookings").select("*").order("created_at", { ascending: false }),
      sb
        .from("chauffeur_bookings")
        .select(
          "*,chauffeur_vehicles(display_name,category)"
        )
        .order("created_at", { ascending: false }),
      sb
        .from("chauffeur_cancellation_requests")
        .select(
          "id,booking_id,user_id,reason,status,admin_note,reviewed_at,created_at,chauffeur_bookings(booking_ref,status,payment_status,customer_name,customer_phone,pickup_location,destination)"
        )
        .order("created_at", { ascending: false }),
      sb
        .from("contact_enquiries")
        .select("id,name,email,phone,subject,message,status,admin_note,created_at")
        .order("created_at", { ascending: false }),
    ]);

    const errors = [
      listingRes.error,
      garageRes.error,
      chauffeurRes.error,
      cancelRes.error,
      contactRes.error,
    ].filter(Boolean);
    if (errors.length && box) {
      box.innerHTML = `<div class="notice err">Could not load all request categories: ${esc(
        errors.map((e) => e.message).join(" · ")
      )}</div>`;
      return;
    }

    state.listings = listingRes.data || state.listings;
    state.garageBookings = garageRes.data || [];
    state.chauffeurBookings = chauffeurRes.data || [];
    cancellationRowsCache = cancelRes.data || [];
    contactRowsCache = contactRes.data || [];
    state.cancellations = cancellationRowsCache;
    state.contactEnquiries = contactRowsCache;

    renderInbox();
  }

  $("refreshRequests")?.addEventListener("click", () => loadRequestsInbox());
  $("requestInboxKind")?.addEventListener("change", renderInbox);
  $("requestInboxSearch")?.addEventListener("input", debounce(renderInbox, 150));

  $("requestsQueue")?.addEventListener("click", async (e) => {
    const triageBtn = e.target.closest("[data-inbox-triage]");
    if (triageBtn) {
      const type = triageBtn.dataset.inboxTriage;
      const id = triageBtn.dataset.triageId;
      if (type === "listing") {
        window.ThreePedalsAdminListings?.openListingDrawer?.(id, { triage: true });
      } else if (type === "garage") {
        await window.ThreePedalsAdminOps?.openGarageDrawer?.(id);
      } else if (type === "chauffeur") {
        await window.ThreePedalsAdminOps?.openChauffeurDrawer?.(id);
      }
      return;
    }

    const contactToggle = e.target.closest("[data-contact-open]");
    if (contactToggle) {
      const panel = $("contact-detail-" + contactToggle.dataset.contactOpen);
      if (panel) panel.hidden = !panel.hidden;
      return;
    }

    const contactAction = e.target.closest("[data-contact-status]");
    if (contactAction) {
      const id = contactAction.dataset.id;
      const status = contactAction.dataset.contactStatus;
      const note = $("contact-note-" + id)?.value.trim() || null;
      contactAction.disabled = true;
      const { error } = await sb
        .from("contact_enquiries")
        .update({ status, admin_note: note, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        showNotice("Could not update enquiry: " + error.message, "err");
        contactAction.disabled = false;
        return;
      }
      await recordAdminAudit(
        "update_enquiry_status",
        "customer_request",
        id,
        `Marked website enquiry as ${status}`
      );
      toast("Contact enquiry updated.", "ok");
      await loadRequestsInbox({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
      return;
    }

    const restoreAccept = e.target.closest("[data-restore-accept]");
    const restoreDecline = e.target.closest("[data-restore-decline]");
    if (restoreAccept || restoreDecline) {
      const btn = restoreAccept || restoreDecline;
      const id = restoreAccept
        ? restoreAccept.dataset.restoreAccept
        : restoreDecline.dataset.restoreDecline;
      const adminNote = $("restore-note-" + id)?.value.trim() || "";
      if (!adminNote) {
        showNotice("Enter a decision reason before processing this restoration.", "err");
        $("restore-note-" + id)?.focus();
        return;
      }
      const ok = await confirm({
        eyebrow: "CHAUFFEUR RESTORATION",
        title: restoreAccept ? "Restore chauffeur booking?" : "Decline restoration request?",
        message: restoreAccept
          ? "It will return to awaiting payment unless already marked paid."
          : "The booking will remain cancelled.",
        confirmText: restoreAccept ? "Restore booking" : "Decline restoration",
        danger: !!restoreDecline,
      });
      if (!ok) return;
      btn.disabled = true;
      if (restoreAccept) {
        const bookingId = restoreAccept.dataset.booking;
        const { data: booking, error: bErr } = await sb
          .from("chauffeur_bookings")
          .select("status,payment_status")
          .eq("id", bookingId)
          .single();
        if (bErr) {
          showNotice("Could not verify booking: " + bErr.message, "err");
          btn.disabled = false;
          return;
        }
        const alreadyPaid = booking.payment_status === "paid";
        const bookingUpdate = {
          status: alreadyPaid ? "confirmed" : "approved_awaiting_payment",
          payment_status: alreadyPaid ? "paid" : "pending",
        };
        const { error: uErr } = await sb
          .from("chauffeur_bookings")
          .update(bookingUpdate)
          .eq("id", bookingId);
        if (uErr) {
          showNotice("Could not restore booking: " + uErr.message, "err");
          btn.disabled = false;
          return;
        }
        const { error } = await sb
          .from("chauffeur_cancellation_requests")
          .update({
            status: "restored",
            admin_note: adminNote,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) {
          await sb
            .from("chauffeur_bookings")
            .update({ status: "cancelled", payment_status: booking.payment_status })
            .eq("id", bookingId);
          showNotice("Could not save restoration decision: " + error.message, "err");
          btn.disabled = false;
          return;
        }
        await recordAdminAudit(
          "restore_chauffeur_booking",
          "customer_request",
          id,
          `Restored chauffeur booking ${bookingId}`
        );
        toast("Booking restored.", "ok");
      } else {
        const { error } = await sb
          .from("chauffeur_cancellation_requests")
          .update({
            status: "restoration_declined",
            admin_note: adminNote,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) {
          showNotice("Could not decline restoration: " + error.message, "err");
          btn.disabled = false;
          return;
        }
        await recordAdminAudit(
          "decline_chauffeur_restoration",
          "customer_request",
          id,
          `Declined restoration request ${id}`
        );
        toast("Restoration request declined.", "ok");
      }
      await loadRequestsInbox({ silent: true });
      window.ThreePedalsAdminOps?.loadChauffeur?.({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
      return;
    }

    const accept = e.target.closest("[data-cancel-accept]");
    const decline = e.target.closest("[data-cancel-decline]");
    if (accept || decline) {
      const btn = accept || decline;
      const id = accept ? accept.dataset.cancelAccept : decline.dataset.cancelDecline;
      const adminNote = $("cancel-note-" + id)?.value.trim() || "";
      if (!adminNote) {
        showNotice("Enter a decision reason before processing this cancellation.", "err");
        $("cancel-note-" + id)?.focus();
        return;
      }
      const ok = await confirm({
        eyebrow: "CHAUFFEUR CANCELLATION",
        title: accept ? "Accept cancellation & cancel booking?" : "Decline cancellation request?",
        message: accept
          ? "The associated chauffeur booking will be marked cancelled."
          : "The customer booking will remain active.",
        confirmText: accept ? "Accept & cancel" : "Decline request",
        danger: !!accept,
      });
      if (!ok) return;
      btn.disabled = true;
      if (accept) {
        const bookingId = accept.dataset.booking;
        const { data: booking, error: bErr } = await sb
          .from("chauffeur_bookings")
          .select("status")
          .eq("id", bookingId)
          .single();
        if (bErr) {
          showNotice("Could not verify booking: " + bErr.message, "err");
          btn.disabled = false;
          return;
        }
        const { error: uErr } = await sb
          .from("chauffeur_bookings")
          .update({ status: "cancelled" })
          .eq("id", bookingId);
        if (uErr) {
          showNotice("Could not cancel booking: " + uErr.message, "err");
          btn.disabled = false;
          return;
        }
        const { error } = await sb
          .from("chauffeur_cancellation_requests")
          .update({
            status: "accepted",
            admin_note: adminNote,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) {
          await sb
            .from("chauffeur_bookings")
            .update({ status: booking.status })
            .eq("id", bookingId);
          showNotice("Could not save cancellation decision: " + error.message, "err");
          btn.disabled = false;
          return;
        }
        await recordAdminAudit(
          "accept_chauffeur_cancellation",
          "customer_request",
          id,
          `Accepted cancellation for booking ${bookingId}`
        );
        toast("Cancellation accepted and booking cancelled.", "ok");
      } else {
        const { error } = await sb
          .from("chauffeur_cancellation_requests")
          .update({
            status: "declined",
            admin_note: adminNote,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) {
          showNotice("Could not decline cancellation: " + error.message, "err");
          btn.disabled = false;
          return;
        }
        await recordAdminAudit(
          "decline_chauffeur_cancellation",
          "customer_request",
          id,
          `Declined cancellation request ${id}`
        );
        toast("Cancellation request declined.", "ok");
      }
      await loadRequestsInbox({ silent: true });
      window.ThreePedalsAdminOps?.loadChauffeur?.({ silent: true });
      window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
      return;
    }

    const open = e.target.closest("[data-open-request]");
    if (open) {
      await activateSection(open.dataset.openRequest);
    }
  });

  A.registerLoader("requestsPanel", loadRequestsInbox);
  window.ThreePedalsAdminRequests = { loadRequestsInbox, renderInbox };
})();
