/* 3 Pedals Auto KE — Account Listings CRUD, Photo Gallery & Seller Analytics Hydration */
(() => {
  "use strict";

  function photoStoragePaths(photos, ownerId) {
    const prefix = "/storage/v1/object/public/car-photos/";
    return [
      ...new Set(
        (Array.isArray(photos) ? photos : [])
          .flatMap((value) => {
            try {
              const path = new URL(String(value), location.href).pathname;
              const at = path.indexOf(prefix);
              return at < 0 ? [] : [decodeURIComponent(path.slice(at + prefix.length))];
            } catch (_) {
              return [];
            }
          })
          .filter((path) => path && (!ownerId || path.split("/")[0] === ownerId))
      ),
    ];
  }

  function bind({
    sb,
    me,
    dialog,
    box,
    listings,
    analyticsPromise,
    renderVersion,
    getRenderVersion,
    openAccount,
    loadListings,
    normWa,
    shrink,
    $,
    esc,
  }) {
    const L = Array.isArray(listings) ? listings : [];
    const listingSearch = $("sellerListingSearch");
    const listingStatus = $("sellerListingStatus");
    const listingCount = $("sellerListingCount");

    const filterSellerListings = () => {
      const query = (listingSearch?.value || "").trim().toLowerCase();
      const status = listingStatus?.value || "";
      let shown = 0;
      const rows = box.querySelectorAll("[data-seller-listing]");
      rows.forEach((row) => {
        const matches =
          (!query || (row.dataset.listingSearch || "").includes(query)) &&
          (!status || row.dataset.listingStatus === status);
        row.hidden = !matches;
        if (matches) shown++;
      });
      if (listingCount) {
        listingCount.textContent = `Showing ${shown} of ${rows.length} listings`;
      }
    };

    listingSearch?.addEventListener("input", filterSellerListings);
    listingStatus?.addEventListener("change", filterSellerListings);
    filterSellerListings();

    box.querySelectorAll("[data-view]").forEach((bt) => {
      bt.onclick = () => {
        window.location.href = `vehicle.html?id=${encodeURIComponent(bt.dataset.view)}`;
      };
    });

    box.querySelectorAll("[data-sold]").forEach((bt) => {
      bt.onclick = async () => {
        const ui = window.ThreePedalsAccountUI;
        const rawPrice = await ui?.prompt({
          eyebrow: "RECORD SALE",
          title: `Mark ${bt.dataset.title || "vehicle"} as sold`,
          message:
            "Marking this vehicle as sold immediately removes it from public inventory.",
          label: "Seller-reported final sale price (KES)",
          placeholder: "e.g. 2450000",
          inputType: "number",
          min: "1",
          step: "1",
          required: true,
          helperNote:
            "The sale amount is seller-reported for your insights only and is not a verified platform payout.",
          confirmText: "Confirm & mark sold",
        });
        if (rawPrice === null || rawPrice === undefined) return;
        const salePrice = Number(rawPrice);
        if (!Number.isFinite(salePrice) || salePrice <= 0) {
          ui?.toast("Enter a valid sale price greater than zero.", "warn");
          return;
        }
        bt.disabled = true;
        bt.textContent = "Updating…";
        const { data, error } = await sb.rpc("mark_listing_sold", {
          listing_id: bt.dataset.sold,
          reported_price: salePrice,
        });
        if (error) {
          ui?.toast(error.message || "Could not mark this vehicle as sold.", "err");
          bt.disabled = false;
          bt.textContent = "Mark sold";
          return;
        }
        if (data !== true) {
          ui?.toast("We could not mark this vehicle as sold. Please try again.", "err");
          bt.disabled = false;
          bt.textContent = "Mark sold";
          return;
        }
        ui?.toast("Vehicle marked as sold.", "ok");
        openAccount({ refresh: true });
        loadListings?.();
      };
    });

    box.querySelectorAll("[data-del]").forEach((bt) => {
      bt.onclick = async () => {
        const ui = window.ThreePedalsAccountUI;
        const confirmed = await ui?.confirm({
          eyebrow: "MY LISTINGS",
          title: "Delete this listing?",
          message:
            "This will permanently remove the vehicle listing and its photos from your account.",
          confirmText: "Delete listing",
          danger: true,
        });
        if (!confirmed) return;
        bt.disabled = true;
        bt.textContent = "Deleting…";
        const { data: deleted, error } = await sb
          .from("listings")
          .delete()
          .eq("id", bt.dataset.del)
          .eq("owner", me.id)
          .select("photos")
          .maybeSingle();
        if (error) {
          ui?.toast(error.message || "Could not delete listing.", "err");
          bt.disabled = false;
          bt.textContent = "Delete";
          return;
        }
        if (!deleted) {
          ui?.toast("This listing could not be found in your account.", "warn");
          openAccount({ refresh: true });
          return;
        }
        const paths = photoStoragePaths(deleted.photos || [], me.id);
        if (paths.length) {
          const removed = await sb.storage.from("car-photos").remove(paths);
          if (removed.error) {
            console.warn(
              "Listing deleted, but its photo files could not be removed:",
              removed.error
            );
          }
        }
        ui?.toast("Listing deleted.", "ok");
        openAccount({ refresh: true });
        loadListings?.();
      };
    });

    // Mount #sellerEditListingDialog directly on document.body (removing any stale copy)
    // so #accBody snapshots never persist it and it renders in top-layer unimpeded.
    document.querySelectorAll("#sellerEditListingDialog").forEach((el) => el.remove());
    const editDialog = document.createElement("dialog");
    editDialog.className = "wide";
    editDialog.id = "sellerEditListingDialog";
    editDialog.setAttribute("aria-label", "Edit vehicle listing");
    editDialog.innerHTML = `<div class="in"><div class="account-dialog-head"><h2>Edit vehicle listing</h2><button type="button" class="btn ghost" id="sellerEditClose">Close</button></div><form id="sellerEditForm"><p class="meta">Add, remove or replace photos. Live listing changes return to review before republishing.</p><div class="two"><div><label for="editListingMake">Make</label><input id="editListingMake" required maxlength="80"></div><div><label for="editListingModel">Model / variant</label><input id="editListingModel" required maxlength="120"></div><div><label for="editListingYear">Year</label><input id="editListingYear" type="number" min="1885" max="2026" required></div><div><label for="editListingPrice">Asking price (KES)</label><input id="editListingPrice" type="number" min="1" required></div><div><label for="editListingKm">Mileage (km)</label><input id="editListingKm" type="number" min="0"></div><div><label for="editListingFuel">Fuel</label><select id="editListingFuel"><option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Turbo-petrol</option><option>Turbo-diesel</option><option>Full electric</option><option>Petrol hybrid</option><option>Diesel hybrid</option></select></div></div><label for="editListingPhotos">Vehicle photos (up to 15 total)</label><input id="editListingPhotos" type="file" accept="image/*" multiple><p class="meta" id="editListingPhotoCount" aria-live="polite">0 of 15 photos</p><div id="editListingPhotoGallery" class="edit-photo-gallery" aria-live="polite"></div><label for="editListingWhatsapp">WhatsApp number</label><input id="editListingWhatsapp" type="tel" required><label for="editListingDescription">Description</label><textarea id="editListingDescription" rows="4"></textarea><p class="meta" id="sellerEditMessage" role="status" aria-live="polite"></p><div class="acts"><button class="btn" id="sellerEditSave" type="submit">Save changes</button><button class="btn ghost" id="sellerEditCancel" type="button">Cancel</button></div></form></div>`;
    document.body.appendChild(editDialog);

    const editForm = editDialog.querySelector("#sellerEditForm");
    const editMessage = editDialog.querySelector("#sellerEditMessage");
    const editSave = editDialog.querySelector("#sellerEditSave");
    const editPhotosInput = editDialog.querySelector("#editListingPhotos");
    const editPhotoCount = editDialog.querySelector("#editListingPhotoCount");
    const editPhotoGallery = editDialog.querySelector("#editListingPhotoGallery");
    let editPhotoItems = [];

    const revokeEditPhotoPreviews = () =>
      editPhotoItems.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });

    const renderEditPhotoGallery = () => {
      editPhotoCount.textContent = editPhotoItems.length + " of 15 photos";
      editPhotoGallery.innerHTML = editPhotoItems
        .map(
          (item, index) =>
            `<div class="edit-photo-item"><img src="${esc(item.preview || item.url)}" alt="Vehicle photo ${index + 1}" loading="lazy" decoding="async"><button type="button" class="btn ghost" data-remove-edit-photo="${index}" aria-label="Remove photo ${index + 1}">Remove</button></div>`
        )
        .join("");
      editPhotosInput.disabled = editPhotoItems.length >= 15;
    };

    editPhotoGallery.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-edit-photo]");
      if (!button) return;
      const index = Number(button.dataset.removeEditPhoto);
      const item = editPhotoItems[index];
      if (item?.preview) URL.revokeObjectURL(item.preview);
      editPhotoItems.splice(index, 1);
      renderEditPhotoGallery();
    });

    editPhotosInput.addEventListener("change", () => {
      const chosen = Array.from(editPhotosInput.files || []);
      if (editPhotoItems.length + chosen.length > 15) {
        editMessage.textContent =
          "A listing can have up to 15 photos. You can add " +
          Math.max(0, 15 - editPhotoItems.length) +
          " more.";
        editPhotosInput.value = "";
        return;
      }
      for (const file of chosen) {
        if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
          editMessage.textContent = "Each photo must be an image under 10 MB.";
          continue;
        }
        editPhotoItems.push({ file, preview: URL.createObjectURL(file) });
      }
      editPhotosInput.value = "";
      renderEditPhotoGallery();
    });

    const closeEditDialog = () => {
      if (editDialog.open) editDialog.close();
    };
    editDialog.querySelector("#sellerEditClose").onclick = closeEditDialog;
    editDialog.querySelector("#sellerEditCancel").onclick = closeEditDialog;

    box.querySelectorAll("[data-edit]").forEach((button) => {
      button.onclick = () => {
        const listing = L.find((item) => String(item.id) === String(button.dataset.edit));
        if (!listing || listing.owner !== me.id || listing.status === "sold") {
          editMessage.textContent = "This listing cannot be edited from this account.";
          return;
        }
        revokeEditPhotoPreviews();
        editPhotoItems = (Array.isArray(listing.photos) ? listing.photos : []).map((url) => ({
          url,
        }));
        editForm.dataset.listingId = listing.id;
        editForm.dataset.originalStatus = listing.status || "pending";
        editDialog.querySelector("#editListingMake").value = listing.make || "";
        editDialog.querySelector("#editListingModel").value = listing.model || "";
        editDialog.querySelector("#editListingYear").value = listing.year || "";
        editDialog.querySelector("#editListingPrice").value = listing.price ?? "";
        editDialog.querySelector("#editListingKm").value = listing.km ?? 0;
        editDialog.querySelector("#editListingFuel").value = listing.fuel || "Petrol";
        editDialog.querySelector("#editListingWhatsapp").value = listing.whatsapp || "";
        editDialog.querySelector("#editListingDescription").value = listing.description || "";
        editMessage.textContent = "";
        editSave.disabled = false;
        editSave.textContent = "Save changes";
        renderEditPhotoGallery();
        if (!editDialog.open) editDialog.showModal();
      };
    });

    editForm.onsubmit = async (event) => {
      event.preventDefault();
      const listingId = editForm.dataset.listingId;
      const originalStatus = editForm.dataset.originalStatus;
      const listing = L.find((item) => String(item.id) === String(listingId));
      if (!listing || listing.owner !== me.id || listing.status === "sold") {
        editMessage.textContent = "This listing is no longer editable. Refresh and try again.";
        return;
      }
      const make = editDialog.querySelector("#editListingMake").value.trim();
      const model = editDialog.querySelector("#editListingModel").value.trim();
      const year = Number(editDialog.querySelector("#editListingYear").value);
      const price = Number(editDialog.querySelector("#editListingPrice").value);
      const km = Number(editDialog.querySelector("#editListingKm").value || 0);
      const whatsapp = normWa(editDialog.querySelector("#editListingWhatsapp").value);
      if (
        !make ||
        !model ||
        !Number.isInteger(year) ||
        year < 1885 ||
        year > 2026 ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(km) ||
        km < 0 ||
        !whatsapp
      ) {
        editMessage.textContent =
          "Check the make, model, year, price, mileage and WhatsApp number.";
        return;
      }
      const updates = {
        make,
        model,
        year,
        price,
        km,
        fuel: editDialog.querySelector("#editListingFuel").value,
        whatsapp,
        description: editDialog.querySelector("#editListingDescription").value.trim(),
      };
      if (originalStatus !== "pending") updates.status = "pending";
      editSave.disabled = true;
      editSave.textContent = "Saving…";
      editMessage.textContent = "Saving your changes and photos…";
      const uploadedPaths = [];
      try {
        const nextPhotos = [];
        for (let i = 0; i < editPhotoItems.length; i++) {
          const item = editPhotoItems[i];
          if (item.file) {
            const dataUrl = await shrink(item.file);
            const blob = await (await fetch(dataUrl)).blob();
            const photoId = crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const path = `${me.id}/${photoId}-edit-${i}.jpg`;
            const upload = await sb.storage
              .from("car-photos")
              .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
            if (upload.error) throw upload.error;
            uploadedPaths.push(path);
            nextPhotos.push(sb.storage.from("car-photos").getPublicUrl(path).data.publicUrl);
          } else {
            nextPhotos.push(item.url);
          }
        }
        updates.photos = nextPhotos;
        const { data, error } = await sb
          .from("listings")
          .update(updates)
          .eq("id", listingId)
          .eq("owner", me.id)
          .neq("status", "sold")
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          throw new Error(
            "No listing was updated. It may have changed or you may not own this listing."
          );
        }
        const removedPaths = photoStoragePaths(
          (Array.isArray(listing.photos) ? listing.photos : []).filter(
            (url) => !nextPhotos.includes(url)
          ),
          me.id
        );
        if (removedPaths.length) {
          const removed = await sb.storage.from("car-photos").remove(removedPaths);
          if (removed.error) {
            console.warn(
              "Listing saved, but removed photo files could not be cleaned up:",
              removed.error
            );
          }
        }
        listing.photos = nextPhotos;
        if (originalStatus !== "pending") listing.status = "pending";
        editMessage.textContent =
          originalStatus !== "pending"
            ? "Saved. Changes and photos are awaiting review before this listing goes live again."
            : "Changes and photos saved.";
        editSave.textContent = "Saved";
        editSave.disabled = false;
        revokeEditPhotoPreviews();
        editPhotoItems = nextPhotos.map((url) => ({ url }));
        renderEditPhotoGallery();
      } catch (error) {
        if (uploadedPaths.length) {
          const cleanup = await sb.storage.from("car-photos").remove(uploadedPaths);
          if (cleanup.error) {
            console.warn("Could not clean up newly uploaded listing photos:", cleanup.error);
          }
        }
        editMessage.textContent =
          error.message || "Could not save your changes. Please try again.";
        editSave.disabled = false;
        editSave.textContent = "Save changes";
      }
    };

    if (analyticsPromise) {
      Promise.resolve(analyticsPromise)
        .then((analyticsResult) => {
          if (
            renderVersion !== getRenderVersion() ||
            !dialog.open ||
            !box.querySelector(".account-pages")
          ) {
            return;
          }
          const status = $("sellerAnalyticsStatus");
          const stats = $("sellerAnalyticsStats");
          if (analyticsResult?.error) {
            if (status) {
              status.textContent =
                "Listing performance metrics are unavailable. Check that the seller analytics SQL setup is installed in Supabase.";
            }
            return;
          }
          const events = analyticsResult?.data || [];
          const metrics = new Map();
          let views = 0;
          let enquiries = 0;
          for (const event of events) {
            const key = String(event.listing_id);
            const metric = metrics.get(key) || { views: 0, whatsapp: 0 };
            if (event.event_type === "view") {
              views++;
              metric.views++;
            }
            if (event.event_type === "whatsapp_click") {
              enquiries++;
              metric.whatsapp++;
            }
            metrics.set(key, metric);
          }
          if (stats) {
            stats.hidden = false;
            stats.innerHTML = `<table class="seller-analytics-table seller-performance-table"><tbody><tr><th scope="row">Vehicle page views</th><td>${views}</td></tr><tr><th scope="row">WhatsApp enquiries clicked</th><td>${enquiries}</td></tr></tbody></table>`;
            stats.style.display = "block";
          }
          box.querySelectorAll("[data-seller-listing]").forEach((row) => {
            let metric = row.querySelector(".seller-listing-metrics");
            if (!metric) {
              metric = document.createElement("span");
              metric.className = "meta seller-listing-metrics";
              row.querySelector(".seller-garage-content,.seller-listing-main")?.append(metric);
            }
            const value = metrics.get(String(row.dataset.listingId)) || {
              views: 0,
              whatsapp: 0,
            };
            metric.textContent = `${value.views} views · ${value.whatsapp} WhatsApp enquiry clicks`;
          });
          if (status) status.textContent = "";
        })
        .catch((error) => {
          if (renderVersion === getRenderVersion()) {
            const status = $("sellerAnalyticsStatus");
            if (status) {
              status.textContent = "Listing performance metrics could not be loaded right now.";
            }
            console.warn("Seller analytics load failed:", error);
          }
        });
    }
  }

  window.ThreePedalsAccountListings = {
    photoStoragePaths,
    bind,
  };
})();
