(() => {
  const RENDER_API_URL = "https://threepedals-auto.onrender.com";
  const API_BASE_URL = /(^|\.)3pedalsauto\.co\.ke$|github\.io$/i.test(location.hostname)
    ? RENDER_API_URL
    : "";
  if (window.__ThreePedalsUXLoaded) return;
  window.__ThreePedalsUXLoaded = true;

  const THEME_KEY = "3pedals:theme";
  const LANG_KEY = "3pedals:lang";
  const RECENT_VEHICLES_KEY = "3pedals:recently-viewed";
  const RECENT_ARTICLES_KEY = "3pedals:journal-recent-reads";
  const NEWSLETTER_KEY = "3pedals:newsletter";

  const DICT = {
    en: {
      home: "Home",
      about: "About Us",
      contact: "Contact Us",
      buyCar: "Buy Car",
      carsForSale: "Inventory",
      garage: "Garage",
      chauffeur: "Chauffeur",
      dealers: "Dealers",
      journal: "Journal",
      account: "Account",
      myAccount: "My Account",
      backHome: "← Home",
      backDealers: "← Back to Dealers",
      backCompact: "← Back",
      themeDark: "Dark mode",
      themeLight: "Daylight mode",
      backToTop: "Back to top",
      searchVehiclesPlaceholder: "Search make, model, year, location…",
      searchDealersPlaceholder: "Search car yards or dealers…",
      searchYardPlaceholder: "Search this yard’s vehicles",
      recentlyViewedTitle: "Recently Viewed",
      recentlyViewedSub: "Vehicles you opened recently on this device.",
      clearHistory: "Clear history",
      recentReadsTitle: "Recent Reads",
      recentReadsSub: "Articles you opened recently.",
      minRead: "min read",
      wordsLabel: "words",
      printSpecSheet: "Print Spec Sheet (A4)",
      previewA4: "Preview A4",
      hideA4: "Hide Preview",
      nlKicker: "Weekly Automotive Insights",
      nlTitle: "Weekly Auto Insights",
      nlDesc: "Weekly yard arrivals, Kenya import duty shifts, inspection tips, and verified price drops from 3 Pedals Auto KE.",
      nlEmailPlaceholder: "Enter your email address",
      nlSubscribe: "Subscribe",
      nlTopicsLabel: "Focus topics",
      nlTopicArrivals: "New Yard Arrivals",
      nlTopicDuty: "Import Duty Updates",
      nlTopicDrops: "Price Drops",
      nlInvalidEmail: "Enter a valid email address to subscribe.",
      nlSyncing: "Subscribing…",
      nlSuccess: "Subscribed to Weekly Automotive Insights.",
      nlEditPrefs: "Update preferences",
      nlUnsubscribe: "Unsubscribe",
      nlSubscribedBadge: "Active weekly insights subscription"
    },
    sw: {
      home: "Mwanzo",
      about: "Kuhusu Sisi",
      contact: "Wasiliana Nasi",
      buyCar: "Nunua Gari",
      carsForSale: "Orodha ya Magari",
      garage: "Gereji",
      chauffeur: "Huduma ya Dereva",
      dealers: "Wauzaji",
      journal: "Jarida",
      account: "Akaunti",
      myAccount: "Akaunti Yangu",
      backHome: "← Mwanzo",
      backDealers: "← Rudi kwa Wauzaji",
      backCompact: "← Rudi",
      themeDark: "Mandhari ya Usiku",
      themeLight: "Mandhari ya Mchana",
      backToTop: "Rudi juu",
      searchVehiclesPlaceholder: "Tafuta aina, modeli, mwaka, eneo…",
      searchDealersPlaceholder: "Tafuta yadi za magari au wauzaji…",
      searchYardPlaceholder: "Tafuta magari ya yadi hii",
      recentlyViewedTitle: "Uliyotazama Hivi Karibuni",
      recentlyViewedSub: "Magari 5 ya mwisho uliyoyafungua kwenye kifaa hiki.",
      clearHistory: "Futa historia",
      recentReadsTitle: "Makala Ulizosoma Hivi Karibuni",
      recentReadsSub: "Makala ulizofungua hivi karibuni.",
      minRead: "dakika za kusoma",
      wordsLabel: "maneno",
      printSpecSheet: "Chapisha Karatasi (A4)",
      previewA4: "Hakiki A4",
      hideA4: "Ficha Hakikisho",
      nlKicker: "Maarifa ya Kila Wiki",
      nlTitle: "Maarifa ya Magari ya Kila Wiki",
      nlDesc: "Magari mapya yardini kila wiki, mabadiliko ya ushuru wa kuagiza Kenya, vidokezo vya ukaguzi, na punguzo la bei kutoka 3 Pedals Auto KE.",
      nlEmailPlaceholder: "Weka barua pepe yako",
      nlSubscribe: "Jisajili",
      nlTopicsLabel: "Mada unazopendelea",
      nlTopicArrivals: "Magari Mapya Yardini",
      nlTopicDuty: "Taarifa za Ushuru",
      nlTopicDrops: "Punguzo la Bei",
      nlInvalidEmail: "Tafadhali weka anwani sahihi ya barua pepe.",
      nlSyncing: "Inasajili…",
      nlSuccess: "Umejisajili kupokea Maarifa ya Magari ya Kila Wiki.",
      nlEditPrefs: "Hariri mapendeleo",
      nlUnsubscribe: "Jiondoe",
      nlSubscribedBadge: "Usajili wa kila wiki upo hai"
    }
  };

  function getTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {}
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    const t = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    document.documentElement.dataset.ux = "1";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "light" ? "#f4efe4" : "#0d0d0d");
    try { localStorage.setItem(THEME_KEY, t); } catch (_) {}
    syncThemeButtons(t);
    window.dispatchEvent(new CustomEvent("3pedals:theme-changed", { detail: { theme: t } }));
    return t;
  }

  function getLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "sw" || saved === "en") return saved;
    } catch (_) {}
    return "en";
  }

  function t(key) {
    const lang = getLang();
    return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
  }

  function themeIconSvg(theme) {
    if (theme === "light") {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  }

  const UX_ICONS = {
    car: '<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13"/><rect x="3" y="13" width="18" height="5" rx="2"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="16.5" cy="18" r="1.5"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".75" fill="currentColor" stroke="none"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pin: '<path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    layers: '<path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
    tag: '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><circle cx="12" cy="8.5" r=".75" fill="currentColor" stroke="none"/>',
    shield: '<path d="M12 3 4 6.5v5.3c0 4.8 3.4 9 8 10.2 4.6-1.2 8-5.4 8-10.2V6.5L12 3Z"/><path d="m9.5 12 1.8 1.8 3.5-3.6"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevLeft: '<path d="m15 18-6-6 6-6"/>',
    chevRight: '<path d="m9 18 6-6-6-6"/>'
  };

  function uxIcon(name, size = 18) {
    const body = UX_ICONS[name] || UX_ICONS.info;
    return `<svg class="ux-svg-icon" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function homeIconSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.8V19.5A1.5 1.5 0 0 0 7 21h3.5v-5a1.5 1.5 0 0 1 3 0v5H17a1.5 1.5 0 0 0 1.5-1.5V9.8"/></svg>';
  }

  function syncThemeButtons(theme) {
    document.querySelectorAll("[data-ux-theme-toggle]").forEach((btn) => {
      const nextLabel = theme === "light" ? t("themeDark") : t("themeLight");
      btn.setAttribute("aria-label", nextLabel);
      btn.setAttribute("title", nextLabel);
      btn.setAttribute("aria-pressed", String(theme === "light"));
      btn.innerHTML = `${themeIconSvg(theme)}<span class="ux-theme-text">${theme === "light" ? (getLang() === "sw" ? "Usiku" : "Dark") : (getLang() === "sw" ? "Mchana" : "Light")}</span>`;
    });
  }

  function applyLanguage(lang) {
    const code = lang === "sw" ? "sw" : "en";
    try { localStorage.setItem(LANG_KEY, code); } catch (_) {}
    document.documentElement.lang = code;

    document.querySelectorAll("[data-ux-lang]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.uxLang === code));
    });

    // Translate explicit i18n keys
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.dataset.i18n;
      if (k && DICT[code][k]) el.textContent = DICT[code][k];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const k = el.dataset.i18nPlaceholder;
      if (k && DICT[code][k]) el.setAttribute("placeholder", DICT[code][k]);
    });

    // Translate well-known nav items across pages non-destructively
    const navMap = [
      { sel: '#nav [data-tab="home"], #garageSectionNav [data-tab="home"]', key: "home" },
      { sel: '#nav [data-tab="about"]', key: "about" },
      { sel: '#nav [data-tab="contact"]', key: "contact" },
      { sel: '#nav a[href*="inventory"], #garageSectionNav a[href*="inventory"]', key: "carsForSale" },
      { sel: '#nav a[href*="garage"]', key: "garage" },
      { sel: '#nav a[href*="chauffeur"]', key: "chauffeur" },
      { sel: '#nav a[href*="dealers"]', key: "dealers" },
      { sel: '.account-pill span', key: "account" },
      { sel: '#garageSectionNav [data-tab="services"], #garageSectionNav [data-tab="book"]', key: null, en: "Services & booking", sw: "Huduma na miadi" },
      { sel: '#garageSectionNav [data-tab="roadside"]', key: null, en: "Mobile mechanic", sw: "Mekanika wa kufika" },
      { sel: '#garageSectionNav [data-tab="mechanics"]', key: null, en: "Verified mechanics", sw: "Mamekanika" },
      { sel: '#garageSectionNav #cLink', key: "carsForSale" },
      { sel: '#q, #inventorySearch', attr: "placeholder", key: "searchVehiclesPlaceholder" },
      { sel: '#dealerSearch', attr: "placeholder", key: "searchDealersPlaceholder" },
      { sel: '#yardVehicleSearch', attr: "placeholder", key: "searchYardPlaceholder" },
      { sel: '#vehiclePrintA4Btn', key: "printSpecSheet" }
    ];
    const accountOpenBtn = document.getElementById("accountOpen");
    if (accountOpenBtn) {
      accountOpenBtn.setAttribute("data-ux-account-label", DICT[code].account);
    }
    navMap.forEach((item) => {
      document.querySelectorAll(item.sel).forEach((el) => {
        if (item.attr === "placeholder") {
          el.setAttribute("placeholder", DICT[code][item.key]);
        } else if (item.key) {
          el.textContent = DICT[code][item.key];
        } else {
          el.textContent = item[code];
        }
      });
    });

    // Key hero CTAs on index
    const browseCta = document.querySelector('#home [data-go="buy"], #home a[href="/inventory.html"]');
    if (browseCta && !browseCta.dataset.origEn) browseCta.dataset.origEn = browseCta.textContent.trim();
    const sellCta = document.querySelector('#home [data-go="sell"]');
    if (sellCta && !sellCta.dataset.origEn) sellCta.dataset.origEn = sellCta.textContent.trim();

    if (browseCta && browseCta.dataset.origEn) {
      browseCta.textContent = code === "sw" ? DICT.sw.carsForSale : browseCta.dataset.origEn;
    }
    if (sellCta && sellCta.dataset.origEn) {
      sellCta.textContent = code === "sw" ? "Uza Gari" : sellCta.dataset.origEn;
    }
    const inspectCta = document.getElementById("heroBookInspectionBtn");
    if (inspectCta) {
      if (!inspectCta.dataset.origEn) inspectCta.dataset.origEn = inspectCta.textContent.trim();
      inspectCta.textContent = code === "sw" ? "Weka miadi ya ukaguzi" : inspectCta.dataset.origEn;
    }

    syncThemeButtons(getTheme());
    const topLabel = document.querySelector("#uxBackToTop span");
    if (topLabel) topLabel.textContent = t("backToTop");
    const topBtn = document.getElementById("uxBackToTop");
    if (topBtn) topBtn.setAttribute("aria-label", t("backToTop"));

    refreshFooterNewsletterCopy();
    const homeRecentHost = document.getElementById("homeRecentViewedSection");
    if (homeRecentHost) renderRecentlyViewed(homeRecentHost);
    syncBackButtonsForViewport();
    window.dispatchEvent(new CustomEvent("3pedals:lang-changed", { detail: { lang: code } }));
  }

  function syncBackButtonsForViewport() {
    const isCompact = window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
    document.querySelectorAll("body > header .back, body > .wrap > header.top .back").forEach((el) => {
      if (!el.dataset.uxFullLabel) {
        const raw = el.textContent.replace(/\s+/g, " ").trim();
        if (raw) el.dataset.uxFullLabel = raw;
      }
      const full = el.dataset.uxFullLabel || el.textContent.replace(/\s+/g, " ").trim();
      const href = (el.getAttribute("href") || "").toLowerCase();
      const isHomeBack =
        el.classList.contains("ux-home-icon-btn") ||
        el.classList.contains("home-link") ||
        /^\s*(?:←|\u2190|&larr;)?\s*(?:home|nyumbani|mwanzo)\s*$/i.test(full);

      if (isHomeBack) {
        el.classList.add("ux-home-icon-btn");
        const homeLabel = t("home");
        el.setAttribute("aria-label", homeLabel);
        el.setAttribute("title", homeLabel);
        if (!el.querySelector("svg")) {
          el.innerHTML = homeIconSvg();
        }
        return;
      }

      if (/(?:^|\/)dealers\.html(?:[?#]|$)/.test(href) || /\bback\s+to\s+dealers?\b/i.test(full)) {
        el.classList.add("ux-back-dealers");
      }
      if (/^\s*(?:←|&larr;)?\s*back\s+to\b/i.test(full)) {
        if (!el.getAttribute("aria-label")) {
          el.setAttribute("aria-label", full.replace(/^[←\u2190]\s*/, ""));
        }
        el.textContent = isCompact ? t("backCompact") : full;
      }
    });
  }

  function syncFooterCopyrightYears() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll("[data-ux-year]").forEach((el) => {
      if (el.textContent !== year) el.textContent = year;
    });
  }

  function createControlsMarkup(compactOnly) {
    const theme = getTheme();
    const lang = getLang();
    return `
      <div class="ux-controls">
        <button type="button" class="ux-theme-btn" data-ux-theme-toggle aria-pressed="${theme === "light"}" aria-label="${t(theme === "light" ? "themeDark" : "themeLight")}">
          ${themeIconSvg(theme)}<span class="ux-theme-text">${theme === "light" ? "Dark" : "Light"}</span>
        </button>
        ${compactOnly ? "" : `
        <div class="ux-lang-switch" role="group" aria-label="Language switcher">
          <button type="button" data-ux-lang="en" aria-pressed="${lang === "en"}">EN</button>
          <button type="button" data-ux-lang="sw" aria-pressed="${lang === "sw"}">SW</button>
        </div>`}
      </div>
    `;
  }

  function initHeaderControls() {
    const header = document.querySelector("body > header, body > .wrap > header.top");
    if (!header) return;
    const path = location.pathname.toLowerCase();

    const homeNav = header.querySelector("#nav");
    const garageNav = header.querySelector("#garageSectionNav");
    const chauffeurNav = header.querySelector("#chauffeurNav");

    if (homeNav || garageNav) {
      const wrap = header.querySelector(".wrap") || header;
      const targetDrawer = homeNav || garageNav;
      // Add controls inside mobile drawer too
      if (!targetDrawer.querySelector(".ux-drawer-controls")) {
        const drawerDiv = document.createElement("div");
        drawerDiv.className = "ux-drawer-controls";
        drawerDiv.innerHTML = createControlsMarkup(false);
        targetDrawer.appendChild(drawerDiv);
      }

      // Unified right-side action cluster: [Theme + Lang] + [Account] + [Mobile Toggle]
      let actions = wrap.querySelector(".ux-header-actions");
      if (!actions) {
        actions = document.createElement("div");
        actions.className = "ux-header-actions";
        wrap.appendChild(actions);
      }
      if (!actions.querySelector(".ux-header-controls-desktop")) {
        const host = document.createElement("div");
        host.className = "ux-header-controls-desktop";
        host.innerHTML = createControlsMarkup(false);
        actions.appendChild(host);
      }
      const accountPill = header.querySelector(".account-pill");
      if (accountPill && accountPill.parentElement !== actions) {
        actions.appendChild(accountPill);
      }
      const accountOpenBtn = header.querySelector("#accountOpen");
      if (accountOpenBtn) {
        accountOpenBtn.setAttribute("data-ux-account-label", t("account"));
      }
      const toggle = header.querySelector("#navToggle, #garageNavToggle");
      if (toggle && toggle.parentElement !== actions) {
        actions.appendChild(toggle);
      }

      const syncAccountPlacement = () => {
        if (!accountPill) return;
        const isCompact = window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
        const drawerControlsWrap = targetDrawer.querySelector(".ux-drawer-controls");
        if (isCompact && drawerControlsWrap) {
          if (accountPill.parentElement !== targetDrawer || accountPill.nextElementSibling !== drawerControlsWrap) {
            targetDrawer.insertBefore(accountPill, drawerControlsWrap);
          }
        } else if (actions) {
          if (toggle && toggle.parentElement === actions) {
            actions.insertBefore(accountPill, toggle);
          } else if (accountPill.parentElement !== actions) {
            actions.appendChild(accountPill);
          }
        }
      };

      if (accountOpenBtn && accountOpenBtn.dataset.uxDrawerCloseBound !== "1") {
        accountOpenBtn.dataset.uxDrawerCloseBound = "1";
        accountOpenBtn.addEventListener("click", () => {
          targetDrawer.classList.remove("is-open", "mobile-menu-open");
          document.body.classList.remove("nav-open");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
        });
      }

      syncAccountPlacement();
      window.matchMedia?.("(max-width: 1023px)")?.addEventListener("change", syncAccountPlacement);
    } else if (!chauffeurNav) {
      // Subpages: inventory, vehicle, dealers, yard, journal, chauffeur, vehicle_documents
      const container = header.querySelector(".wrap, .headin") || header;
      if (container && !container.querySelector(".ux-header-right")) {
        const isCurrent = (p) => path.endsWith(p);
        const rightGroup = document.createElement("div");
        rightGroup.className = "ux-header-right";

        const subnav = document.createElement("nav");
        subnav.className = "ux-subnav-links";
        subnav.setAttribute("aria-label", "Quick navigation");
        const links = [
          { href: "/", label: "home", cur: path === "/" || path.endsWith("/index.html") },
          { href: "/inventory.html", label: "carsForSale", cur: isCurrent("inventory.html") },
          { href: "/garage.html", label: "garage", cur: isCurrent("garage.html") },
          { href: "/chauffeur.html", label: "chauffeur", cur: isCurrent("chauffeur.html") },
          { href: "/dealers.html", label: "dealers", cur: isCurrent("dealers.html") || isCurrent("yard.html") },
          { href: "/journal.html", label: "journal", cur: isCurrent("journal.html") }
        ];
        subnav.innerHTML =
          links
            .map((l) => `<a class="ux-subnav-link" href="${l.href}" data-i18n="${l.label}"${l.cur ? ' aria-current="page"' : ""}>${t(l.label)}</a>`)
            .join("") +
          `<div class="ux-drawer-controls">${createControlsMarkup(false)}</div>`;

        const controlsWrap = document.createElement("div");
        controlsWrap.innerHTML = createControlsMarkup(false);
        const controls = controlsWrap.firstElementChild;

        // Collect existing Back button/nav inside container
        const existingBack = container.querySelector(":scope > .back, :scope > .headnav, :scope > .vehicle-header-nav");

        const mobileToggle = document.createElement("button");
        mobileToggle.type = "button";
        mobileToggle.className = "ux-mobile-subtoggle";
        mobileToggle.setAttribute("aria-label", "Toggle site navigation");
        mobileToggle.setAttribute("aria-expanded", "false");
        mobileToggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

        rightGroup.appendChild(controls);
        if (existingBack) {
          if (existingBack.classList.contains("vehicle-header-nav") || existingBack.classList.contains("headnav")) {
            const backOnly = existingBack.querySelector(".back");
            if (backOnly) {
              backOnly.style.marginLeft = "0";
              rightGroup.appendChild(backOnly);
            }
            existingBack.remove();
          } else {
            existingBack.style.marginLeft = "0";
            rightGroup.appendChild(existingBack);
          }
        }
        rightGroup.appendChild(mobileToggle);
        container.appendChild(subnav);
        container.appendChild(rightGroup);

        const closeSub = () => {
          subnav.classList.remove("is-open");
          mobileToggle.setAttribute("aria-expanded", "false");
        };
        mobileToggle.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const open = subnav.classList.toggle("is-open");
          mobileToggle.setAttribute("aria-expanded", String(open));
        });
        subnav.addEventListener("click", (e) => {
          if (!e.target.closest(".ux-drawer-controls") && e.target.closest("a")) closeSub();
        });
        document.addEventListener("click", (e) => {
          if (!subnav.contains(e.target) && !mobileToggle.contains(e.target)) closeSub();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") closeSub();
        });
        window.matchMedia("(min-width: 1024px)").addEventListener("change", (ev) => {
          if (ev.matches) closeSub();
          syncBackButtonsForViewport();
        });
      }
    }

    syncBackButtonsForViewport();
    window.matchMedia?.("(max-width: 1023px)")?.addEventListener("change", syncBackButtonsForViewport);

    // Bind global delegated clicks for theme & language switchers
    document.addEventListener("click", (e) => {
      const themeBtn = e.target.closest("[data-ux-theme-toggle]");
      if (themeBtn) {
        e.preventDefault();
        const next = getTheme() === "light" ? "dark" : "light";
        applyTheme(next);
        return;
      }
      const langBtn = e.target.closest("[data-ux-lang]");
      if (langBtn) {
        e.preventDefault();
        applyLanguage(langBtn.dataset.uxLang);
      }
    });
  }

  function initBackToTop() {
    if (document.getElementById("uxBackToTop")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "uxBackToTop";
    btn.className = "ux-back-to-top no-print";
    btn.setAttribute("aria-label", t("backToTop"));
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 15l-6-6-6 6"/></svg><span>${t("backToTop")}</span>`;
    document.body.appendChild(btn);

    btn.addEventListener("click", () => {
      const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });

    const hero = document.querySelector(".hero, .intro, #profile, article.article");
    let heroOut = false;

    const update = () => {
      const visible = heroOut || window.scrollY > 340;
      btn.classList.toggle("is-visible", visible);
    };

    if (hero && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            heroOut = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            update();
          });
        },
        { threshold: 0.05 }
      );
      io.observe(hero);
    }

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(() => {
            ticking = false;
            update();
          });
        }
      },
      { passive: true }
    );
    update();
  }

  // ===== Footer Newsletter ("Auto Market Briefing") =====
  function getNewsletterState() {
    try {
      const raw = JSON.parse(localStorage.getItem(NEWSLETTER_KEY) || "null");
      if (raw && raw.email) return raw;
    } catch (_) {}
    return null;
  }

  function renderNewsletterBox(container) {
    if (!container) return;
    const saved = getNewsletterState();
    const lang = getLang();
    const topicsList = [
      { id: "arrivals", key: "nlTopicArrivals" },
      { id: "duty", key: "nlTopicDuty" },
      { id: "drops", key: "nlTopicDrops" }
    ];
    const selectedTopics = saved?.topics || ["arrivals", "drops"];

    if (saved && !container.dataset.editing) {
      const topicNames = selectedTopics
        .map((id) => {
          const item = topicsList.find((x) => x.id === id);
          return item ? t(item.key) : id;
        })
        .join(" · ");
      container.innerHTML = `
        <div class="ux-nl-copy">
          <div class="ux-nl-header">
            <span class="ux-nl-kicker">${t("nlKicker")}</span>
            <button type="button" class="ux-nl-lang-mini" data-ux-lang="${lang === "en" ? "sw" : "en"}">${lang === "en" ? "SW" : "EN"}</button>
          </div>
          <h3>${t("nlTitle")}</h3>
          <p>${t("nlDesc")}</p>
        </div>
        <div class="ux-nl-confirmed" role="status" aria-live="polite">
          <div>
            <strong>${t("nlSubscribedBadge")}</strong><br>
            <span>${escapeHtml(saved.email)}${topicNames ? " — " + escapeHtml(topicNames) : ""}</span>
          </div>
          <div class="ux-nl-confirmed-actions">
            <button type="button" data-nl-edit>${t("nlEditPrefs")}</button>
            <button type="button" data-nl-unsub>${t("nlUnsubscribe")}</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="ux-nl-copy">
          <div class="ux-nl-header">
            <span class="ux-nl-kicker">${t("nlKicker")}</span>
            <button type="button" class="ux-nl-lang-mini" data-ux-lang="${lang === "en" ? "sw" : "en"}">${lang === "en" ? "SW" : "EN"}</button>
          </div>
          <h3>${t("nlTitle")}</h3>
          <p>${t("nlDesc")}</p>
        </div>
        <form class="ux-nl-form" novalidate>
          <div class="ux-nl-topics" role="group" aria-label="${t("nlTopicsLabel")}">
            ${topicsList
              .map(
                (topic) => `
              <label class="ux-nl-topic">
                <input type="checkbox" name="nlTopic" value="${topic.id}" ${selectedTopics.includes(topic.id) ? "checked" : ""}>
                <span>${t(topic.key)}</span>
              </label>`
              )
              .join("")}
          </div>
          <div class="ux-nl-row">
            <input type="email" name="nlEmail" value="${escapeHtml(saved?.email || "")}" placeholder="${t("nlEmailPlaceholder")}" aria-label="${t("nlEmailPlaceholder")}" required>
            <button type="submit" class="ux-nl-submit">${t("nlSubscribe")}</button>
          </div>
          <p class="ux-nl-status" role="status" aria-live="polite"></p>
        </form>
      `;
    }
  }

  function refreshFooterNewsletterCopy() {
    document.querySelectorAll(".ux-footer-newsletter").forEach((box) => renderNewsletterBox(box));
  }

  function initFooterNewsletter() {
    let footer =
      document.querySelector("body > footer") ||
      document.querySelector("footer:not(.a4-bottom-row)");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "ux-site-footer no-print";
      document.body.appendChild(footer);
    } else {
      if (footer.parentElement !== document.body) {
        document.body.appendChild(footer);
      }
      footer.classList.add("ux-site-footer", "no-print");
    }

    if (footer.querySelector(".ux-footer-newsletter")) return;

    const year = String(new Date().getFullYear());
    const existingLegal = footer.innerHTML;
    let brandHtml = '3 Pedals Auto KE';
    if (existingLegal && existingLegal.trim()) {
      const temp = document.createElement("div");
      temp.innerHTML = existingLegal;
      const brandSpan = temp.querySelector("#footerBrand");
      const noteWrap = temp.querySelector("#footerNoteWrap");
      const noteSpan = temp.querySelector("#footerNote");
      if (brandSpan || noteSpan || noteWrap) {
        const b = brandSpan ? brandSpan.outerHTML : '<span id="footerBrand">3 Pedals Auto KE</span>';
        const noteText = (noteSpan?.textContent || "").replace(/^\s*Prices in KES\.?\s*$/i, "").trim();
        if (noteSpan) noteSpan.textContent = noteText;
        if (noteWrap) {
          noteWrap.hidden = !noteText;
          brandHtml = `${b}${noteWrap.outerHTML}`;
        } else if (noteSpan) {
          brandHtml = `${b}<span id="footerNoteWrap"${noteText ? "" : " hidden"}> · ${noteSpan.outerHTML}</span>`;
        } else {
          brandHtml = b;
        }
      } else {
        temp.querySelectorAll(".legal-footer-links, a, button, br").forEach((el) => el.remove());
        const cleanText = temp.textContent
          .replace(/\s+/g, " ")
          .replace(/(?:\s*·\s*)?Prices in KES\.?/gi, "")
          .replace(/^©\s*(?:\d{4}\s*)?/, "")
          .replace(/[·|\-\s]+$/g, "")
          .trim();
        if (cleanText) {
          brandHtml = escapeHtml(cleanText);
        }
      }
    }

    footer.innerHTML = `
      <div class="ux-footer-inner">
        <section class="ux-footer-newsletter" aria-label="Weekly Automotive Insights Newsletter"></section>
        <div class="ux-footer-legal">
          <div>© <span data-ux-year>${year}</span> ${brandHtml}</div>
          <div class="legal-footer-links">
            <a href="/privacy.html">Privacy Policy</a> ·
            <a href="/terms.html">Terms of Service</a> ·
            <button type="button" onclick="window.ThreePedalsConsent?.open()">Cookie preferences</button>
          </div>
        </div>
      </div>
    `;

    syncFooterCopyrightYears();

    const box = footer.querySelector(".ux-footer-newsletter");
    renderNewsletterBox(box);

    async function callNewsletterEdge(payload) {
      const cfg = window.SB_CONFIG || {};
      const sbUrl = String(cfg.url || "").replace(/\/+$/, "");
      const sbKey = String(cfg.key || "");
      if (!sbUrl || !sbKey || /^PASTE/i.test(sbUrl)) {
        return { ok: false, skipped: true, status: 0 };
      }
      const ctrl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 9000) : 0;
      try {
        const res = await fetch(`${sbUrl}/functions/v1/newsletter-subscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`
          },
          body: JSON.stringify(payload),
          signal: ctrl?.signal
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch (err) {
        return { ok: false, status: 0, error: err?.message || "Network error" };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    footer.addEventListener("submit", async (e) => {
      const form = e.target.closest(".ux-nl-form");
      if (!form) return;
      e.preventDefault();
      const emailInput = form.querySelector('input[name="nlEmail"]');
      const submitBtn = form.querySelector('button[type="submit"]');
      const statusEl = form.querySelector(".ux-nl-status");
      const email = (emailInput?.value || "").trim().toLowerCase();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!emailValid) {
        statusEl.className = "ux-nl-status is-error";
        statusEl.textContent = t("nlInvalidEmail");
        emailInput?.focus();
        return;
      }
      const topics = [...form.querySelectorAll('input[name="nlTopic"]:checked')].map((el) => el.value);
      const cleanTopics = topics.length ? topics : ["arrivals"];
      const payload = {
        email,
        topics: cleanTopics,
        cadence: "weekly",
        lang: getLang(),
        action: "subscribe",
        source: "footer"
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = t("nlSyncing");
      }
      statusEl.className = "ux-nl-status";
      statusEl.textContent = "";

      const edgeRes = await callNewsletterEdge(payload);
      if (!edgeRes.ok && (edgeRes.status === 400 || edgeRes.status === 422)) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = t("nlSubscribe");
        }
        statusEl.className = "ux-nl-status is-error";
        statusEl.textContent = edgeRes.data?.error || t("nlInvalidEmail");
        emailInput?.focus();
        return;
      }

      const record = {
        email,
        topics: cleanTopics,
        cadence: "weekly",
        lang: getLang(),
        edgeSynced: Boolean(edgeRes.ok),
        subscribedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(record));
      } catch (_) {}
      delete box.dataset.editing;
      renderNewsletterBox(box);
    });

    footer.addEventListener("click", async (e) => {
      if (e.target.closest("[data-nl-edit]")) {
        box.dataset.editing = "1";
        renderNewsletterBox(box);
        return;
      }
      const unsubBtn = e.target.closest("[data-nl-unsub]");
      if (unsubBtn) {
        const saved = getNewsletterState();
        unsubBtn.disabled = true;
        if (saved?.email) {
          await callNewsletterEdge({
            email: saved.email,
            action: "unsubscribe",
            lang: getLang(),
            source: "footer"
          });
        }
        try { localStorage.removeItem(NEWSLETTER_KEY); } catch (_) {}
        delete box.dataset.editing;
        renderNewsletterBox(box);
      }
    });
  }

  // ===== Recently Viewed Vehicles (localStorage) =====
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const MAX_RECENT_VEHICLES = 5;
  const LOCAL_BOOKINGS_KEY = "3pedals:inspection-bookings:v1";
  const LOCAL_CALLBACKS_KEY = "3pedals:mechanic-callbacks:v1";

  function buildVehicleCacheSnapshot(item) {
    if (window.ThreePedalsLogic?.buildVehicleCacheRow) {
      return window.ThreePedalsLogic.buildVehicleCacheRow(item);
    }
    if (!item || !item.id) return null;
    const seller = item.seller && typeof item.seller === "object" ? item.seller : {};
    let make = String(item.make || "").trim();
    let model = String(item.model || "").trim();
    let year = item.year || "";
    if ((!make || !model) && item.title) {
      const parts = String(item.title).trim().split(/\s+/);
      if (!year && /^\d{4}$/.test(parts[0] || "")) year = Number(parts.shift());
      if (!make && parts.length) make = parts.shift() || "";
      if (!model && parts.length) model = parts.join(" ");
    }
    const photos = Array.isArray(item.photos) && item.photos.length
      ? item.photos.filter((p) => typeof p === "string" && p.trim()).slice(0, 6)
      : item.photo
        ? [String(item.photo)]
        : [];
    const sellerType = item.seller_type || seller.type || (item.yard_name || seller.yard ? "yard" : "private");
    return {
      id: String(item.id),
      make: make || "Vehicle",
      model,
      year,
      price: Number(item.price || 0),
      km: Number(item.km || 0),
      fuel: String(item.fuel || ""),
      desc: String(item.desc ?? item.description ?? ""),
      description: String(item.description ?? item.desc ?? ""),
      photos,
      whatsapp: item.whatsapp || seller.whatsapp || "",
      seller_name: item.seller_name || seller.name || "",
      seller_phone: item.seller_phone || item.phone || seller.phone || "",
      seller_email: item.seller_email || item.email || seller.email || "",
      yard_name: item.yard_name || seller.yard || (sellerType === "yard" ? seller.name || "" : ""),
      yard_location: item.yard_location || item.location || seller.location || "",
      yard_web: item.yard_web || item.web || seller.web || "",
      yard_logo_url: item.yard_logo_url || item.seller_logo_url || seller.logo || "",
      contact: item.contact || seller.contact || "",
      seller_type: sellerType,
      status: String(item.status || "approved")
    };
  }

  function getRecentVehicles() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_VEHICLES_KEY) || "[]");
      return Array.isArray(list) ? list.filter((x) => x && x.id).slice(0, MAX_RECENT_VEHICLES) : [];
    } catch (_) {
      return [];
    }
  }

  function recordRecentVehicle(item) {
    if (!item || !item.id) return [];
    let next;
    if (window.ThreePedalsLogic?.recordRecentVehicleList) {
      next = window.ThreePedalsLogic.recordRecentVehicleList(getRecentVehicles(), item, MAX_RECENT_VEHICLES);
    } else {
      const photos = Array.isArray(item.photos)
        ? item.photos.filter((p) => typeof p === "string" && p.trim()).slice(0, 4)
        : item.photo
          ? [String(item.photo)]
          : [];
      const entry = {
        id: String(item.id),
        title: String(item.title || `${item.year || ""} ${item.make || ""} ${item.model || ""}`.trim() || "Vehicle"),
        make: item.make ? String(item.make) : "",
        model: item.model ? String(item.model) : "",
        year: item.year || "",
        price: Number(item.price || 0),
        km: Number(item.km || 0),
        fuel: String(item.fuel || ""),
        desc: String(item.desc ?? item.description ?? "").slice(0, 500),
        photo: String(item.photo || photos[0] || ""),
        photos,
        seller: item.seller && typeof item.seller === "object" ? item.seller : undefined,
        status: String(item.status || "approved"),
        viewedAt: Date.now()
      };
      next = [entry, ...getRecentVehicles().filter((x) => String(x.id) !== entry.id)].slice(0, MAX_RECENT_VEHICLES);
    }
    try { localStorage.setItem(RECENT_VEHICLES_KEY, JSON.stringify(next)); } catch (_) {}
    // Also prime vehicle.html cold-start cache so opening a recently viewed vehicle is instantaneous
    try {
      const snapshot = buildVehicleCacheSnapshot(item);
      if (snapshot) {
        const cacheKey = "3pedals:vehicle:v2:" + snapshot.id;
        const payload = JSON.stringify({ at: Date.now(), row: snapshot });
        localStorage.setItem(cacheKey, payload);
        sessionStorage.setItem(cacheKey, payload);
      }
    } catch (_) {}
    return next;
  }

  function clearRecentVehicles() {
    try { localStorage.removeItem(RECENT_VEHICLES_KEY); } catch (_) {}
  }

  function warmVehicleAssets(car) {
    if (!car || !car.id) return;
    try {
      const cacheKey = "3pedals:vehicle:v2:" + String(car.id);
      if (!localStorage.getItem(cacheKey)) {
        const snapshot = buildVehicleCacheSnapshot(car);
        if (snapshot) {
          const payload = JSON.stringify({ at: Date.now(), row: snapshot });
          localStorage.setItem(cacheKey, payload);
        }
      }
    } catch (_) {}
    if (car.photo && typeof Image === "function") {
      const pre = new Image();
      pre.decoding = "async";
      pre.src = car.photo;
    }
  }

  function renderRecentlyViewed(hostEl, options = {}) {
    if (!hostEl) return;
    const excludeId = options.excludeId ? String(options.excludeId) : "";
    const items = getRecentVehicles()
      .filter((x) => !excludeId || String(x.id) !== excludeId)
      .slice(0, MAX_RECENT_VEHICLES);
    if (!items.length) {
      hostEl.hidden = true;
      hostEl.innerHTML = "";
      return;
    }
    hostEl.hidden = false;
    hostEl.className = "ux-recent-section no-print";
    hostEl.innerHTML = `
      <div class="ux-recent-head">
        <div>
          <h2>${t("recentlyViewedTitle")}</h2>
          <p class="meta" style="margin:3px 0 0">${t("recentlyViewedSub")}</p>
        </div>
        <button type="button" class="ux-clear-history ux-btn-danger" data-ux-clear-recent-vehicles>${uxIcon("trash", 15)}<span>${t("clearHistory")}</span></button>
      </div>
      <div class="ux-recent-grid">
        ${items
          .map(
            (car, idx) => `
          <a class="ux-recent-card" href="/vehicle.html?id=${encodeURIComponent(car.id)}" data-recent-vehicle-id="${escapeHtml(car.id)}">
            ${
              car.photo
                ? `<img class="ux-recent-thumb" src="${escapeHtml(car.photo)}" alt="${escapeHtml(car.title)}" loading="${idx < 3 ? "eager" : "lazy"}" decoding="async" fetchpriority="${idx === 0 ? "high" : "auto"}">`
                : `<div class="ux-recent-thumb-empty">3 Pedals Auto KE</div>`
            }
            <div class="ux-recent-body">
              <strong class="ux-recent-title">${escapeHtml(car.title)}</strong>
              <span class="ux-recent-price">KES ${Number(car.price || 0).toLocaleString("en-KE")}</span>
              <span class="ux-recent-meta">${Number(car.km || 0).toLocaleString("en-KE")} km${car.fuel ? " · " + escapeHtml(car.fuel) : ""}</span>
            </div>
          </a>`
          )
          .join("")}
      </div>
    `;
    // Proactively prime caches & first 2 thumbnails so clicking feels instantaneous on startup
    items.slice(0, 3).forEach(warmVehicleAssets);

    hostEl.querySelector("[data-ux-clear-recent-vehicles]")?.addEventListener("click", () => {
      clearRecentVehicles();
      renderRecentlyViewed(hostEl, options);
    });
    hostEl.querySelectorAll(".ux-recent-card").forEach((link) => {
      const id = link.dataset.recentVehicleId;
      const carObj = items.find((x) => String(x.id) === String(id));
      const primeOnIntent = () => {
        if (carObj) warmVehicleAssets(carObj);
      };
      link.addEventListener("pointerenter", primeOnIntent, { passive: true, once: true });
      link.addEventListener("touchstart", primeOnIntent, { passive: true, once: true });
      link.addEventListener("click", (e) => {
        if (carObj) {
          warmVehicleAssets(carObj);
          recordRecentVehicle(carObj);
        }
        if (typeof options.onSelect === "function" && id && options.onSelect(id, e)) {
          e.preventDefault();
        }
      });
    });
  }

  // ===== Journal Reading Progress Bar =====
  function mountReadingProgress(scrollEl, barEl) {
    if (!barEl) return () => {};
    let rafId = 0;
    const isWindow = !scrollEl || scrollEl === window || scrollEl === document.documentElement;
    const update = () => {
      rafId = 0;
      let scrollTop = 0;
      let maxScroll = 0;
      if (isWindow) {
        const doc = document.documentElement;
        scrollTop = window.scrollY || doc.scrollTop || 0;
        maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      } else {
        scrollTop = scrollEl.scrollTop || 0;
        maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      }
      const ratio = maxScroll > 12 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 1;
      const pct = Math.round(ratio * 1000) / 10;
      barEl.style.transform = `scaleX(${ratio})`;
      barEl.style.opacity = ratio > 0.01 ? "1" : "0.45";
      barEl.setAttribute("aria-valuenow", String(Math.round(pct)));
    };
    const schedule = () => {
      if (!rafId) rafId = requestAnimationFrame(update);
    };
    const target = isWindow ? window : scrollEl;
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    requestAnimationFrame(update);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }

  // ===== Unified Graphical Inspection Booking Modal (Calendar + Scope + Mechanic Callback) =====
  function readLocalBookingsMap() {
    const map = {};
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY) || "[]");
      if (Array.isArray(list)) {
        list.forEach((b) => {
          if (b && b.date && b.timeSlot) {
            if (!map[b.date]) map[b.date] = [];
            if (!map[b.date].includes(b.timeSlot)) map[b.date].push(b.timeSlot);
          }
        });
      }
    } catch (_) {}
    return map;
  }

  function mergeBookedMaps(a, b) {
    const out = {};
    [a, b].forEach((src) => {
      if (!src) return;
      Object.entries(src).forEach(([iso, slots]) => {
        if (!out[iso]) out[iso] = new Set();
        (Array.isArray(slots) ? slots : Array.from(slots || [])).forEach((s) => {
          if (s) out[iso].add(String(s).trim());
        });
      });
    });
    const plain = {};
    Object.entries(out).forEach(([k, v]) => { plain[k] = Array.from(v); });
    return plain;
  }

  function openInspectionBookingModal(opts = {}) {
    const c = opts.car;
    const dlg = opts.dialog || document.getElementById("inspectionBookingModal");
    if (!c || !dlg) return;
    dlg.classList.add("ux-inspect-modal");
    const sw = (opts.lang || getLang()) === "sw";
    if (c.isSold) {
      if (typeof opts.onNotice === "function") {
        opts.onNotice(sw ? "Gari hili tayari limeuzwa." : "This vehicle is already marked as sold.", { kind: "error" });
      }
      return;
    }

    const logic = window.ThreePedalsLogic;
    const ALL_SLOTS = logic?.INSPECTION_TIME_SLOTS || [
      "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"
    ];
    const SCOPE_PRESETS = logic?.INSPECTION_SCOPE_PRESETS || [
      "Engine only", "Full chassis", "Paintwork check", "OBD-II & Electronics", "Suspension & Brakes", "Road test"
    ];

    const now = new Date();
    const toIso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const minDate = toIso(now.getFullYear(), now.getMonth(), now.getDate());
    const nextWorkday = (() => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      if (d.getDay() === 0) d.setDate(d.getDate() + 1);
      return toIso(d.getFullYear(), d.getMonth(), d.getDate());
    })();

    const s = c.seller || {};
    const title = `${c.year || ""} ${c.make || ""} ${c.model || ""}`.trim() || "Vehicle";
    const photo = (c.photos && c.photos[0]) || c.photo || "";
    const vehicleRef = `3PA-${String(c.id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const sellerLabel = s.type === "yard"
      ? (s.yard || s.name || (sw ? "Yadi ya magari" : "Car yard"))
      : (s.name || (sw ? "Muuzaji binafsi" : "Private seller"));
    const locText = s.location ? ` · ${s.location}` : "";
    const defaultName = String(opts.defaultName || opts.profile?.name || opts.user?.user_metadata?.name || opts.user?.user_metadata?.full_name || "").trim();
    const defaultPhone = String(opts.defaultPhone || opts.profile?.phone || opts.user?.user_metadata?.phone || "").trim();
    const defaultEmail = String(opts.defaultEmail || opts.user?.email || "").trim();
    const businessWa = String(opts.businessWa || opts.siteSettings?.whatsapp_number || "254791961807").replace(/\D/g, "");
    const garageHref = opts.garageHref || `/garage.html?service=${encodeURIComponent("Pre-purchase inspection")}&car=${encodeURIComponent(title)}#book`;
    const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");

    let selectedDate = nextWorkday;
    let selectedSlot = "09:00 AM";
    let activeStep = "vehicle";
    const selParts = logic?.parseIsoDateParts?.(selectedDate);
    let viewYear = selParts ? selParts.year : now.getFullYear();
    let viewMonth = selParts ? selParts.monthIndex : now.getMonth();
    let bookedMap = readLocalBookingsMap();
    let slotsLoading = Boolean(opts.sb);

    const stepDefs = [
      { key: "vehicle", icon: "car", label: sw ? "Gari" : "Vehicle details" },
      { key: "scope", icon: "wrench", label: sw ? "Wigo" : "Inspection Scope" },
      { key: "schedule", icon: "calendar", label: sw ? "Ratiba" : "Schedule" },
      { key: "details", icon: "user", label: sw ? "Mawasiliano" : "Your details" }
    ];

    const serviceOptions = [
      {
        value: "Pre-purchase inspection",
        icon: "wrench",
        title: sw ? "Ukaguzi kwenye gereji ya 3 Pedals" : "Workshop bay inspection at 3 Pedals Garage",
        desc: sw
          ? "Inafanyika Kiambu Road na lifti kamili, ukaguzi wa chini ya gari, injini na mfumo wa breki."
          : "Full lift access, chassis underbody, compression check, and OBD-II scan at our Kiambu Road bay."
      },
      {
        value: "Mobile yard pre-purchase inspection",
        icon: "pin",
        title: sw ? "Mekanika aje kwenye yadi au kwa muuzaji" : "Mobile mechanic at seller or yard",
        desc: sw
          ? "Fundi wetu anakwenda alipo muuzaji au yadi kufanya ukaguzi na jaribio la barabarani."
          : "Our inspector travels directly to the car yard or seller address for on-site diagnostics and road test."
      }
    ];

    const mileageFormatted = `${fmtNum(c.km)} km`;
    const priceFormatted = `KES ${fmtNum(c.price)}`;
    const vehicleMetaText = sw
      ? `Mwendo: ${mileageFormatted} · Mafuta: ${c.fuel || "Petrol"} · Inatolewa na: ${sellerLabel}${locText}`
      : `Mileage: ${mileageFormatted} · Fuel: ${c.fuel || "Petrol"} · Offered by: ${sellerLabel}${locText}`;

    dlg.innerHTML = `
      <div class="ux-inspect-modal-shell">
        <div class="ux-inspect-topbar">
          <div class="ux-inspect-modal-head">
            <div>
              <span class="eyebrow">${uxIcon("shield", 14)} <span>${sw ? "UKAGUZI WA 3 PEDALS GARAGE" : "3 PEDALS GARAGE INSPECTION"} · ${escapeHtml(vehicleRef)}</span></span>
              <h2 id="inspectionBookingTitle">${sw ? "Weka Miadi ya Ukaguzi" : "Book Vehicle Inspection"}</h2>
            </div>
            <button type="button" class="ux-inspect-modal-close" id="closeInspectModalBtn" aria-label="${sw ? "Funga dirisha la ukaguzi" : "Close inspection booking"}">${uxIcon("close", 18)}</button>
          </div>

          <div class="ux-inspect-progress" id="inspectProgressBar" role="region" aria-label="${sw ? "Hatua za kuweka miadi" : "Booking progress"}">
            <div class="ux-inspect-progress-meta">
              <span id="inspectProgressStepLabel">${sw ? "Hatua 1 kati ya 4 · Maelezo ya gari" : "Step 1 of 4 · Vehicle details"}</span>
              <strong id="inspectProgressPct">25%</strong>
            </div>
            <div class="ux-inspect-progress-track" aria-hidden="true">
              <div class="ux-inspect-progress-fill" id="inspectProgressFill" style="width:25%"></div>
            </div>
            <div class="ux-inspect-steps" role="tablist" aria-label="${sw ? "Sehemu za fomu" : "Form sections"}">
              ${stepDefs
                .map(
                  (st, i) => `<button type="button" class="ux-inspect-step${i === 0 ? " is-active is-done" : ""}" data-step-key="${st.key}" role="tab" aria-selected="${i === 0 ? "true" : "false"}">${uxIcon(st.icon, 15)}<span>${escapeHtml(st.label)}</span></button>`
                )
                .join("")}
            </div>
          </div>
        </div>

        <section class="ux-inspect-group" id="inspectGroupVehicle" data-step-group="vehicle">
          <div class="ux-inspect-group-head">
            <div class="ux-inspect-group-title">${uxIcon("car", 18)}<h3>${sw ? "Maelezo ya Gari" : "Vehicle details"}</h3></div>
            <p class="ux-inspect-group-desc">${sw ? "Hakiki gari unalokagua na uulize mekanika swali lolote la kiufundi kabla ya kuthibitisha." : "Confirm the vehicle you are booking for and ask a mechanic any technical question first."}</p>
          </div>

          <div class="ux-inspect-car">
            ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(title)}">` : `<div class="ux-inspect-car-fallback" aria-hidden="true">${uxIcon("car", 22)}</div>`}
            <div class="ux-inspect-car-meta">
              <strong>${escapeHtml(title)}</strong>
              <div class="ux-inspect-car-price">${sw ? "Bei iliyoorodheshwa:" : "Listed price:"} ${escapeHtml(priceFormatted)}</div>
              <span class="ux-inspect-car-sub">${escapeHtml(vehicleMetaText)}</span>
            </div>
          </div>

          <div class="ux-inspect-callback-card" id="inspectCallbackCard">
            <div class="ux-inspect-callback-head">
              <div>
                <span class="ux-callback-badge">${uxIcon("phone", 14)} <span>${sw ? "Ushauri wa Mekanika Kabla ya Miadi" : "Pre-Booking Technical Advice"}</span></span>
                <strong>${sw ? "Una swali la kiufundi kuhusu gari hili?" : "Have a technical question before booking?"}</strong>
                <small>${sw ? `Uliza mekanika wa 3 Pedals moja kwa moja kuhusu ${escapeHtml(title)}.` : `Ask a 3 Pedals mechanic directly about ${escapeHtml(title)} before you finalize.`}</small>
              </div>
              <button
                type="button"
                class="ux-inspect-callback-toggle"
                id="inspectAskMechanicBtn"
                aria-expanded="false"
                aria-controls="inspectAskMechanicPanel"
              >${uxIcon("wrench", 15)}<span>${sw ? "Uliza Mekanika" : "Ask a Mechanic"}</span></button>
            </div>
            <div class="ux-inspect-callback-body" id="inspectAskMechanicPanel" hidden>
              <div class="ux-inspect-field">
                <label for="inspectCallbackQuestion">${sw ? `Swali la kiufundi kuhusu ${escapeHtml(title)}` : `Technical question about ${escapeHtml(title)}`}</label>
                <textarea id="inspectCallbackQuestion" rows="3" maxlength="600" placeholder="${sw ? "Andika swali lako la kiufundi (mf. injini, gearbox ya CVT, betri ya hybrid, au rekodi za service)…" : "Ask about engine reliability, CVT/transmission health, hybrid battery condition, suspension, or common faults…"}"></textarea>
                <p class="ux-field-error" id="errCallbackQuestion" role="alert" hidden></p>
              </div>
              <div class="ux-inspect-field">
                <label for="inspectCallbackPhone">${sw ? "Namba ya Simu / WhatsApp ya Majibu" : "Phone / WhatsApp for mechanic reply"}</label>
                <input type="tel" id="inspectCallbackPhone" maxlength="40" placeholder="0712 345 678" value="${escapeHtml(defaultPhone)}">
                <p class="ux-field-error" id="errCallbackPhone" role="alert" hidden></p>
              </div>
              <div class="ux-inspect-field">
                <label for="inspectCallbackWindow">${sw ? "Njia / Muda wa Majibu" : "Preferred advice channel"}</label>
                <select id="inspectCallbackWindow">
                  <option value="Phone call (ASAP)">${sw ? "Simu haraka iwezekanavyo" : "Phone call (ASAP)"}</option>
                  <option value="WhatsApp technical reply">${sw ? "Ujumbe wa kiufundi WhatsApp" : "WhatsApp technical reply"}</option>
                  <option value="Morning callback (8 AM – 12 PM)">${sw ? "Simu asubuhi (8 AM – 12 PM)" : "Morning callback (8 AM – 12 PM)"}</option>
                  <option value="Afternoon callback (12 PM – 5 PM)">${sw ? "Simu mchana (12 PM – 5 PM)" : "Afternoon callback (12 PM – 5 PM)"}</option>
                </select>
              </div>
              <p class="ux-inspect-status" id="inspectCallbackStatus" role="status" aria-live="polite" hidden></p>
              <div class="ux-inspect-actions">
                <button type="button" class="ux-inspect-callback-submit" id="inspectCallbackSubmitBtn">${uxIcon("phone", 16)}<span>${sw ? "Tuma Swali kwa Mekanika" : "Send Question to Mechanic"}</span></button>
              </div>
            </div>
          </div>
        </section>

        <form class="ux-inspect-form" id="inspectionBookingForm" novalidate>
          <section class="ux-inspect-group" id="inspectGroupScope" data-step-group="scope">
            <div class="ux-inspect-group-head">
              <div class="ux-inspect-group-title">${uxIcon("wrench", 18)}<h3>${sw ? "Aina na Wigo wa Ukaguzi" : "Inspection Scope"}</h3></div>
              <p class="ux-inspect-group-desc">${sw ? "Chagua mahali ukaguzi ufanyike kisha uonyeshe mifumo unayotaka itiliwe mkazo." : "Pick how the inspection happens and highlight which vehicle components to prioritize."}</p>
            </div>

            <div class="ux-inspect-field">
              <label for="inspectServiceChoices">${sw ? "Mahali pa Ukaguzi" : "Inspection Type"}</label>
              <div class="ux-service-choices" id="inspectServiceChoices" role="radiogroup" aria-label="${sw ? "Chagua aina ya ukaguzi" : "Choose inspection location"}">
                ${serviceOptions
                  .map(
                    (opt, idx) => `
                  <button type="button" class="ux-service-choice${idx === 0 ? " is-selected" : ""}" data-service-choice="${escapeHtml(opt.value)}" role="radio" aria-checked="${idx === 0 ? "true" : "false"}">
                    <span class="ux-service-choice-head">${uxIcon(opt.icon, 16)}<strong>${escapeHtml(opt.title)}</strong></span>
                    <span class="ux-service-choice-desc">${escapeHtml(opt.desc)}</span>
                  </button>`
                  )
                  .join("")}
              </div>
              <select id="inspectServiceType" name="serviceType" hidden aria-hidden="true" tabindex="-1">
                <option value="Pre-purchase inspection" selected>${sw ? "Ukaguzi wa Kabla ya Kununua (3 Pedals Garage)" : "Pre-purchase inspection (3 Pedals Garage)"}</option>
                <option value="Mobile yard pre-purchase inspection">${sw ? "Ukaguzi wa Moja kwa Moja kwenye Yadi" : "Mobile inspection at seller / car yard"}</option>
              </select>
            </div>

            <div class="ux-inspect-field ux-inspect-scope-field">
              <label for="inspectScopeInput">${sw ? "Wigo wa Ukaguzi (Inspection Scope)" : "Priority Components (Inspection Scope)"}</label>
              <div class="ux-scope-chips" id="inspectScopeChips" role="group" aria-label="${sw ? "Chagua sehemu za kukagua" : "Prioritize inspection components"}">
                ${SCOPE_PRESETS.map((preset) => `<button type="button" class="ux-scope-chip" data-scope-preset="${escapeHtml(preset)}" aria-pressed="false">${escapeHtml(preset)}</button>`).join("")}
              </div>
              <textarea id="inspectScopeInput" name="inspectionScope" rows="2" maxlength="400" placeholder="${sw ? "Chagua hapo juu au andika sehemu mahususi (mf. Engine only, Full chassis, Paintwork check)…" : "Select chips above or type specific components to prioritize (e.g., Engine only, Full chassis, Paintwork check)…"}"></textarea>
              <p class="ux-field-error" id="errInspectScope" role="alert" hidden></p>
            </div>
          </section>

          <section class="ux-inspect-group" id="inspectGroupSchedule" data-step-group="schedule">
            <div class="ux-inspect-group-head">
              <div class="ux-inspect-group-title">${uxIcon("calendar", 18)}<h3>${sw ? "Ratiba na Muda" : "Schedule"}</h3></div>
              <p class="ux-inspect-group-desc">${sw ? "Chagua siku ya Jumatatu–Jumamosi kisha chagua saa iliyo wazi ili kuepuka mwingiliano wa miadi." : "Pick a Monday–Saturday date, then choose an open hour slot to prevent double-booking."}</p>
            </div>

            <div class="ux-inspect-scheduler" id="inspectScheduler">
              <div class="ux-cal-pane">
                <div class="ux-cal-header">
                  <button type="button" class="ux-cal-nav" id="inspectCalPrev" aria-label="${sw ? "Mwezi uliopita" : "Previous month"}">${uxIcon("chevLeft", 16)}</button>
                  <strong class="ux-cal-month" id="inspectCalMonthLabel"></strong>
                  <button type="button" class="ux-cal-nav" id="inspectCalNext" aria-label="${sw ? "Mwezi ujao" : "Next month"}">${uxIcon("chevRight", 16)}</button>
                </div>
                <div class="ux-cal-weekdays" aria-hidden="true">
                  <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
                </div>
                <div class="ux-cal-grid" id="inspectCalGrid" role="grid" aria-label="${sw ? "Chagua tarehe ya ukaguzi" : "Select inspection date"}"></div>
                <div class="ux-cal-legend">
                  <span><i class="dot dot-open"></i>${sw ? "Inapatikana" : "Open"}</span>
                  <span><i class="dot dot-busy"></i>${sw ? "Baadhi zimejaa" : "Partial"}</span>
                  <span><i class="dot dot-closed"></i>${sw ? "Jumapili imefungwa" : "Sun Closed"}</span>
                </div>
              </div>
              <p class="ux-field-error" id="errInspectDate" role="alert" hidden></p>

              <div class="ux-slots-pane">
                <div class="ux-slots-head">
                  <span class="ux-slots-title">${sw ? "Muda Unaopatikana" : "Available Time Slots"}</span>
                  <span class="ux-slots-date-badge" id="inspectSelectedDateBadge"></span>
                </div>
                <div class="ux-slots-grid" id="inspectSlotsGrid" role="radiogroup" aria-label="${sw ? "Chagua muda" : "Select time slot"}"></div>
                <p class="ux-slots-sync-note" id="inspectSlotsSyncNote"></p>
              </div>
              <p class="ux-field-error" id="errInspectSlot" role="alert" hidden></p>

              <input type="hidden" id="inspectDate" name="date" value="${escapeHtml(selectedDate)}">
              <input type="hidden" id="inspectTimeSlot" name="timeSlot" value="${escapeHtml(selectedSlot)}">
            </div>
          </section>

          <section class="ux-inspect-group" id="inspectGroupDetails" data-step-group="details">
            <div class="ux-inspect-group-head">
              <div class="ux-inspect-group-title">${uxIcon("user", 18)}<h3>${sw ? "Maelezo Yako ya Mawasiliano" : "Your details"}</h3></div>
              <p class="ux-inspect-group-desc">${sw ? "Tutakutumia uthibitisho wa miadi na ripoti ya ukaguzi kupitia namba hii." : "We will send your inspection confirmation and garage report using these details."}</p>
            </div>

            <div class="ux-inspect-field">
              <label for="inspectCustomerName">${sw ? "Jina Lako Kamili" : "Your full name"}</label>
              <input type="text" id="inspectCustomerName" name="name" autocomplete="name" maxlength="120" placeholder="Jane Mwangi" value="${escapeHtml(defaultName)}" required>
              <p class="ux-field-error" id="errInspectName" role="alert" hidden></p>
            </div>

            <div class="ux-inspect-field">
              <label for="inspectCustomerPhone">${sw ? "Namba ya Simu / WhatsApp" : "Phone / WhatsApp number"}</label>
              <input type="tel" id="inspectCustomerPhone" name="phone" autocomplete="tel" maxlength="40" placeholder="0712 345 678" value="${escapeHtml(defaultPhone)}" required>
              <p class="ux-field-error" id="errInspectPhone" role="alert" hidden></p>
            </div>

            <div class="ux-inspect-field">
              <label for="inspectCustomerEmail">${sw ? "Barua Pepe (hiari)" : "Email address (optional)"}</label>
              <input type="email" id="inspectCustomerEmail" name="email" autocomplete="email" maxlength="254" placeholder="you@example.com" value="${escapeHtml(defaultEmail)}">
              <p class="ux-field-error" id="errInspectEmail" role="alert" hidden></p>
            </div>

            <div class="ux-inspect-field">
              <label for="inspectNotes">${sw ? "Eneo la Gari / Maelezo ya Ziada (hiari)" : "Yard location / extra notes (optional)"}</label>
              <input type="text" id="inspectNotes" name="notes" maxlength="300" placeholder="${escapeHtml(s.location ? `At ${s.location}` : "Yard directions or extra requests…")}" value="${escapeHtml(s.location ? `Vehicle location: ${s.location}` : "")}">
            </div>
          </section>

          <p class="ux-inspect-status" id="inspectBookingStatus" role="status" aria-live="polite" hidden></p>
          <div class="ux-inspect-confirm-links" id="inspectConfirmLinks" hidden></div>

          <div class="ux-inspect-actions">
            <button type="submit" class="ux-inspect-submit" id="inspectSubmitBtn">${uxIcon("check", 18)}<span>${sw ? "Thibitisha Miadi ya Ukaguzi" : "Confirm Inspection Booking"}</span></button>
            <a class="ux-inspect-secondary" href="${escapeHtml(garageHref)}">${sw ? "Fungua Ukurasa wa Gereji" : "Open Garage Page"}</a>
          </div>
        </form>
      </div>
    `;

    const calMonthEl = document.getElementById("inspectCalMonthLabel");
    const calGridEl = document.getElementById("inspectCalGrid");
    const slotsGridEl = document.getElementById("inspectSlotsGrid");
    const dateBadgeEl = document.getElementById("inspectSelectedDateBadge");
    const syncNoteEl = document.getElementById("inspectSlotsSyncNote");
    const dateHiddenEl = document.getElementById("inspectDate");
    const slotHiddenEl = document.getElementById("inspectTimeSlot");
    const serviceSelectEl = document.getElementById("inspectServiceType");
    const serviceChoicesEl = document.getElementById("inspectServiceChoices");
    const scopeInputEl = document.getElementById("inspectScopeInput");
    const scopeChipsEl = document.getElementById("inspectScopeChips");
    const nameInputEl = document.getElementById("inspectCustomerName");
    const phoneInputEl = document.getElementById("inspectCustomerPhone");
    const emailInputEl = document.getElementById("inspectCustomerEmail");
    const notesInputEl = document.getElementById("inspectNotes");
    const statusEl = document.getElementById("inspectBookingStatus");
    const linksEl = document.getElementById("inspectConfirmLinks");

    const setFieldError = (errId, inputEl, message) => {
      const errEl = document.getElementById(errId);
      if (errEl) {
        if (message) {
          errEl.innerHTML = `${uxIcon("alert", 15)}<span>${escapeHtml(message)}</span>`;
          errEl.hidden = false;
        } else {
          errEl.innerHTML = "";
          errEl.hidden = true;
        }
      }
      if (inputEl) {
        if (message) inputEl.setAttribute("aria-invalid", "true");
        else inputEl.removeAttribute("aria-invalid");
      }
    };

    const clearBookingErrors = () => {
      setFieldError("errInspectDate", calGridEl, "");
      setFieldError("errInspectSlot", slotsGridEl, "");
      setFieldError("errInspectScope", scopeInputEl, "");
      setFieldError("errInspectName", nameInputEl, "");
      setFieldError("errInspectPhone", phoneInputEl, "");
      setFieldError("errInspectEmail", emailInputEl, "");
    };

    const clearCallbackErrors = () => {
      setFieldError("errCallbackQuestion", document.getElementById("inspectCallbackQuestion"), "");
      setFieldError("errCallbackPhone", document.getElementById("inspectCallbackPhone"), "");
    };

    const setStatus = (msg, isErr = false) => {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.classList.toggle("is-error", isErr);
      statusEl.hidden = !msg;
    };

    const updateProgressBar = () => {
      const progress = logic?.computeInspectionBookingProgress
        ? logic.computeInspectionBookingProgress({
            activeStep,
            scopeText: scopeInputEl?.value || "",
            serviceType: serviceSelectEl?.value || "Pre-purchase inspection",
            date: selectedDate,
            timeSlot: selectedSlot,
            name: nameInputEl?.value || "",
            phone: phoneInputEl?.value || "",
            email: emailInputEl?.value || ""
          })
        : {
            steps: stepDefs.map((st, index) => ({
              key: st.key,
              index,
              completed: index === 0,
              active: st.key === activeStep
            })),
            activeStep,
            activeIndex: Math.max(0, stepDefs.findIndex((s) => s.key === activeStep)),
            completedCount: 1,
            totalCount: 4,
            percent: 25
          };

      const activeDef = stepDefs.find((s) => s.key === progress.activeStep) || stepDefs[0];
      const stepLabelEl = document.getElementById("inspectProgressStepLabel");
      const pctEl = document.getElementById("inspectProgressPct");
      const fillEl = document.getElementById("inspectProgressFill");
      if (stepLabelEl) {
        if (progress.percent >= 100) {
          stepLabelEl.textContent = sw
            ? "Hatua 4 kati ya 4 · Tayari kuthibitisha"
            : "Step 4 of 4 · Ready to confirm";
        } else {
          stepLabelEl.textContent = sw
            ? `Hatua ${progress.activeIndex + 1} kati ya ${progress.totalCount} · ${activeDef.label}`
            : `Step ${progress.activeIndex + 1} of ${progress.totalCount} · ${activeDef.label}`;
        }
      }
      if (pctEl) pctEl.textContent = `${progress.percent}%`;
      if (fillEl) fillEl.style.width = `${progress.percent}%`;

      dlg.querySelectorAll(".ux-inspect-step[data-step-key]").forEach((btn) => {
        const stepObj = progress.steps.find((s) => s.key === btn.dataset.stepKey);
        if (!stepObj) return;
        btn.classList.toggle("is-active", stepObj.active);
        btn.classList.toggle("is-done", stepObj.completed);
        btn.setAttribute("aria-selected", String(stepObj.active));
      });
    };

    dlg.querySelectorAll(".ux-inspect-step[data-step-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stepKey = btn.dataset.stepKey || "vehicle";
        activeStep = stepKey;
        updateProgressBar();
        const target = dlg.querySelector(`[data-step-group="${stepKey}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    dlg.querySelectorAll("[data-step-group]").forEach((group) => {
      const activateGroup = () => {
        const key = group.dataset.stepGroup;
        if (key && key !== activeStep) {
          activeStep = key;
          updateProgressBar();
        }
      };
      group.addEventListener("focusin", activateGroup);
      group.addEventListener("click", activateGroup);
    });

    const getSlotsForDate = (iso) => {
      const bookedSlots = bookedMap[iso] || [];
      if (logic?.computeAvailableTimeSlots) {
        return logic.computeAvailableTimeSlots({ dateIso: iso, bookedSlots, nowDate: new Date() });
      }
      const d = new Date(iso + "T00:00:00");
      const isSun = d.getDay() === 0;
      const set = new Set(bookedSlots.map((x) => String(x).toUpperCase()));
      return ALL_SLOTS.map((slot) => ({
        slot,
        booked: set.has(slot.toUpperCase()),
        pastCutoff: false,
        available: !isSun && !set.has(slot.toUpperCase())
      }));
    };

    const renderScheduler = () => {
      const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(sw ? "sw-KE" : "en-KE", {
        month: "long",
        year: "numeric"
      });
      if (calMonthEl) calMonthEl.textContent = monthName;

      const minParts = logic?.parseIsoDateParts?.(minDate);
      const prevDisabled = minParts && (viewYear < minParts.year || (viewYear === minParts.year && viewMonth <= minParts.monthIndex));
      const prevBtn = document.getElementById("inspectCalPrev");
      if (prevBtn) prevBtn.disabled = Boolean(prevDisabled);

      const cells = logic?.buildCalendarMonthMatrix
        ? logic.buildCalendarMonthMatrix({
            year: viewYear,
            monthIndex: viewMonth,
            minDateIso: minDate,
            bookedByDate: bookedMap,
            nowDate: new Date()
          })
        : (() => {
            const out = [];
            const first = new Date(viewYear, viewMonth, 1);
            const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
            const offset = (first.getDay() + 6) % 7;
            for (let i = 0; i < 42; i++) {
              const dn = i - offset + 1;
              const dt = new Date(viewYear, viewMonth, dn);
              const iso = toIso(dt.getFullYear(), dt.getMonth(), dt.getDate());
              const inMonth = dt.getMonth() === viewMonth && dn >= 1 && dn <= daysInMonth;
              const isSunday = dt.getDay() === 0;
              const isPast = iso < minDate;
              const bookedCount = (bookedMap[iso] || []).length;
              const availableCount = isSunday || isPast ? 0 : Math.max(0, ALL_SLOTS.length - bookedCount);
              out.push({
                iso,
                day: dt.getDate(),
                inMonth,
                isSunday,
                isPast,
                isToday: iso === minDate,
                bookedCount,
                availableCount,
                isDisabled: !inMonth || isSunday || isPast || availableCount === 0
              });
            }
            return out.slice(35).some((c) => c.inMonth) ? out : out.slice(0, 35);
          })();

      if (calGridEl) {
        calGridEl.innerHTML = cells
          .map((cell) => {
            const selected = cell.iso === selectedDate && cell.inMonth;
            const classes = [
              "ux-cal-day",
              !cell.inMonth ? "is-outside" : "",
              cell.isSunday ? "is-sunday" : "",
              cell.isPast ? "is-past" : "",
              cell.isToday ? "is-today" : "",
              cell.bookedCount > 0 && !cell.isDisabled ? "has-booked" : "",
              selected ? "is-selected" : ""
            ]
              .filter(Boolean)
              .join(" ");
            const ariaLabel = cell.inMonth
              ? `${cell.iso}: ${cell.isSunday ? "Closed on Sunday" : cell.isDisabled ? "Unavailable" : `${cell.availableCount} slots open`}`
              : "";
            return `<button type="button" class="${classes}" data-cal-iso="${escapeHtml(cell.iso)}" ${cell.isDisabled ? "disabled" : ""} aria-pressed="${String(selected)}" aria-label="${escapeHtml(ariaLabel)}"><span>${cell.day}</span>${cell.inMonth && !cell.isSunday && !cell.isPast ? `<i class="ux-cal-dot" aria-hidden="true"></i>` : ""}</button>`;
          })
          .join("");
      }

      const slots = getSlotsForDate(selectedDate);
      if (!slots.some((x) => x.slot === selectedSlot && x.available)) {
        const firstOpen = slots.find((x) => x.available);
        selectedSlot = firstOpen ? firstOpen.slot : "";
      }
      if (dateHiddenEl) dateHiddenEl.value = selectedDate;
      if (slotHiddenEl) slotHiddenEl.value = selectedSlot;

      if (dateBadgeEl) {
        const parsed = logic?.parseIsoDateParts?.(selectedDate);
        const dtObj = parsed ? new Date(parsed.year, parsed.monthIndex, parsed.day) : new Date(selectedDate + "T00:00:00");
        dateBadgeEl.textContent = Number.isFinite(dtObj.getTime())
          ? dtObj.toLocaleDateString(sw ? "sw-KE" : "en-KE", { weekday: "short", month: "short", day: "numeric" })
          : selectedDate;
      }

      if (slotsGridEl) {
        slotsGridEl.innerHTML = slots
          .map((item) => {
            const active = item.slot === selectedSlot && item.available;
            const badge = item.booked
              ? (sw ? "Imejaa" : "Booked")
              : item.pastCutoff
                ? (sw ? "Imepita" : "Passed")
                : (sw ? "Wazi" : "Open");
            return `<button type="button" class="ux-slot-btn${active ? " is-selected" : ""}${item.booked ? " is-booked" : ""}" data-slot-val="${escapeHtml(item.slot)}" ${item.available ? "" : "disabled"} role="radio" aria-checked="${String(active)}"><strong>${escapeHtml(item.slot)}</strong><span>${badge}</span></button>`;
          })
          .join("");
      }

      if (syncNoteEl) {
        const openCount = slots.filter((x) => x.available).length;
        syncNoteEl.textContent = slotsLoading
          ? (sw ? "Inahakiki nafasi za moja kwa moja…" : "Checking live garage availability…")
          : openCount > 0
            ? (sw ? `Nafasi ${openCount} za ukaguzi zipo wazi tarehe hii.` : `${openCount} of ${ALL_SLOTS.length} inspection slots available on this date.`)
            : (sw ? "Hakuna nafasi wazi tarehe hii — chagua siku nyingine." : "No open slots on this date — select another day.");
      }

      updateProgressBar();
    };

    const syncServiceChoices = (value) => {
      if (serviceSelectEl) serviceSelectEl.value = value;
      serviceChoicesEl?.querySelectorAll("[data-service-choice]").forEach((btn) => {
        const active = btn.dataset.serviceChoice === value;
        btn.classList.toggle("is-selected", active);
        btn.setAttribute("aria-checked", String(active));
      });
      updateProgressBar();
    };

    serviceChoicesEl?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-service-choice]");
      if (!btn) return;
      activeStep = "scope";
      syncServiceChoices(btn.dataset.serviceChoice || "Pre-purchase inspection");
    });

    const syncScopeChips = () => {
      if (!scopeChipsEl || !scopeInputEl) return;
      const val = scopeInputEl.value || "";
      scopeChipsEl.querySelectorAll("[data-scope-preset]").forEach((btn) => {
        const preset = btn.dataset.scopePreset || "";
        const active = logic?.hasInspectionScopeItem
          ? logic.hasInspectionScopeItem(val, preset)
          : val.toLowerCase().includes(preset.toLowerCase());
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      updateProgressBar();
    };

    scopeChipsEl?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-scope-preset]");
      if (!chip || !scopeInputEl) return;
      activeStep = "scope";
      const preset = chip.dataset.scopePreset || "";
      if (logic?.toggleInspectionScopeItem) {
        scopeInputEl.value = logic.toggleInspectionScopeItem(scopeInputEl.value, preset);
      } else {
        const cur = scopeInputEl.value.split(",").map((x) => x.trim()).filter(Boolean);
        const idx = cur.findIndex((x) => x.toLowerCase() === preset.toLowerCase());
        if (idx >= 0) cur.splice(idx, 1);
        else cur.push(preset);
        scopeInputEl.value = cur.join(", ");
      }
      setFieldError("errInspectScope", scopeInputEl, "");
      syncScopeChips();
    });
    scopeInputEl?.addEventListener("input", () => {
      activeStep = "scope";
      setFieldError("errInspectScope", scopeInputEl, "");
      syncScopeChips();
    });

    calGridEl?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cal-iso]");
      if (!btn || btn.disabled) return;
      activeStep = "schedule";
      selectedDate = btn.dataset.calIso || selectedDate;
      setFieldError("errInspectDate", calGridEl, "");
      if (statusEl?.classList.contains("is-error")) setStatus("", false);
      renderScheduler();
    });

    slotsGridEl?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-slot-val]");
      if (!btn || btn.disabled) return;
      activeStep = "schedule";
      selectedSlot = btn.dataset.slotVal || selectedSlot;
      setFieldError("errInspectSlot", slotsGridEl, "");
      if (statusEl?.classList.contains("is-error")) setStatus("", false);
      renderScheduler();
    });

    document.getElementById("inspectCalPrev")?.addEventListener("click", () => {
      if (viewMonth === 0) { viewMonth = 11; viewYear -= 1; } else { viewMonth -= 1; }
      renderScheduler();
    });
    document.getElementById("inspectCalNext")?.addEventListener("click", () => {
      if (viewMonth === 11) { viewMonth = 0; viewYear += 1; } else { viewMonth += 1; }
      renderScheduler();
    });

    document.getElementById("closeInspectModalBtn")?.addEventListener("click", () => dlg.close());

    const cbPhoneEl = document.getElementById("inspectCallbackPhone");
    const askMechanicBtn = document.getElementById("inspectAskMechanicBtn");
    const askMechanicPanel = document.getElementById("inspectAskMechanicPanel");
    const cbQuestionEl = document.getElementById("inspectCallbackQuestion");

    nameInputEl?.addEventListener("input", () => {
      activeStep = "details";
      setFieldError("errInspectName", nameInputEl, "");
      updateProgressBar();
    });
    phoneInputEl?.addEventListener("input", () => {
      activeStep = "details";
      if (cbPhoneEl && !cbPhoneEl.dataset.edited) {
        cbPhoneEl.value = phoneInputEl.value;
        setFieldError("errCallbackPhone", cbPhoneEl, "");
      }
      setFieldError("errInspectPhone", phoneInputEl, "");
      updateProgressBar();
    });
    emailInputEl?.addEventListener("input", () => {
      activeStep = "details";
      setFieldError("errInspectEmail", emailInputEl, "");
      updateProgressBar();
    });
    cbPhoneEl?.addEventListener("input", () => {
      cbPhoneEl.dataset.edited = "1";
      setFieldError("errCallbackPhone", cbPhoneEl, "");
    });
    cbQuestionEl?.addEventListener("input", () => {
      setFieldError("errCallbackQuestion", cbQuestionEl, "");
    });

    askMechanicBtn?.addEventListener("click", () => {
      if (!askMechanicPanel) return;
      const willOpen = askMechanicPanel.hidden;
      askMechanicPanel.hidden = !willOpen;
      askMechanicBtn.setAttribute("aria-expanded", String(willOpen));
      document.getElementById("inspectCallbackCard")?.classList.toggle("is-open", willOpen);
      if (willOpen) {
        if (cbPhoneEl && !cbPhoneEl.dataset.edited && phoneInputEl?.value && !cbPhoneEl.value) {
          cbPhoneEl.value = phoneInputEl.value;
        }
        cbQuestionEl?.focus();
      }
    });

    // Pre-booking Ask a Mechanic / technical question submission
    document.getElementById("inspectCallbackSubmitBtn")?.addEventListener("click", async () => {
      const cbBtn = document.getElementById("inspectCallbackSubmitBtn");
      const cbStatus = document.getElementById("inspectCallbackStatus");
      const cbPhone = (cbPhoneEl?.value || phoneInputEl?.value || "").trim();
      const cbWindow = document.getElementById("inspectCallbackWindow")?.value || "Phone call (ASAP)";
      const cbQuestion = (cbQuestionEl?.value || "").trim();
      const cbName = (nameInputEl?.value || defaultName || "Prospective Buyer").trim();
      const cbEmail = (emailInputEl?.value || defaultEmail || "mechanic@3pedalsauto.co.ke").trim();

      const setCbStatus = (m, err = false) => {
        if (!cbStatus) return;
        cbStatus.textContent = m;
        cbStatus.classList.toggle("is-error", err);
        cbStatus.hidden = !m;
      };

      clearCallbackErrors();
      const cbValidation = logic?.validateMechanicQuestion
        ? logic.validateMechanicQuestion({ question: cbQuestion, phone: cbPhone, lang: sw ? "sw" : "en" })
        : (() => {
            const errors = {};
            if (cbQuestion.length < 5) {
              errors.question = sw ? "Andika swali lako la kiufundi kuhusu gari hili." : "Please enter your technical question about this vehicle.";
            }
            if (cbPhone.replace(/\D/g, "").length < 9) {
              errors.phone = sw ? "Weka namba sahihi ya simu ili mekanika akujibu." : "Enter a valid phone or WhatsApp number so our mechanic can reply.";
            }
            const firstErrorField = errors.question ? "question" : errors.phone ? "phone" : null;
            return { valid: !firstErrorField, errors, firstErrorField };
          })();

      if (!cbValidation.valid) {
        if (cbValidation.errors.question) setFieldError("errCallbackQuestion", cbQuestionEl, cbValidation.errors.question);
        if (cbValidation.errors.phone) setFieldError("errCallbackPhone", cbPhoneEl, cbValidation.errors.phone);
        setCbStatus(sw ? "Rekebisha sehemu zilizoangaziwa hapa juu." : "Please fix the highlighted fields above before sending.", true);
        if (cbValidation.firstErrorField === "question") cbQuestionEl?.focus();
        else if (cbValidation.firstErrorField === "phone") cbPhoneEl?.focus();
        return;
      }

      if (cbBtn) {
        cbBtn.disabled = true;
        cbBtn.innerHTML = `${uxIcon("phone", 16)}<span>${sw ? "Inatuma swali…" : "Sending question…"}</span>`;
      }
      setCbStatus("", false);
      const cbRef = "MECH-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      let sentRemotely = false;

      if (opts.sb) {
        try {
          const { error } = await opts.sb.from("contact_enquiries").insert({
            name: cbName,
            email: cbEmail,
            phone: cbPhone,
            subject: `Ask a Mechanic (${cbRef}): ${title}`,
            message: [
              `Technical vehicle advice requested before inspection for ${title} (${vehicleRef})`,
              `Preferred advice channel: ${cbWindow}`,
              `Phone / WhatsApp: ${cbPhone}`,
              `Technical question: ${cbQuestion}`
            ].join("\n")
          });
          if (!error) sentRemotely = true;
        } catch (_) {}
      }

      try {
        const list = JSON.parse(localStorage.getItem(LOCAL_CALLBACKS_KEY) || "[]");
        const nextList = Array.isArray(list) ? list : [];
        nextList.unshift({ ref: cbRef, vehicleId: c.id, vehicle: title, phone: cbPhone, window: cbWindow, question: cbQuestion, createdAt: new Date().toISOString() });
        localStorage.setItem(LOCAL_CALLBACKS_KEY, JSON.stringify(nextList.slice(0, 20)));
      } catch (_) {}

      setCbStatus(
        sentRemotely
          ? (sw ? `Swali lako la kiufundi (${cbRef}) limepokelewa. Mekanika wa 3 Pedals atawasiliana kupitia ${cbPhone}.` : `Technical question sent (${cbRef}). A 3 Pedals mechanic will advise via ${cbPhone} (${cbWindow.toLowerCase()}).`)
          : (sw ? `Swali (${cbRef}) limehifadhiwa kwa ${cbPhone}. Unaweza kuendelea na miadi au kusubiri ushauri.` : `Question ${cbRef} logged for a 3 Pedals mechanic (${cbPhone}). You can proceed to confirm your booking whenever ready.`),
        false
      );
      if (cbBtn) {
        cbBtn.disabled = false;
        cbBtn.innerHTML = `${uxIcon("phone", 16)}<span>${sw ? "Uliza Swali Jingine" : "Ask Another Question"}</span>`;
      }
      if (typeof opts.onNotice === "function") {
        opts.onNotice(sw ? `Swali limetumwa kwa mekanika (${cbRef})` : `Question sent to mechanic (${cbRef})`, { sub: `${title} · ${cbPhone}` });
      }
    });

    // Main Inspection Booking Submission
    document.getElementById("inspectionBookingForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearBookingErrors();
      const serviceType = serviceSelectEl?.value || "Pre-purchase inspection";
      const date = selectedDate;
      const timeSlot = selectedSlot;
      const scopeText = (scopeInputEl?.value || "").trim();
      const name = (nameInputEl?.value || "").trim();
      const phoneRaw = (phoneInputEl?.value || "").trim();
      const email = (emailInputEl?.value || "").trim();
      const notes = (notesInputEl?.value || "").trim();

      const liveSlotCheck = getSlotsForDate(date).find((x) => x.slot === timeSlot);
      const slotAvailable = Boolean(liveSlotCheck && liveSlotCheck.available);

      const validation = logic?.validateInspectionBooking
        ? logic.validateInspectionBooking({
            date,
            minDate,
            slotAvailable,
            timeSlot,
            name,
            phone: phoneRaw,
            email,
            lang: sw ? "sw" : "en"
          })
        : (() => {
            const errors = {};
            const picked = new Date(date + "T00:00:00");
            if (!date || !Number.isFinite(picked.getTime()) || date < minDate || picked.getDay() === 0) {
              errors.date = sw ? "Chagua tarehe wazi (Jumatatu–Jumamosi)." : "Please pick an open Monday–Saturday date.";
            }
            if (!timeSlot || !slotAvailable) {
              errors.timeSlot = sw ? "Chagua muda unaopatikana." : "Please choose an available time slot.";
            }
            if (name.length < 2) errors.name = sw ? "Weka jina lako kamili." : "Please enter your full name.";
            if (phoneRaw.replace(/\D/g, "").length < 9) {
              errors.phone = sw ? "Weka namba sahihi ya simu au WhatsApp." : "Please enter a valid phone or WhatsApp number.";
            }
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
              errors.email = sw ? "Weka anwani sahihi ya barua pepe." : "Please enter a valid email address or leave it blank.";
            }
            const firstErrorField = ["date", "timeSlot", "name", "phone", "email"].find((k) => Boolean(errors[k])) || null;
            return { valid: !firstErrorField, errors, firstErrorField };
          })();

      if (!validation.valid) {
        if (validation.errors.date) setFieldError("errInspectDate", calGridEl, validation.errors.date);
        if (validation.errors.timeSlot) setFieldError("errInspectSlot", slotsGridEl, validation.errors.timeSlot);
        if (validation.errors.name) setFieldError("errInspectName", nameInputEl, validation.errors.name);
        if (validation.errors.phone) setFieldError("errInspectPhone", phoneInputEl, validation.errors.phone);
        if (validation.errors.email) setFieldError("errInspectEmail", emailInputEl, validation.errors.email);

        if (validation.firstErrorField === "date" || validation.firstErrorField === "timeSlot") {
          activeStep = "schedule";
        } else {
          activeStep = "details";
        }
        updateProgressBar();
        setStatus(
          sw ? "Kagua sehemu zilizo na alama nyekundu kabla ya kuthibitisha." : "Please review the highlighted fields above before confirming.",
          true
        );

        const focusMap = {
          date: calGridEl?.querySelector("[data-cal-iso]:not(:disabled)") || calGridEl,
          timeSlot: slotsGridEl?.querySelector("[data-slot-val]:not(:disabled)") || slotsGridEl,
          name: nameInputEl,
          phone: phoneInputEl,
          email: emailInputEl
        };
        const target = focusMap[validation.firstErrorField];
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          if (typeof target.focus === "function") target.focus({ preventScroll: true });
        }
        return;
      }

      const submitBtn = document.getElementById("inspectSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `${uxIcon("check", 18)}<span>${sw ? "Inahifadhi miadi…" : "Booking inspection…"}</span>`;
      }
      setStatus("", false);
      if (linksEl) linksEl.hidden = true;

      const ref = "3PG-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const carDesc = `${title} (${vehicleRef})`;
      const fullServiceDesc = scopeText ? `${serviceType} — Scope: ${scopeText}`.slice(0, 240) : serviceType;
      let savedRemotely = false;
      let slotTaken = false;

      if (opts.sb) {
        if (opts.user?.id) {
          try {
            const { error } = await opts.sb.from("bookings").insert({
              ref,
              user_id: opts.user.id,
              request_type: "garage",
              service: fullServiceDesc,
              car: carDesc,
              date,
              time_slot: timeSlot,
              service_status: "scheduled",
              name,
              phone: phoneRaw
            });
            if (!error) savedRemotely = true;
            else if (error.code === "23505") slotTaken = true;
          } catch (_) {}
        }
        if (!savedRemotely && !slotTaken) {
          try {
            const { error: enqErr } = await opts.sb.from("contact_enquiries").insert({
              name,
              email: email || "inspection@3pedalsauto.co.ke",
              phone: phoneRaw,
              subject: `Inspection Booking (${ref}): ${title}`,
              message: [
                `Inspection request for ${carDesc}`,
                `Service: ${serviceType}`,
                scopeText ? `Inspection Scope: ${scopeText}` : "",
                `Preferred date: ${date} at ${timeSlot}`,
                `Vehicle price: KES ${fmtNum(c.price)}`,
                `Seller: ${sellerLabel}${locText}`,
                notes ? `Notes: ${notes}` : ""
              ]
                .filter(Boolean)
                .join("\n")
            });
            if (!enqErr) savedRemotely = true;
          } catch (_) {}
        }
      }

      if (slotTaken) {
        bookedMap = mergeBookedMaps(bookedMap, { [date]: [timeSlot] });
        renderScheduler();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${uxIcon("check", 18)}<span>${sw ? "Thibitisha Miadi ya Ukaguzi" : "Confirm Inspection Booking"}</span>`;
        }
        setFieldError("errInspectSlot", slotsGridEl, sw ? "Muda huo tayari umechukuliwa. Chagua muda mwingine." : "That time slot was just booked. Choose another available slot.");
        setStatus(sw ? "Muda huo tayari umechukuliwa. Chagua muda au tarehe nyingine." : "That time slot was just booked. Please choose another available slot.", true);
        return;
      }

      try {
        const existingLocal = JSON.parse(localStorage.getItem(LOCAL_BOOKINGS_KEY) || "[]");
        const nextLocal = Array.isArray(existingLocal) ? existingLocal : [];
        nextLocal.unshift({
          ref,
          vehicleId: c.id,
          vehicle: title,
          service: serviceType,
          inspectionScope: scopeText,
          date,
          timeSlot,
          name,
          phone: phoneRaw,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(nextLocal.slice(0, 30)));
      } catch (_) {}

      bookedMap = mergeBookedMaps(bookedMap, { [date]: [timeSlot] });
      renderScheduler();
      if (email && typeof opts.onAlertEmailSave === "function") opts.onAlertEmailSave(email);

      const waText = encodeURIComponent(
        `Hello 3 Pedals Garage, I have booked a ${serviceType} (${ref}) for the ${title} (${vehicleRef}) on ${date} at ${timeSlot}.${scopeText ? `\nInspection Scope: ${scopeText}` : ""}\nName: ${name}\nPhone: ${phoneRaw}${notes ? `\nNotes: ${notes}` : ""}`
      );
      const waUrl = `https://wa.me/${businessWa}?text=${waText}`;
      setStatus(
        savedRemotely
          ? (sw ? `Miadi imepokelewa (${ref}) kwa ${title} tarehe ${date} saa ${timeSlot}. Timu yetu itawasiliana nawe kuthibitisha.` : `Inspection booked (${ref}) for ${title} on ${date} at ${timeSlot}. Our garage team will confirm shortly.`)
          : (sw ? `Kumbukumbu ya ukaguzi ${ref} imeandaliwa kwa ${title} (${date}, ${timeSlot}). Thibitisha kupitia WhatsApp hapa chini.` : `Inspection request ${ref} prepared for ${title} (${date} at ${timeSlot}). Send directly on WhatsApp below to lock in your slot.`),
        false
      );
      if (linksEl) {
        linksEl.innerHTML = `<a class="ux-inspect-submit" style="text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center" href="${escapeHtml(waUrl)}" target="_blank" rel="noopener">${uxIcon("phone", 18)}<span>${sw ? "Tuma Kwenye WhatsApp" : "Send via WhatsApp"}</span></a><button type="button" class="ux-inspect-secondary" id="inspectDoneBtn">${sw ? "Imekamilika" : "Done"}</button>`;
        linksEl.hidden = false;
        document.getElementById("inspectDoneBtn")?.addEventListener("click", () => dlg.close());
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${uxIcon("check", 18)}<span>${sw ? "Weka Miadi Nyingine" : "Update Booking"}</span>`;
      }
      if (typeof opts.onNotice === "function") {
        opts.onNotice(sw ? `Ukaguzi umewekwa (${ref})` : `Inspection booked (${ref})`, { sub: `${title} · ${date} · ${timeSlot}` });
      }
    });

    syncServiceChoices(serviceSelectEl?.value || "Pre-purchase inspection");
    renderScheduler();
    syncScopeChips();
    updateProgressBar();
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
    const closeInspectBtn = document.getElementById("closeInspectModalBtn");
    if (closeInspectBtn) closeInspectBtn.focus({ preventScroll: true });

    // Fetch live garage bookings asynchronously to prevent double-booking across users
    if (opts.sb) {
      opts.sb
        .from("bookings")
        .select("date,time_slot")
        .eq("request_type", "garage")
        .gte("date", minDate)
        .neq("service_status", "cancelled")
        .then(({ data, error }) => {
          slotsLoading = false;
          if (!error && Array.isArray(data)) {
            const remoteMap = {};
            data.forEach((row) => {
              if (row && row.date && row.time_slot) {
                if (!remoteMap[row.date]) remoteMap[row.date] = [];
                remoteMap[row.date].push(row.time_slot);
              }
            });
            bookedMap = mergeBookedMaps(bookedMap, remoteMap);
          }
          if (dlg.open) renderScheduler();
        })
        .catch(() => {
          slotsLoading = false;
          if (dlg.open) renderScheduler();
        });
    } else {
      slotsLoading = false;
      renderScheduler();
    }
  }

  // ===== Journal Estimated Reading Time & Recent Reads =====
  function calcReadingStats(textParts) {
    const raw = (Array.isArray(textParts) ? textParts : [textParts])
      .filter(Boolean)
      .join(" ")
      .replace(/\[\[\s*photo\s*:\s*\d+\s*\]\]/gi, " ")
      .replace(/[#>*_`~|-]+/g, " ")
      .trim();
    const words = raw ? raw.split(/\s+/).filter(Boolean).length : 0;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return { words, minutes };
  }

  function getRecentArticles() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_ARTICLES_KEY) || "[]");
      return Array.isArray(list) ? list.filter((x) => x && x.id) : [];
    } catch (_) {
      return [];
    }
  }

  function recordRecentArticle(article) {
    if (!article || !article.id) return;
    const stats = calcReadingStats([article.title, article.description, article.body]);
    const entry = {
      id: String(article.id),
      slug: String(article.slug || ""),
      title: String(article.title || "3 Pedals Journal"),
      category: String(article.category || "Automotive Journal"),
      words: stats.words,
      minutes: stats.minutes,
      href: String(article.href || `/journal.html?id=${encodeURIComponent(article.id)}`),
      readAt: Date.now()
    };
    const next = [entry, ...getRecentArticles().filter((x) => String(x.id) !== entry.id)].slice(0, 6);
    try { localStorage.setItem(RECENT_ARTICLES_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function clearRecentArticles() {
    try { localStorage.removeItem(RECENT_ARTICLES_KEY); } catch (_) {}
  }

  function renderRecentReads(hostEl, excludeId = "") {
    if (!hostEl) return;
    const items = getRecentArticles().filter((x) => !excludeId || String(x.id) !== String(excludeId));
    if (!items.length) {
      hostEl.hidden = true;
      hostEl.innerHTML = "";
      return;
    }
    hostEl.hidden = false;
    hostEl.className = "ux-journal-recent-strip no-print";
    hostEl.innerHTML = `
      <div class="ux-recent-head">
        <div>
          <h3 style="margin:0;font-size:18px">${t("recentReadsTitle")}</h3>
          <p class="meta" style="margin:2px 0 0;font-size:12px">${t("recentReadsSub")}</p>
        </div>
        <button type="button" class="ux-clear-history ux-btn-danger" data-ux-clear-recent-articles>${uxIcon("trash", 15)}<span>${t("clearHistory")}</span></button>
      </div>
      <div class="ux-journal-recent-list">
        ${items
          .map(
            (a) => `
          <a class="ux-journal-recent-item" href="${escapeHtml(a.href)}">
            <strong>${escapeHtml(a.title)}</strong>
            <span>${escapeHtml(a.category)} · ${a.words.toLocaleString("en-KE")} ${t("wordsLabel")} · ${a.minutes} ${t("minRead")}</span>
          </a>`
          )
          .join("")}
      </div>
    `;
    hostEl.querySelector("[data-ux-clear-recent-articles]")?.addEventListener("click", () => {
      clearRecentArticles();
      renderRecentReads(hostEl, excludeId);
    });
  }

  // ===== Authentic Self-Contained QR Code SVG Matrix Generator (ISO 18004 Byte Mode, V1-V6) =====
  const QR_VERSIONS = [
    { v: 1, cap: 17, total: 26, data: 19, ecc: 7, align: [] },
    { v: 2, cap: 32, total: 44, data: 34, ecc: 10, align: [6, 18] },
    { v: 3, cap: 53, total: 70, data: 55, ecc: 15, align: [6, 22] },
    { v: 4, cap: 78, total: 100, data: 80, ecc: 20, align: [6, 26] },
    { v: 5, cap: 106, total: 134, data: 108, ecc: 26, align: [6, 30] },
    { v: 6, cap: 134, total: 172, data: 136, ecc: 18, blocks: 2, align: [6, 34] }
  ];

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 256) x ^= 285;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const factor = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsCompute(data, eccLen) {
    const gen = rsGenerator(eccLen);
    const res = new Uint8Array(data.length + eccLen);
    res.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  function generateQrSvg(text, label = "Scan vehicle link") {
    const bytes = new TextEncoder().encode(String(text || "https://3pedalsauto.co.ke/"));
    const spec = QR_VERSIONS.find((q) => bytes.length <= q.cap) || QR_VERSIONS[QR_VERSIONS.length - 1];
    const payload = bytes.slice(0, spec.cap);
    const size = 17 + spec.v * 4;

    // Encode bitstream (Byte mode 0100 + 8-bit length + bytes + terminator + pad bytes)
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    };
    pushBits(4, 4);
    pushBits(payload.length, 8);
    payload.forEach((b) => pushBits(b, 8));
    const maxBits = spec.data * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const padBytes = [0xec, 0x11];
    let p = 0;
    while (bits.length < maxBits) {
      pushBits(padBytes[p % 2], 8);
      p++;
    }

    const dataBytes = new Uint8Array(spec.data);
    for (let i = 0; i < spec.data; i++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
      dataBytes[i] = byte;
    }

    let finalCodewords = [];
    if (spec.blocks === 2) {
      const half = spec.data / 2;
      const b1 = dataBytes.slice(0, half);
      const b2 = dataBytes.slice(half);
      const e1 = rsCompute(b1, spec.ecc);
      const e2 = rsCompute(b2, spec.ecc);
      for (let i = 0; i < half; i++) finalCodewords.push(b1[i], b2[i]);
      for (let i = 0; i < spec.ecc; i++) finalCodewords.push(e1[i], e2[i]);
    } else {
      const ec = rsCompute(dataBytes, spec.ecc);
      finalCodewords = [...dataBytes, ...ec];
    }

    const matrix = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const reserved = Array.from({ length: size }, () => new Uint8Array(size));

    const setMod = (r, c, v, res = true) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      matrix[r][c] = v ? 1 : 0;
      if (res) reserved[r][c] = 1;
    };

    const drawFinder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = r0 + r, cc = c0 + c;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          const on =
            r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setMod(rr, cc, on, true);
        }
      }
    };

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      setMod(6, i, i % 2 === 0, true);
      setMod(i, 6, i % 2 === 0, true);
    }

    // Alignment pattern
    if (spec.align.length >= 2) {
      const cPos = spec.align[1];
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const on = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setMod(cPos + r, cPos + c, on, true);
        }
      }
    }

    // Reserve format info + dark module
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        reserved[8][i] = 1;
        reserved[i][8] = 1;
      }
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = 1;
      if (i < 7) reserved[size - 1 - i][8] = 1;
    }
    setMod(size - 8, 8, 1, true);

    // Place data bits in zig-zag with mask 0 ((r + c) % 2 === 0)
    let bitIdx = 0;
    const totalBits = finalCodewords.length * 8;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      const upward = ((size - 1 - col) >> 1) % 2 === 0;
      for (let rowStep = 0; rowStep < size; rowStep++) {
        const r = upward ? size - 1 - rowStep : rowStep;
        for (let dx = 0; dx < 2; dx++) {
          const c = col - dx;
          if (reserved[r][c]) continue;
          let bit = 0;
          if (bitIdx < totalBits) {
            const byte = finalCodewords[bitIdx >> 3];
            bit = (byte >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          if ((r + c) % 2 === 0) bit ^= 1;
          matrix[r][c] = bit;
        }
      }
    }

    // Format info for EC Level L (01) + Mask 0 (000) => 15-bit BCH + XOR 0x5412 = 0x77c4
    const fmt = 0x77c4;
    const fmtCoords1 = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];
    const fmtCoords2 = [
      [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
      [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]
    ];
    for (let i = 0; i < 15; i++) {
      const bit = (fmt >> i) & 1;
      matrix[fmtCoords1[i][0]][fmtCoords1[i][1]] = bit;
      matrix[fmtCoords2[i][0]][fmtCoords2[i][1]] = bit;
    }

    const quiet = 3;
    const vb = size + quiet * 2;
    let d = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c] === 1) {
          d += `M${c + quiet},${r + quiet}h1v1h-1z`;
        }
      }
    }
    return `<svg viewBox="0 0 ${vb} ${vb}" role="img" aria-label="${escapeHtml(label)}" shape-rendering="crispEdges"><rect width="${vb}" height="${vb}" fill="#ffffff"/><path d="${d}" fill="#141311"/></svg>`;
  }

  // ===== Multi-Turn Gemini Auto Advisor Chatbot (Search & OpenStreetMap) =====
  const CHAT_STORAGE_KEY = "3pedals:gemini-chat:v1";

  function readChatSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) || "null");
      if (parsed && Array.isArray(parsed.messages)) {
        return {
          role: String(parsed.role || "buyer_advisor"),
          mode: String(parsed.mode || "auto"),
          messages: parsed.messages
            .filter((m) => m && typeof m.text === "string" && m.text.trim().length > 0)
            .slice(-24)
        };
      }
    } catch (_) {}
    return { role: "buyer_advisor", mode: "auto", messages: [] };
  }

  function writeChatSession(state) {
    try {
      sessionStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify({
          role: state.role,
          mode: state.mode,
          messages: state.messages.slice(-24)
        })
      );
    } catch (_) {}
  }

  function formatChatMarkdown(raw) {
    const escaped = escapeHtml(String(raw || ""));
    const lines = escaped.split(/\r?\n/);
    const htmlLines = [];
    let inList = false;

    const inlineFormat = (txt) =>
      txt
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");

    for (const line of lines) {
      const bulletMatch = line.match(/^\s*[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          htmlLines.push("<ul>");
          inList = true;
        }
        htmlLines.push(`<li>${inlineFormat(bulletMatch[1])}</li>`);
      } else {
        if (inList) {
          htmlLines.push("</ul>");
          inList = false;
        }
        if (line.trim()) {
          htmlLines.push(`<p>${inlineFormat(line)}</p>`);
        }
      }
    }
    if (inList) htmlLines.push("</ul>");
    return htmlLines.join("") || `<p>${escaped}</p>`;
  }

  function initGeminiAdvisorChat() {
    if (document.getElementById("uxChatFab") || location.pathname.toLowerCase().includes("admin")) {
      return;
    }

    const state = readChatSession();
    let userLocation = null;
    let isSending = false;
    let editingMessageIndex = -1;

    const fab = document.createElement("button");
    fab.type = "button";
    fab.id = "uxChatFab";
    fab.className = "ux-chat-fab no-print";
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-controls", "uxChatDrawer");

    const drawer = document.createElement("aside");
    drawer.id = "uxChatDrawer";
    drawer.className = "ux-chat-drawer no-print";
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "3P Auto Advisor Chat");

    document.body.appendChild(fab);
    document.body.appendChild(drawer);

    function chatLabels() {
      const sw = getLang() === "sw";
      return {
        fab: sw ? "Uliza Mshauri" : "Auto Advisor",
        title: sw ? "Mshauri wa Magari 3P" : "3P Auto Advisor",
        subtitle: sw ? "Utafutaji wa Google, OpenStreetMap & Ushauri" : "Live Search, OpenStreetMap & Specs",
        roleLabel: sw ? "Jukumu" : "Role",
        modeLabel: sw ? "Zana" : "Mode",
        clear: sw ? "Futa" : "Clear",
        close: sw ? "Funga" : "Close",
        locBtn: userLocation ? (sw ? "GPS Imewashwa" : "GPS On") : (sw ? "Tumia eneo" : "Use GPS"),
        placeholder: sw
          ? "Uliza magari, ushuru au yadi…"
          : "Ask about cars, KRA duty, or yards…",
        send: sw ? "Tuma" : "Send",
        thinking: sw ? "Inachakata…" : "Thinking…",
        emptyTitle: sw
          ? "Karibu! Niulize chochote kuhusu magari Kenya."
          : "Ask about cars in Kenya, live duties, or nearby car yards.",
        prompts: sw
          ? [
              "Linganisha matumizi ya mafuta kati ya Mazda Atenza na Subaru Forester Kenya",
              "Yadi za magari zilizo karibu Mombasa Road Nairobi",
              "Sheria za sasa za ushuru wa KRA na kikomo cha miaka 8 Kenya"
            ]
          : [
              "Compare 2016 Mazda Atenza vs Subaru Forester maintenance in Kenya",
              "Reputable car yards along Mombasa Road Nairobi",
              "Current Kenya car import duty & 8-year age limit rules"
            ],
        roles: [
          { value: "buyer_advisor", label: sw ? "Mshauri wa Ununuzi" : "Buyer Advisor" },
          { value: "yard_locator", label: sw ? "Yadi & Ramani" : "Yard & Places Locator" },
          { value: "import_specialist", label: sw ? "Ushuru & KRA" : "Import & Duty Specialist" },
          { value: "inspection_tech", label: sw ? "Ukaguzi wa Kiufundi" : "Inspection Tech" }
        ],
        modes: [
          { value: "auto", label: sw ? "Otomatiki (Tafuta / Ramani)" : "Auto (Search / Maps)" },
          { value: "search", label: "Google Search" },
          { value: "maps", label: "OpenStreetMap" },
          { value: "fast", label: sw ? "Haraka (Bila utafutaji wa moja kwa moja)" : "Fast (No live search)" }
        ]
      };
    }

    function syncFabLabel() {
      const lbl = chatLabels();
      fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>${lbl.fab}</span>`;
      fab.setAttribute("aria-label", lbl.fab);
    }

    function renderDrawer() {
      const lbl = chatLabels();
      drawer.innerHTML = `
        <div class="ux-chat-head">
          <div>
            <strong>${lbl.title}</strong>
            <span>${lbl.subtitle}</span>
          </div>
          <div class="ux-chat-head-actions">
            <button type="button" class="ux-chat-mini-btn" id="uxChatGpsBtn" title="Share current location for nearby OpenStreetMap results">${uxIcon("pin", 14)}<span>${lbl.locBtn}</span></button>
            <button type="button" class="ux-chat-mini-btn ux-btn-danger" id="uxChatClearBtn">${uxIcon("trash", 14)}<span>${lbl.clear}</span></button>
            <button type="button" class="ux-chat-close-btn" id="uxChatCloseBtn" aria-label="${lbl.close}">${uxIcon("close", 16)}</button>
          </div>
        </div>
        <div class="ux-chat-controls">
          <label>
            <span>${lbl.roleLabel}</span>
            <select id="uxChatRoleSelect">
              ${lbl.roles.map((r) => `<option value="${r.value}" ${state.role === r.value ? "selected" : ""}>${r.label}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>${lbl.modeLabel}</span>
            <select id="uxChatModeSelect">
              ${lbl.modes.map((m) => `<option value="${m.value}" ${state.mode === m.value ? "selected" : ""}>${m.label}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="ux-chat-messages" id="uxChatMessages" role="log" aria-live="polite"></div>
        <form class="ux-chat-form" id="uxChatForm">
          <div class="ux-chat-edit-status" id="uxChatEditStatus" hidden>
            <span>${getLang() === "sw" ? "Unahariri ujumbe uliotangulia" : "Editing an earlier prompt"}</span>
            <button type="button" id="uxChatCancelEditBtn">${getLang() === "sw" ? "Ghairi" : "Cancel"}</button>
          </div>
          <div class="ux-chat-compose-row">
            <textarea id="uxChatInput" rows="1" placeholder="${lbl.placeholder}" aria-label="${lbl.placeholder}"></textarea>
            <button type="submit" id="uxChatSendBtn">${lbl.send}</button>
          </div>
        </form>
      `;

      renderMessages();
      syncEditComposer();

      const resizeChatInput = () => {
        const el = document.getElementById("uxChatInput");
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(Math.max(el.scrollHeight, 38), 88)}px`;
      };

      document.getElementById("uxChatCancelEditBtn")?.addEventListener("click", () => {
        editingMessageIndex = -1;
        const input = document.getElementById("uxChatInput");
        if (input) input.value = "";
        syncEditComposer();
        resizeChatInput();
      });
      document.getElementById("uxChatCloseBtn")?.addEventListener("click", () => setOpen(false));
      document.getElementById("uxChatClearBtn")?.addEventListener("click", () => {
        state.messages = [];
        writeChatSession(state);
        renderMessages();
      });
      document.getElementById("uxChatRoleSelect")?.addEventListener("change", (e) => {
        state.role = e.target.value;
        writeChatSession(state);
      });
      document.getElementById("uxChatModeSelect")?.addEventListener("change", (e) => {
        state.mode = e.target.value;
        writeChatSession(state);
      });
      document.getElementById("uxChatGpsBtn")?.addEventListener("click", () => {
        if (!navigator.geolocation) return;
        const btn = document.getElementById("uxChatGpsBtn");
        if (btn) btn.innerHTML = `${uxIcon("pin", 14)}<span>${getLang() === "sw" ? "Inakagua…" : "Checking…"}</span>`;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            userLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            if (btn) btn.innerHTML = `${uxIcon("pin", 14)}<span>${chatLabels().locBtn}</span>`;
          },
          () => {
            if (btn) btn.innerHTML = `${uxIcon("pin", 14)}<span>${getLang() === "sw" ? "GPS Imezimwa" : "GPS Off"}</span>`;
          },
          { enableHighAccuracy: false, timeout: 7000 }
        );
      });

      const form = document.getElementById("uxChatForm");
      const input = document.getElementById("uxChatInput");
      input?.addEventListener("input", resizeChatInput);
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        sendMessage(input?.value || "");
      });
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage(input.value);
        }
      });
    }

    function renderMessages() {
      const box = document.getElementById("uxChatMessages");
      if (!box) return;
      const lbl = chatLabels();

      if (!state.messages.length) {
        box.innerHTML = `
          <div class="ux-chat-empty">
            <p>${lbl.emptyTitle}</p>
            <div class="ux-chat-starters">
              ${lbl.prompts.map((p) => `<button type="button" class="ux-chat-starter">${escapeHtml(p)}</button>`).join("")}
            </div>
          </div>
        `;
        box.querySelectorAll(".ux-chat-starter").forEach((btn) => {
          btn.addEventListener("click", () => sendMessage(btn.textContent || ""));
        });
        return;
      }

      box.innerHTML = state.messages
        .map((m) => {
          const isUser = m.role === "user";
          const sources = Array.isArray(m.sources) ? m.sources : [];
          const safeSources = sources.filter((s) => s?.type !== "osm" && /^https?:\/\//i.test(String(s?.uri || "")));
          const sourcesHtml = safeSources.length
            ? `<div class="ux-chat-sources">${safeSources
                .map(
                  (s) =>
                    `<a class="ux-chat-source-link" href="${escapeHtml(s.uri)}" target="_blank" rel="noopener noreferrer" data-source-type="${escapeHtml(s.type)}">${s.type === "osm" ? uxIcon("pin", 14) : uxIcon("search", 14)} <span>${escapeHtml(s.title)}</span></a>${
                      Array.isArray(s.snippets) && s.snippets.length
                        ? `<small class="ux-chat-snippet">${escapeHtml(s.snippets[0])}</small>`
                        : ""
                    }`
                )
                .join("")}</div>`
            : "";
          const badge =
            !isUser && m.model
              ? `<span class="ux-chat-meta">${escapeHtml(m.model)}${m.groundingMode ? " · " + escapeHtml(m.groundingMode) : ""}</span>`
              : "";
          const messageIndex = state.messages.indexOf(m);
          const copyIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>`;
          const editIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>`;
          const copyButton = `<button type="button" class="ux-chat-icon-btn" data-chat-action="copy" data-message-index="${messageIndex}" title="${getLang() === "sw" ? "Nakili ujumbe" : "Copy to clipboard"}" aria-label="${getLang() === "sw" ? "Nakili ujumbe" : "Copy to clipboard"}">${copyIcon}</button>`;
          const actionButtons = m.isError ? "" : isUser
            ? `<div class="ux-chat-message-actions ux-chat-prompt-actions">${copyButton}<button type="button" class="ux-chat-icon-btn" data-chat-action="edit" data-message-index="${messageIndex}" title="${getLang() === "sw" ? "Hariri swali hili" : "Edit this prompt"}" aria-label="${getLang() === "sw" ? "Hariri swali hili" : "Edit this prompt"}">${editIcon}</button></div>`
            : `<div class="ux-chat-message-actions ux-chat-answer-actions">${copyButton}</div>`;
          return `
            <div class="ux-chat-msg ${isUser ? "is-user" : m.isError ? "is-error" : "is-model"}">
              ${isUser ? actionButtons : ""}
              <div class="ux-chat-bubble">
                ${isUser ? `<p>${escapeHtml(m.text)}</p>` : formatChatMarkdown(m.text)}
                ${sourcesHtml}
                ${badge}
              </div>
              ${!isUser ? actionButtons : ""}
            </div>
          `;
        })
        .join("");

      box.querySelectorAll("[data-chat-action]").forEach((button) => {
        button.addEventListener("click", async () => {
          const index = Number(button.dataset.messageIndex);
          const message = state.messages[index];
          if (!message) return;
          if (button.dataset.chatAction === "edit" && message.role === "user") {
            editingMessageIndex = index;
            const input = document.getElementById("uxChatInput");
            if (input) {
              input.value = message.text;
              input.focus();
              input.setSelectionRange(input.value.length, input.value.length);
            }
            syncEditComposer();
            return;
          }
          if (button.dataset.chatAction === "copy") {
            try {
              if (navigator.clipboard?.writeText && window.isSecureContext) {
                await navigator.clipboard.writeText(message.text);
              } else {
                const temporary = document.createElement("textarea");
                temporary.value = message.text;
                temporary.style.position = "fixed";
                temporary.style.opacity = "0";
                document.body.appendChild(temporary);
                temporary.select();
                const copied = document.execCommand("copy");
                temporary.remove();
                if (!copied) throw new Error("Clipboard copy failed");
              }
              const previousTitle = button.title;
              button.classList.add("is-copied");
              button.title = getLang() === "sw" ? "Imenakiliwa" : "Copied";
              window.setTimeout(() => {
                if (button.isConnected) button.title = previousTitle;
                button.classList.remove("is-copied");
              }, 1400);
            } catch (error) {
              console.warn("Could not copy Auto Advisor message:", error);
            }
          }
        });
      });

      if (isSending) {
        box.insertAdjacentHTML(
          "beforeend",
          `<div class="ux-chat-msg is-model"><div class="ux-chat-bubble ux-chat-typing">${lbl.thinking}</div></div>`
        );
      }
      box.scrollTop = box.scrollHeight;
    }

    function syncEditComposer() {
      const status = document.getElementById("uxChatEditStatus");
      const sendBtn = document.getElementById("uxChatSendBtn");
      const input = document.getElementById("uxChatInput");
      const editing = editingMessageIndex >= 0;
      if (status) status.hidden = !editing;
      if (sendBtn && !isSending) sendBtn.textContent = editing
        ? (getLang() === "sw" ? "Sasisha" : "Update")
        : chatLabels().send;
      if (input) input.placeholder = editing
        ? (getLang() === "sw" ? "Hariri ujumbe wako, kisha utume tena…" : "Edit your prompt, then send it again…")
        : chatLabels().placeholder;
    }

    async function sendMessage(rawText) {
      const text = String(rawText || "").trim();
      if (!text || isSending) return;
      const input = document.getElementById("uxChatInput");
      const sendBtn = document.getElementById("uxChatSendBtn");
      if (input) {
        input.value = "";
        input.style.height = "auto";
      }

      if (editingMessageIndex >= 0) {
        state.messages = state.messages.slice(0, editingMessageIndex);
        editingMessageIndex = -1;
      }
      state.messages.push({ role: "user", text });
      writeChatSession(state);
      syncEditComposer();
      isSending = true;
      if (sendBtn) sendBtn.disabled = true;
      renderMessages();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const wakeNoticeId = setTimeout(() => {
        const typingEl = document.querySelector("#uxChatMessages .ux-chat-typing");
        if (typingEl) {
          typingEl.textContent =
            getLang() === "sw"
              ? "Inaamsha seva ya mshauri… tafadhali subiri sekunde chache."
              : "Waking up Auto Advisor server… this can take a moment on first load.";
        }
      }, 5000);

      try {
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: state.messages.filter((m) => !m.isError).map((m) => ({ role: m.role, text: m.text })),
            role: state.role,
            mode: state.mode,
            lang: getLang(),
            location: userLocation
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 405) {
            throw new Error(
              getLang() === "sw"
                ? "Huduma ya mazungumzo haipatikani kwenye seva hii tuli (HTTP 405). Hakikisha unatumia seva ya Node (node server.js / Development App) badala ya tovuti tuli."
                : "Advisor backend is not running on this static host (HTTP 405). Open the Node server app (Development URL / node server.js) so /api/chat can process requests."
            );
          }
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        const replyText = String(data.reply || data.text || data.message || "").trim();
        if (!replyText) {
          throw new Error(
            getLang() === "sw"
              ? "Mshauri hakurudisha jibu. Tafadhali jaribu tena."
              : "The Auto Advisor returned an empty response. Please try again."
          );
        }
        state.messages.push({
          role: "model",
          text: replyText,
          model: data.model || "3P Auto Advisor",
          groundingMode: data.groundingMode || "",
          sources: Array.isArray(data.groundingSources) ? data.groundingSources : []
        });
      } catch (err) {
        const isTimeout = err?.name === "AbortError";
        const msg = isTimeout
          ? getLang() === "sw"
            ? "Muda wa ombi umeisha. Tafadhali jaribu tena."
            : "The advisor request timed out while waking up or searching. Please try again."
          : err?.message || "Unable to reach the Auto Advisor right now. Please try again.";
        state.messages.push({
          role: "model",
          isError: true,
          text: msg
        });
      } finally {
        clearTimeout(timeoutId);
        clearTimeout(wakeNoticeId);
        isSending = false;
        if (sendBtn) sendBtn.disabled = false;
        syncEditComposer();
        writeChatSession(state);
        renderMessages();
      }
    }

    function setOpen(next) {
      drawer.hidden = !next;
      fab.setAttribute("aria-expanded", String(next));
      if (next) {
        renderDrawer();
        setTimeout(() => document.getElementById("uxChatInput")?.focus(), 40);
      }
    }

    fab.addEventListener("click", () => setOpen(drawer.hidden));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !drawer.hidden) setOpen(false);
    });
    window.addEventListener("3pedals:lang-changed", () => {
      syncFabLabel();
      if (!drawer.hidden) renderDrawer();
    });

    syncFabLabel();
  }

  function initFaqCategoryFilters() {
    const faqRoot = document.getElementById("aboutFaq");
    const filterBar = document.getElementById("aboutFaqFilters");
    if (!faqRoot || !filterBar) return;

    const itemEls = Array.from(faqRoot.querySelectorAll("details.faq-item"));
    if (!itemEls.length) return;

    const categoryDefs = [
      { key: "all", icon: "layers", en: "All", sw: "Zote" },
      { key: "inspections", icon: "wrench", en: "Inspections", sw: "Ukaguzi" },
      { key: "selling", icon: "tag", en: "Selling", sw: "Kuuza" },
      { key: "general", icon: "info", en: "General", sw: "Jumla" },
      { key: "booking", icon: "calendar", en: "Booking", sw: "Miadi" }
    ];

    const logic = window.ThreePedalsLogic;
    let activeCategory = "all";

    const getCounts = () => {
      const counts = { all: itemEls.length, inspections: 0, selling: 0, general: 0, booking: 0 };
      itemEls.forEach((el) => {
        const cat = String(el.dataset.faqCategory || "general").toLowerCase();
        if (Object.prototype.hasOwnProperty.call(counts, cat)) counts[cat] += 1;
      });
      return counts;
    };

    const syncTagIcons = () => {
      const lang = getLang();
      itemEls.forEach((el) => {
        const cat = String(el.dataset.faqCategory || "general").toLowerCase();
        const def = categoryDefs.find((d) => d.key === cat) || categoryDefs[3];
        const tagEl = el.querySelector(".faq-item-tag");
        if (tagEl) {
          tagEl.innerHTML = `${uxIcon(def.icon, 14)}<span>${escapeHtml(lang === "sw" ? def.sw : def.en)}</span>`;
        }
      });
    };

    const renderFilters = (forceRebuild = false) => {
      const lang = getLang();
      const counts = getCounts();
      const existing = Array.from(filterBar.querySelectorAll("[data-faq-filter]"));
      if (!forceRebuild && existing.length === categoryDefs.length) {
        existing.forEach((btn) => {
          const isActive = btn.dataset.faqFilter === activeCategory;
          btn.classList.toggle("is-active", isActive);
          btn.setAttribute("aria-selected", String(isActive));
        });
        return;
      }
      filterBar.innerHTML = categoryDefs
        .map((def) => {
          const isActive = def.key === activeCategory;
          const label = lang === "sw" ? def.sw : def.en;
          return `<button type="button" class="faq-filter-btn${isActive ? " is-active" : ""}" role="tab" aria-selected="${String(isActive)}" data-faq-filter="${def.key}">${uxIcon(def.icon, 16)}<span>${escapeHtml(label)}</span><span class="faq-filter-count">${counts[def.key] ?? 0}</span></button>`;
        })
        .join("");
    };

    const applyFilter = (nextCat) => {
      activeCategory = nextCat || "all";
      const model = itemEls.map((el, index) => ({
        index,
        category: el.dataset.faqCategory || "general"
      }));
      const matched = logic?.filterFaqItemsByCategory
        ? logic.filterFaqItemsByCategory(model, activeCategory)
        : activeCategory === "all"
          ? model
          : model.filter((m) => String(m.category).toLowerCase() === String(activeCategory).toLowerCase());
      const visibleIndices = new Set(matched.map((m) => m.index));

      let anyVisibleOpen = false;
      itemEls.forEach((el, index) => {
        const show = visibleIndices.has(index);
        el.hidden = !show;
        if (show && el.open) anyVisibleOpen = true;
      });

      if (!anyVisibleOpen) {
        const firstVisible = itemEls.find((el) => !el.hidden);
        if (firstVisible) firstVisible.open = true;
      }

      renderFilters(false);
    };

    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-faq-filter]");
      if (!btn) return;
      applyFilter(btn.dataset.faqFilter || "all");
    });

    window.addEventListener("3pedals:lang-changed", () => {
      syncTagIcons();
      renderFilters(true);
    });

    syncTagIcons();
    applyFilter("all");
  }

  window.ThreePedalsUX = {
    getTheme,
    setTheme: applyTheme,
    getLang,
    setLang: applyLanguage,
    t,
    uxIcon,
    recordRecentVehicle,
    getRecentVehicles,
    clearRecentVehicles,
    renderRecentlyViewed,
    buildVehicleCacheSnapshot,
    calcReadingStats,
    recordRecentArticle,
    getRecentArticles,
    clearRecentArticles,
    renderRecentReads,
    mountReadingProgress,
    openInspectionBookingModal,
    generateQrSvg
  };

  function boot() {
    applyTheme(getTheme());
    initHeaderControls();
    initFooterNewsletter();
    syncFooterCopyrightYears();
    initFaqCategoryFilters();
    applyLanguage(getLang());
    const homeRecentHost = document.getElementById("homeRecentViewedSection");
    if (homeRecentHost) renderRecentlyViewed(homeRecentHost);
    const initDeferredUi = () => {
      initBackToTop();
      initGeminiAdvisorChat();
      syncFooterCopyrightYears();
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(initDeferredUi, { timeout: 800 });
    } else {
      window.setTimeout(initDeferredUi, 120);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
