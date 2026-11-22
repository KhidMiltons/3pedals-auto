/* 3 Pedals Auto KE — Vehicle Listings Moderation, Bulk Actions, Inline Edit Drawer & Pagination */
(() => {
  "use strict";

  const A = window.ThreePedalsAdmin;
  if (!A) return;
  const {
    $,
    esc,
    safeUrl,
    fmt,
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
    downloadCsv,
    recordAdminAudit,
    sb,
  } = A;

  const PAGE_SIZE = 25;
  let currentFilter = "pending";
  let currentPage = 1;
  const selectedIds = new Set();

  function photosOf(x) {
    return Array.isArray(x?.photos) ? x.photos.map(safeUrl).filter(Boolean) : [];
  }

  function getFilteredListings() {
    const q = String($("listingSearch")?.value || "").trim().toLowerCase();
    const sellerType = $("listingSellerFilter")?.value || "all";
    const sort = $("listingSort")?.value || "newest";

    const statusList =
      currentFilter === "all"
        ? state.listings
        : state.listings.filter(
            (x) => String(x.status || "").toLowerCase() === currentFilter
          );

    const list = statusList.filter((x) => {
      const typeMatch =
        sellerType === "all" ||
        String(x.seller_type || "private").toLowerCase() === sellerType;
      const queryMatch =
        !q ||
        [
          x.make,
          x.model,
          x.year,
          x.seller_name,
          x.seller_phone,
          x.seller_email,
          x.yard_name,
          x.yard_location,
          x.seller_type,
          x.status,
        ].some((v) => String(v ?? "").toLowerCase().includes(q));
      return typeMatch && queryMatch;
    });

    list.sort((a, b) =>
      sort === "oldest"
        ? new Date(a.created_at || 0) - new Date(b.created_at || 0)
        : sort === "price-high"
        ? Number(b.price || 0) - Number(a.price || 0)
        : sort === "price-low"
        ? Number(a.price || 0) - Number(b.price || 0)
        : sort === "year-new"
        ? Number(b.year || 0) - Number(a.year || 0)
        : sort === "year-old"
        ? Number(a.year || 0) - Number(b.year || 0)
        : new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );

    return { list, statusList, q };
  }

  function updateBulkBar(pageItems) {
    const bar = $("listingsBulkBar");
    const countEl = $("bulkSelectedCount");
    if (!bar || !countEl) return;
    if (!selectedIds.size) {
      bar.classList.add("hidden");
      return;
    }
    bar.classList.remove("hidden");
    countEl.textContent = `${selectedIds.size} selected`;
    const selectBtn = $("bulkSelectVisible");
    if (selectBtn) {
      const allPageSelected =
        pageItems.length > 0 && pageItems.every((item) => selectedIds.has(String(item.id)));
      selectBtn.textContent = allPageSelected ? "Deselect page" : "Select page";
    }
  }

  function renderListings() {
    const { list, statusList, q } = getFilteredListings();
    const pendingTotal = state.listings.filter((x) => x.status === "pending").length;
    if ($("pendingCount")) $("pendingCount").textContent = String(pendingTotal);
    if ($("approvedCount"))
      $("approvedCount").textContent = String(
        state.listings.filter((x) => x.status === "approved").length
      );
    if ($("rejectedCount"))
      $("rejectedCount").textContent = String(
        state.listings.filter((x) => x.status === "rejected").length
      );
    if ($("totalCount")) $("totalCount").textContent = String(state.listings.length);
    if ($("pendingQuickCount"))
      $("pendingQuickCount").textContent = pendingTotal ? String(pendingTotal) : "";

    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = list.slice(startIdx, startIdx + PAGE_SIZE);

    if ($("listingResultCount")) {
      $("listingResultCount").textContent = `Showing ${pageItems.length} of ${list.length} (${statusList.length} ${currentFilter})`;
    }

    const container = $("listings");
    if (!container) return;
    if (!list.length) {
      container.innerHTML = `<div class="empty">${
        q
          ? "No vehicle listings match your search."
          : `No ${currentFilter === "all" ? "vehicle listings" : currentFilter + " listings"} found.`
      }</div>`;
      $("listingsPagination")?.classList.add("hidden");
      updateBulkBar([]);
      return;
    }

    container.innerHTML = pageItems
      .map((x) => {
        const photos = photosOf(x);
        const idStr = String(x.id);
        const checked = selectedIds.has(idStr) ? "checked" : "";
        const name = x.seller_name || x.yard_name || "Private seller";
        const phone = x.seller_phone || x.phone || x.whatsapp || "—";
        const thumb = photos[0]
          ? `<img src="${esc(photos[0])}" alt="" class="listing-thumb" loading="lazy" decoding="async">`
          : `<div class="listing-thumb" style="display:grid;place-items:center;font-size:11px;color:var(--ad-mute)">No photo</div>`;
        return `
        <article class="listing" data-id="${esc(idStr)}">
          <div class="summary">
            <div class="listing-summary-lead">
              <input type="checkbox" class="listing-check" data-select-listing="${esc(idStr)}" ${checked} aria-label="Select ${esc(
          [x.year, x.make, x.model].filter(Boolean).join(" ")
        )}">
              ${thumb}
              <div class="vehicle">
                <h2>${esc(x.year || "")} ${esc(x.make || "")} ${esc(x.model || "")}</h2>
                <div class="meta-line">
                  <span>KES ${fmt(x.price)}</span><span class="sep">·</span>
                  <span>${fmt(x.km)} km</span><span class="sep">·</span>
                  <span>${esc(x.fuel || "Fuel not specified")}</span><span class="sep">·</span>
                  <span>${esc(name)}</span>
                </div>
                <div style="margin-top:8px"><span class="status ${esc(
                  statusClass(x.status || "pending")
                )}">${esc(x.status || "pending")}</span></div>
              </div>
            </div>
            <div class="actions">
              <button class="ghost" type="button" data-view="${esc(idStr)}">Details</button>
              <button class="ghost" type="button" data-edit-listing="${esc(idStr)}">Edit specs</button>
              ${
                x.status !== "approved"
                  ? `<button class="approve" type="button" data-action="approve" data-id="${esc(
                      idStr
                    )}">Approve</button>`
                  : ""
              }
              ${
                x.status !== "rejected"
                  ? `<button class="reject" type="button" data-action="reject" data-id="${esc(
                      idStr
                    )}">Reject</button>`
                  : ""
              }
              <button class="danger" type="button" data-action="delete" data-id="${esc(
                idStr
              )}">Delete</button>
            </div>
          </div>
          <div class="details">
            <div class="grid">
              <div>
                <div class="fields">
                  <div class="field"><strong>Seller</strong>${esc(name)}</div>
                  <div class="field"><strong>WhatsApp / phone</strong>${esc(phone)}</div>
                  <div class="field"><strong>Email</strong>${esc(x.seller_email || "—")}</div>
                  <div class="field"><strong>Location</strong>${esc(x.yard_location || "—")}</div>
                  <div class="field"><strong>Year</strong>${esc(x.year || "—")}</div>
                  <div class="field"><strong>Make &amp; Model</strong>${esc(
                    [x.make, x.model].filter(Boolean).join(" ") || "—"
                  )}</div>
                  <div class="field"><strong>Price</strong>KES ${fmt(x.price)}</div>
                  <div class="field"><strong>Submitted</strong>${esc(
                    A.fmtDate(x.created_at)
                  )}</div>
                </div>
                <div class="field" style="margin-top:10px"><strong>Description</strong><div class="desc">${esc(
                  x.description || "No description provided."
                )}</div></div>
              </div>
              <div>
                <strong style="font-size:12px">Vehicle photos (${photos.length})</strong>
                <span class="photo-review-hint">Click any photo to open full-screen viewer.</span>
                <div class="photos" style="margin-top:8px">
                  ${
                    photos.length
                      ? photos
                          .map(
                            (p, i) =>
                              `<a href="${esc(p)}" class="admin-photo-open" data-photo-index="${i}" aria-label="View photo ${
                                i + 1
                              }"><img src="${esc(p)}" alt="Vehicle photo ${
                                i + 1
                              }" loading="lazy" decoding="async"></a>`
                          )
                          .join("")
                      : '<span class="meta">No photos uploaded.</span>'
                  }
                </div>
              </div>
            </div>
          </div>
        </article>`;
      })
      .join("");

    const pag = $("listingsPagination");
    if (pag) {
      if (totalPages > 1) {
        pag.classList.remove("hidden");
        pag.innerHTML = `
          <span class="meta">Page ${currentPage} of ${totalPages} · ${list.length} total</span>
          <div class="actions">
            <button type="button" class="ghost" data-list-page="${currentPage - 1}" ${
          currentPage <= 1 ? "disabled" : ""
        }>Previous</button>
            <button type="button" class="ghost" data-list-page="${currentPage + 1}" ${
          currentPage >= totalPages ? "disabled" : ""
        }>Next</button>
          </div>`;
      } else {
        pag.classList.add("hidden");
      }
    }

    updateBulkBar(pageItems);
  }

  async function loadListings(opts = {}) {
    if (!sb) {
      showNotice("Supabase is not configured.", "err");
      return;
    }
    if (!opts.silent) {
      hideNotice();
      if ($("listings")) $("listings").innerHTML = '<div class="empty">Loading listings…</div>';
    }
    const { data, error } = await sb
      .from("listings")
      .select(
        "id,make,model,year,price,km,fuel,status,seller_name,seller_phone,seller_email,yard_location,description,photos,whatsapp,seller_type,yard_name,created_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      showNotice("Could not load listings: " + error.message, "err");
      return;
    }
    state.listings = data || [];
    const validSet = new Set(state.listings.map((x) => String(x.id)));
    for (const id of [...selectedIds]) {
      if (!validSet.has(id)) selectedIds.delete(id);
    }
    renderListings();
  }

  function setFilter(nextFilter) {
    currentFilter = nextFilter || "pending";
    currentPage = 1;
    document.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === currentFilter);
    });
    renderListings();
  }

  async function moderateListing(id, action) {
    const item = state.listings.find((x) => String(x.id) === String(id));
    const title = item
      ? [item.year, item.make, item.model].filter(Boolean).join(" ")
      : "this vehicle";

    let reason = "";
    if (action === "delete") {
      const ok = await confirm({
        eyebrow: "LISTINGS · DELETE",
        title: `Delete ${title}?`,
        message: "This permanently removes the listing from the database and cannot be undone.",
        confirmText: "Delete permanently",
        danger: true,
      });
      if (!ok) return false;
    } else if (action === "reject") {
      const res = await prompt({
        eyebrow: "LISTINGS · REJECT",
        title: `Reject ${title}?`,
        message:
          "The listing will be hidden from public inventory. Optionally record a reason in the audit trail.",
        label: "Rejection note (optional, saved to Audit History)",
        placeholder: "e.g. Blurry photos, incomplete price, duplicate entry…",
        multiline: true,
        required: false,
        confirmText: "Reject listing",
        danger: true,
      });
      if (res === null) return false;
      reason = res;
    } else if (action === "approve") {
      const ok = await confirm({
        eyebrow: "LISTINGS · APPROVE",
        title: `Approve ${title}?`,
        message: "This will publish the vehicle to the public marketplace immediately.",
        confirmText: "Approve & publish",
      });
      if (!ok) return false;
    }

    const q =
      action === "delete"
        ? sb.from("listings").delete().eq("id", id)
        : sb
            .from("listings")
            .update({ status: action === "approve" ? "approved" : "rejected" })
            .eq("id", id);

    const { error } = await q;
    if (error) {
      showNotice("Action failed: " + error.message, "err");
      return false;
    }

    await recordAdminAudit(
      action,
      "vehicle_listing",
      id,
      `${action} vehicle listing (${title})${reason ? " — Reason: " + reason : ""}`
    );

    toast(
      action === "delete" ? "Listing deleted." : `Listing ${action}d successfully.`,
      "ok"
    );
    await loadListings({ silent: true });
    window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    window.ThreePedalsAdminRequests?.loadRequestsInbox?.({ silent: true });
    return true;
  }

  function openListingDrawer(id, opts = {}) {
    const x = state.listings.find((row) => String(row.id) === String(id));
    if (!x) return;
    const photos = photosOf(x);
    const title = [x.year, x.make, x.model].filter(Boolean).join(" ") || "Vehicle listing";
    const seller = x.seller_name || x.yard_name || "Private seller";

    const bodyHtml = `
      <div class="meta-line" style="margin-bottom:12px">
        <span class="status ${esc(statusClass(x.status || "pending"))}">${esc(
      x.status || "pending"
    )}</span>
        <span class="sep">·</span><span>${esc(seller)}</span>
        <span class="sep">·</span><span>${esc(x.seller_phone || x.whatsapp || "No phone")}</span>
      </div>
      ${
        photos.length
          ? `<div class="photos" style="margin-bottom:16px">${photos
              .map(
                (p, i) =>
                  `<a href="${esc(p)}" class="admin-photo-open" data-photo-index="${i}"><img src="${esc(
                    p
                  )}" alt="Vehicle photo ${i + 1}" loading="lazy" decoding="async"></a>`
              )
              .join("")}</div>`
          : '<p class="meta">No photos uploaded.</p>'
      }
      <form id="drawerEditListingForm">
        <div class="editor-grid">
          <div><label for="dlYear">Year</label><input id="dlYear" type="number" min="1950" max="2030" value="${esc(
            x.year || ""
          )}" required></div>
          <div><label for="dlPrice">Price (KES)</label><input id="dlPrice" type="number" min="1" value="${esc(
            x.price || ""
          )}" required></div>
          <div><label for="dlMake">Make</label><input id="dlMake" value="${esc(
            x.make || ""
          )}" required></div>
          <div><label for="dlModel">Model</label><input id="dlModel" value="${esc(
            x.model || ""
          )}" required></div>
          <div><label for="dlKm">Mileage (km)</label><input id="dlKm" type="number" min="0" value="${esc(
            x.km ?? 0
          )}"></div>
          <div><label for="dlFuel">Fuel</label><input id="dlFuel" value="${esc(
            x.fuel || ""
          )}"></div>
          <div class="full"><label for="dlLocation">Location</label><input id="dlLocation" value="${esc(
            x.yard_location || ""
          )}"></div>
          <div class="full"><label for="dlDesc">Description</label><textarea id="dlDesc" rows="4">${esc(
            x.description || ""
          )}</textarea></div>
        </div>
        <div class="editor-actions">
          <button type="submit" class="primary" id="dlSaveSpecs">Save spec edits</button>
        </div>
      </form>`;

    const footerHtml = `
      ${
        x.status !== "approved"
          ? `<button type="button" class="approve" id="dlApproveBtn">Approve &amp; publish</button>`
          : ""
      }
      ${
        x.status !== "rejected"
          ? `<button type="button" class="reject" id="dlRejectBtn">Reject</button>`
          : ""
      }
      <button type="button" class="danger" id="dlDeleteBtn">Delete</button>`;

    openDrawer({
      eyebrow: opts.triage ? "Quick triage · Vehicle listing" : "Edit vehicle specs",
      title,
      subtitle: `${seller} · Submitted ${A.fmtDate(x.created_at)}`,
      bodyHtml,
      footerHtml,
      onMount: (drawer) => {
        drawer.querySelector("#drawerEditListingForm")?.addEventListener("submit", async (ev) => {
          ev.preventDefault();
          const saveBtn = drawer.querySelector("#dlSaveSpecs");
          if (saveBtn) saveBtn.disabled = true;
          const payload = {
            year: Number(drawer.querySelector("#dlYear")?.value) || x.year,
            price: Number(drawer.querySelector("#dlPrice")?.value) || x.price,
            make: drawer.querySelector("#dlMake")?.value.trim() || x.make,
            model: drawer.querySelector("#dlModel")?.value.trim() || x.model,
            km: Number(drawer.querySelector("#dlKm")?.value || 0),
            fuel: drawer.querySelector("#dlFuel")?.value.trim() || "",
            yard_location: drawer.querySelector("#dlLocation")?.value.trim() || "",
            description: drawer.querySelector("#dlDesc")?.value.trim() || "",
          };
          const { error } = await sb.from("listings").update(payload).eq("id", x.id);
          if (saveBtn) saveBtn.disabled = false;
          if (error) {
            showNotice("Could not save vehicle specs: " + error.message, "err");
            return;
          }
          await recordAdminAudit(
            "edit_vehicle_listing",
            "vehicle_listing",
            x.id,
            `Updated specs for ${payload.year} ${payload.make} ${payload.model}`
          );
          toast("Vehicle specs saved.", "ok");
          await loadListings({ silent: true });
        });

        drawer.querySelector("#dlApproveBtn")?.addEventListener("click", async () => {
          if (await moderateListing(x.id, "approve")) closeDrawer();
        });
        drawer.querySelector("#dlRejectBtn")?.addEventListener("click", async () => {
          if (await moderateListing(x.id, "reject")) closeDrawer();
        });
        drawer.querySelector("#dlDeleteBtn")?.addEventListener("click", async () => {
          if (await moderateListing(x.id, "delete")) closeDrawer();
        });
      },
    });
  }

  /* ===== Bulk Actions ===== */
  async function runBulkModeration(targetStatus) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    let reason = "";
    if (targetStatus === "rejected") {
      const res = await prompt({
        eyebrow: "BULK REJECTION",
        title: `Reject ${ids.length} selected listing${ids.length === 1 ? "" : "s"}?`,
        message: "Selected listings will be removed from public view.",
        label: "Rejection reason (optional, saved to Audit History)",
        placeholder: "Reason for bulk rejection…",
        confirmText: `Reject ${ids.length} listing${ids.length === 1 ? "" : "s"}`,
        danger: true,
      });
      if (res === null) return;
      reason = res;
    } else {
      const ok = await confirm({
        eyebrow: "BULK APPROVAL",
        title: `Approve ${ids.length} selected listing${ids.length === 1 ? "" : "s"}?`,
        message: "All selected vehicles will go live immediately on the public marketplace.",
        confirmText: `Approve ${ids.length} listing${ids.length === 1 ? "" : "s"}`,
      });
      if (!ok) return;
    }

    const { error } = await sb
      .from("listings")
      .update({ status: targetStatus })
      .in("id", ids);
    if (error) {
      showNotice("Bulk update failed: " + error.message, "err");
      return;
    }

    await recordAdminAudit(
      targetStatus === "approved" ? "bulk_approve_listings" : "bulk_reject_listings",
      "vehicle_listing",
      ids.slice(0, 5).join(","),
      `Bulk ${targetStatus} ${ids.length} listings${reason ? " — Reason: " + reason : ""}`
    );

    selectedIds.clear();
    toast(`${ids.length} listing${ids.length === 1 ? "" : "s"} updated to ${targetStatus}.`, "ok");
    await loadListings({ silent: true });
    window.ThreePedalsAdminOverview?.loadOverview?.({ silent: true });
    window.ThreePedalsAdminRequests?.loadRequestsInbox?.({ silent: true });
  }

  function exportFilteredListings() {
    const { list } = getFilteredListings();
    const columns = [
      ["Listing ID", "id"],
      ["Status", "status"],
      ["Seller type", "seller_type"],
      ["Yard name", "yard_name"],
      ["Seller name", "seller_name"],
      ["Seller phone", "seller_phone"],
      ["Seller email", "seller_email"],
      ["Location", "yard_location"],
      ["Year", "year"],
      ["Make", "make"],
      ["Model", "model"],
      ["Price (KES)", "price"],
      ["Mileage (km)", "km"],
      ["Fuel", "fuel"],
      ["Created at", "created_at"],
    ];
    downloadCsv(
      `3-pedals-vehicle-listings-${new Date().toISOString().slice(0, 10)}.csv`,
      columns.map((c) => c[0]),
      list.map((row) => columns.map((c) => row[c[1]]))
    );
    toast(`Exported ${list.length} listing${list.length === 1 ? "" : "s"}.`, "ok");
  }

  /* ===== Event Listeners ===== */
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });

  $("listingSearch")?.addEventListener(
    "input",
    debounce(() => {
      currentPage = 1;
      renderListings();
    }, 150)
  );
  $("listingSellerFilter")?.addEventListener("change", () => {
    currentPage = 1;
    renderListings();
  });
  $("listingSort")?.addEventListener("change", () => {
    currentPage = 1;
    renderListings();
  });
  $("clearListingSearch")?.addEventListener("click", () => {
    if ($("listingSearch")) $("listingSearch").value = "";
    if ($("listingSellerFilter")) $("listingSellerFilter").value = "all";
    if ($("listingSort")) $("listingSort").value = "newest";
    currentPage = 1;
    renderListings();
  });
  $("exportListings")?.addEventListener("click", exportFilteredListings);

  $("listings")?.addEventListener("change", (e) => {
    const cb = e.target.closest("[data-select-listing]");
    if (!cb) return;
    if (cb.checked) selectedIds.add(cb.dataset.selectListing);
    else selectedIds.delete(cb.dataset.selectListing);
    const { list } = getFilteredListings();
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    updateBulkBar(list.slice(startIdx, startIdx + PAGE_SIZE));
  });

  $("listings")?.addEventListener("click", async (e) => {
    const view = e.target.closest("[data-view]");
    if (view) {
      view.closest(".listing")?.classList.toggle("open");
      return;
    }
    const edit = e.target.closest("[data-edit-listing]");
    if (edit) {
      openListingDrawer(edit.dataset.editListing);
      return;
    }
    const act = e.target.closest("[data-action]");
    if (!act) return;
    act.disabled = true;
    await moderateListing(act.dataset.id, act.dataset.action);
    if (act.isConnected) act.disabled = false;
  });

  $("listingsPagination")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-list-page]");
    if (!btn || btn.disabled) return;
    currentPage = Number(btn.dataset.listPage) || 1;
    renderListings();
    $("listingsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("bulkSelectVisible")?.addEventListener("click", () => {
    const { list } = getFilteredListings();
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = list.slice(startIdx, startIdx + PAGE_SIZE);
    const allSelected =
      pageItems.length > 0 && pageItems.every((item) => selectedIds.has(String(item.id)));
    pageItems.forEach((item) => {
      if (allSelected) selectedIds.delete(String(item.id));
      else selectedIds.add(String(item.id));
    });
    renderListings();
  });
  $("bulkClearBtn")?.addEventListener("click", () => {
    selectedIds.clear();
    renderListings();
  });
  $("bulkApproveBtn")?.addEventListener("click", () => runBulkModeration("approved"));
  $("bulkRejectBtn")?.addEventListener("click", () => runBulkModeration("rejected"));

  A.registerLoader("listingsPanel", loadListings);
  window.ThreePedalsAdminListings = {
    loadListings,
    renderListings,
    setFilter,
    openListingDrawer,
  };
})();
