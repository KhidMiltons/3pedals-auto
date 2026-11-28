/* 3 Pedals Auto KE — optional tracking consent.
   No analytics, advertising pixel or session replay script is requested before opt-in. */
(() => {
  "use strict";
  const KEY = "3pedals:privacy-consent:v1";
  const GTM_ID = "GTM-M8B39FNW";
  const META_PIXEL_ID = "1474861414573206";
  let banner;

  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "null");
      return value && value.version === 1 ? value.choice : null;
    } catch (_) { return null; }
  }
  function hasConsent() { return readChoice() === "accepted"; }

  function loadOptionalTags() {
    if (window.__threePedalsOptionalTagsLoaded) return;
    window.__threePedalsOptionalTagsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted"
    });
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const gtm = document.createElement("script");
    gtm.async = true;
    gtm.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(GTM_ID);
    document.head.appendChild(gtm);

    if (!window.fbq) {
      const fbq = window.fbq = function(){ fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = [];
    }
    window.fbq("init", META_PIXEL_ID);
    window.fbq("track", "PageView");
    const pixel = document.createElement("script");
    pixel.async = true;
    pixel.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(pixel);
  }

  function save(choice) {
    try {
      localStorage.setItem(KEY, JSON.stringify({version:1, choice, saved_at:new Date().toISOString()}));
    } catch (_) {}
    if (choice === "accepted") loadOptionalTags();
    else {
      if (typeof window.gtag === "function") {
        window.gtag("consent", "update", {
          analytics_storage: "denied", ad_storage: "denied",
          ad_user_data: "denied", ad_personalization: "denied"
        });
      }
      if (typeof window.fbq === "function") window.fbq("consent", "revoke");
    }
    if (banner) banner.remove();
    banner = null;
    window.dispatchEvent(new CustomEvent("3pedals:consent-changed", {detail:{choice}}));
  }

  function open() {
    if (banner) { banner.remove(); banner = null; }
    banner = document.createElement("section");
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "tp-consent-title");
    banner.style.cssText = "position:fixed;z-index:2147483000;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:760px;margin:0 auto;padding:20px;border:1px solid rgba(215,189,131,.35);border-radius:18px;background:rgba(15,17,20,.98);color:#f7f4ed;box-shadow:0 18px 60px rgba(0,0,0,.55);font:14px/1.6 Manrope,system-ui,sans-serif";
    const title = document.createElement("h2");
    title.id = "tp-consent-title";
    title.textContent = "Your privacy choices";
    title.style.cssText = "margin:0 0 8px;font:600 22px/1.2 Manrope,system-ui,sans-serif;color:#f7f4ed";
    const copy = document.createElement("p");
    copy.textContent = "Essential storage keeps sign-in, security, preferences and payments working. Optional Google Analytics 4 (through Google Tag Manager) and the Meta advertising pixel stay off unless you choose Accept. We do not currently detect a session-replay provider. You can change this choice later in Account Settings.";
    copy.style.cssText = "margin:0 0 14px;color:#c7c0b2";
    const links = document.createElement("p");
    links.style.cssText = "margin:0 0 14px";
    links.innerHTML = '<a href="/privacy.html" style="color:#d7bd83;text-decoration:underline">Privacy Policy</a> · <a href="/terms.html" style="color:#d7bd83;text-decoration:underline">Terms of Service</a>';
    const actions = document.createElement("div");
    actions.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:10px";
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
      banner.style.cssText = "position:fixed;z-index:2147483000;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:760px;margin:0 auto;padding:20px;border:1px solid rgba(138,114,62,.35);border-radius:18px;background:rgba(253,250,243,.98);color:#171512;box-shadow:0 18px 60px rgba(48,38,18,.18);font:14px/1.6 Manrope,system-ui,sans-serif";
      title.style.color = "#171512";
      copy.style.color = "#4f493e";
      links.innerHTML = '<a href="/privacy.html" style="color:#8c6510;text-decoration:underline">Privacy Policy</a> · <a href="/terms.html" style="color:#8c6510;text-decoration:underline">Terms of Service</a>';
    }
    const makeButton = (label, accepted) => {
      const button = document.createElement("button");
      button.type = "button";
      const icon = accepted
        ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>'
        : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>';
      button.innerHTML = `${icon}<span>${label}</span>`;
      if (accepted) {
        button.style.cssText = "min-height:48px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;border:1px solid #d7bd83;padding:11px 16px;font:700 14px Manrope,system-ui,sans-serif;cursor:pointer;background:#d7bd83;color:#111";
      } else {
        button.style.cssText = isLight
          ? "min-height:48px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;border:1px solid rgba(180,35,24,.38);padding:11px 16px;font:700 14px Manrope,system-ui,sans-serif;cursor:pointer;background:rgba(180,35,24,.09);color:#b42318"
          : "min-height:48px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;border:1px solid rgba(239,98,92,.45);padding:11px 16px;font:700 14px Manrope,system-ui,sans-serif;cursor:pointer;background:rgba(239,98,92,.12);color:#ff9d97";
      }
      button.addEventListener("click", () => save(accepted ? "accepted" : "rejected"));
      return button;
    };
    actions.append(makeButton("Accept optional cookies", true), makeButton("Reject optional cookies", false));
    banner.append(title, copy, links, actions);
    document.body.appendChild(banner);
  }

  window.ThreePedalsConsent = {hasConsent, open, accept:() => save("accepted"), reject:() => save("rejected"), getChoice:readChoice};
  const existing = readChoice();
  if (existing === "accepted") loadOptionalTags();
  if (!existing) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", open, {once:true});
    else open();
  }
})();