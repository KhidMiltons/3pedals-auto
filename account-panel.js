/* 3 Pedals Auto KE — standalone account dashboard shell.
   Account data, authentication and Supabase operations remain in the main app. */
(() => {
  "use strict";
  const mount = document.getElementById("accountPanelMount");
  if (!mount) return;
  // Keep the modal outside page-level stacking/transform contexts so it always
  // overlays the marketplace instead of appearing underneath it.
  if (mount.parentElement !== document.body) document.body.appendChild(mount);
  mount.innerHTML = `
    <dialog id="accDlg" class="account-dashboard-dialog" aria-label="3 Pedals account dashboard">
      <nav id="accountMenu" class="dashboard-shortcuts account-sidebar" aria-label="Account navigation" hidden>
        <div class="account-sidebar-brand">
          <img src="favicon.svg" alt="">
          <div><strong>3 PEDALS</strong><span>AUTO KE · ACCOUNT</span></div>
        </div>
        <div class="seller-nav-identity"><small>YOUR WORKSPACE</small><strong>Seller account</strong></div>
        <div class="seller-mode-switch">
          <button type="button" data-buying>Buying</button>
          <button type="button" class="selected" aria-current="page">Selling</button>
        </div>
        <div class="seller-nav-label">OVERVIEW</div>
        <button type="button" data-page="dashboard">Overview</button>
        <div class="seller-nav-label">MANAGE</div>
        <button type="button" data-page="listings">My Listings</button>
        <button type="button" data-page="promotions">Promotions</button>
        <button type="button" data-page="bookings">Garage Bookings</button>
        <div class="seller-nav-label">ACCOUNT</div>
        <button type="button" data-page="settings" data-account-tab="business">Profile</button>
        <button type="button" data-page="settings" data-account-tab="account">Settings</button>
        <button type="button" data-seller-signup>Create seller account</button>
        <div class="account-sidebar-footer"><button type="button" data-signout>Log out</button></div>
      </nav>
      <div class="in account-dashboard-main">
        <header class="account-dialog-head">
          <button id="accMenuToggle" type="button" aria-label="Open account menu" aria-expanded="false" aria-controls="accountMenu" onpointerup="window.toggleAccountMenu(event)" onclick="window.toggleAccountMenu(event)">Menu</button>
          <h2 class="account-brand-title">
            <img src="favicon.svg" alt="" class="account-brand-icon">
            <span>3 Pedals Auto KE</span>
          </h2>
          <button id="accHomeTop" type="button" aria-label="Return to homepage" title="Return to homepage">Home</button>
          <button id="accCloseTop" type="button" aria-label="Close account" title="Close account">×</button>
        </header>
        <div id="accBody" aria-live="polite"></div>
      </div>
    </dialog>`;
})();
