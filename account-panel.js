/* 3 Pedals Auto KE — Account Workspace Shell (Dual-Theme: Dark Obsidian & Light Parchment) */
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
        <div id="accBody" aria-live="polite"></div>
      </section>
    </dialog>`;
})();