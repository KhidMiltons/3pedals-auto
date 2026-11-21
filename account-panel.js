/* 3 Pedals Auto KE — Account Workspace Shell & Action UI (Parity with Admin Console) */
(() => {
  "use strict";
  const mount = document.getElementById("accountPanelMount");
  if (!mount) return;
  if (mount.parentElement !== document.body) document.body.appendChild(mount);

  const currentTheme = () =>
    document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  mount.innerHTML = `
    <dialog id="accDlg" class="account-dashboard-dialog" aria-label="3 Pedals Auto KE Account Workspace">
      <div id="accountMenuBackdrop" class="account-menu-backdrop" aria-hidden="true"></div>
      <nav id="accountMenu" class="account-sidebar" aria-label="Account navigation">
        <a class="account-sidebar-brand" href="/" aria-label="3 Pedals Auto KE home">
          <img src="favicon.svg" alt="" width="28" height="28">
          <span><strong>3 PEDALS</strong><small>Account Workspace</small></span>
        </a>
        <div class="seller-nav-identity">
          <small>Signed in member</small>
          <strong>Account workspace</strong>
          <span>Loading profile…</span>
        </div>
        <div class="seller-mode-switch" aria-label="Marketplace mode">
          <button type="button" data-buying>Buying</button>
          <button type="button" class="selected" aria-current="page">Selling</button>
        </div>
        <div class="seller-nav-label">Workspace</div>
        <button type="button" class="account-nav-btn active" data-page="overview" aria-current="page"><span>Overview</span></button>
        <button type="button" class="account-nav-btn" data-page="buying"><span>Buying workspace</span><span class="account-nav-count"></span></button>
        <button type="button" class="account-nav-btn" data-page="dashboard"><span>Insights</span></button>
        <div class="seller-nav-label">Selling &amp; Services</div>
        <button type="button" class="account-nav-btn" data-page="listings"><span>My listings</span><span class="account-nav-count"></span></button>
        <button type="button" class="account-nav-btn" data-page="promotions"><span>Promotions</span><span class="account-nav-count"></span></button>
        <button type="button" class="account-nav-btn" data-page="bookings"><span>Garage bookings</span><span class="account-nav-count"></span></button>
        <button type="button" class="account-nav-btn" data-page="chauffeur"><span>Chauffeur bookings</span><span class="account-nav-count"></span></button>
        <button type="button" class="account-nav-btn" data-page="activity"><span>Activity centre</span><span class="account-nav-count"></span></button>
        <div class="seller-nav-label">Account</div>
        <button type="button" class="account-nav-btn" data-page="settings" data-account-tab="business"><span>Profile</span></button>
        <button type="button" class="account-nav-btn" data-page="settings" data-account-tab="account"><span>Settings</span></button>
        <button type="button" class="account-nav-btn" data-seller-signup><span>Seller store URL</span></button>
        <div class="account-sidebar-footer">
          <button type="button" class="ap-btn ap-btn-ghost" id="accThemeToggle">${currentTheme() === "light" ? "Dark theme" : "Light theme"}</button>
          <button type="button" class="ap-btn ap-btn-ghost" id="accHomeSide">Back to site</button>
          <button type="button" class="ap-btn ap-btn-ghost" data-signout>Sign out</button>
        </div>
      </nav>
      <section class="account-dashboard-main">
        <header class="account-dialog-head">
          <div class="account-topbar-left">
            <button id="accMenuToggle" type="button" aria-label="Open account menu" aria-expanded="false" aria-controls="accountMenu">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
            </button>
            <div class="account-breadcrumb">
              <span class="account-breadcrumb-root">Account</span>
              <span class="account-breadcrumb-sep" aria-hidden="true">/</span>
              <span id="accActiveSectionTitle" class="account-breadcrumb-current">Overview</span>
            </div>
          </div>
          <div class="account-global-search">
            <input id="accGlobalSearch" type="search" placeholder="Search listings, bookings, saved vehicles, settings…" aria-label="Search account workspace" autocomplete="off">
            <span class="account-search-kbd" aria-hidden="true">Ctrl K</span>
            <div id="accGlobalResults" class="account-global-results" hidden></div>
          </div>
          <div class="account-head-actions">
            <span id="accLastSync" class="account-sync-label"></span>
            <button id="accRefreshTop" type="button" class="ap-btn ap-btn-ghost">Refresh</button>
            <button id="accHomeTop" type="button" class="ap-btn ap-btn-ghost" aria-label="Return to homepage" title="Return to homepage">Back to site</button>
            <button id="accCloseTop" type="button" class="ap-icon-close" aria-label="Close account" title="Close account">×</button>
          </div>
        </header>
        <div id="accToastHost" class="acc-toast-host" aria-live="polite"></div>
        <div id="accBody" aria-live="polite"></div>
      </section>
    </dialog>
    <dialog id="accActionDlg" class="acc-action-dialog" aria-labelledby="accActionTitle"></dialog>`;

  const dlg = document.getElementById("accDlg");
  const actionDlg = document.getElementById("accActionDlg");
  const toastHost = document.getElementById("accToastHost");
  let fallbackToastHost = null;

  const escHtml = (value) =>
    String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  function applyTheme(next) {
    const theme = next === "light" ? "light" : "dark";
    if (window.ThreePedalsUX && typeof window.ThreePedalsUX.setTheme === "function") {
      window.ThreePedalsUX.setTheme(theme);
    } else {
      document.documentElement.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("3pedals:theme", theme);
      } catch (_) {}
    }
    const toggle = document.getElementById("accThemeToggle");
    if (toggle) toggle.textContent = theme === "light" ? "Dark theme" : "Light theme";
  }

  function syncThemeButton() {
    const toggle = document.getElementById("accThemeToggle");
    if (toggle) toggle.textContent = currentTheme() === "light" ? "Dark theme" : "Light theme";
  }

  function getToastHost() {
    if (dlg?.open && toastHost) return toastHost;
    if (!fallbackToastHost) {
      fallbackToastHost = document.createElement("div");
      fallbackToastHost.id = "siteToastHost";
      fallbackToastHost.className = "acc-toast-host acc-toast-host--floating";
      fallbackToastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(fallbackToastHost);
    }
    return fallbackToastHost;
  }

  function toast(message, kind = "info", durationMs = 4400) {
    const text = String(message || "").trim();
    if (!text) return;
    const host = getToastHost();
    const item = document.createElement("div");
    item.className = `acc-toast acc-toast--${kind}`;
    item.setAttribute("role", kind === "err" ? "alert" : "status");
    item.innerHTML = `<span class="acc-toast-text">${escHtml(text)}</span><button type="button" class="acc-toast-close" aria-label="Dismiss message">×</button>`;
    const remove = () => {
      if (!item.isConnected) return;
      item.classList.add("is-leaving");
      window.setTimeout(() => item.remove(), 180);
    };
    item.querySelector(".acc-toast-close")?.addEventListener("click", remove);
    host.appendChild(item);
    while (host.children.length > 3) host.firstElementChild?.remove();
    window.setTimeout(remove, durationMs);
  }

  function openActionDialog(config) {
    return new Promise((resolve) => {
      if (!actionDlg) {
        resolve(null);
        return;
      }
      if (actionDlg.open) actionDlg.close();
      const {
        mode = "confirm",
        eyebrow = "Confirm Action",
        title = "Please confirm",
        message = "",
        helperNote = "",
        confirmText = "Confirm",
        cancelText = "Cancel",
        danger = false,
        label = "",
        placeholder = "",
        inputType = "text",
        min = "",
        step = "",
        defaultValue = "",
        required = false,
        matchExact = "",
        multiline = false,
      } = config || {};

      const fieldId = "accActionInput";
      const fieldMarkup =
        mode === "prompt"
          ? `<div class="acc-action-field">
              ${label ? `<label for="${fieldId}">${escHtml(label)}</label>` : ""}
              ${
                multiline
                  ? `<textarea id="${fieldId}" rows="3" placeholder="${escHtml(placeholder)}">${escHtml(defaultValue)}</textarea>`
                  : `<input id="${fieldId}" type="${escHtml(inputType)}" ${min !== "" ? `min="${escHtml(min)}"` : ""} ${step !== "" ? `step="${escHtml(step)}"` : ""} value="${escHtml(defaultValue)}" placeholder="${escHtml(placeholder)}" autocomplete="off">`
              }
            </div>`
          : "";

      actionDlg.innerHTML = `
        <form class="acc-action-form" novalidate>
          <div class="acc-action-head">
            <div>
              <span class="ap-eyebrow">${escHtml(eyebrow)}</span>
              <h3 id="accActionTitle">${escHtml(title)}</h3>
            </div>
            <button type="button" class="acc-action-x" data-action-cancel aria-label="Close">×</button>
          </div>
          ${message ? `<p class="acc-action-msg">${escHtml(message)}</p>` : ""}
          ${fieldMarkup}
          ${helperNote ? `<p class="acc-action-note">${escHtml(helperNote)}</p>` : ""}
          <p id="accActionError" class="acc-action-err" role="alert"></p>
          <div class="acc-action-btns">
            <button type="button" class="ap-btn ap-btn-ghost" data-action-cancel>${escHtml(cancelText)}</button>
            <button type="submit" class="ap-btn ${danger ? "ap-btn-danger" : "ap-btn-primary"}">${escHtml(confirmText)}</button>
          </div>
        </form>`;

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        if (actionDlg.open) actionDlg.close();
        resolve(value);
      };

      const form = actionDlg.querySelector("form");
      const input = actionDlg.querySelector(`#${fieldId}`);
      const errEl = actionDlg.querySelector("#accActionError");

      actionDlg.querySelectorAll("[data-action-cancel]").forEach((btn) =>
        btn.addEventListener("click", () => finish(mode === "confirm" ? false : null))
      );

      actionDlg.addEventListener(
        "cancel",
        (ev) => {
          ev.preventDefault();
          finish(mode === "confirm" ? false : null);
        },
        { once: true }
      );

      actionDlg.addEventListener(
        "click",
        (ev) => {
          if (ev.target === actionDlg) finish(mode === "confirm" ? false : null);
        },
        { once: true }
      );

      form?.addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (mode === "confirm") {
          finish(true);
          return;
        }
        const raw = input ? String(input.value || "") : "";
        const trimmed = raw.trim();
        if (required && !trimmed) {
          if (errEl) errEl.textContent = "Please complete this field before continuing.";
          input?.focus();
          return;
        }
        if (inputType === "number") {
          const num = Number(trimmed);
          const minNum = min !== "" ? Number(min) : -Infinity;
          if (!trimmed || !Number.isFinite(num) || num < minNum) {
            if (errEl) errEl.textContent = min !== "" ? `Enter a valid number (${min} or higher).` : "Enter a valid number.";
            input?.focus();
            return;
          }
        }
        if (matchExact && trimmed !== matchExact) {
          if (errEl) errEl.textContent = `Type ${matchExact} exactly to confirm.`;
          input?.focus();
          return;
        }
        finish(trimmed);
      });

      actionDlg.showModal();
      window.requestAnimationFrame(() => {
        if (input) input.focus();
        else actionDlg.querySelector('[type="submit"]')?.focus();
      });
    });
  }

  window.ThreePedalsAccountUI = {
    toast,
    confirm: (opts) => openActionDialog({ ...(opts || {}), mode: "confirm" }),
    prompt: (opts) => openActionDialog({ ...(opts || {}), mode: "prompt" }),
    toggleTheme: () => applyTheme(currentTheme() === "light" ? "dark" : "light"),
    syncThemeButton,
  };
})();