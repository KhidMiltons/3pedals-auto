/* 3 Pedals Auto KE — Account Workspace Shell & Action UI (Dual-Theme: Dark Obsidian & Light Parchment) */
(() => {
  "use strict";
  const mount = document.getElementById("accountPanelMount");
  if (!mount) return;
  if (mount.parentElement !== document.body) document.body.appendChild(mount);
  mount.innerHTML = `
    <dialog id="accDlg" class="account-dashboard-dialog" aria-label="3 Pedals Auto KE Account Workspace">
      <div id="accountMenuBackdrop" class="account-menu-backdrop" aria-hidden="true"></div>
      <nav id="accountMenu" class="account-sidebar" aria-label="Account navigation">
        <a class="account-sidebar-brand" href="/" aria-label="3 Pedals Auto KE home">
          <img src="favicon.svg" alt="" width="28" height="28">
          <span><strong>3 PEDALS</strong><small>AUTO KE · WORKSPACE</small></span>
        </a>
        <div class="seller-nav-identity"><small>YOUR WORKSPACE</small><strong>Seller account</strong></div>
        <div class="seller-mode-switch" aria-label="Marketplace mode">
          <button type="button" data-buying>Buying</button>
          <button type="button" class="selected" aria-current="page">Selling</button>
        </div>
        <div class="seller-nav-label">WORKSPACE</div>
        <button type="button" class="active" data-page="overview" aria-current="page">Overview</button>
        <button type="button" data-page="buying">Buying workspace</button>
        <button type="button" data-page="dashboard">Insights</button>
        <button type="button" data-page="listings">My listings</button>
        <button type="button" data-page="promotions">Promotions</button>
        <button type="button" data-page="bookings">Garage bookings</button>
        <button type="button" data-page="chauffeur">Chauffeur bookings</button>
        <button type="button" data-page="activity">Activity centre</button>
        <button type="button" data-seller-signup>Create seller account</button>
        <div class="seller-nav-label">ACCOUNT</div>
        <button type="button" data-page="settings" data-account-tab="business">Profile</button>
        <button type="button" data-page="settings" data-account-tab="account">Settings</button>
        <div class="account-sidebar-footer"><button type="button" data-signout>Log out</button></div>
      </nav>
      <section class="account-dashboard-main">
        <header class="account-dialog-head">
          <button id="accMenuToggle" type="button" aria-label="Open account menu" aria-expanded="false" aria-controls="accountMenu">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
          <div class="account-head-title-wrap">
            <h2 class="account-brand-title"><img src="favicon.svg" alt="" class="account-brand-icon" width="22" height="22"><span>3 Pedals Auto KE</span></h2>
            <span id="accActiveSectionTitle" class="account-header-section">Overview</span>
          </div>
          <div class="account-head-actions">
            <button id="accHomeTop" type="button" aria-label="Return to homepage" title="Return to homepage">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v9.5a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1V10"/></svg>
              <span>Home</span>
            </button>
            <button id="accCloseTop" type="button" aria-label="Close account" title="Close account">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
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
    item.innerHTML = `<span class="acc-toast-dot" aria-hidden="true"></span><span class="acc-toast-text">${escHtml(text)}</span><button type="button" class="acc-toast-close" aria-label="Dismiss message">×</button>`;
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
        eyebrow = "CONFIRM ACTION",
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
              <p class="account-eyebrow">${escHtml(eyebrow)}</p>
              <h3 id="accActionTitle">${escHtml(title)}</h3>
            </div>
            <button type="button" class="acc-action-x" data-action-cancel aria-label="Close">×</button>
          </div>
          ${message ? `<p class="acc-action-msg">${escHtml(message)}</p>` : ""}
          ${fieldMarkup}
          ${helperNote ? `<p class="acc-action-note">${escHtml(helperNote)}</p>` : ""}
          <p id="accActionError" class="acc-action-err" role="alert"></p>
          <div class="acc-action-btns">
            <button type="button" class="btn ghost" data-action-cancel>${escHtml(cancelText)}</button>
            <button type="submit" class="btn ${danger ? "acc-btn-danger" : ""}">${escHtml(confirmText)}</button>
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
  };
})();