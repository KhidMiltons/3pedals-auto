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
    const savedMetric = $("accBody")?.querySelector('[data-overview-page="buying"] strong');
    if (savedMetric) savedMetric.textContent = String(savedVehicleRows.length);
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
        ? `<div class="account-overview-empty" role="alert">${esc(savedVehiclesLoadError)} <button type="button" data-retry-saved>Try again</button></div>`
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
      err.style.color = "var(--err)";
      err.textContent = "Please complete the dealer name, location and phone number.";
      return;
    }
    if (!name) {
      err.style.color = "var(--err)";
      err.textContent = "Please enter your name.";
      return;
    }
    btn.disabled = true;
    err.style.color = "var(--mute)";
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
      err.style.color = "var(--ok)";
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
      err.style.color = "var(--err)";
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
      err.style.color = "var(--mute)";
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

  const accountMenuDesktopQuery = window.matchMedia("(min-width: 761px)");
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
      mobileOpen ? "Close seller navigation" : "Open seller navigation"
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
    const dashboard = pages?.querySelector("#accountPage-dashboard");
    if (!pages) return;
    if (selected === "buying") {
      pages.querySelectorAll(".account-page").forEach((page) => {
        page.hidden = page.id !== "accountPage-buying";
      });
      loadSavedVehicles().then(renderSavedVehicles);
    } else if (["dashboard", "listings"].includes(selected) && dashboard) {
      pages.querySelectorAll(".account-page").forEach((page) => {
        page.hidden = page !== dashboard;
      });
      const sections = dashboard.querySelectorAll(":scope > .account-tools");
      sections.forEach((section, index) => {
        section.hidden = selected !== "dashboard" && selected === "listings" && index !== 1;
      });
    } else {
      const target = pages.querySelector(`#accountPage-${selected}`);
      if (!target) return;
      pages.querySelectorAll(".account-page").forEach((page) => {
        page.hidden = page !== target;
      });
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
    const active = button || $("accountMenu")?.querySelector(`[data-page="${selected}"]`);
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
        if (button.dataset.accountFocus === "sales") {
          requestAnimationFrame(() => {
            const target = $("accBody")?.querySelector("#sellerSummary .stats");
            if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
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
      accountDialog.addEventListener("close", () => {
        closeAccountMenu();
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

    $("accCloseTop").onclick = () => d.close();
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
        <div class="account-fast-loading-grid"><span></span><span></span><span></span></div>
        <div class="account-fast-loading-card"><i></i><i></i><i></i></div>
        <p class="meta">Opening your account…</p>
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
      box.innerHTML = `<p class="meta" role="alert">We couldn't load your listings: ${esc(l.error.message)}. Please check the marketplace security SQL has been installed.</p><button class="btn ghost" id="accCloseLoadError" type="button">Close</button>`;
      $("accCloseLoadError").onclick = () => d.close();
      return;
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
    const averageReportedSale = S.length ? reportedSales / S.length : 0;
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

    box.innerHTML = `<div class="profile-card">
      <div class="profile-avatar">${avatar ? `<img src="${esc(avatar)}" alt="Profile picture">` : esc(initialsFor(name, me.email))}</div>
      <div><h3 style="margin:0 0 4px">Your profile</h3><p class="meta" style="margin:0">${esc(me.email)}</p>
        <div class="profile-actions"><label class="btn ghost" style="display:inline-flex;align-items:center;cursor:pointer;margin:0">Upload / change ${isYard ? "dealer logo" : "picture"}<input id="accPhoto" type="file" accept="image/*" hidden></label>${avatar ? '<button class="btn ghost" type="button" id="accRemovePhoto">Remove picture</button>' : ""}</div>${isYard ? '<p class="meta">This image appears beside your dealer name and on your yard profile.</p>' : ""}
      </div>
    </div>
    ${profile && profile.is_admin ? `<section class="account-tools account-admin-tools"><div><h3>Administration</h3><p class="meta">Manage vehicle approvals, garage bookings, website contact details and published content.</p></div><button class="btn ghost account-admin-button" type="button" id="accAdmin"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.9 7.8-7 10-4.1-2.2-7-5.4-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/></svg><span>Open Admin Dashboard</span></button></section>` : ""}
    <div class="profile-grid"><div><label for="accName">Full name</label><input id="accName" value="${esc(name)}" autocomplete="name"></div><div><label for="accPhone">Phone number</label><input id="accPhone" value="${esc(phone)}" type="tel" autocomplete="tel"></div><div><label for="accType">Account type</label><select id="accType"><option value="private" ${accountType() === "private" ? "selected" : ""}>Private seller</option><option value="yard" ${isYard ? "selected" : ""}>Car yard / dealer</option></select></div></div>
    ${isYard ? `<section class="account-tools dealer-account-editor">
      <div class="dealer-editor-heading"><div><p class="account-eyebrow">PUBLIC BUSINESS DETAILS</p><h3>Dealer information</h3><p class="meta">Keep your yard identity and buyer contact details clear and up to date.</p></div><span class="dealer-profile-status">Business profile</span></div>
      <div class="dealer-editor-section"><h4>Business identity</h4><div class="profile-grid dealer-fields-grid">
        <div class="dealer-field-wide"><label for="accDealerName">Dealer / business name</label><input id="accDealerName" value="${esc(yardProfile.yard_name || yardProfile.seller_name || me.user_metadata?.dealer_name || name)}"></div>
        <div><label for="accDealerContact">Contact person</label><input id="accDealerContact" value="${esc(yardProfile.contact || me.user_metadata?.dealer_contact || "")}"></div>
        <div><label for="accDealerLocation">Location / address</label><input id="accDealerLocation" value="${esc(yardProfile.yard_location || yardProfile.location || me.user_metadata?.dealer_location || "")}"></div>
      </div></div>
      <div class="dealer-editor-section"><h4>Contact details</h4><div class="profile-grid dealer-fields-grid">
        <div><label for="accDealerPhone">Dealer phone</label><input id="accDealerPhone" type="tel" value="${esc(yardProfile.seller_phone || yardProfile.phone || me.user_metadata?.dealer_phone || phone)}"></div>
        <div><label for="accDealerEmail">Dealer email</label><input id="accDealerEmail" type="email" value="${esc(yardProfile.seller_email || yardProfile.email || me.user_metadata?.dealer_email || me.email || "")}"></div>
        <div><label for="accDealerWhatsApp">WhatsApp number</label><input id="accDealerWhatsApp" type="tel" value="${esc(yardProfile.whatsapp || me.user_metadata?.dealer_whatsapp || yardProfile.seller_phone || phone)}"></div>
      </div></div>
      <div class="dealer-editor-section"><h4>Online presence</h4><div class="profile-grid dealer-fields-grid">
        <div class="dealer-field-wide"><label for="accDealerWeb">Website / social link</label><input id="accDealerWeb" type="url" value="${esc(yardProfile.yard_web || yardProfile.web || me.user_metadata?.dealer_website || "")}" placeholder="https://example.com"></div>
      </div></div>
      <div class="dealer-save-row"><button class="btn" type="button" data-save-dealer-info>Save dealer information</button><span class="meta">Your saved details appear on your dealer profile and vehicle listings.</span></div>
    </section>` : ""}
    <p id="accProfileErr" class="meta" style="color:var(--err)"></p><div class="acts"><button class="btn" id="accSaveProfile">Save profile changes</button></div>
    <section class="account-tools"><h3>Login details</h3><div class="field-row"><div><label for="accEmail">Email address</label><input id="accEmail" type="email" value="${esc(me.email || "")}" autocomplete="email"></div><button class="btn ghost" id="accUpdateEmail" type="button">Change email</button></div><div class="field-row"><div><label for="accPassword">New password</label><input id="accPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></div><button class="btn ghost" id="accUpdatePassword" type="button">Change password</button></div><p class="meta">Email changes require confirmation from your inbox.</p></section>
     <div class="seller-dashboard">
      <section class="account-tools"><h3>Analytics</h3><p class="meta">${isYard ? "Your yard’s vehicles and activity" : "Your vehicle listings and activity"}</p>${reminders.length ? `<div class="dashboard-welcome" role="status"><strong>${reminders.length} live listing${reminders.length === 1 ? " is" : "s are"} due for a repost reminder.</strong> <button class="btn ghost" type="button" data-open-marketing>Review reminders</button></div>` : ""}<table class="seller-analytics-table"><tbody><tr><th scope="row">All listings</th><td>${L.length}</td></tr><tr><th scope="row">Live</th><td>${listingStatusCounts.approved || 0}</td></tr><tr><th scope="row">Pending review</th><td>${listingStatusCounts.pending || 0}</td></tr><tr><th scope="row">Not approved</th><td>${listingStatusCounts.rejected || 0}</td></tr><tr><th scope="row">Sold vehicles</th><td>${listingStatusCounts.sold || 0}</td></tr><tr><th scope="row">Recorded sale reports</th><td>${S.length}</td></tr><tr><th scope="row">Total reported sale value</th><td>KES ${fmt(reportedSales)}</td></tr><tr><th scope="row">Average reported sale</th><td>KES ${fmt(averageReportedSale)}</td></tr></tbody></table><div id="sellerAnalyticsStats" hidden></div><p class="meta sale-summary-note">Sale amounts are reported by you and are not verified platform earnings or payouts.</p><p class="meta" id="sellerAnalyticsStatus" role="status">Loading listing performance…</p></section>
      <section class="account-tools"><h3>Manage your listings</h3><div class="seller-listing-filters"><div><label for="sellerListingSearch">Search your vehicles</label><input id="sellerListingSearch" type="search" placeholder="Search make, model or year"></div><div><label for="sellerListingStatus">Filter by status</label><select id="sellerListingStatus"><option value="">All listings</option><option value="approved">Live</option><option value="pending">Waiting for approval</option><option value="rejected">Not approved</option><option value="sold">Sold</option></select></div></div><p class="meta" id="sellerListingCount" aria-live="polite"></p>${L.map((x) => {
        const promotion = PM.filter((p) => String(p.listing_id) === String(x.id)).sort(
          (a, b) => new Date(b.created_at || b.starts_at || 0) - new Date(a.created_at || a.starts_at || 0)
        )[0];
        const promotionActive = promotion && String(promotion.status || "").toLowerCase() === "active";
        const promotionExpiry = promotion?.ends_at || promotion?.expires_at;
        return `<article data-seller-listing data-listing-id="${esc(x.id)}" data-listing-status="${esc(x.status)}" data-listing-search="${esc((x.year + " " + x.make + " " + x.model).toLowerCase())}" class="seller-listing seller-garage-card"><div class="seller-garage-media">${Array.isArray(x.photos) && x.photos[0] ? `<img class="seller-listing-photo" src="${esc(x.photos[0])}" alt="${esc(x.year + " " + x.make + " " + x.model)}" loading="lazy" decoding="async">` : `<div class="seller-garage-photo-placeholder">3 PEDALS <span>VEHICLE</span></div>`}<span class="seller-garage-status status-${esc(x.status || "pending")}">${esc(label[x.status] || formatStatus(x.status))}</span></div><div class="seller-garage-content"><div class="seller-garage-heading"><div><span class="seller-garage-eyebrow">${esc(x.stock_mode === "local" ? "KENYA STOCK" : x.stock_mode === "import" ? "IMPORT" : "VEHICLE LISTING")}</span><h4>${esc([x.year, x.make, x.model].filter(Boolean).join(" "))}</h4></div><strong class="seller-garage-price">KES ${fmt(x.price)}</strong></div><div class="seller-garage-meta"><span>${Array.isArray(x.photos) ? x.photos.length : 0} photos</span><span>${esc(x.km ? `${fmt(x.km)} km` : "Mileage not set")}</span><span>${esc(x.fuel || "Fuel not set")}</span></div>${promotion ? `<div class="seller-garage-promotion"><span class="seller-garage-promotion-dot ${promotionActive ? "is-active" : ""}"></span><div><strong>${esc(promotion.package_name || "Promotion")}</strong><span>${promotionActive ? "Active promotion" : `Promotion · ${esc(formatStatus(promotion.status))}`}${promotionExpiry ? ` · Ends ${esc(new Date(promotionExpiry).toLocaleDateString())}` : ""}</span></div></div>` : `<div class="seller-garage-promotion is-empty"><span>No active promotion</span></div>`}<div class="seller-listing-actions">${x.status === "approved" ? `<button class="btn ghost" data-sold="${x.id}" data-title="${esc(x.year + " " + x.make + " " + x.model)}">Mark sold</button><button class="btn ghost" data-promote-listing="${x.id}">Promote</button>` : ""}${x.status === "sold" ? `<span class="meta">Reported sale: KES ${fmt(S.find((s) => String(s.listing_id) === String(x.id))?.reported_sale_price || 0)}</span>` : ""}${x.status !== "sold" ? `<button class="btn ghost" data-edit="${esc(x.id)}">Edit listing</button>` : ""}${["approved", "sold"].includes(x.status) ? `<button class="btn ghost" data-view="${x.id}">View</button>` : ""}<button class="btn ghost" data-del="${x.id}">Delete</button></div></div></article>`;
      }).join("") || '<p class="meta">You have no listings yet.</p>'}</section>
      <section class="account-tools"><h3>Marketing</h3><h4>Listing reminders</h4><p class="meta">Live listings with no repost activity for ${reminderDays} days or more. Mark one reposted after you refresh its photos or promotion.</p>${reminders.length ? reminders.map((x) => `<div class="seller-listing marketing-reminder-row"><div class="seller-listing-main"><strong>${esc(x.year + " " + x.make + " " + x.model)}</strong><span class="meta">Last updated ${esc(new Date(x.reposted_at || x.updated_at || x.created_at || 0).toLocaleDateString())}</span></div><div class="seller-listing-actions"><button class="btn ghost" type="button" data-reposted="${esc(x.id)}">Mark reposted today</button></div></div>`).join("") : '<p class="meta">No listings are due for a repost reminder.</p>'}<p class="meta" id="reminderMessage" aria-live="polite"></p><h4>Paid promotions</h4><p class="meta">Choose an active listing and package. M-Pesa STK Push payments stay pending until the secure payment callback is verified.</p>${PK.length ? `<div class="promotion-package-grid">${PK.map((p) => `<div class="promotion-package"><strong>${esc(p.name)}</strong><span>${esc(p.description || `${p.duration_days} days featured`)}</span><b>KES ${fmt(p.amount)}</b><small class="meta">${Number(p.duration_days)} days</small></div>`).join("")}</div><label for="promoListing">Vehicle to promote</label><select id="promoListing"><option value="">Choose a live vehicle</option>${L.filter((x) => x.status === "approved").map((x) => `<option value="${esc(x.id)}">${esc(x.year + " " + x.make + " " + x.model)}</option>`).join("")}</select><label for="promoPackage">Promotion package</label><select id="promoPackage"><option value="">Choose a package</option>${PK.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} · KES ${fmt(p.amount)} / ${Number(p.duration_days)} days</option>`).join("")}</select><label for="promoPhone">M-Pesa phone number</label><input id="promoPhone" type="tel" autocomplete="tel" value="${esc(phone)}" placeholder="07XX XXX XXX"><button class="btn" type="button" id="startPromotion">Pay with M-Pesa</button><p class="meta" id="promotionMessage" aria-live="polite"></p>` : '<p class="meta">Promotion packages are not configured yet. Please check back later.</p>'}<div class="promotion-history-head"><h4>Promotion history</h4><button class="btn ghost" type="button" id="clearPromotionHistory">Clear history</button></div><div id="promotionHistoryList">${renderPromotionHistory(PM)}</div><p class="meta" id="promotionHistoryMessage" aria-live="polite"></p></section>
     </div>
    <div class="account-bookings-toolbar"><div class="account-bookings-head"><h3>My garage bookings and service tickets</h3></div><div class="acts" id="garageBookingAction"><a class="btn alt" href="/garage?section=book">Book a garage service</a><button class="btn ghost" type="button" id="clearMyCompletedBookings">Clear completed</button></div></div><div id="myGarageBookings">${B.map((x) => {
      const completed =
        String(x.status || "").toLowerCase() === "done" ||
        String(x.service_status || "").toLowerCase() === "completed";
      return `<div class="svc account-booking-row" data-my-booking="${esc(x.id)}"><div><b>${esc(x.service || x.service_type || "Garage service")}</b><span class="meta">Ticket ${esc(x.ref || x.id)} · ${esc(x.date || "")}${x.time_slot ? " · " + esc(x.time_slot) : ""} · ${esc(x.car || "")}</span><span class="meta">Progress: ${esc(String(x.service_status || x.status || "pending").replaceAll("_", " "))}</span></div><span class="st">${esc(completed ? "Completed" : x.status || "Pending")}</span></div>`;
    }).join("") || '<p class="meta">No bookings yet.</p>'}</div>
    <section class="danger-zone"><h3>Delete account</h3><p class="meta">Permanently remove your account, listings, and bookings. This cannot be undone.</p><button class="btn ghost" id="accDeleteAccount" type="button">Permanently delete account</button></section>
    <div class="acts" style="margin-top:18px"><button class="btn ghost" id="accOut">Sign out</button><button class="btn ghost" id="accClose">Close</button></div>`;

    const dashboard = box.querySelector(".seller-dashboard");
    const profileCard = box.querySelector(".profile-card");
    const profileGrid = box.querySelector(".profile-grid");
    const dealerEditor = box.querySelector(".dealer-account-editor");
    const profileError = $("accProfileErr");
    const profileActions = $("accSaveProfile")?.parentElement;
    const loginDetails = Array.from(box.children).find(
      (node) =>
        node.classList.contains("account-tools") &&
        node.querySelector("h3")?.textContent.trim() === "Login details"
    );
    const menu = $("accountMenu");
    const accountOwnerId = me.id;

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

    if (dashboard) {
      const dashboardSections = Array.from(dashboard.children);
      const summary = dashboardSections[0];
      const listings = dashboardSections[1];
      const promotions = dashboardSections[2];
      const deleteZone = box.querySelector(".danger-zone");
      const bookingToolbar = box.querySelector(".account-bookings-toolbar");
      if (summary) summary.querySelector("h3").id = "sellerSummary";
      if (listings) listings.querySelector("h3").id = "sellerListings";
      if (promotions) promotions.querySelector("h3").id = "sellerPromotions";

      const settings = document.createElement("section");
      settings.className = "account-page";
      settings.id = "accountPage-settings";
      settings.hidden = true;
      settings.innerHTML =
        '<h3>Profile and account settings</h3><div class="account-settings-inner"></div>';
      const settingsInner = settings.querySelector(".account-settings-inner");
      const settingsTabs = document.createElement("div");
      settingsTabs.className = "account-settings-tabs";
      settingsTabs.innerHTML =
        '<button type="button" class="active" data-settings-tab="business">Your business</button><button type="button" data-settings-tab="vehicles">New vehicles</button><button type="button" data-settings-tab="paperwork">Paperwork</button><button type="button" data-settings-tab="reminders">Reminders</button><button type="button" data-settings-tab="account">Account</button>';

      const businessSettings = document.createElement("section");
      businessSettings.className = "settings-section";
      businessSettings.dataset.settingsSection = "business";
      businessSettings.innerHTML =
        '<h4>Your business profile</h4><p class="meta">Your name, contact details and seller profile image.</p>';
      [profileCard, profileGrid, dealerEditor, profileError, profileActions]
        .filter(Boolean)
        .forEach((node) => businessSettings.append(node));

      const makeSettingsSection = (key, title, description, html) => {
        const section = document.createElement("section");
        section.className = "settings-section";
        section.dataset.settingsSection = key;
        section.hidden = true;
        section.innerHTML = `<section class="account-tools"><h4>${title}</h4><p class="meta">${description}</p>${html}<button class="btn" type="button" data-save-preferences="${key}">Save</button><p class="meta" data-preference-status="${key}" aria-live="polite"></p></section>`;
        return section;
      };
      const vehicleSettings = makeSettingsSection(
        "vehicles",
        "New vehicle defaults",
        "Choose the starting stock type used in the Sell a car listing form.",
        `<label for="prefStockMode">Preferred stock mode</label><select id="prefStockMode"><option value="any">No preference</option><option value="local">Kenya stock</option><option value="import">Import</option></select><p class="meta">New listings start with this selection. You can change it for each vehicle.</p>`
      );
      const paperworkSettings = makeSettingsSection(
        "paperwork",
        "Paperwork rules",
        "Apply your saved preferences when preparing vehicle documents.",
        `<label for="prefBankDetails">Bank details for documents</label><textarea id="prefBankDetails" rows="4" placeholder="Bank, account name and payment details"></textarea><label class="check-row"><input id="prefPrintLogo" type="checkbox"> Print your logo on documents</label><label class="check-row"><input id="prefRequireEngine" type="checkbox"> Require engine number in checklist</label><label class="check-row"><input id="prefRequireRegistration" type="checkbox"> Require registration number in checklist</label><label class="check-row"><input id="prefRequireLogbook" type="checkbox"> Require logbook check</label><label class="check-row"><input id="prefRequireSupplierDocs" type="checkbox"> Require supplier ID/PIN check for consignment stock</label><p class="meta">These settings prefill and mark required checks in the printable vehicle documents.</p>`
      );
      const reminderSettings = makeSettingsSection(
        "reminders",
        "Listing reminders",
        "See overdue listings in Marketing and reset the reminder date after reposting.",
        `<label for="prefReminderDays">Repost reminder interval (days)</label><input id="prefReminderDays" type="number" min="1" max="365" value="14"><p class="meta">Reminders appear in your seller dashboard when a live listing has not been updated within this interval.</p>`
      );
      const accountSettings = document.createElement("section");
      accountSettings.className = "settings-section";
      accountSettings.dataset.settingsSection = "account";
      accountSettings.hidden = true;
      accountSettings.innerHTML =
        '<h4>Login and account</h4><p class="meta">Manage the email and password used to sign in.</p><div class="account-subscription-note"><h4>Subscriptions</h4><p class="meta">Recurring subscriptions and automatic renewals are not currently offered on this site. Vehicle promotions and chauffeur payments are one-time M-Pesa transactions; their price and service period are shown before payment. There is no subscription renewal date or recurring charge to cancel.</p></div><div class="account-legal-preferences"><h4>Privacy and legal</h4><p class="meta">Read how 3 Pedals Auto KE uses and protects your information.</p><p><a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · <a href="/terms.html" target="_blank" rel="noopener">Terms of Service</a></p><button class="btn ghost" type="button" id="accCookiePreferences">Change cookie preferences</button><p class="meta">Optional analytics and advertising tags load only if you accept them. Essential account, security and payment services remain active.</p></div>';
      [loginDetails, deleteZone].filter(Boolean).forEach((node) => accountSettings.append(node));

      settingsInner.append(
        settingsTabs,
        businessSettings,
        vehicleSettings,
        paperworkSettings,
        reminderSettings,
        accountSettings
      );
      accountSettings.querySelector("#accCookiePreferences").onclick = () =>
        window.ThreePedalsConsent?.open();
      settingsTabs.querySelectorAll("[data-settings-tab]").forEach((tab) => {
        tab.onclick = () => {
          const key = tab.dataset.settingsTab;
          settingsTabs.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === tab));
          settingsInner.querySelectorAll("[data-settings-section]").forEach((section) => {
            section.hidden = section.dataset.settingsSection !== key;
          });
        };
      });
      settingsInner.querySelector("#prefStockMode").value =
        sellerSettings.preferred_stock_mode || "any";
      settingsInner.querySelector("#prefBankDetails").value = sellerSettings.bank_details || "";
      settingsInner.querySelector("#prefPrintLogo").checked =
        sellerSettings.print_logo_on_documents !== false;
      settingsInner.querySelector("#prefRequireEngine").checked =
        !!sellerSettings.require_engine_number;
      settingsInner.querySelector("#prefRequireRegistration").checked =
        sellerSettings.require_registration_number !== false;
      settingsInner.querySelector("#prefRequireLogbook").checked =
        sellerSettings.require_logbook !== false;
      settingsInner.querySelector("#prefRequireSupplierDocs").checked =
        !!sellerSettings.require_supplier_documents;
      settingsInner.querySelector("#prefReminderDays").value =
        Number(sellerSettings.repost_reminder_days) || 14;

      settingsInner.querySelectorAll("[data-save-preferences]").forEach((button) => {
        button.onclick = async () => {
          const key = button.dataset.savePreferences;
          const status = settingsInner.querySelector(`[data-preference-status="${key}"]`);
          button.disabled = true;
          status.textContent = "Saving…";
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
            status.textContent = "Saved.";
          } catch (error) {
            status.textContent = error.message?.includes("seller_settings")
              ? "Settings storage is not installed yet. Run outputs/seller_account_settings.sql in Supabase SQL Editor."
              : `Could not save settings: ${error.message || "Please try again."}`;
          } finally {
            button.disabled = false;
          }
        };
      });

      const overview = document.createElement("section");
      overview.className = "account-page account-overview";
      overview.id = "accountPage-overview";
      const activePromotionCount = PM.filter(
        (p) => String(p.status || "").toLowerCase() === "active"
      ).length;
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
      const activityItems = allActivityItems.slice(0, 6);
      const activityMarkup = activityItems.length
        ? activityItems
            .map(
              (item) =>
                `<article class="account-activity-item"><span class="account-activity-dot ${esc(item.kind)}"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><time datetime="${esc(item.time)}">${esc(new Date(item.time).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }))}</time></article>`
            )
            .join("")
        : '<p class="account-overview-empty">Your recent account activity will appear here.</p>';
      const firstName = name ? name.split(/\s+/)[0] : "there";

      overview.innerHTML = `<main class="workspace-v2">
        <header class="workspace-v2-hero">
          <div class="workspace-v2-welcome">
            <p class="workspace-v2-kicker">3 PEDALS AUTO KE <span></span> ACCOUNT WORKSPACE</p>
            <h3>Welcome back, ${esc(firstName)}.</h3>
            <p>Your vehicles, marketplace activity and garage services — together in one place.</p>
          </div>
          <div class="workspace-v2-hero-actions">
            <span class="workspace-v2-status"><i></i> Account active</span>
            <div class="workspace-v2-primary-actions">
              <button type="button" class="workspace-v2-action-secondary" data-overview-page="listings">Manage listings <b>↗</b></button>
              <button type="button" data-overview-buying>Explore inventory <b>↗</b></button>
            </div>
          </div>
        </header>

        <section class="workspace-v2-metric-grid" aria-label="Account summary">
          <button type="button" class="workspace-v2-metric" data-overview-page="listings">
            <span class="workspace-v2-metric-top"><span>MY LISTINGS</span><i>01</i></span>
            <strong>${L.length}</strong>
            <span class="workspace-v2-metric-bottom">Vehicles in your account <b>↗</b></span>
          </button>
          <button type="button" class="workspace-v2-metric" data-overview-page="promotions">
            <span class="workspace-v2-metric-top"><span>ACTIVE PROMOTIONS</span><i>02</i></span>
            <strong>${activePromotionCount}</strong>
            <span class="workspace-v2-metric-bottom">Visibility campaigns <b>↗</b></span>
          </button>
          <button type="button" class="workspace-v2-metric" data-overview-page="buying">
            <span class="workspace-v2-metric-top"><span>SAVED VEHICLES</span><i>03</i></span>
            <strong>${savedVehicleRows.length}</strong>
            <span class="workspace-v2-metric-bottom">Vehicles on your shortlist <b>↗</b></span>
          </button>
          <button type="button" class="workspace-v2-metric" data-overview-page="bookings">
            <span class="workspace-v2-metric-top"><span>GARAGE BOOKINGS</span><i>04</i></span>
            <strong>${B.length}</strong>
            <span class="workspace-v2-metric-bottom">Service requests recorded <b>↗</b></span>
          </button>
        </section>

        <section class="workspace-v2-main-grid">
          <article class="workspace-v2-card workspace-v2-inventory">
            <div class="workspace-v2-card-heading">
              <div><p class="workspace-v2-kicker">INVENTORY OVERVIEW</p><h4>Your vehicle activity</h4></div>
              <button type="button" data-overview-page="listings">Manage listings <b>↗</b></button>
            </div>
            <div class="workspace-v2-inventory-total"><strong>${L.length}</strong><span>total vehicles in your account</span></div>
            <div class="workspace-v2-progress"><i style="--workspace-progress:${L.length ? Math.round(((listingStatusCounts.approved || 0) / L.length) * 100) : 0}%"></i></div>
            <div class="workspace-v2-status-list">
              <div><span><i class="live"></i> Live listings</span><strong>${listingStatusCounts.approved || 0}</strong></div>
              <div><span><i class="review"></i> Awaiting review</span><strong>${listingStatusCounts.pending || 0}</strong></div>
              <div><span><i class="other"></i> Other statuses</span><strong>${Math.max(0, L.length - (listingStatusCounts.approved || 0) - (listingStatusCounts.pending || 0))}</strong></div>
            </div>
          </article>

          <article class="workspace-v2-card workspace-v2-shortcuts">
            <div class="workspace-v2-card-heading">
              <div><p class="workspace-v2-kicker">WORKSPACE</p><h4>Quick access</h4></div>
            </div>
            <button type="button" data-overview-page="listings"><span class="workspace-v2-shortcut-index">01</span><span><strong>My listings</strong><small>Manage vehicles, photos and prices</small></span><b>↗</b></button>
            <button type="button" data-overview-page="promotions"><span class="workspace-v2-shortcut-index">02</span><span><strong>Promotions</strong><small>Manage vehicle visibility</small></span><b>↗</b></button>
            <button type="button" data-overview-page="bookings"><span class="workspace-v2-shortcut-index">03</span><span><strong>Garage bookings</strong><small>Review service requests</small></span><b>↗</b></button>
            <button type="button" data-overview-page="buying"><span class="workspace-v2-shortcut-index">04</span><span><strong>Saved vehicles</strong><small>Return to vehicles you saved</small></span><b>↗</b></button>
          </article>
        </section>

        ${isYard ? `<section class="workspace-v2-card workspace-v2-dealer">
          <div class="workspace-v2-card-heading">
            <div><p class="workspace-v2-kicker">BUSINESS PROFILE</p><h4>Your dealership</h4></div>
            <button type="button" data-overview-page="settings" data-account-tab="business">Edit details <b>↗</b></button>
          </div>
          <div class="workspace-v2-dealer-content">
            ${avatar ? `<img src="${esc(avatar)}" alt="Dealership logo">` : `<span class="workspace-v2-dealer-monogram">${esc(initialsFor(yardProfile.yard_name || yardProfile.seller_name || me.user_metadata?.dealer_name || name, me.email))}</span>`}
            <div class="workspace-v2-dealer-name"><strong>${esc(yardProfile.yard_name || yardProfile.seller_name || me.user_metadata?.dealer_name || name || "Dealer profile")}</strong><span>${esc(yardProfile.yard_location || yardProfile.location || me.user_metadata?.dealer_location || "Add your business location in Profile")}</span></div>
            <div><small>PHONE</small><strong>${esc(yardProfile.seller_phone || yardProfile.phone || me.user_metadata?.dealer_phone || phone || "Not added")}</strong></div>
            <div><small>EMAIL</small><strong>${esc(yardProfile.seller_email || yardProfile.email || me.user_metadata?.dealer_email || me.email || "Not added")}</strong></div>
            <div><small>WEBSITE</small><strong>${esc(yardProfile.yard_web || yardProfile.web || me.user_metadata?.dealer_website || "Not added")}</strong></div>
          </div>
        </section>` : ""}

        <section class="workspace-v2-card workspace-v2-activity">
          <div class="workspace-v2-card-heading">
            <div><p class="workspace-v2-kicker">LATEST UPDATES</p><h4>Recent account activity</h4></div>
            <button type="button" data-overview-page="activity">Full activity <b>↗</b></button>
          </div>
          <div class="workspace-v2-activity-list">${activityMarkup}</div>
        </section>
        <footer class="workspace-v2-footer"><span>3 PEDALS AUTO KE</span><span>Automotive excellence, in one workspace.</span></footer>
      </main>`;

      const makePage = (id, node) => {
        const page = document.createElement("section");
        page.className = "account-page";
        page.id = `accountPage-${id}`;
        page.hidden = true;
        if (node) page.append(node);
        return page;
      };
      const activityPage = makePage("activity");
      const buyingPage = makePage("buying");
      buyingPage.innerHTML =
        '<section class="account-tools account-buyer-workspace"><div class="account-activity-page-head"><div><p class="account-eyebrow">YOUR MARKETPLACE</p><h3>Buying workspace</h3><p class="meta">Keep track of vehicles you are considering.</p></div><a class="btn ghost" href="#buy" data-browse-buying>Browse vehicles</a></div><h4>Saved vehicles</h4><div id="savedVehiclesGrid" class="account-saved-vehicles-grid"><p class="meta">Loading your saved vehicles…</p></div></section>';
      activityPage.innerHTML = `<section class="account-tools account-full-activity"><div class="account-activity-page-head"><div><p class="account-eyebrow">YOUR ACCOUNT HISTORY</p><h3>Activity centre</h3><p class="meta">A chronological record of your marketplace and garage activity.</p></div><span>${allActivityItems.length} events</span></div><div class="account-activity-list">${allActivityItems.length ? allActivityItems.map((item) => `<article class="account-activity-item"><span class="account-activity-dot ${esc(item.kind)}"></span><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><time datetime="${esc(item.time)}">${esc(new Date(item.time).toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }))}</time></article>`).join("") : '<p class="account-overview-empty">Your recent account activity will appear here as you use the marketplace.</p>'}</div></section>`;
      const dashboardPage = makePage("dashboard");
      const promotionsPage = makePage("promotions");
      const bookingsPage = makePage("bookings");
      const chauffeurPage = makePage("chauffeur");
      promotionsPage.classList.add("account-promotions-page");
      promotionsPage.append(promotions);
      dashboardPage.append(summary, listings);
      bookingsPage.classList.add("account-bookings-page");
      chauffeurPage.classList.add("account-bookings-page", "account-chauffeur-bookings-page");
      chauffeurPage.innerHTML =
        '<section class="account-tools"><div class="account-activity-page-head"><div><p class="account-eyebrow">YOUR CHAUFFEUR SERVICE</p><h3>My Chauffeur Bookings</h3><p class="meta">Track your booking requests, confirmed quotations, payment status and assigned driver.</p></div><a class="btn ghost" href="/chauffeur.html#booking">Request a chauffeur</a></div><div id="myChauffeurBookings" aria-live="polite"><p class="meta">Your chauffeur bookings will appear here.</p></div></section>';
      if (bookingToolbar) bookingsPage.append(bookingToolbar);
      let bookingNode = bookingToolbar?.nextElementSibling;
      while (bookingNode && !bookingNode.querySelector("#accOut")) {
        const next = bookingNode.nextElementSibling;
        bookingsPage.append(bookingNode);
        bookingNode = next;
      }
      bookingsPage
        .querySelectorAll(".svc")
        .forEach((item) => item.classList.add("account-booking-item"));

      const pages = document.createElement("div");
      pages.className = "account-pages";
      pages.append(
        overview,
        buyingPage,
        dashboardPage,
        promotionsPage,
        settings,
        bookingsPage,
        chauffeurPage,
        activityPage
      );
      overview.hidden = false;
      dashboardPage.hidden = true;
      settings.hidden = true;
      closeAccountMenu();

      const navIco = (path) =>
        `<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
      menu.innerHTML = `<a class="account-sidebar-brand" href="/"><img src="favicon.svg" alt="" width="28" height="28"><div><strong>3 PEDALS</strong><span>AUTO KE · WORKSPACE</span></div></a><div class="seller-nav-identity"><small>${isYard ? "DEALER ACCOUNT" : "SELLER ACCOUNT"}</small><strong>${esc(name || me.email || "Member")}</strong><span>${esc(me.email || "")}</span></div><div class="seller-mode-switch"><button type="button" data-buying>Buying</button><button type="button" class="selected" aria-current="page">Selling</button></div><div class="seller-nav-label">WORKSPACE</div><button type="button" class="active" data-page="overview" aria-current="page">${navIco('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')}<span>Overview</span></button><button type="button" data-page="buying">${navIco('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>')}<span>Buying workspace</span></button><button type="button" data-page="dashboard">${navIco('<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/>')}<span>Insights</span></button><button type="button" data-page="listings">${navIco('<path d="M5 17H4a2 2 0 0 1-2-2v-3l2.2-5A2 2 0 0 1 6 5.8h12a2 2 0 0 1 1.8 1.2L22 12v3a2 2 0 0 1-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>')}<span>My listings</span></button><button type="button" data-page="promotions">${navIco('<path d="m12 3 2.5 5.5L20 10l-4.5 3.8L16.8 20 12 16.8 7.2 20l1.3-6.2L4 10l5.5-1.5Z"/>')}<span>Promotions${reminders.length ? ` · ${reminders.length} due` : ""}</span></button><button type="button" data-page="bookings">${navIco('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>')}<span>Garage bookings</span></button><button type="button" data-page="chauffeur">${navIco('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7m-7.5 4 5.5-2m8.5 2-5.5-2"/>')}<span>Chauffeur bookings</span></button><button type="button" data-page="activity">${navIco('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<span>Activity centre</span></button><button type="button" data-seller-signup>${navIco('<path d="M12 5v14M5 12h14"/>')}<span>Create seller account</span></button><div class="seller-nav-label">ACCOUNT</div><button type="button" data-page="settings" data-account-tab="business">${navIco('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}<span>Profile</span></button><button type="button" data-page="settings" data-account-tab="account">${navIco('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.79 1.03 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>')}<span>Settings</span></button><div class="account-sidebar-footer"><button type="button" data-signout>${navIco('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')}<span>Log out</span></button></div>`;
      menu.hidden = window.matchMedia("(max-width:760px)").matches;
      $("accDlg").classList.remove("nav-collapsed");

      dashboard.remove();
      box.insertBefore(pages, box.firstChild);

      pages.querySelectorAll("[data-overview-page]").forEach((button) => {
        button.addEventListener("click", () => {
          menu.querySelector(`[data-page="${button.dataset.overviewPage}"]`)?.click();
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
        menu.querySelector('[data-page="promotions"]')?.click();
      });

      menu.querySelector("[data-seller-signup]").onclick = () => {
        $("accDlg").close();
        closeAccountMenu();
        setSellerSlugEdited(false);
        $("authName").value =
          profile?.name || me?.user_metadata?.name || me?.user_metadata?.full_name || "";
        $("authSellerSlug").value = "";
        host().openAuth?.("register", "", { seller: true });
      };
      menu.querySelector("[data-buying]").onclick = () => host().openCurrentInventory?.(true);
      menu.querySelector("[data-signout]").onclick = () => $("accOut").click();

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
          if (!data.length) {
            container.innerHTML =
              '<p class="meta">You have no chauffeur bookings yet. When you submit a request, its progress will appear here.</p>';
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
          const statusClass = (value) =>
            ["confirmed", "completed", "accepted", "paid"].includes(
              String(value || "").toLowerCase()
            )
              ? "success"
              : ["declined", "cancelled", "failed"].includes(String(value || "").toLowerCase())
                ? "danger"
                : "pending";
          container.innerHTML =
            '<div class="account-chauffeur-toolbar"><span class="meta">Updated ' +
            esc(
              new Date().toLocaleTimeString("en-KE", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })
            ) +
            '</span><button type="button" class="btn ghost" id="refreshMyChauffeurBookings">Refresh status</button></div>' +
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
                  ? '<div class="account-cancellation-state"><span class="meta">Cancellation / restoration status</span><strong class="' +
                    statusClass(request.status) +
                    '">' +
                    esc(labelStatus(request.status)) +
                    "</strong>" +
                    (request.reason
                      ? '<span class="meta">Your reason: ' + esc(request.reason) + "</span>"
                      : "") +
                    (request.admin_note
                      ? '<span class="meta">Administrator response: ' +
                        esc(request.admin_note) +
                        "</span>"
                      : "") +
                    (request.status === "pending"
                      ? '<span class="meta">Your booking remains active while the cancellation request is reviewed.</span><div class="account-booking-actions"><button type="button" class="btn ghost" data-keep-chauffeur-booking="' +
                        esc(request.id) +
                        '">Keep this booking instead</button></div>'
                      : request.status === "withdrawn"
                        ? '<span class="meta">You chose to keep this booking. No cancellation will be made.</span>'
                        : request.status === "accepted"
                          ? '<span class="meta">Your booking was cancelled. You can request restoration below.</span><div class="account-booking-actions"><button type="button" class="btn ghost" data-request-chauffeur-restore="' +
                            esc(request.id) +
                            '">Request booking restoration</button></div>'
                          : request.status === "restoration_requested"
                            ? '<span class="meta">Your restoration request is awaiting administrator approval. The booking remains cancelled for now.</span>'
                            : request.status === "restoration_declined"
                              ? '<span class="meta">Your restoration request was declined. You may submit another request.</span><div class="account-booking-actions"><button type="button" class="btn ghost" data-request-chauffeur-restore="' +
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
                    ? '<div class="account-booking-actions"><button type="button" class="btn ghost" data-request-chauffeur-cancel="' +
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
                  '</div><span class="st ' +
                  statusClass(item.status) +
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

      menu
        .querySelector('[data-page="chauffeur"]')
        ?.addEventListener("click", loadMyChauffeurBookings);
      if (requestedAccountPage === "chauffeur") loadMyChauffeurBookings();

      const startChauffeurAccountLive = () => {
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
      };
      startChauffeurAccountLive();
    }

    $("accPhoto").onchange = (e) => {
      pendingProfilePhoto = e.target.files?.[0] || null;
      pendingRemoveProfilePhoto = false;
      if (pendingProfilePhoto) {
        const err = $("accProfileErr");
        if (err) {
          err.style.color = "var(--mute)";
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
        $("myGarageBookings").innerHTML = '<p class="meta">No bookings yet.</p>';
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

    $("accOut").onclick = async () => {
      await client.auth.signOut();
      try {
        sessionStorage.removeItem("3pedals:account-open");
        sessionStorage.removeItem("3pedals:account-page");
        sessionStorage.removeItem("3pedals:account-view-cache");
      } catch (_) {}
      d.close();
    };
    $("accClose").onclick = () => d.close();
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
    showSellerAccountPage(requestedAccountPage || "settings", activeSettingsMenuBtn, {
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
