/* 3 Pedals Auto KE — Account Workspace Renderer, Saved Vehicles, Profile CRUD & Bookings */
(() => {
  "use strict";

  const host = () => window.ThreePedalsAccountHost || {};
  const sb = () => host().getSb?.() || null;
  const getMe = () => host().getMe?.() || null;
  const setMe = (v) => host().setMe?.(v);
  const getProfile = () => host().getProfile?.() || null;
  const setProfile = (v) => host().setProfile?.(v);
  const setSellerPreferences = (v) => host().setSellerPreferences?.(v);
  const setSellerSlugEdited = (v) => host().setSellerSlugEdited?.(v);
  const $ = (id) => (host().$ ? host().$(id) : document.getElementById(id));
  const esc = (s) =>
    host().esc
      ? host().esc(s)
      : String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = (n) => (host().fmt ? host().fmt(n) : Number(n).toLocaleString("en-US"));
  const normWa = (raw) => (host().normWa ? host().normWa(raw) : "");
  const shrink = (file) => (host().shrink ? host().shrink(file) : Promise.reject());

  let accountDataPrefetch = null;
  let accountDataPrefetchUserId = null;
  let accountRenderVersion = 0;
  let promotionHistoryRefreshTimer = null;
  let chauffeurAccountRefreshTimer = null;
  let chauffeurAccountChannel = null;

  let savedVehicleIds = new Set();
  let savedVehicleRows = [];
  let savedVehiclesLoadedFor = null;
  let savedVehiclesLoadError = "";

  let pendingProfilePhoto = null;
  let pendingRemoveProfilePhoto = false;

  function resetSavedVehiclesState() {
    savedVehicleIds = new Set();
    savedVehicleRows = [];
    savedVehiclesLoadedFor = null;
    savedVehiclesLoadError = "";
  }

  function isSavedVehicle(id) {
    return savedVehicleIds.has(String(id));
  }

  function clearAccountPrefetch() {
    accountDataPrefetch = null;
    accountDataPrefetchUserId = null;
  }

  async function loadSavedVehicles() {
    const client = sb();
    const me = getMe();
    if (!client || !me) {
      resetSavedVehiclesState();
      return [];
    }
    if (savedVehiclesLoadedFor === me.id) return savedVehicleRows;
    const userId = me.id;
    const { data, error } = await client
      .from("saved_vehicles")
      .select(
        "listing_id,created_at,listing:listings(id,make,model,year,price,km,fuel,photos,status)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      savedVehiclesLoadError = error.message || "Saved vehicles could not be loaded.";
      console.warn("Saved vehicles could not be loaded:", error);
      return [];
    }
    if (getMe()?.id !== userId) return [];
    savedVehiclesLoadError = "";
    savedVehicleRows = (data || []).filter(
      (row) => row.listing && String(row.listing.status || "").toLowerCase() === "approved"
    );
    savedVehicleIds = new Set((data || []).map((row) => String(row.listing_id)));
    savedVehiclesLoadedFor = userId;
    return savedVehicleRows;
  }

  async function toggleSavedVehicle(id, button) {
    const client = sb();
    const me = getMe();
    if (!me) {
      host().openAuth?.("login", "Sign in to save vehicles to your account.");
      return;
    }
    id = String(id);
    const removing = savedVehicleIds.has(id);
    if (button) {
      button.disabled = true;
      button.textContent = removing ? "Removing…" : "Saving…";
    }
    const result = removing
      ? await client.from("saved_vehicles").delete().eq("listing_id", id)
      : await client.from("saved_vehicles").insert({ listing_id: id, user_id: me.id });
    if (result.error) {
      if (button) {
        button.disabled = false;
        button.textContent = removing ? "Remove saved" : "Save vehicle";
      }
      window.ThreePedalsAccountUI?.toast(
        result.error.message || "Could not update saved vehicles.",
        "err"
      );
      return;
    }
    if (removing) {
      savedVehicleIds.delete(id);
      savedVehicleRows = savedVehicleRows.filter((row) => String(row.listing_id) !== id);
    } else {
      savedVehicleIds.add(id);
      savedVehiclesLoadedFor = null;
      await loadSavedVehicles();
    }
    document.querySelectorAll("[data-save-vehicle]").forEach((el) => {
      if (el.dataset.saveVehicle === id) {
        el.textContent = savedVehicleIds.has(id) ? "Saved ✓" : "Save vehicle";
        el.setAttribute("aria-pressed", String(savedVehicleIds.has(id)));
        el.disabled = false;
      }
    });
    const savedMetric = $("accBody")?.querySelector('[data-overview-page="buying"] b, [data-overview-page="buying"] strong');
    if (savedMetric) savedMetric.textContent = String(savedVehicleRows.length);
    const navSaved = $("accNavSavedCount");
    if (navSaved) navSaved.textContent = savedVehicleRows.length ? String(savedVehicleRows.length) : "";
    renderSavedVehicles();
    window.ThreePedalsAccountUI?.toast(
      removing ? "Removed from saved vehicles." : "Saved to your shortlist.",
      "ok"
    );
  }

  function renderSavedVehicles() {
    const target = $("savedVehiclesGrid");
    if (!target) return;
    if (!savedVehicleRows.length) {
      target.innerHTML = savedVehiclesLoadError
        ? `<div class="account-overview-empty" role="alert">${esc(savedVehiclesLoadError)} <button type="button" class="ap-btn ap-btn-ghost" data-retry-saved>Try again</button></div>`
        : '<div class="account-overview-empty">No saved vehicles yet. Browse the marketplace and save cars to keep them here.</div>';
      target.querySelector("[data-retry-saved]")?.addEventListener("click", async (event) => {
        const control = event.currentTarget;
        control.disabled = true;
        control.textContent = "Loading…";
        savedVehiclesLoadedFor = null;
        await loadSavedVehicles();
        renderSavedVehicles();
      });
      return;
    }
    target.innerHTML = savedVehicleRows
      .map((row) => {
        const v = row.listing;
        if (!v) return "";
        const title = [v.year, v.make, v.model].filter(Boolean).join(" ");
        const photo = Array.isArray(v.photos) ? v.photos[0] : "";
        return (
          '<article class="account-saved-vehicle"><a href="vehicle.html?id=' +
          encodeURIComponent(v.id) +
          '" class="account-saved-vehicle-image">' +
          (photo
            ? '<img src="' + esc(photo) + '" alt="' + esc(title) + '" loading="lazy" decoding="async">'
            : "<span>3 PEDALS</span>") +
          '</a><div class="account-saved-vehicle-info"><strong>' +
          esc(title) +
          "</strong><b>KES " +
          fmt(v.price) +
          "</b><small>" +
          fmt(v.km || 0) +
          " km · " +
          esc(v.fuel || "Fuel not specified") +
          '</small><div><a href="vehicle.html?id=' +
          encodeURIComponent(v.id) +
          '">View vehicle</a><button type="button" data-save-vehicle="' +
          esc(v.id) +
          '" aria-pressed="true">Remove saved</button></div></div></article>'
        );
      })
      .join("");
    target
      .querySelectorAll("[data-save-vehicle]")
      .forEach((button) => (button.onclick = () => toggleSavedVehicle(button.dataset.saveVehicle, button)));
  }

  function fetchAccountData(userId, sellerPrefsRequest = null) {
    const client = sb();
    const listingsRequest = Promise.resolve().then(() =>
      client.from("listings").select("*").eq("owner", userId).order("created_at", { ascending: false })
    );
    const analyticsRequest = listingsRequest.then(({ data, error }) =>
      error || !data?.length
        ? { data: [], error: null }
        : client
            .from("seller_listing_analytics")
            .select("listing_id,event_type,created_at")
            .in(
              "listing_id",
              data.map((item) => item.id)
            )
    );
    return Promise.all([
      listingsRequest,
      client.from("bookings").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      client
        .from("seller_sales")
        .select("listing_id,reported_sale_price,currency,created_at")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false }),
      client
        .from("listing_promotions")
        .select("id,listing_id,package_name,amount,status,payment_status,starts_at,expires_at,created_at")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false }),
      client
        .from("promotion_packages")
        .select("id,name,description,amount,duration_days")
        .eq("active", true)
        .order("amount", { ascending: true }),
      sellerPrefsRequest ||
        client.from("seller_settings").select("*").eq("seller_id", userId).maybeSingle(),
    ]).then((results) => [...results, analyticsRequest]);
  }

  function prefetchAccountData(userId, sellerPrefsRequest = null) {
    if (!sb() || !userId) return;
    accountDataPrefetchUserId = userId;
    accountDataPrefetch = fetchAccountData(userId, sellerPrefsRequest).catch((error) => {
      console.warn("Account data prefetch failed; it will be loaded when opened.", error);
      return null;
    });
  }

  function normalizeAccountType(value) {
    return String(value || "").trim().toLowerCase() === "yard" ? "yard" : "private";
  }

  function accountType() {
    const me = getMe();
    const profile = getProfile();
    const metadataType = me?.user_metadata?.account_type;
    if (metadataType === "yard" || metadataType === "private") return metadataType;
    return normalizeAccountType(profile?.account_type);
  }

  async function syncAccountType() {
    const client = sb();
    const me = getMe();
    const profile = getProfile();
    if (!me || !client) return;
    const metadataType = me.user_metadata?.account_type;
    if (metadataType !== "yard" && metadataType !== "private") return;
    if (profile?.account_type === metadataType) return;
    const { data, error } = await client
      .from("profiles")
      .update({ account_type: metadataType })
      .eq("id", me.id)
      .select("*")
      .maybeSingle();
    if (error) {
      console.warn(
        "Account type profile sync failed; the selected type remains in account metadata.",
        error
      );
    }
    if (data) setProfile(data);
    else if (profile) setProfile({ ...profile, account_type: metadataType });
  }

  function initialsFor(name, email) {
    const x = String(name || email || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return ((x[0] || "?")[0] + (x[1] || "")[0]).toUpperCase();
  }

  function profileAvatarUrl() {
    const me = getMe();
    const profile = getProfile();
    return (profile && profile.avatar_url) || me?.user_metadata?.avatar_url || "";
  }

  function profileName() {
    const me = getMe();
    const profile = getProfile();
    return (
      (profile && profile.name) ||
      me?.user_metadata?.name ||
      me?.user_metadata?.full_name ||
      ""
    );
  }

  function profilePhone() {
    const me = getMe();
    const profile = getProfile();
    return (profile && profile.phone) || me?.user_metadata?.phone || "";
  }

  async function changeProfilePhoto(file) {
    const client = sb();
    const me = getMe();
    const profile = getProfile();
    const err = $("accProfileErr");
    if (!file || !client || !me) return false;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      if (err) err.textContent = "Choose an image under 10 MB.";
      return false;
    }
    if (err) err.textContent = "Saving profile picture…";
    try {
      const x = await shrink(file);
      const blob = await (await fetch(x)).blob();
      const path = `${me.id}/profile-${Date.now()}.jpg`;
      const up = await client.storage
        .from("car-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const url = client.storage.from("car-photos").getPublicUrl(path).data.publicUrl;
      const au = await client.auth.updateUser({
        data: { ...(me.user_metadata || {}), avatar_url: url },
      });
      if (au.error) throw au.error;
      const pu = await client.from("profiles").update({ avatar_url: url }).eq("id", me.id);
      if (pu.error) {
        console.warn("Avatar saved to account metadata; profiles.avatar_url may not exist yet.", pu.error);
      }
      await client.from("listings").update({ yard_logo_url: url }).eq("owner", me.id);
      setMe(au.data.user || me);
      setProfile({ ...(profile || {}), avatar_url: url });
      return true;
    } catch (e) {
      if (err) err.textContent = e.message || "Could not upload that profile picture.";
      return false;
    }
  }

  async function saveAccountProfile() {
    const client = sb();
    let me = getMe();
    let profile = getProfile();
    if (!client || !me) return;
    const name = $("accName").value.trim();
    const phone = $("accPhone").value.trim();
    const type = normalizeAccountType($("accType").value);
    const err = $("accProfileErr");
    const btn = $("accSaveProfile");
    const dealerFields = $("accDealerName")
      ? {
          yard_name: $("accDealerName").value.trim(),
          seller_name: $("accDealerName").value.trim(),
          contact: $("accDealerContact").value.trim(),
          yard_location: $("accDealerLocation").value.trim(),
          seller_phone: $("accDealerPhone").value.trim(),
          seller_email: $("accDealerEmail").value.trim(),
          whatsapp: $("accDealerWhatsApp").value.trim(),
          yard_web: $("accDealerWeb").value.trim(),
          seller_type: "yard",
          yard_logo_url: profileAvatarUrl() || null,
        }
      : null;
    if (
      dealerFields &&
      (!dealerFields.yard_name || !dealerFields.yard_location || !dealerFields.seller_phone)
    ) {
      err.style.color = "var(--ap-bad)";
      err.textContent = "Please complete the dealer name, location and phone number.";
      return;
    }
    if (!name) {
      err.style.color = "var(--ap-bad)";
      err.textContent = "Please enter your name.";
      return;
    }
    btn.disabled = true;
    err.style.color = "var(--ap-mute)";
    err.textContent = "Saving profile changes…";
    try {
      const meta = { ...(me.user_metadata || {}), name, phone, account_type: type };
      const au = await client.auth.updateUser({ data: meta });
      if (au.error) throw au.error;
      const pu = await client
        .from("profiles")
        .update({ name, phone, account_type: type })
        .eq("id", me.id);
      if (pu.error) {
        console.warn("Profile table update failed; account metadata was saved.", pu.error);
      }
      const listingUpdates = dealerFields || {
        seller_type: type,
        ...(type === "yard" ? { yard_logo_url: profileAvatarUrl() || null } : {}),
      };
      const lu = await client.from("listings").update(listingUpdates).eq("owner", me.id);
      if (lu.error && dealerFields) {
        throw new Error(
          "Your profile was saved, but dealer information could not be updated on your listings: " +
            lu.error.message
        );
      }
      if (lu.error) {
        console.warn("Listing seller type update failed; account type was saved.", lu.error);
      }
      if (dealerFields) {
        const dealerMeta = {
          ...(me.user_metadata || {}),
          dealer_name: dealerFields.yard_name,
          dealer_contact: dealerFields.contact,
          dealer_location: dealerFields.yard_location,
          dealer_phone: dealerFields.seller_phone,
          dealer_email: dealerFields.seller_email,
          dealer_whatsapp: dealerFields.whatsapp,
          dealer_website: dealerFields.yard_web,
        };
        const dealerAuth = await client.auth.updateUser({ data: dealerMeta });
        if (dealerAuth.error) throw dealerAuth.error;
        me = dealerAuth.data.user || me;
        setMe(me);
      } else {
        me = au.data.user || me;
        setMe(me);
      }
      profile = { ...(profile || {}), name, phone, account_type: type };
      setProfile(profile);
      if (pendingRemoveProfilePhoto) {
        const cleared = await client.auth.updateUser({
          data: { ...(me.user_metadata || {}), avatar_url: null },
        });
        if (cleared.error) throw cleared.error;
        const pc = await client.from("profiles").update({ avatar_url: null }).eq("id", me.id);
        if (pc.error) console.warn("Could not clear profiles avatar.", pc.error);
        await client.from("listings").update({ yard_logo_url: null }).eq("owner", me.id);
        me = cleared.data.user || me;
        setMe(me);
        profile = { ...(profile || {}), avatar_url: null };
        setProfile(profile);
        pendingRemoveProfilePhoto = false;
      } else if (pendingProfilePhoto) {
        const saved = await changeProfilePhoto(pendingProfilePhoto);
        if (!saved) {
          throw new Error(
            "Your details were saved, but the picture could not be saved. Please try again."
          );
        }
        pendingProfilePhoto = null;
      }
      host().refreshAccountUI?.();
      err.style.color = "var(--ap-ok)";
      err.textContent = "Changes saved. You are still in Account Settings.";
      const avatarBox = document.querySelector("#accDlg .profile-avatar");
      if (avatarBox) {
        const url = profileAvatarUrl();
        avatarBox.innerHTML = url
          ? '<img src="' + esc(url) + '" alt="Profile picture">'
          : esc(initialsFor(profileName(), getMe().email));
      }
      if ($("accRemovePhoto") && !profileAvatarUrl()) $("accRemovePhoto").remove();
    } catch (e) {
      err.style.color = "var(--ap-bad)";
      err.textContent = e.message || "Could not save your details.";
    }
    btn.disabled = false;
  }

  async function removeProfilePhoto() {
    if (!profileAvatarUrl()) return;
    pendingRemoveProfilePhoto = true;
    pendingProfilePhoto = null;
    const err = $("accProfileErr");
    if (err) {
      err.style.color = "var(--ap-mute)";
      err.textContent =
        "Picture removal selected. Click “Save profile changes” to confirm.";
    }
    const avatarBox = document.querySelector("#accDlg .profile-avatar");
    if (avatarBox) avatarBox.innerHTML = esc(initialsFor(profileName(), getMe()?.email));
  }

  async function updateAccountEmail() {
    const client = sb();
    const me = getMe();
    const email = $("accEmail").value.trim().toLowerCase();
    const err = $("accProfileErr");
    const btn = $("accUpdateEmail");
    if (!email || email === String(me?.email || "").toLowerCase()) {
      err.textContent = "Enter a different email address.";
      return;
    }
    btn.disabled = true;
    err.textContent = "Updating email…";
    try {
      const { data, error } = await client.auth.updateUser({ email });
      if (error) throw error;
      setMe(data.user || me);
      err.textContent = "Email update requested. Check your inbox to confirm the new address.";
      host().refreshAccountUI?.();
    } catch (e) {
      err.textContent = e.message || "Could not update your email.";
    } finally {
      btn.disabled = false;
    }
  }

  async function updateAccountPassword() {
    const client = sb();
    const password = $("accPassword").value;
    const err = $("accProfileErr");
    const btn = $("accUpdatePassword");
    if (password.length < 8) {
      err.textContent = "Use a password of at least 8 characters.";
      return;
    }
    btn.disabled = true;
    err.textContent = "Updating password…";
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      $("accPassword").value = "";
      err.textContent = "Password updated.";
    } catch (e) {
      err.textContent = e.message || "Could not update your password.";
    } finally {
      btn.disabled = false;
    }
  }

  async function permanentlyDeleteAccount() {
    const client = sb();
    const ui = window.ThreePedalsAccountUI;
    const typed = await ui?.prompt({
      eyebrow: "DANGER ZONE",
      title: "Permanently delete account",
      message:
        "This will permanently remove your account, vehicle listings, saved vehicles, and bookings.",
      label: "Type DELETE to confirm permanent removal",
      placeholder: "DELETE",
      matchExact: "DELETE",
      required: true,
      confirmText: "Delete permanently",
      danger: true,
    });
    if (typed !== "DELETE") return;
    const btn = $("accDeleteAccount");
    const err = $("accProfileErr");
    btn.disabled = true;
    if (err) err.textContent = "Deleting account…";
    try {
      const { error } = await client.rpc("delete_my_account");
      if (error) throw error;
      await client.auth.signOut();
      setMe(null);
      setProfile(null);
      try {
        sessionStorage.removeItem("3pedals:account-open");
        sessionStorage.removeItem("3pedals:account-page");
        sessionStorage.removeItem("3pedals:account-view-cache");
      } catch (_) {}
      host().refreshAccountUI?.();
      $("accDlg").close();
      ui?.toast("Your account has been permanently deleted.", "ok");
    } catch (e) {
      if (err) {
        err.textContent =
          e.message ||
          "Could not delete the account. Confirm the account deletion SQL has been installed.";
      }
      ui?.toast(e.message || "Could not delete the account.", "err");
      btn.disabled = false;
    }
  }

  let workspaceSearchItems = [];
  let workspaceChauffeurLoader = null;

  async function signOutFromAccount() {
    const client = sb();
    const d = $("accDlg");
    try {
      await client?.auth.signOut();
    } catch (e) {
      console.warn("Sign out error:", e);
    }
    try {
      sessionStorage.removeItem("3pedals:account-open");
      sessionStorage.removeItem("3pedals:account-page");
      sessionStorage.removeItem("3pedals:account-view-cache");
    } catch (_) {}
    d?.close();
  }

  function renderGlobalSearchResults(query) {
    const input = $("accGlobalSearch");
    const resultsBox = $("accGlobalResults");
    if (!input || !resultsBox) return;
    const q = String(query || "").trim().toLowerCase();
    if (!q) {
      resultsBox.hidden = true;
      resultsBox.innerHTML = "";
      return;
    }
    const hits = workspaceSearchItems.filter((item) => item.search.includes(q)).slice(0, 10);
    if (!hits.length) {
      resultsBox.innerHTML =
        '<div class="meta" style="padding:10px 12px">No matching items in your account.</div>';
      resultsBox.hidden = false;
      return;
    }
    resultsBox.innerHTML = hits
      .map(
        (hit, idx) =>
          `<button type="button" class="account-global-hit" data-global-hit="${idx}"><div><strong>${esc(hit.title)}</strong><span>${esc(hit.subtitle)}</span></div><em>${esc(hit.kind)}</em></button>`
      )
      .join("");
    resultsBox.hidden = false;
    resultsBox.querySelectorAll("[data-global-hit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const hit = hits[Number(btn.dataset.globalHit)];
        resultsBox.hidden = true;
        input.value = "";
        hit?.onSelect?.();
      });
    });
  }

  const accountMenuDesktopQuery = window.matchMedia("(min-width: 961px)");
  function syncAccountMenuState(open) {
    const nav = $("accountMenu");
    const toggle = $("accMenuToggle");
    const backdrop = $("accountMenuBackdrop");
    if (!nav) return;
    const mobileOpen = Boolean(open) && !accountMenuDesktopQuery.matches;
    nav.classList.toggle("menu-open", mobileOpen);
    backdrop?.classList.toggle("is-open", mobileOpen);
    toggle?.setAttribute("aria-expanded", String(mobileOpen));
    toggle?.setAttribute(
      "aria-label",
      mobileOpen ? "Close account navigation" : "Open account navigation"
    );
  }

  function closeAccountMenu() {
    syncAccountMenuState(false);
  }

  window.toggleAccountMenu = function (event) {
    event?.preventDefault();
    event?.stopPropagation();
    const nav = $("accountMenu");
    if (!nav || accountMenuDesktopQuery.matches) return;
    syncAccountMenuState(!nav.classList.contains("menu-open"));
  };

  function showSellerAccountPage(selected, button, options = {}) {
    const pages = $("accBody")?.querySelector(".account-pages");
    if (!pages) return;
    const target = pages.querySelector(`#accountPage-${selected}`);
    if (!target) return;
    pages.querySelectorAll(".account-page").forEach((page) => {
      page.hidden = page !== target;
    });
    if (selected === "buying") {
      loadSavedVehicles().then(renderSavedVehicles);
    } else if (selected === "chauffeur") {
      workspaceChauffeurLoader?.({ quiet: false });
    }
    if (
      options.updateHistory !== false &&
      $("accDlg").open &&
      history.state?.accountPage !== selected
    ) {
      history.pushState(
        { ...history.state, accountOpen: true, accountPage: selected },
        "",
        location.href
      );
    }
    try {
      if ($("accDlg").open) {
        sessionStorage.setItem("3pedals:account-open", "1");
        sessionStorage.setItem("3pedals:account-page", selected);
        const snapshot = $("accBody").cloneNode(true);
        snapshot
          .querySelectorAll(
            'input[type="password"],input[type="email"],input[type="tel"],input[type="file"],#prefBankDetails,textarea,#sellerEditListingDialog'
          )
          .forEach((field) => {
            if (field.id === "sellerEditListingDialog") {
              field.remove();
              return;
            }
            field.value = "";
            field.removeAttribute("value");
            field.textContent = "";
            field.removeAttribute("checked");
            if ("checked" in field) field.checked = false;
          });
        snapshot
          .querySelectorAll("#accProfileErr,.account-refresh-status,[role='alert']")
          .forEach((node) => node.remove());
        sessionStorage.setItem("3pedals:account-view-cache", snapshot.innerHTML);
      }
    } catch (_) {}
    const currentTabKey =
      button?.dataset?.accountTab ||
      $("accBody")?.querySelector("[data-settings-tab].active")?.dataset?.settingsTab ||
      "business";
    const active =
      button ||
      (selected === "settings"
        ? $("accountMenu")?.querySelector(
            `[data-page="settings"][data-account-tab="${currentTabKey === "account" ? "account" : "business"}"]`
          ) || $("accountMenu")?.querySelector('[data-page="settings"]')
        : $("accountMenu")?.querySelector(`[data-page="${selected}"]`));
    $("accountMenu")
      ?.querySelectorAll("[data-page]")
      .forEach((item) => {
        const isActive = item === active;
        item.classList.toggle("active", isActive);
        if (isActive) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
      });
    const sectionTitles = {
      overview: "Overview",
      buying: "Buying workspace",
      dashboard: "Insights",
      listings: "My listings",
      promotions: "Promotions",
      bookings: "Garage bookings",
      chauffeur: "Chauffeur bookings",
      activity: "Activity centre",
      settings: "Profile & settings",
    };
    const headerSection = $("accActiveSectionTitle");
    if (headerSection) {
      headerSection.textContent =
        button?.dataset?.accountTab === "business"
          ? "Profile"
          : button?.dataset?.accountTab === "account"
            ? "Settings"
            : sectionTitles[selected] || "Workspace";
    }
    closeAccountMenu();
    $("accBody")?.scrollTo({
      top: 0,
      behavior: options.scroll === false ? "auto" : "smooth",
    });
  }

  function bindDialogChromeListeners() {
    const accountMenuToggle = $("accMenuToggle");
    if (accountMenuToggle && !accountMenuToggle.dataset.menuClickBound) {
      accountMenuToggle.dataset.menuClickBound = "1";
      accountMenuToggle.addEventListener("click", window.toggleAccountMenu);
    }
    $("accountMenuBackdrop")?.addEventListener("click", () => closeAccountMenu());
    accountMenuDesktopQuery.addEventListener("change", (ev) => {
      if (ev.matches) closeAccountMenu();
    });

    const menuEl = $("accountMenu");
    if (menuEl && !menuEl.dataset.workspaceMenuBound) {
      menuEl.dataset.workspaceMenuBound = "1";
      menuEl.addEventListener("click", (event) => {
        if (event.target.closest("#accThemeToggle")) {
          window.ThreePedalsAccountUI?.toggleTheme();
          return;
        }
        if (event.target.closest("#accHomeSide")) {
          $("accDlg")?.close();
          return;
        }
        if (event.target.closest("[data-signout]")) {
          signOutFromAccount();
          return;
        }
        if (event.target.closest("[data-buying]")) {
          host().openCurrentInventory?.(true);
          return;
        }
        if (event.target.closest("[data-seller-signup]")) {
          const me = getMe();
          const profile = getProfile();
          $("accDlg")?.close();
          closeAccountMenu();
          setSellerSlugEdited(false);
          if ($("authName")) {
            $("authName").value =
              profile?.name || me?.user_metadata?.name || me?.user_metadata?.full_name || "";
          }
          if ($("authSellerSlug")) $("authSellerSlug").value = "";
          host().openAuth?.("register", "", { seller: true });
          return;
        }
        const button = event.target.closest("[data-page]");
        if (!button) return;
        showSellerAccountPage(button.dataset.page, button);
        if (button.dataset.accountTab) {
          requestAnimationFrame(() => {
            const tab = $("accBody")?.querySelector(
              `[data-settings-tab="${button.dataset.accountTab}"]`
            );
            tab?.click();
          });
        }
      });
    }

    const accountDialog = $("accDlg");
    if (accountDialog && !accountDialog.dataset.workspaceDlgBound) {
      accountDialog.dataset.workspaceDlgBound = "1";
      $("accHomeTop")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        accountDialog.close();
      });
      $("accCloseTop")?.addEventListener("click", () => accountDialog.close());
      $("accRefreshTop")?.addEventListener("click", async () => {
        const btn = $("accRefreshTop");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Refreshing…";
        }
        try {
          await openAccount({ refresh: true });
          window.ThreePedalsAccountUI?.toast("Account workspace refreshed.", "ok");
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Refresh";
          }
        }
      });

      const globalSearchInput = $("accGlobalSearch");
      const globalResults = $("accGlobalResults");
      globalSearchInput?.addEventListener("input", (event) => {
        renderGlobalSearchResults(event.target.value);
      });
      globalSearchInput?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          if (globalResults) globalResults.hidden = true;
          globalSearchInput.value = "";
          globalSearchInput.blur();
        }
      });
      document.addEventListener("keydown", (event) => {
        if (
          accountDialog.open &&
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          globalSearchInput?.focus();
          globalSearchInput?.select();
        }
      });

      accountDialog.addEventListener("close", () => {
        closeAccountMenu();
        if (globalResults) globalResults.hidden = true;
        if (globalSearchInput) globalSearchInput.value = "";
        if (promotionHistoryRefreshTimer) {
          clearInterval(promotionHistoryRefreshTimer);
          promotionHistoryRefreshTimer = null;
        }
        if (chauffeurAccountRefreshTimer) {
          clearInterval(chauffeurAccountRefreshTimer);
          chauffeurAccountRefreshTimer = null;
        }
        const client = sb();
        if (chauffeurAccountChannel && client) {
          client.removeChannel(chauffeurAccountChannel);
          chauffeurAccountChannel = null;
        }
        try {
          sessionStorage.removeItem("3pedals:account-open");
          sessionStorage.removeItem("3pedals:account-page");
          sessionStorage.removeItem("3pedals:account-view-cache");
          sessionStorage.setItem("3pedals:site-section", "home");
        } catch (_) {}
        document.documentElement.classList.remove("account-restoring");
        if (typeof host().show === "function") {
          host().show("home", { updateUrl: false, scroll: false });
        } else {
          document.querySelectorAll("main.wrap>section").forEach((section) => {
            section.hidden = section.id !== "home";
          });
          document.querySelectorAll("#nav button[data-tab]").forEach((button) => {
            button.setAttribute("aria-selected", String(button.dataset.tab === "home"));
          });
          window.scrollTo({ top: 0, behavior: "auto" });
        }
        try {
          history.replaceState({ siteSection: "home" }, "", location.pathname + location.search);
        } catch (_) {}
      });
      accountDialog.addEventListener("cancel", (event) => {
        if (globalResults && !globalResults.hidden) {
          event.preventDefault();
          globalResults.hidden = true;
          if (globalSearchInput) globalSearchInput.value = "";
          return;
        }
        const nav = $("accountMenu");
        if (nav?.classList.contains("menu-open")) {
          event.preventDefault();
          closeAccountMenu();
          return;
        }
        event.preventDefault();
        if (history.state?.accountOpen) history.back();
        else accountDialog.close();
      });
      accountDialog.addEventListener("click", (event) => {
        if (
          globalResults &&
          !globalResults.hidden &&
          !event.target.closest(".account-global-search")
        ) {
          globalResults.hidden = true;
        }
        const nav = $("accountMenu");
        const toggle = $("accMenuToggle");
        if (
          nav?.classList.contains("menu-open") &&
          !nav.contains(event.target) &&
          !toggle?.contains(event.target)
        ) {
          closeAccountMenu();
        }
      });
      window.addEventListener("popstate", (event) => {
        const state = event.state || {};
        const dialog = $("accDlg");
        if (!dialog) return;
        if (state.accountOpen) {
          if (!dialog.open) dialog.showModal();
          if (state.accountPage) {
            showSellerAccountPage(state.accountPage, null, {
              updateHistory: false,
              scroll: false,
            });
          }
        } else if (dialog.open) {
          dialog.close();
        }
      });
    }
  }

  async function openAccount(options = {}) {
    const client = sb();
    const me = getMe();
    const profile = getProfile();
    const renderVersion = ++accountRenderVersion;
    const d = $("accDlg");
    const box = $("accBody");
    if (!d || !box || !me || !client) return;

    window.ThreePedalsAccountUI?.syncThemeButton?.();

    const preservedSettingsTab =
      options.settingsTab ||
      (d.open ? box.querySelector("[data-settings-tab].active")?.dataset?.settingsTab : null);

    let requestedAccountPage =
      options.page ||
      (d.open && history.state?.accountOpen ? history.state.accountPage : null);
    if (!requestedAccountPage && options.restore) {
      try {
        requestedAccountPage = sessionStorage.getItem("3pedals:account-page");
      } catch (_) {}
    }
    if (!requestedAccountPage) requestedAccountPage = "overview";

    if (!d.open) {
      d.showModal();
      history.pushState(
        { ...history.state, accountOpen: true, accountPage: requestedAccountPage },
        "",
        location.href
      );
    }

    try {
      sessionStorage.setItem("3pedals:account-open", "1");
      sessionStorage.setItem("3pedals:account-page", requestedAccountPage);
    } catch (_) {}

    let hasCachedAccount = !!box.querySelector(".account-pages");
    if (!hasCachedAccount && options.restore) {
      try {
        const snapshot = sessionStorage.getItem("3pedals:account-view-cache");
        if (snapshot && snapshot.includes('class="account-pages"')) {
          box.innerHTML = snapshot;
          hasCachedAccount = !!box.querySelector(".account-pages");
          if (hasCachedAccount) {
            showSellerAccountPage(requestedAccountPage, null, {
              updateHistory: false,
              scroll: false,
            });
          }
        }
      } catch (error) {
        console.warn("Account view cache could not be restored:", error);
      }
    }

    if (!hasCachedAccount) {
      box.innerHTML = `<div class="account-fast-loading" role="status" aria-live="polite">
        <div class="account-fast-loading-head"><span class="account-fast-avatar"></span><span class="account-fast-lines"><i></i><i></i></span></div>
        <div class="account-fast-loading-grid"><span></span><span></span><span></span><span></span></div>
        <div class="account-fast-loading-card"><i></i><i></i><i></i></div>
        <p class="meta">Opening your workspace…</p>
      </div>`;
    }

    if (hasCachedAccount && !options.refresh) {
      openAccount({ refresh: true }).catch((error) =>
        console.warn("Background account refresh failed:", error)
      );
      return;
    }

    let accountResults = null;
    if (accountDataPrefetch && accountDataPrefetchUserId === me.id) {
      const pending = accountDataPrefetch;
      accountDataPrefetch = null;
      accountDataPrefetchUserId = null;
      accountResults = await pending;
    }
    if (!accountResults) accountResults = await fetchAccountData(me.id);

    if (renderVersion !== accountRenderVersion || !d.open) return;

    const [l, b, sales, promos, packages, prefs, analyticsPromise] = accountResults;
    if (l.error) {
      box.innerHTML = `<div class="ap-card"><p class="meta" role="alert">We couldn't load your listings: ${esc(l.error.message)}. Please check the marketplace security SQL has been installed.</p><button class="ap-btn ap-btn-ghost" id="accCloseLoadError" type="button">Close</button></div>`;
      $("accCloseLoadError").onclick = () => d.close();
      return;
    }

    const syncLabel = $("accLastSync");
    if (syncLabel) {
      syncLabel.textContent = `Synced ${new Date().toLocaleTimeString("en-KE", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    const L = l.data || [];
    const B = b.data || [];
    const S = sales.data || [];
    const PK = packages.data || [];
    const sellerSettings = prefs.data || {};
    const yardProfile =
      L.find(
        (x) =>
          String(x.seller_type || "").toLowerCase() === "yard" ||
          String(x.yard_name || "").trim()
      ) || {};
    const historyClearedAt = sellerSettings.promotion_history_cleared_at
      ? new Date(sellerSettings.promotion_history_cleared_at).getTime()
      : 0;
    const PM = (promos.data || []).filter(
      (p) => !historyClearedAt || new Date(p.created_at || p.starts_at || 0).getTime() > historyClearedAt
    );
    const reminderDays = Number(sellerSettings.repost_reminder_days) || 14;
    const reminderCutoff = Date.now() - reminderDays * 86400000;
    const reminders = L.filter(
      (x) =>
        x.status === "approved" &&
        new Date(x.reposted_at || x.updated_at || x.created_at || 0).getTime() <= reminderCutoff
    );
    const label = {
      pending: "Waiting for approval",
      approved: "Live",
      rejected: "Not approved",
      sold: "Sold",
    };
    const avatar = profileAvatarUrl();
    const name = profileName();
    const phone = profilePhone();
    const isYard = accountType() === "yard" || !!Object.keys(yardProfile).length;
    const reportedSales = S.reduce((sum, x) => sum + Number(x.reported_sale_price || 0), 0);
    const averageReportedSale = S.length ? Math.round(reportedSales / S.length) : 0;
    const formatStatus = (value) =>
      String(value || "pending")
        .replaceAll("_", " ")
        .replace(/^\w/, (letter) => letter.toUpperCase());

    const renderPromotionHistory = (rows) =>
      window.ThreePedalsAccountPromotions
        ? window.ThreePedalsAccountPromotions.renderPromotionHistory(rows, L, {
            esc,
            fmt,
            formatStatus,
          })
        : '<p class="meta">No promotion history to show.</p>';

    const listingStatusCounts = L.reduce(
      (counts, item) => ((counts[item.status || "pending"] = (counts[item.status || "pending"] || 0) + 1), counts),
      {}
    );
    const activePromotionCount = PM.filter(
      (p) => String(p.status || "").toLowerCase() === "active"
    ).length;

    const activityCode = { vehicle: "VH", promotion: "PR", booking: "GB", sale: "SL" };
    const allActivityItems = [
      ...L.filter((x) => x.created_at).map((x) => ({
        time: x.created_at,
        title: "Vehicle listing submitted",
        detail: [x.year, x.make, x.model].filter(Boolean).join(" "),
        kind: "vehicle",
      })),
      ...PM.filter((p) => p.created_at || p.starts_at).map((p) => ({
        time: p.created_at || p.starts_at,
        title: "Promotion activity",
        detail: [p.package_name || "Vehicle promotion", formatStatus(p.payment_status || p.status)]
          .filter(Boolean)
          .join(" · "),
        kind: "promotion",
      })),
      ...B.filter((x) => x.created_at).map((x) => ({
        time: x.created_at,
        title: "Garage booking received",
        detail: [x.car, x.service_type || x.service].filter(Boolean).join(" · ") || "A new booking was recorded",
        kind: "booking",
      })),
      ...S.filter((x) => x.created_at).map((x) => ({
        time: x.created_at,
        title: "Sale reported",
        detail: "KES " + fmt(x.reported_sale_price || 0),
        kind: "sale",
      })),
    ]
      .filter((item) => Number.isFinite(new Date(item.time).getTime()))
      .sort((a, b) => new Date(b.time) - new Date(a.time));

    const firstName = name ? name.split(/\s+/)[0] : "there";
    const livePct = L.length ? Math.round(((listingStatusCounts.approved || 0) / L.length) * 100) : 0;
    const otherStatusCount = Math.max(
      0,
      L.length - (listingStatusCounts.approved || 0) - (listingStatusCounts.pending || 0)
    );

    const overviewActivityHtml = allActivityItems.length
      ? allActivityItems
          .slice(0, 6)
          .map(
            (item) =>
              `<div class="ap-activity-row"><span class="ap-activity-icon ${esc(item.kind)}">${esc(activityCode[item.kind] || "AC")}</span><div><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></div><time datetime="${esc(item.time)}">${esc(new Date(item.time).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }))}</time></div>`
          )
          .join("")
      : '<div class="ap-empty">Your recent account activity will appear here.</div>';

    const fullActivityHtml = allActivityItems.length
      ? allActivityItems
          .map(
            (item) =>
              `<div class="ap-activity-row"><span class="ap-activity-icon ${esc(item.kind)}">${esc(activityCode[item.kind] || "AC")}</span><div><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></div><time datetime="${esc(item.time)}">${esc(new Date(item.time).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</time></div>`
          )
          .join("")
      : '<div class="ap-empty">Your recent account activity will appear here as you use the marketplace.</div>';

    const dealerOverviewHtml = isYard
      ? `<article class="ap-card">
          <div class="ap-card-head">
            <div><span class="ap-eyebrow">Business Profile</span><h2>Your dealership</h2></div>
            <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="settings" data-account-tab="business">Edit details</button>
          </div>
          <div class="ap-dealer-content">
            ${
              avatar
                ? `<img src="${esc(avatar)}" alt="Dealership logo">`
                : `<span class="ap-dealer-monogram">${esc(initialsFor(yardProfile.yard_name || yardProfile.seller_name || me.user_metadata?.dealer_name || name, me.email))}</span>`
            }
            <div class="ap-dealer-name">
              <strong>${esc(yardProfile.yard_name || yardProfile.seller_name || me.user_metadata?.dealer_name || name || "Dealer profile")}</strong>
              <span>${esc(yardProfile.yard_location || yardProfile.location || me.user_metadata?.dealer_location || "Add your business location in Profile")}</span>
            </div>
            <div><small>Phone</small><strong>${esc(yardProfile.seller_phone || yardProfile.phone || me.user_metadata?.dealer_phone || phone || "Not added")}</strong></div>
            <div><small>Email</small><strong>${esc(yardProfile.seller_email || yardProfile.email || me.user_metadata?.dealer_email || me.email || "Not added")}</strong></div>
            <div><small>Website</small><strong>${esc(yardProfile.yard_web || yardProfile.web || me.user_metadata?.dealer_website || "Not added")}</strong></div>
          </div>
        </article>`
      : "";

    const overviewHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Account Workspace</span>
          <h1>Welcome back, ${esc(firstName)}.</h1>
          <p class="meta">Live snapshot of your vehicles, promotions, garage tickets, and saved inventory.</p>
        </div>
        <div class="ap-actions">
          <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="listings">Manage listings</button>
          <button type="button" class="ap-btn ap-btn-primary" data-overview-buying>Explore inventory</button>
        </div>
      </div>

      <div class="ap-stats" aria-label="Account summary">
        <button type="button" class="ap-stat" data-overview-page="listings"><b>${L.length}</b><span>My listings</span></button>
        <button type="button" class="ap-stat" data-overview-page="promotions"><b>${activePromotionCount}</b><span>Active promotions</span></button>
        <button type="button" class="ap-stat" data-overview-page="buying"><b>${savedVehicleRows.length}</b><span>Saved vehicles</span></button>
        <button type="button" class="ap-stat" data-overview-page="bookings"><b>${B.length}</b><span>Garage bookings</span></button>
      </div>

      <div class="ap-overview-grid">
        <article class="ap-card">
          <div class="ap-card-head">
            <div><span class="ap-eyebrow">Inventory Health</span><h2>Your vehicle activity</h2></div>
            <span class="ap-card-mark">${L.length}</span>
          </div>
          <div class="ap-progress-track"><i style="--workspace-progress:${livePct}%"></i></div>
          <div class="ap-metric-row-3">
            <div><strong>${listingStatusCounts.approved || 0}</strong><span>Live listings</span></div>
            <div><strong>${listingStatusCounts.pending || 0}</strong><span>Awaiting review</span></div>
            <div><strong>${otherStatusCount}</strong><span>Other statuses</span></div>
          </div>
          <p class="meta ap-footnote">${livePct}% of your vehicles are currently live on 3 Pedals Auto KE.</p>
        </article>

        <article class="ap-card">
          <div class="ap-card-head">
            <div><span class="ap-eyebrow">Quick Access</span><h2>Workspace shortcuts</h2></div>
          </div>
          <div class="ap-task-list">
            <div class="ap-task-row">
              <div class="ap-task-count">${L.length}</div>
              <div class="ap-task-copy"><strong>My listings</strong><span>Manage vehicles, photos and prices</span></div>
              <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="listings">Open</button>
            </div>
            <div class="ap-task-row">
              <div class="ap-task-count">${reminders.length || activePromotionCount}</div>
              <div class="ap-task-copy"><strong>Promotions</strong><span>${reminders.length ? `${reminders.length} due for repost reminder` : "Manage featured visibility"}</span></div>
              <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="promotions">Open</button>
            </div>
            <div class="ap-task-row">
              <div class="ap-task-count">${B.length}</div>
              <div class="ap-task-copy"><strong>Garage bookings</strong><span>Review inspection and workshop tickets</span></div>
              <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="bookings">Open</button>
            </div>
            <div class="ap-task-row">
              <div class="ap-task-count">${savedVehicleRows.length}</div>
              <div class="ap-task-copy"><strong>Saved vehicles</strong><span>Return to your buying shortlist</span></div>
              <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="buying">Open</button>
            </div>
          </div>
        </article>
      </div>

      ${dealerOverviewHtml}

      <article class="ap-card">
        <div class="ap-card-head">
          <div><span class="ap-eyebrow">Latest Updates</span><h2>Recent account activity</h2></div>
          <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="activity">Full activity</button>
        </div>
        <div class="ap-activity-list">${overviewActivityHtml}</div>
      </article>
    `;

    const buyingHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Marketplace Shortlist</span>
          <h1>Buying workspace</h1>
          <p class="meta">Keep track of vehicles you are considering across 3 Pedals Auto KE.</p>
        </div>
        <div class="ap-actions">
          <a class="ap-btn ap-btn-primary" href="#buy" data-browse-buying>Browse vehicles</a>
        </div>
      </div>
      <div id="savedVehiclesGrid" class="account-saved-vehicles-grid"><p class="meta">Loading your saved vehicles…</p></div>
    `;

    const insightsHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Seller Analytics</span>
          <h1 id="sellerSummary">Insights</h1>
          <p class="meta">${isYard ? "Your yard’s vehicles, buyer enquiries, and reported sales." : "Your vehicle listings, buyer enquiries, and reported sales."}</p>
        </div>
        <div class="ap-actions">
          <button type="button" class="ap-btn ap-btn-ghost" data-overview-page="listings">Manage listings</button>
        </div>
      </div>
      ${
        reminders.length
          ? `<div class="ap-notice warn" role="status"><strong>${reminders.length} live listing${reminders.length === 1 ? " is" : "s are"} due for a repost reminder.</strong><button class="ap-btn ap-btn-ghost" type="button" data-open-marketing>Review reminders</button></div>`
          : ""
      }
      <div class="ap-stats">
        <div class="ap-stat"><b>${L.length}</b><span>All listings</span></div>
        <div class="ap-stat"><b>${listingStatusCounts.approved || 0}</b><span>Live on site</span></div>
        <div class="ap-stat"><b>${listingStatusCounts.pending || 0}</b><span>Pending review</span></div>
        <div class="ap-stat"><b>${listingStatusCounts.sold || 0}</b><span>Sold vehicles</span></div>
      </div>
      <div class="ap-overview-grid">
        <article class="ap-card">
          <div class="ap-card-head">
            <div><span class="ap-eyebrow">Recorded Business</span><h2>Reported sales summary</h2></div>
            <span class="ap-card-mark">KES</span>
          </div>
          <div class="ap-metric-row-3">
            <div><strong>${S.length}</strong><span>Recorded sales</span></div>
            <div><strong>KES ${fmt(reportedSales)}</strong><span>Total reported value</span></div>
            <div><strong>KES ${fmt(averageReportedSale)}</strong><span>Average sale price</span></div>
          </div>
          <p class="meta ap-footnote">Sale amounts are reported by you and are not verified platform earnings or payouts.${listingStatusCounts.rejected ? ` Not approved listings: ${listingStatusCounts.rejected}.` : ""}</p>
        </article>
        <article class="ap-card">
          <div class="ap-card-head">
            <div><span class="ap-eyebrow">Buyer Engagement</span><h2>Listing performance</h2></div>
          </div>
          <div id="sellerAnalyticsStats" hidden></div>
          <p class="meta" id="sellerAnalyticsStatus" role="status">Loading listing performance…</p>
        </article>
      </div>
    `;

    const listingsHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Inventory Management</span>
          <h1 id="sellerListings">My listings</h1>
          <p class="meta">Search, filter, update photos, record completed sales, or boost live vehicles.</p>
        </div>
      </div>
      <div class="ap-tools-bar">
        <input id="sellerListingSearch" type="search" placeholder="Search make, model or year…" aria-label="Search your vehicles">
        <select id="sellerListingStatus" aria-label="Filter by status">
          <option value="">All listings</option>
          <option value="approved">Live</option>
          <option value="pending">Waiting for approval</option>
          <option value="rejected">Not approved</option>
          <option value="sold">Sold</option>
        </select>
        <span class="tools-count" id="sellerListingCount" aria-live="polite"></span>
      </div>
      ${
        L.map((x) => {
          const promotion = PM.filter((p) => String(p.listing_id) === String(x.id)).sort(
            (a, b) => new Date(b.created_at || b.starts_at || 0) - new Date(a.created_at || a.starts_at || 0)
          )[0];
          const promotionActive = promotion && String(promotion.status || "").toLowerCase() === "active";
          const promotionExpiry = promotion?.ends_at || promotion?.expires_at;
          const fullTitle = [x.year, x.make, x.model].filter(Boolean).join(" ");
          const statusKey = esc(x.status || "pending");
          return `<article data-seller-listing data-listing-id="${esc(x.id)}" data-listing-status="${statusKey}" data-listing-search="${esc(fullTitle.toLowerCase())}" class="seller-listing ap-listing-card">
            <div class="ap-listing-thumb">
              ${
                Array.isArray(x.photos) && x.photos[0]
                  ? `<img src="${esc(x.photos[0])}" alt="${esc(fullTitle)}" loading="lazy" decoding="async">`
                  : `<span class="ap-listing-placeholder">3 PEDALS</span>`
              }
            </div>
            <div class="seller-garage-content">
              <div class="ap-listing-head">
                <div>
                  <span class="ap-eyebrow">${esc(x.stock_mode === "local" ? "Kenya Stock" : x.stock_mode === "import" ? "Import" : "Vehicle Listing")}</span>
                  <h3>${esc(fullTitle)}</h3>
                </div>
                <div class="ap-listing-head-right">
                  <strong class="ap-listing-price">KES ${fmt(x.price)}</strong>
                  <span class="ap-status ${statusKey}">${esc(label[x.status] || formatStatus(x.status))}</span>
                </div>
              </div>
              <div class="ap-meta-line">
                <span>${Array.isArray(x.photos) ? x.photos.length : 0} photos</span>
                <span class="sep">·</span>
                <span>${esc(x.km ? `${fmt(x.km)} km` : "Mileage not set")}</span>
                <span class="sep">·</span>
                <span>${esc(x.fuel || "Fuel not set")}</span>
              </div>
              <div class="ap-listing-promo-note">
                ${
                  promotion
                    ? `<strong>${esc(promotion.package_name || "Promotion")}</strong> · ${promotionActive ? "Active promotion" : esc(formatStatus(promotion.status))}${promotionExpiry ? ` · Ends ${esc(new Date(promotionExpiry).toLocaleDateString())}` : ""}`
                    : "No active promotion"
                }
              </div>
              <div class="seller-listing-actions">
                ${
                  x.status === "approved"
                    ? `<button class="ap-btn ap-btn-ghost" type="button" data-sold="${esc(x.id)}" data-title="${esc(fullTitle)}">Mark sold</button><button class="ap-btn ap-btn-ghost" type="button" data-promote-listing="${esc(x.id)}">Promote</button>`
                    : ""
                }
                ${
                  x.status === "sold"
                    ? `<span class="meta">Reported sale: KES ${fmt(S.find((s) => String(s.listing_id) === String(x.id))?.reported_sale_price || 0)}</span>`
                    : `<button class="ap-btn ap-btn-ghost" type="button" data-edit="${esc(x.id)}">Edit listing</button>`
                }
                ${["approved", "sold"].includes(x.status) ? `<button class="ap-btn ap-btn-ghost" type="button" data-view="${esc(x.id)}">View</button>` : ""}
                <button class="ap-btn ap-btn-ghost" type="button" data-del="${esc(x.id)}">Delete</button>
              </div>
            </div>
          </article>`;
        }).join("") || '<div class="ap-empty">You have no listings yet.</div>'
      }
    `;

    const promotionsHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Visibility &amp; Boosts</span>
          <h1 id="sellerPromotions">Promotions</h1>
          <p class="meta">Refresh stale live vehicles or run M-Pesa featured campaigns.</p>
        </div>
      </div>

      <article class="ap-card">
        <div class="ap-card-head">
          <div><span class="ap-eyebrow">Follow-ups</span><h2>Listing reminders</h2><p class="meta">Live listings with no repost activity for ${reminderDays} days or more.</p></div>
          <span class="ap-status ${reminders.length ? "pending" : "approved"}">${reminders.length} due</span>
        </div>
        <div class="ap-task-list">
          ${
            reminders.length
              ? reminders
                  .map(
                    (x) => `<div class="ap-task-row">
                      <div class="ap-task-count">DUE</div>
                      <div class="ap-task-copy"><strong>${esc(x.year + " " + x.make + " " + x.model)}</strong><span>Last updated ${esc(new Date(x.reposted_at || x.updated_at || x.created_at || 0).toLocaleDateString())}</span></div>
                      <button class="ap-btn ap-btn-ghost" type="button" data-reposted="${esc(x.id)}">Mark reposted today</button>
                    </div>`
                  )
                  .join("")
              : '<div class="ap-empty">No listings are due for a repost reminder.</div>'
          }
        </div>
        <p class="meta" id="reminderMessage" aria-live="polite"></p>
      </article>

      <article class="ap-card">
        <div class="ap-card-head">
          <div><span class="ap-eyebrow">M-Pesa STK Push</span><h2>Paid promotions</h2><p class="meta">Choose an active listing and package. Payments stay pending until verified.</p></div>
        </div>
        ${
          PK.length
            ? `<div class="promotion-package-grid">${PK.map(
                (p) =>
                  `<div class="promotion-package"><strong>${esc(p.name)}</strong><span>${esc(p.description || `${p.duration_days} days featured`)}</span><b>KES ${fmt(p.amount)}</b><small class="meta">${Number(p.duration_days)} days</small></div>`
              ).join("")}</div>
              <div class="ap-promo-form-grid">
                <div>
                  <label for="promoListing">Vehicle to promote</label>
                  <select id="promoListing"><option value="">Choose a live vehicle</option>${L.filter((x) => x.status === "approved").map((x) => `<option value="${esc(x.id)}">${esc(x.year + " " + x.make + " " + x.model)}</option>`).join("")}</select>
                </div>
                <div>
                  <label for="promoPackage">Promotion package</label>
                  <select id="promoPackage"><option value="">Choose a package</option>${PK.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · KES ${fmt(p.amount)} / ${Number(p.duration_days)} days</option>`).join("")}</select>
                </div>
                <div>
                  <label for="promoPhone">M-Pesa phone number</label>
                  <input id="promoPhone" type="tel" autocomplete="tel" value="${esc(phone)}" placeholder="07XX XXX XXX">
                </div>
              </div>
              <button class="ap-btn ap-btn-primary" type="button" id="startPromotion">Pay with M-Pesa</button>
              <p class="meta" id="promotionMessage" aria-live="polite"></p>`
            : '<div class="ap-empty">Promotion packages are not configured yet. Please check back later.</div>'
        }
      </article>

      <article class="ap-card">
        <div class="ap-card-head">
          <div><span class="ap-eyebrow">Records</span><h2>Promotion history</h2></div>
          <button class="ap-btn ap-btn-ghost" type="button" id="clearPromotionHistory">Clear history</button>
        </div>
        <div id="promotionHistoryList">${renderPromotionHistory(PM)}</div>
        <p class="meta" id="promotionHistoryMessage" aria-live="polite"></p>
      </article>
    `;

    const bookingsHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Workshop Services</span>
          <h1>Garage bookings</h1>
          <p class="meta">Track your garage service tickets, scheduled inspection slots, and workshop progress.</p>
        </div>
        <div class="ap-actions" id="garageBookingAction">
          <a class="ap-btn ap-btn-primary" href="/garage?section=book">Book a garage service</a>
          <button class="ap-btn ap-btn-ghost" type="button" id="clearMyCompletedBookings">Clear completed</button>
        </div>
      </div>
      <div id="myGarageBookings">${
        B.map((x) => {
          const completed =
            String(x.status || "").toLowerCase() === "done" ||
            String(x.service_status || "").toLowerCase() === "completed";
          const tone = completed
            ? "completed"
            : ["cancelled", "declined"].includes(String(x.status || "").toLowerCase())
              ? "cancelled"
              : "pending";
          return `<div class="svc account-booking-row" data-my-booking="${esc(x.id)}"><div><b>${esc(x.service || x.service_type || "Garage service")}</b><span class="meta">Ticket ${esc(x.ref || x.id)} · ${esc(x.date || "")}${x.time_slot ? " · " + esc(x.time_slot) : ""}${x.car ? " · " + esc(x.car) : ""}</span><span class="meta">Progress: ${esc(String(x.service_status || x.status || "pending").replaceAll("_", " "))}</span></div><span class="ap-status ${tone}">${esc(completed ? "Completed" : formatStatus(x.status || "Pending"))}</span></div>`;
        }).join("") || '<div class="ap-empty">No garage bookings yet.</div>'
      }</div>
    `;

    const chauffeurHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Executive Chauffeur</span>
          <h1>Chauffeur bookings</h1>
          <p class="meta">Track your booking requests, confirmed quotations, payment status, and assigned driver.</p>
        </div>
        <div class="ap-actions">
          <a class="ap-btn ap-btn-primary" href="/chauffeur.html#booking">Request a chauffeur</a>
        </div>
      </div>
      <div id="myChauffeurBookings" aria-live="polite"><p class="meta">Loading your chauffeur bookings…</p></div>
    `;

    const activityHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Account History</span>
          <h1>Activity centre</h1>
          <p class="meta">Chronological record of your marketplace listings, promotions, garage tickets, and sales.</p>
        </div>
        <span class="ap-status info">${allActivityItems.length} events</span>
      </div>
      <article class="ap-card">
        <div class="ap-activity-list">${fullActivityHtml}</div>
      </article>
    `;

    const settingsHtml = `
      <div class="ap-panel-title">
        <div>
          <span class="ap-eyebrow">Account Configuration</span>
          <h1>Profile &amp; settings</h1>
          <p class="meta">Manage your business identity, new listing defaults, paperwork rules, and login security.</p>
        </div>
      </div>
      <div class="account-settings-inner">
        <div class="account-settings-tabs" role="tablist" aria-label="Settings sections">
          <button type="button" class="active" data-settings-tab="business">Your business</button>
          <button type="button" data-settings-tab="vehicles">New vehicles</button>
          <button type="button" data-settings-tab="paperwork">Paperwork</button>
          <button type="button" data-settings-tab="reminders">Reminders</button>
          <button type="button" data-settings-tab="account">Account</button>
        </div>

        <section class="settings-section" data-settings-section="business">
          <article class="ap-card">
            <div class="ap-card-head">
              <div><span class="ap-eyebrow">Identity</span><h2>Your business profile</h2><p class="meta">Your name, contact details, and seller profile image.</p></div>
            </div>
            <div class="profile-card">
              <div class="profile-avatar">${avatar ? `<img src="${esc(avatar)}" alt="Profile picture">` : esc(initialsFor(name, me.email))}</div>
              <div>
                <h3 style="margin:0 0 4px">Your profile</h3>
                <p class="meta" style="margin:0">${esc(me.email)}</p>
                <div class="profile-actions">
                  <label class="ap-btn ap-btn-ghost" style="cursor:pointer;margin:0">Upload / change ${isYard ? "dealer logo" : "picture"}<input id="accPhoto" type="file" accept="image/*" hidden></label>
                  ${avatar ? '<button class="ap-btn ap-btn-ghost" type="button" id="accRemovePhoto">Remove picture</button>' : ""}
                </div>
                ${isYard ? '<p class="meta" style="margin:8px 0 0">This image appears beside your dealer name and on your yard profile.</p>' : ""}
              </div>
            </div>

            ${
              profile && profile.is_admin
                ? `<div class="account-admin-tools"><div><h3 style="margin:0 0 4px">Administration</h3><p class="meta" style="margin:0">Manage vehicle approvals, garage bookings, website contact details, and published content.</p></div><button class="ap-btn ap-btn-ghost account-admin-button" type="button" id="accAdmin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.9 7.8-7 10-4.1-2.2-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg><span>Open Admin Dashboard</span></button></div>`
                : ""
            }

            <div class="profile-grid">
              <div><label for="accName">Full name</label><input id="accName" value="${esc(name)}" autocomplete="name"></div>
              <div><label for="accPhone">Phone number</label><input id="accPhone" value="${esc(phone)}" type="tel" autocomplete="tel"></div>
              <div><label for="accType">Account type</label><select id="accType"><option value="private" ${accountType() === "private" ? "selected" : ""}>Private seller</option><option value="yard" ${isYard ? "selected" : ""}>Car yard / dealer</option></select></div>
            </div>

            ${
              isYard
                ? `<div class="dealer-account-editor">
                    <div class="dealer-editor-heading">
                      <div><span class="ap-eyebrow">Public Business Details</span><h3>Dealer information</h3><p class="meta" style="margin:4px 0 0">Keep your yard identity and buyer contact details clear and up to date.</p></div>
                      <span class="ap-status approved">Business profile</span>
                    </div>
                    <div class="dealer-editor-section">
                      <h4>Business identity</h4>
                      <div class="dealer-fields-grid">
                        <div class="dealer-field-wide"><label for="accDealerName">Dealer / business name</label><input id="accDealerName" value="${esc(yardProfile.yard_name || yardProfile.seller_name || me.user_metadata?.dealer_name || name)}"></div>
                        <div><label for="accDealerContact">Contact person</label><input id="accDealerContact" value="${esc(yardProfile.contact || me.user_metadata?.dealer_contact || "")}"></div>
                        <div><label for="accDealerLocation">Location / address</label><input id="accDealerLocation" value="${esc(yardProfile.yard_location || yardProfile.location || me.user_metadata?.dealer_location || "")}"></div>
                      </div>
                    </div>
                    <div class="dealer-editor-section">
                      <h4>Contact details</h4>
                      <div class="dealer-fields-grid">
                        <div><label for="accDealerPhone">Dealer phone</label><input id="accDealerPhone" type="tel" value="${esc(yardProfile.seller_phone || yardProfile.phone || me.user_metadata?.dealer_phone || phone)}"></div>
                        <div><label for="accDealerEmail">Dealer email</label><input id="accDealerEmail" type="email" value="${esc(yardProfile.seller_email || yardProfile.email || me.user_metadata?.dealer_email || me.email || "")}"></div>
                        <div><label for="accDealerWhatsApp">WhatsApp number</label><input id="accDealerWhatsApp" type="tel" value="${esc(yardProfile.whatsapp || me.user_metadata?.dealer_whatsapp || yardProfile.seller_phone || phone)}"></div>
                      </div>
                    </div>
                    <div class="dealer-editor-section">
                      <h4>Online presence</h4>
                      <div class="dealer-fields-grid">
                        <div class="dealer-field-wide"><label for="accDealerWeb">Website / social link</label><input id="accDealerWeb" type="url" value="${esc(yardProfile.yard_web || yardProfile.web || me.user_metadata?.dealer_website || "")}" placeholder="https://example.com"></div>
                      </div>
                    </div>
                    <div class="dealer-save-row">
                      <button class="ap-btn ap-btn-primary" type="button" data-save-dealer-info>Save dealer information</button>
                      <span class="meta">Your saved details appear on your dealer profile and vehicle listings.</span>
                    </div>
                  </div>`
                : ""
            }

            <p id="accProfileErr" class="meta" style="color:var(--ap-bad);margin-top:12px"></p>
            <div class="ap-actions" style="margin-top:12px">
              <button class="ap-btn ap-btn-primary" type="button" id="accSaveProfile">Save profile changes</button>
            </div>
          </article>
        </section>

        <section class="settings-section" data-settings-section="vehicles" hidden>
          <article class="ap-card">
            <div class="ap-card-head"><div><span class="ap-eyebrow">Defaults</span><h2>New vehicle defaults</h2><p class="meta">Choose the starting stock type used in the Sell a car listing form.</p></div></div>
            <label for="prefStockMode">Preferred stock mode</label>
            <select id="prefStockMode"><option value="any">No preference</option><option value="local">Kenya stock</option><option value="import">Import</option></select>
            <p class="meta" style="margin-top:8px">New listings start with this selection. You can change it for each vehicle.</p>
            <div class="ap-actions" style="margin-top:14px"><button class="ap-btn ap-btn-primary" type="button" data-save-preferences="vehicles">Save</button></div>
            <p class="meta" data-preference-status="vehicles" aria-live="polite"></p>
          </article>
        </section>

        <section class="settings-section" data-settings-section="paperwork" hidden>
          <article class="ap-card">
            <div class="ap-card-head"><div><span class="ap-eyebrow">Documentation</span><h2>Paperwork rules</h2><p class="meta">Apply your saved preferences when preparing vehicle documents.</p></div></div>
            <label for="prefBankDetails">Bank details for documents</label>
            <textarea id="prefBankDetails" rows="4" placeholder="Bank, account name and payment details"></textarea>
            <label class="check-row"><input id="prefPrintLogo" type="checkbox"> Print your logo on documents</label>
            <label class="check-row"><input id="prefRequireEngine" type="checkbox"> Require engine number in checklist</label>
            <label class="check-row"><input id="prefRequireRegistration" type="checkbox"> Require registration number in checklist</label>
            <label class="check-row"><input id="prefRequireLogbook" type="checkbox"> Require logbook check</label>
            <label class="check-row"><input id="prefRequireSupplierDocs" type="checkbox"> Require supplier ID/PIN check for consignment stock</label>
            <p class="meta">These settings prefill and mark required checks in printable vehicle documents.</p>
            <div class="ap-actions" style="margin-top:14px"><button class="ap-btn ap-btn-primary" type="button" data-save-preferences="paperwork">Save</button></div>
            <p class="meta" data-preference-status="paperwork" aria-live="polite"></p>
          </article>
        </section>

        <section class="settings-section" data-settings-section="reminders" hidden>
          <article class="ap-card">
            <div class="ap-card-head"><div><span class="ap-eyebrow">Notifications</span><h2>Listing reminders</h2><p class="meta">See overdue listings in Promotions and reset the reminder date after reposting.</p></div></div>
            <label for="prefReminderDays">Repost reminder interval (days)</label>
            <input id="prefReminderDays" type="number" min="1" max="365" value="14">
            <p class="meta" style="margin-top:8px">Reminders appear when a live listing has not been updated within this interval.</p>
            <div class="ap-actions" style="margin-top:14px"><button class="ap-btn ap-btn-primary" type="button" data-save-preferences="reminders">Save</button></div>
            <p class="meta" data-preference-status="reminders" aria-live="polite"></p>
          </article>
        </section>

        <section class="settings-section" data-settings-section="account" hidden>
          <article class="ap-card">
            <div class="ap-card-head"><div><span class="ap-eyebrow">Security</span><h2>Login details</h2><p class="meta">Manage the email and password used to sign in.</p></div></div>
            <div class="field-row"><div><label for="accEmail">Email address</label><input id="accEmail" type="email" value="${esc(me.email || "")}" autocomplete="email"></div><button class="ap-btn ap-btn-ghost" id="accUpdateEmail" type="button">Change email</button></div>
            <div class="field-row"><div><label for="accPassword">New password</label><input id="accPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></div><button class="ap-btn ap-btn-ghost" id="accUpdatePassword" type="button">Change password</button></div>
            <p class="meta" style="margin-bottom:16px">Email changes require confirmation from your inbox.</p>
            <div class="account-subscription-note" style="margin-bottom:12px">
              <h4>Subscriptions</h4>
              <p class="meta" style="margin:0">Recurring subscriptions and automatic renewals are not currently offered on this site. Vehicle promotions and chauffeur payments are one-time M-Pesa transactions; their price and service period are shown before payment.</p>
            </div>
            <div class="account-legal-preferences" style="margin-bottom:16px">
              <h4>Privacy and legal</h4>
              <p class="meta">Read how 3 Pedals Auto KE uses and protects your information.</p>
              <p><a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms of Service</a></p>
              <button class="ap-btn ap-btn-ghost" type="button" id="accCookiePreferences">Change cookie preferences</button>
              <p class="meta" style="margin:8px 0 0">Optional analytics and advertising tags load only if you accept them. Essential account, security and payment services remain active.</p>
            </div>
            <div class="danger-zone">
              <h3>Delete account</h3>
              <p class="meta">Permanently remove your account, listings, and bookings. This cannot be undone.</p>
              <button class="ap-btn ap-btn-danger" id="accDeleteAccount" type="button">Permanently delete account</button>
            </div>
          </article>
        </section>
      </div>
    `;

    const makePage = (id, html, extraClass = "") => {
      const page = document.createElement("section");
      page.className = extraClass ? `account-page ${extraClass}` : "account-page";
      page.id = `accountPage-${id}`;
      page.hidden = true;
      page.innerHTML = html;
      return page;
    };

    const overviewPage = makePage("overview", overviewHtml, "account-overview");
    overviewPage.hidden = false;
    const buyingPage = makePage("buying", buyingHtml);
    const dashboardPage = makePage("dashboard", insightsHtml);
    const listingsPage = makePage("listings", listingsHtml);
    const promotionsPage = makePage("promotions", promotionsHtml, "account-promotions-page");
    const bookingsPage = makePage("bookings", bookingsHtml, "account-bookings-page");
    const chauffeurPage = makePage(
      "chauffeur",
      chauffeurHtml,
      "account-bookings-page account-chauffeur-bookings-page"
    );
    const activityPage = makePage("activity", activityHtml);
    const settingsPage = makePage("settings", settingsHtml);

    const pages = document.createElement("div");
    pages.className = "account-pages";
    pages.append(
      overviewPage,
      buyingPage,
      dashboardPage,
      listingsPage,
      promotionsPage,
      bookingsPage,
      chauffeurPage,
      activityPage,
      settingsPage
    );

    box.innerHTML = "";
    box.appendChild(pages);

    const menu = $("accountMenu");
    const accountOwnerId = me.id;
    const currentThemeMode =
      document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    menu.innerHTML = `
      <a class="account-sidebar-brand" href="/" aria-label="3 Pedals Auto KE home">
        <img src="favicon.svg" alt="" width="28" height="28">
        <span><strong>3 PEDALS</strong><small>Account Workspace</small></span>
      </a>
      <div class="seller-nav-identity">
        <small>${isYard ? "Signed in dealer" : "Signed in member"}</small>
        <strong>${esc(name || me.email || "Member")}</strong>
        <span>${esc(me.email || "")}</span>
      </div>
      <div class="seller-mode-switch" aria-label="Marketplace mode">
        <button type="button" data-buying>Buying</button>
        <button type="button" class="selected" aria-current="page">Selling</button>
      </div>
      <div class="seller-nav-label">Workspace</div>
      <button type="button" class="account-nav-btn active" data-page="overview" aria-current="page"><span>Overview</span></button>
      <button type="button" class="account-nav-btn" data-page="buying"><span>Buying workspace</span><span class="account-nav-count" id="accNavSavedCount">${savedVehicleRows.length || ""}</span></button>
      <button type="button" class="account-nav-btn" data-page="dashboard"><span>Insights</span></button>
      <div class="seller-nav-label">Selling &amp; Services</div>
      <button type="button" class="account-nav-btn" data-page="listings"><span>My listings</span><span class="account-nav-count">${L.length || ""}</span></button>
      <button type="button" class="account-nav-btn" data-page="promotions"><span>Promotions</span><span class="account-nav-count">${reminders.length || activePromotionCount || ""}</span></button>
      <button type="button" class="account-nav-btn" data-page="bookings"><span>Garage bookings</span><span class="account-nav-count">${B.length || ""}</span></button>
      <button type="button" class="account-nav-btn" data-page="chauffeur"><span>Chauffeur bookings</span><span class="account-nav-count" id="accNavChauffeurCount"></span></button>
      <button type="button" class="account-nav-btn" data-page="activity"><span>Activity centre</span><span class="account-nav-count">${allActivityItems.length || ""}</span></button>
      <div class="seller-nav-label">Account</div>
      <button type="button" class="account-nav-btn" data-page="settings" data-account-tab="business"><span>Profile</span></button>
      <button type="button" class="account-nav-btn" data-page="settings" data-account-tab="account"><span>Settings</span></button>
      <button type="button" class="account-nav-btn" data-seller-signup><span>Seller store URL</span></button>
      <div class="account-sidebar-footer">
        <button type="button" class="ap-btn ap-btn-ghost" id="accThemeToggle">${currentThemeMode === "light" ? "Dark theme" : "Light theme"}</button>
        <button type="button" class="ap-btn ap-btn-ghost" id="accHomeSide">Back to site</button>
        <button type="button" class="ap-btn ap-btn-ghost" data-signout>Sign out</button>
      </div>
    `;
    menu.hidden = false;
    closeAccountMenu();
    d.classList.remove("nav-collapsed");

    const promoBindings = window.ThreePedalsAccountPromotions?.bind({
      sb: client,
      me,
      dialog: d,
      box,
      menu,
      listings: L,
      accountOwnerId,
      openAccount,
      $,
      esc,
      fmt,
      formatStatus,
    });

    if (promotionHistoryRefreshTimer) {
      clearInterval(promotionHistoryRefreshTimer);
      promotionHistoryRefreshTimer = null;
    }
    if (promoBindings?.refreshPromotionHistory) {
      promotionHistoryRefreshTimer = setInterval(() => {
        if (!d.open || !getMe() || getMe().id !== accountOwnerId) {
          clearInterval(promotionHistoryRefreshTimer);
          promotionHistoryRefreshTimer = null;
          return;
        }
        if (document.visibilityState !== "visible") return;
        promoBindings
          .refreshPromotionHistory()
          .catch((error) => console.warn("Promotion history refresh failed:", error));
      }, 30000);
    }

    const settingsInner = settingsPage.querySelector(".account-settings-inner");
    const settingsTabs = settingsPage.querySelector(".account-settings-tabs");
    settingsPage.querySelector("#accCookiePreferences")?.addEventListener("click", () => {
      window.ThreePedalsConsent?.open();
    });
    settingsTabs?.querySelectorAll("[data-settings-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.dataset.settingsTab;
        settingsTabs
          .querySelectorAll("button")
          .forEach((item) => item.classList.toggle("active", item === tab));
        settingsInner
          ?.querySelectorAll("[data-settings-section]")
          .forEach((section) => {
            section.hidden = section.dataset.settingsSection !== key;
          });
      });
    });

    if ($("prefStockMode")) $("prefStockMode").value = sellerSettings.preferred_stock_mode || "any";
    if ($("prefBankDetails")) $("prefBankDetails").value = sellerSettings.bank_details || "";
    if ($("prefPrintLogo")) $("prefPrintLogo").checked = sellerSettings.print_logo_on_documents !== false;
    if ($("prefRequireEngine")) $("prefRequireEngine").checked = !!sellerSettings.require_engine_number;
    if ($("prefRequireRegistration")) {
      $("prefRequireRegistration").checked = sellerSettings.require_registration_number !== false;
    }
    if ($("prefRequireLogbook")) $("prefRequireLogbook").checked = sellerSettings.require_logbook !== false;
    if ($("prefRequireSupplierDocs")) {
      $("prefRequireSupplierDocs").checked = !!sellerSettings.require_supplier_documents;
    }
    if ($("prefReminderDays")) {
      $("prefReminderDays").value = Number(sellerSettings.repost_reminder_days) || 14;
    }

    settingsInner?.querySelectorAll("[data-save-preferences]").forEach((button) => {
      button.onclick = async () => {
        const key = button.dataset.savePreferences;
        const status = settingsInner.querySelector(`[data-preference-status="${key}"]`);
        button.disabled = true;
        if (status) status.textContent = "Saving…";
        const values = {
          seller_id: me.id,
          preferred_stock_mode: $("prefStockMode").value,
          bank_details: $("prefBankDetails").value,
          print_logo_on_documents: $("prefPrintLogo").checked,
          require_engine_number: $("prefRequireEngine").checked,
          require_registration_number: $("prefRequireRegistration").checked,
          require_logbook: $("prefRequireLogbook").checked,
          require_supplier_documents: $("prefRequireSupplierDocs").checked,
          repost_reminder_days: Math.max(
            1,
            Math.min(365, Number($("prefReminderDays").value) || 14)
          ),
          updated_at: new Date().toISOString(),
        };
        try {
          const { error } = await client
            .from("seller_settings")
            .upsert(values, { onConflict: "seller_id" });
          if (error) throw error;
          setSellerPreferences(values);
          if (status) status.textContent = "Saved.";
          window.ThreePedalsAccountUI?.toast("Preferences saved.", "ok");
        } catch (error) {
          if (status) {
            status.textContent = error.message?.includes("seller_settings")
              ? "Settings storage is not installed yet. Run outputs/seller_account_settings.sql in Supabase SQL Editor."
              : `Could not save settings: ${error.message || "Please try again."}`;
          }
        } finally {
          button.disabled = false;
        }
      };
    });

    pages.querySelectorAll("[data-overview-page]").forEach((button) => {
      button.addEventListener("click", () => {
        const page = button.dataset.overviewPage;
        const tab = button.dataset.accountTab;
        const menuBtn = tab
          ? menu.querySelector(`[data-page="${page}"][data-account-tab="${tab}"]`)
          : menu.querySelector(`[data-page="${page}"]`);
        showSellerAccountPage(page, menuBtn);
        if (tab) {
          requestAnimationFrame(() => {
            $("accBody")?.querySelector(`[data-settings-tab="${tab}"]`)?.click();
          });
        }
      });
    });
    pages.querySelector("[data-browse-buying]")?.addEventListener("click", (event) => {
      event.preventDefault();
      host().openCurrentInventory?.(true);
    });
    pages.querySelector("[data-overview-buying]")?.addEventListener("click", () => {
      host().openCurrentInventory?.(true);
    });
    pages.querySelector("[data-open-marketing]")?.addEventListener("click", () => {
      showSellerAccountPage("promotions", menu.querySelector('[data-page="promotions"]'));
    });

    const baseSearchItems = [
      { title: "Overview", subtitle: "Workspace summary & activity", kind: "Section", search: "overview home workspace", onSelect: () => showSellerAccountPage("overview") },
      { title: "Buying workspace", subtitle: "Saved vehicles shortlist", kind: "Section", search: "buying workspace saved vehicles shortlist", onSelect: () => showSellerAccountPage("buying") },
      { title: "Insights", subtitle: "Seller analytics & reported sales", kind: "Section", search: "insights analytics views whatsapp sales", onSelect: () => showSellerAccountPage("dashboard") },
      { title: "My listings", subtitle: `${L.length} vehicles in your account`, kind: "Section", search: "my listings vehicles inventory", onSelect: () => showSellerAccountPage("listings") },
      { title: "Promotions", subtitle: "Repost reminders & M-Pesa boosts", kind: "Section", search: "promotions mpesa boosts reminders", onSelect: () => showSellerAccountPage("promotions") },
      { title: "Garage bookings", subtitle: `${B.length} service tickets`, kind: "Section", search: "garage bookings service tickets", onSelect: () => showSellerAccountPage("bookings") },
      { title: "Chauffeur bookings", subtitle: "Chauffeur quotes & driver dispatch", kind: "Section", search: "chauffeur bookings rides driver", onSelect: () => showSellerAccountPage("chauffeur") },
      { title: "Activity centre", subtitle: "Chronological event log", kind: "Section", search: "activity centre history events", onSelect: () => showSellerAccountPage("activity") },
      { title: "Profile & dealer details", subtitle: "Business details & logo", kind: "Settings", search: "profile business dealer logo contact", onSelect: () => { showSellerAccountPage("settings", menu.querySelector('[data-account-tab="business"]')); settingsPage.querySelector('[data-settings-tab="business"]')?.click(); } },
      { title: "New vehicle defaults", subtitle: "Preferred stock mode", kind: "Settings", search: "new vehicle defaults stock mode", onSelect: () => { showSellerAccountPage("settings", menu.querySelector('[data-account-tab="account"]')); settingsPage.querySelector('[data-settings-tab="vehicles"]')?.click(); } },
      { title: "Paperwork rules", subtitle: "Bank details & checklist settings", kind: "Settings", search: "paperwork documents bank details checklist", onSelect: () => { showSellerAccountPage("settings", menu.querySelector('[data-account-tab="account"]')); settingsPage.querySelector('[data-settings-tab="paperwork"]')?.click(); } },
      { title: "Account & login security", subtitle: "Email, password, privacy & delete account", kind: "Settings", search: "account email password security privacy delete", onSelect: () => { showSellerAccountPage("settings", menu.querySelector('[data-account-tab="account"]')); settingsPage.querySelector('[data-settings-tab="account"]')?.click(); } },
      ...L.map((item) => {
        const title = [item.year, item.make, item.model].filter(Boolean).join(" ");
        return {
          title: title || "Vehicle listing",
          subtitle: `KES ${fmt(item.price)} · ${label[item.status] || formatStatus(item.status)}`,
          kind: "Listing",
          search: `${title} ${item.status || ""} ${item.fuel || ""}`.toLowerCase(),
          onSelect: () => {
            showSellerAccountPage("listings");
            const searchField = $("sellerListingSearch");
            if (searchField) {
              searchField.value = title;
              searchField.dispatchEvent(new Event("input"));
            }
          },
        };
      }),
      ...savedVehicleRows.map((row) => {
        const v = row.listing || {};
        const title = [v.year, v.make, v.model].filter(Boolean).join(" ");
        return {
          title: title || "Saved vehicle",
          subtitle: `KES ${fmt(v.price)} · Shortlist`,
          kind: "Saved",
          search: `saved ${title} ${v.fuel || ""}`.toLowerCase(),
          onSelect: () => showSellerAccountPage("buying"),
        };
      }),
      ...B.map((item) => ({
        title: item.service || item.service_type || "Garage booking",
        subtitle: `${item.car || "Vehicle"} · ${item.date || "Pending date"}`,
        kind: "Garage",
        search: `garage ${item.service || ""} ${item.service_type || ""} ${item.car || ""} ${item.ref || ""}`.toLowerCase(),
        onSelect: () => showSellerAccountPage("bookings"),
      })),
    ];
    workspaceSearchItems = baseSearchItems;

    let chauffeurBookingsLoading = false;
    const loadMyChauffeurBookings = async ({ quiet = false } = {}) => {
      const container = $("myChauffeurBookings");
      if (
        !container ||
        !d.open ||
        !getMe() ||
        getMe().id !== accountOwnerId ||
        chauffeurBookingsLoading
      ) {
        return;
      }
      chauffeurBookingsLoading = true;
      if (!quiet) container.innerHTML = '<p class="meta">Loading your chauffeur bookings…</p>';
      try {
        const [bookingResult, cancelResult] = await Promise.all([
          client
            .from("chauffeur_bookings")
            .select(
              "id,booking_ref,status,payment_status,start_at,end_at,pickup_location,destination,quoted_amount,final_amount,currency,assigned_driver_name,assigned_driver_phone,pricing_method,created_at,chauffeur_vehicles(display_name)"
            )
            .eq("user_id", accountOwnerId)
            .order("created_at", { ascending: false }),
          client
            .from("chauffeur_cancellation_requests")
            .select("id,booking_id,reason,status,admin_note,created_at,reviewed_at")
            .eq("user_id", accountOwnerId)
            .order("created_at", { ascending: false }),
        ]);
        if (!d.open || !getMe() || getMe().id !== accountOwnerId) return;
        if (bookingResult.error) throw bookingResult.error;
        if (cancelResult.error) throw cancelResult.error;
        const data = bookingResult.data || [];
        const cancellations = cancelResult.data || [];

        const navChauffeur = $("accNavChauffeurCount");
        if (navChauffeur) navChauffeur.textContent = data.length ? String(data.length) : "";
        workspaceSearchItems = [
          ...baseSearchItems,
          ...data.map((cItem) => ({
            title: cItem.booking_ref || "Chauffeur booking",
            subtitle: `${cItem.pickup_location || ""} → ${cItem.destination || ""}`,
            kind: "Chauffeur",
            search: `chauffeur ${cItem.booking_ref || ""} ${cItem.pickup_location || ""} ${cItem.destination || ""} ${cItem.chauffeur_vehicles?.display_name || ""}`.toLowerCase(),
            onSelect: () => showSellerAccountPage("chauffeur"),
          })),
        ];

        if (!data.length) {
          container.innerHTML =
            '<div class="ap-empty">You have no chauffeur bookings yet. When you submit a request, its progress will appear here.</div>';
          return;
        }
        const date = (value) =>
          value
            ? new Date(value).toLocaleString("en-KE", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Not set";
        const labelStatus = (value) =>
          String(value || "pending")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());
        const statusTone = (value) => {
          const s = String(value || "").toLowerCase();
          if (["confirmed", "completed", "accepted", "paid", "restored"].includes(s)) return "confirmed";
          if (["declined", "cancelled", "failed", "restoration_declined"].includes(s)) return "declined";
          return "pending";
        };
        container.innerHTML =
          '<div class="account-chauffeur-toolbar"><span class="meta">Updated ' +
          esc(
            new Date().toLocaleTimeString("en-KE", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })
          ) +
          '</span><button type="button" class="ap-btn ap-btn-ghost" id="refreshMyChauffeurBookings">Refresh status</button></div>' +
          data
            .map((item) => {
              const amount = item.final_amount ?? item.quoted_amount;
              const amountText =
                amount !== null && amount !== undefined
                  ? "KES " + Number(amount).toLocaleString("en-KE")
                  : "Awaiting quotation";
              const driver = item.assigned_driver_name
                ? '<span class="meta">Assigned driver: <strong>' +
                  esc(item.assigned_driver_name) +
                  "</strong>" +
                  (item.assigned_driver_phone
                    ? " · " + esc(item.assigned_driver_phone)
                    : "") +
                  "</span>"
                : '<span class="meta">Driver details will appear here once assigned.</span>';
              const request = cancellations.find(
                (x) => String(x.booking_id) === String(item.id)
              );
              const canCancel = [
                "pending_approval",
                "approved_awaiting_payment",
                "confirmed",
              ].includes(String(item.status || "").toLowerCase());
              const cancellationLine = request
                ? '<div class="account-cancellation-state"><span class="meta">Cancellation / restoration status</span><div><span class="ap-status ' +
                  statusTone(request.status) +
                  '">' +
                  esc(labelStatus(request.status)) +
                  "</span></div>" +
                  (request.reason
                    ? '<span class="meta">Your reason: ' + esc(request.reason) + "</span>"
                    : "") +
                  (request.admin_note
                    ? '<span class="meta">Administrator response: ' +
                      esc(request.admin_note) +
                      "</span>"
                    : "") +
                  (request.status === "pending"
                    ? '<span class="meta">Your booking remains active while the cancellation request is reviewed.</span><div class="account-booking-actions"><button type="button" class="ap-btn ap-btn-ghost" data-keep-chauffeur-booking="' +
                      esc(request.id) +
                      '">Keep this booking instead</button></div>'
                    : request.status === "withdrawn"
                      ? '<span class="meta">You chose to keep this booking. No cancellation will be made.</span>'
                      : request.status === "accepted"
                        ? '<span class="meta">Your booking was cancelled. You can request restoration below.</span><div class="account-booking-actions"><button type="button" class="ap-btn ap-btn-ghost" data-request-chauffeur-restore="' +
                          esc(request.id) +
                          '">Request booking restoration</button></div>'
                        : request.status === "restoration_requested"
                          ? '<span class="meta">Your restoration request is awaiting administrator approval. The booking remains cancelled for now.</span>'
                          : request.status === "restoration_declined"
                            ? '<span class="meta">Your restoration request was declined. You may submit another request.</span><div class="account-booking-actions"><button type="button" class="ap-btn ap-btn-ghost" data-request-chauffeur-restore="' +
                              esc(request.id) +
                              '">Request booking restoration again</button></div>'
                            : request.status === "restored"
                              ? '<span class="meta">Your booking has been restored by the administrator. Check the booking and payment status above.</span>'
                              : "") +
                  "</div>"
                : "";
              const cancelAction =
                canCancel &&
                (!request ||
                  ["declined", "withdrawn"].includes(String(request.status).toLowerCase()))
                  ? '<div class="account-booking-actions"><button type="button" class="ap-btn ap-btn-ghost" data-request-chauffeur-cancel="' +
                    esc(item.id) +
                    '">Request cancellation</button></div>'
                  : "";
              return (
                '<article class="svc account-booking-row"><div><b>' +
                esc(item.booking_ref || "Chauffeur booking") +
                '</b><span class="meta">Vehicle: ' +
                esc(item.chauffeur_vehicles?.display_name || "Chauffeur vehicle") +
                '</span><span class="meta">Route: ' +
                esc(item.pickup_location) +
                " → " +
                esc(item.destination) +
                '</span><span class="meta">Pickup: ' +
                esc(date(item.start_at)) +
                " · Expected end: " +
                esc(date(item.end_at)) +
                '</span><span class="meta">Hire type: ' +
                esc(labelStatus(item.pricing_method)) +
                " · Quotation: " +
                esc(amountText) +
                "</span>" +
                driver +
                '<span class="meta">Booking status: ' +
                esc(labelStatus(item.status)) +
                '</span><span class="meta">Payment status: ' +
                esc(labelStatus(item.payment_status)) +
                "</span>" +
                cancellationLine +
                cancelAction +
                '</div><span class="ap-status ' +
                statusTone(item.status) +
                '">' +
                esc(labelStatus(item.status)) +
                "</span></article>"
              );
            })
            .join("");

        $("refreshMyChauffeurBookings")?.addEventListener("click", () =>
          loadMyChauffeurBookings()
        );
        container.querySelectorAll("[data-request-chauffeur-cancel]").forEach((button) => {
          button.addEventListener("click", async () => {
            const bookingId = button.dataset.requestChauffeurCancel;
            const ui = window.ThreePedalsAccountUI;
            const reason = await ui?.prompt({
              eyebrow: "CHAUFFEUR BOOKING",
              title: "Request cancellation",
              message:
                "Tell us why you need to cancel this booking. Your booking remains active until an administrator reviews the request.",
              label: "Cancellation reason",
              placeholder: "e.g. Change in travel schedule",
              multiline: true,
              required: true,
              confirmText: "Submit request",
              cancelText: "Keep booking",
            });
            if (!reason) return;
            button.disabled = true;
            button.textContent = "Submitting…";
            const existing = cancellations.find(
              (x) => String(x.booking_id) === String(bookingId) && x.status === "pending"
            );
            if (existing) {
              button.disabled = false;
              button.textContent = "Request cancellation";
              ui?.toast("A cancellation request is already awaiting review.", "warn");
              return;
            }
            const { error } = await client.from("chauffeur_cancellation_requests").insert({
              booking_id: bookingId,
              user_id: accountOwnerId,
              reason: reason.trim(),
              status: "pending",
              admin_note: "",
            });
            if (error) {
              button.disabled = false;
              button.textContent = "Request cancellation";
              ui?.toast("Could not submit cancellation request: " + error.message, "err");
              return;
            }
            ui?.toast("Cancellation request submitted.", "ok");
            await loadMyChauffeurBookings();
          });
        });
        container.querySelectorAll("[data-request-chauffeur-restore]").forEach((button) => {
          button.addEventListener("click", async () => {
            const ui = window.ThreePedalsAccountUI;
            const confirmed = await ui?.confirm({
              eyebrow: "CHAUFFEUR BOOKING",
              title: "Request booking restoration",
              message:
                "Send a request to restore this cancelled booking? An administrator must approve it before the booking becomes active again.",
              confirmText: "Send request",
            });
            if (!confirmed) return;
            const originalText = button.textContent;
            button.disabled = true;
            button.textContent = "Sending…";
            try {
              const { data, error } = await client
                .from("chauffeur_cancellation_requests")
                .update({
                  status: "restoration_requested",
                  admin_note: "Customer requested restoration of this cancelled booking.",
                })
                .eq("id", button.dataset.requestChauffeurRestore)
                .eq("user_id", accountOwnerId)
                .in("status", ["accepted", "restoration_declined"])
                .select("id,status")
                .maybeSingle();
              if (error) throw error;
              if (!data) {
                throw new Error(
                  "No request was updated. Please refresh your bookings and try again."
                );
              }
              ui?.toast("Restoration request sent.", "ok");
              await loadMyChauffeurBookings();
            } catch (error) {
              console.error("Chauffeur booking restoration request failed", error);
              button.disabled = false;
              button.textContent = originalText;
              ui?.toast(
                "Restoration request failed: " + (error?.message || "Please try again."),
                "err"
              );
            }
          });
        });
        container.querySelectorAll("[data-keep-chauffeur-booking]").forEach((button) => {
          button.addEventListener("click", async () => {
            const ui = window.ThreePedalsAccountUI;
            const confirmed = await ui?.confirm({
              eyebrow: "CHAUFFEUR BOOKING",
              title: "Keep this booking?",
              message:
                "Withdraw your pending cancellation request so this chauffeur booking stays active.",
              confirmText: "Withdraw cancellation",
            });
            if (!confirmed) return;
            button.disabled = true;
            button.textContent = "Updating…";
            const { error } = await client
              .from("chauffeur_cancellation_requests")
              .update({
                status: "withdrawn",
                admin_note: "Customer chose to keep the booking.",
              })
              .eq("id", button.dataset.keepChauffeurBooking)
              .eq("user_id", accountOwnerId)
              .eq("status", "pending");
            if (error) {
              button.disabled = false;
              button.textContent = "Keep this booking instead";
              ui?.toast("Could not withdraw the cancellation request: " + error.message, "err");
              return;
            }
            ui?.toast("Cancellation request withdrawn.", "ok");
            await loadMyChauffeurBookings();
          });
        });
      } catch (error) {
        if (d.open && getMe() && getMe().id === accountOwnerId) {
          if (!quiet) {
            container.innerHTML =
              '<p class="meta" role="alert">We could not load your chauffeur bookings. Please refresh and try again.</p>';
          }
          console.warn("Chauffeur bookings account refresh failed:", error?.message || error);
        }
      } finally {
        chauffeurBookingsLoading = false;
      }
    };

    workspaceChauffeurLoader = loadMyChauffeurBookings;
    if (requestedAccountPage === "chauffeur") loadMyChauffeurBookings();

    if (chauffeurAccountRefreshTimer) clearInterval(chauffeurAccountRefreshTimer);
    if (chauffeurAccountChannel) client.removeChannel(chauffeurAccountChannel);
    chauffeurAccountChannel = client
      .channel("account-chauffeur-" + accountOwnerId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chauffeur_bookings",
          filter: "user_id=eq." + accountOwnerId,
        },
        () => loadMyChauffeurBookings({ quiet: true })
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chauffeur_cancellation_requests",
          filter: "user_id=eq." + accountOwnerId,
        },
        () => loadMyChauffeurBookings({ quiet: true })
      )
      .subscribe();
    chauffeurAccountRefreshTimer = window.setInterval(() => {
      if (
        d.open &&
        getMe() &&
        getMe().id === accountOwnerId &&
        !chauffeurPage.hidden &&
        document.visibilityState === "visible"
      ) {
        loadMyChauffeurBookings({ quiet: true });
      }
    }, 8000);

    $("accPhoto").onchange = (e) => {
      pendingProfilePhoto = e.target.files?.[0] || null;
      pendingRemoveProfilePhoto = false;
      if (pendingProfilePhoto) {
        const err = $("accProfileErr");
        if (err) {
          err.style.color = "var(--ap-mute)";
          err.textContent = "Picture selected. Click “Save profile changes” to upload it.";
        }
      }
    };
    if ($("accRemovePhoto")) $("accRemovePhoto").onclick = removeProfilePhoto;
    $("accSaveProfile").onclick = saveAccountProfile;
    $("accUpdateEmail").onclick = updateAccountEmail;
    $("accUpdatePassword").onclick = updateAccountPassword;
    $("accDeleteAccount").onclick = permanentlyDeleteAccount;
    box.querySelector("[data-save-dealer-info]")?.addEventListener("click", saveAccountProfile);

    const clearMyCompleted = $("clearMyCompletedBookings");
    clearMyCompleted?.addEventListener("click", async () => {
      const ui = window.ThreePedalsAccountUI;
      const completed = (B || []).filter(
        (item) =>
          String(item.status || "").toLowerCase() === "done" ||
          String(item.service_status || "").toLowerCase() === "completed"
      );
      if (!completed.length) {
        ui?.toast("No completed garage bookings to clear.", "info");
        return;
      }
      const confirmed = await ui?.confirm({
        eyebrow: "GARAGE BOOKINGS",
        title: `Clear ${completed.length} completed booking${completed.length === 1 ? "" : "s"}?`,
        message: "This permanently removes completed service records from your My Garage list.",
        confirmText: "Clear completed",
        danger: true,
      });
      if (!confirmed) return;
      clearMyCompleted.disabled = true;
      clearMyCompleted.textContent = "Clearing…";
      const ids = completed.map((item) => item.id);
      const { error } = await client
        .from("bookings")
        .delete()
        .in("id", ids)
        .eq("user_id", me.id);
      if (error) {
        clearMyCompleted.disabled = false;
        clearMyCompleted.textContent = "Clear completed";
        ui?.toast("Could not clear completed bookings: " + error.message, "err");
        return;
      }
      ids.forEach((id) => box.querySelector(`[data-my-booking="${CSS.escape(String(id))}"]`)?.remove());
      clearMyCompleted.textContent = "Cleared";
      ui?.toast("Completed bookings cleared.", "ok");
      if (!$("myGarageBookings")?.children.length) {
        $("myGarageBookings").innerHTML = '<div class="ap-empty">No garage bookings yet.</div>';
      }
    });

    window.ThreePedalsAccountListings?.bind({
      sb: client,
      me,
      dialog: d,
      box,
      listings: L,
      analyticsPromise,
      renderVersion,
      getRenderVersion: () => accountRenderVersion,
      openAccount,
      loadListings: () => host().loadListings?.(),
      normWa,
      shrink,
      $,
      esc,
    });

    if ($("accAdmin")) {
      $("accAdmin").onclick = () => {
        window.location.href = "/admin.html";
      };
    }

    const activeSettingsMenuBtn =
      requestedAccountPage === "settings" && preservedSettingsTab
        ? $("accountMenu").querySelector(`[data-account-tab="${preservedSettingsTab}"]`) ||
          $("accountMenu").querySelector('[data-page="settings"]')
        : null;
    showSellerAccountPage(requestedAccountPage || "overview", activeSettingsMenuBtn, {
      updateHistory: false,
      scroll: false,
    });
    if (requestedAccountPage === "settings" && preservedSettingsTab) {
      const tabBtn = box.querySelector(`[data-settings-tab="${preservedSettingsTab}"]`);
      tabBtn?.click();
    }

    document.documentElement.classList.remove("account-restoring");
    try {
      const snapshot = box.cloneNode(true);
      snapshot
        .querySelectorAll(
          'input[type="password"],input[type="email"],input[type="tel"],input[type="file"],#prefBankDetails,textarea,#sellerEditListingDialog'
        )
        .forEach((field) => {
          if (field.id === "sellerEditListingDialog") {
            field.remove();
            return;
          }
          field.value = "";
          field.removeAttribute("value");
          field.textContent = "";
          field.removeAttribute("checked");
          if ("checked" in field) field.checked = false;
        });
      snapshot
        .querySelectorAll("#accProfileErr,.account-refresh-status,[role='alert']")
        .forEach((node) => node.remove());
      sessionStorage.setItem("3pedals:account-view-cache", snapshot.innerHTML);
    } catch (_) {}
  }

  bindDialogChromeListeners();

  Object.assign(window, {
    isSavedVehicle,
    resetSavedVehiclesState,
    loadSavedVehicles,
    toggleSavedVehicle,
    renderSavedVehicles,
    fetchAccountData,
    prefetchAccountData,
    clearAccountPrefetch,
    normalizeAccountType,
    accountType,
    syncAccountType,
    initialsFor,
    profileAvatarUrl,
    profileName,
    profilePhone,
    openAccount,
    showSellerAccountPage,
    closeAccountMenu,
  });
})();
