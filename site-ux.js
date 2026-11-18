(() => {
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
      carsForSale: "Cars for Sale",
      garage: "Garage",
      chauffeur: "Chauffeur",
      dealers: "Dealers",
      journal: "Journal",
      account: "Account",
      myAccount: "My Account",
      backHome: "← Home",
      backDealers: "← Back to Dealers",
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
      nlKicker: "Monthly Intelligence",
      nlTitle: "Auto Market Briefing",
      nlDesc: "Monthly yard arrivals, Kenya import duty shifts, and verified price drops from 3 Pedals Auto KE.",
      nlEmailPlaceholder: "Enter your email address",
      nlSubscribe: "Subscribe",
      nlTopicsLabel: "Focus topics",
      nlTopicArrivals: "New Yard Arrivals",
      nlTopicDuty: "Import Duty Updates",
      nlTopicDrops: "Price Drops",
      nlInvalidEmail: "Enter a valid email address to subscribe.",
      nlSuccess: "Subscribed to the monthly Auto Market Briefing.",
      nlEditPrefs: "Update preferences",
      nlUnsubscribe: "Unsubscribe",
      nlSubscribedBadge: "Active monthly briefing"
    },
    sw: {
      home: "Mwanzo",
      about: "Kuhusu Sisi",
      contact: "Wasiliana Nasi",
      buyCar: "Nunua Gari",
      carsForSale: "Magari Yanayouzwa",
      garage: "Gereji",
      chauffeur: "Huduma ya Dereva",
      dealers: "Wauzaji",
      journal: "Jarida",
      account: "Akaunti",
      myAccount: "Akaunti Yangu",
      backHome: "← Mwanzo",
      backDealers: "← Rudi kwa Wauzaji",
      themeDark: "Mandhari ya Usiku",
      themeLight: "Mandhari ya Mchana",
      backToTop: "Rudi juu",
      searchVehiclesPlaceholder: "Tafuta aina, modeli, mwaka, eneo…",
      searchDealersPlaceholder: "Tafuta yadi za magari au wauzaji…",
      searchYardPlaceholder: "Tafuta magari ya yadi hii",
      recentlyViewedTitle: "Uliyotazama Hivi Karibuni",
      recentlyViewedSub: "Magari uliyoyafungua hivi karibuni kwenye kifaa hiki.",
      clearHistory: "Futa historia",
      recentReadsTitle: "Makala Ulizosoma Hivi Karibuni",
      recentReadsSub: "Makala ulizofungua hivi karibuni.",
      minRead: "dakika za kusoma",
      wordsLabel: "maneno",
      printSpecSheet: "Chapisha Karatasi (A4)",
      previewA4: "Hakiki A4",
      hideA4: "Ficha Hakikisho",
      nlKicker: "Taarifa ya Kila Mwezi",
      nlTitle: "Ripoti ya Soko la Magari",
      nlDesc: "Magari mapya yardini, mabadiliko ya ushuru wa kuagiza Kenya, na punguzo la bei kutoka 3 Pedals Auto KE.",
      nlEmailPlaceholder: "Weka barua pepe yako",
      nlSubscribe: "Jisajili",
      nlTopicsLabel: "Mada unazopendelea",
      nlTopicArrivals: "Magari Mapya Yardini",
      nlTopicDuty: "Taarifa za Ushuru",
      nlTopicDrops: "Punguzo la Bei",
      nlInvalidEmail: "Tafadhali weka anwani sahihi ya barua pepe.",
      nlSuccess: "Umejisajili kupokea Ripoti ya Soko la Magari kila mwezi.",
      nlEditPrefs: "Hariri mapendeleo",
      nlUnsubscribe: "Jiondoe",
      nlSubscribedBadge: "Usajili wa kila mwezi upo hai"
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
      { sel: '#nav .account-pill span', key: "account" },
      { sel: '#garageSectionNav [data-tab="services"]', key: null, en: "Services & booking", sw: "Huduma na miadi" },
      { sel: '#garageSectionNav [data-tab="roadside"]', key: null, en: "Mobile mechanic", sw: "Mekanika wa kufika" },
      { sel: '#garageSectionNav [data-tab="mechanics"]', key: null, en: "Verified mechanics", sw: "Mamekanika" },
      { sel: '#q, #inventorySearch', attr: "placeholder", key: "searchVehiclesPlaceholder" },
      { sel: '#dealerSearch', attr: "placeholder", key: "searchDealersPlaceholder" },
      { sel: '#yardVehicleSearch', attr: "placeholder", key: "searchYardPlaceholder" },
      { sel: '#vehiclePrintA4Btn', key: "printSpecSheet" }
    ];
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
      browseCta.textContent = code === "sw" ? "Tazama Magari" : browseCta.dataset.origEn;
    }
    if (sellCta && sellCta.dataset.origEn) {
      sellCta.textContent = code === "sw" ? "Uza Gari" : sellCta.dataset.origEn;
    }

    syncThemeButtons(getTheme());
    const topLabel = document.querySelector("#uxBackToTop span");
    if (topLabel) topLabel.textContent = t("backToTop");
    const topBtn = document.getElementById("uxBackToTop");
    if (topBtn) topBtn.setAttribute("aria-label", t("backToTop"));

    refreshFooterNewsletterCopy();
    window.dispatchEvent(new CustomEvent("3pedals:lang-changed", { detail: { lang: code } }));
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
    const header = document.querySelector("body > header");
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
      // Add desktop & header-bar compact switcher before toggle button
      if (!wrap.querySelector(".ux-header-controls-desktop")) {
        const host = document.createElement("div");
        host.className = "ux-header-controls-desktop";
        host.innerHTML = createControlsMarkup(false);
        const toggle = wrap.querySelector("#navToggle, #garageNavToggle");
        if (toggle) wrap.insertBefore(host, toggle);
        else wrap.appendChild(host);
      }
      // Keep drawer open when user toggles theme/lang inside mobile drawer
      targetDrawer.addEventListener("click", (e) => {
        if (e.target.closest(".ux-drawer-controls")) {
          e.stopPropagation();
        }
      });
    } else if (!chauffeurNav) {
      // Subpages: inventory, vehicle, dealers, yard, journal, chauffeur (when chauffeur uses .headin)
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

        rightGroup.appendChild(subnav);
        rightGroup.appendChild(controls);
        if (existingBack) {
          if (existingBack.classList.contains("vehicle-header-nav") || existingBack.classList.contains("headnav")) {
            // Keep existing back links inside mobile-safe group, avoid duplicating Home/Inventory
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
        document.addEventListener("click", (e) => {
          if (!subnav.contains(e.target) && !mobileToggle.contains(e.target)) closeSub();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") closeSub();
        });
        window.matchMedia("(min-width: 861px)").addEventListener("change", (ev) => {
          if (ev.matches) closeSub();
        });
      }
    }

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
    let footer = document.querySelector("body > footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "ux-site-footer no-print";
      document.body.appendChild(footer);
    } else {
      footer.classList.add("ux-site-footer", "no-print");
    }

    if (footer.querySelector(".ux-footer-newsletter")) return;

    const existingLegal = footer.innerHTML;
    footer.innerHTML = `
      <div class="ux-footer-inner">
        <section class="ux-footer-newsletter" aria-label="Auto Market Briefing Newsletter"></section>
        <div class="ux-footer-legal">
          <div>${existingLegal.includes("3 Pedals") ? "" : "3 Pedals Auto KE · Prices in KES"}</div>
          <div class="legal-footer-links">
            <a href="/privacy.html">Privacy Policy</a> ·
            <a href="/terms.html">Terms of Service</a> ·
            <button type="button" onclick="window.ThreePedalsConsent?.open()">Cookie preferences</button>
          </div>
        </div>
      </div>
    `;

    // Preserve existing brand text inside legal bar cleanly if it had text
    const firstCol = footer.querySelector(".ux-footer-legal > div:first-child");
    if (existingLegal && existingLegal.trim()) {
      const temp = document.createElement("div");
      temp.innerHTML = existingLegal;
      const hasLinks = !!temp.querySelector(".legal-footer-links, a[href*='privacy']");
      if (hasLinks) {
        footer.querySelector(".ux-footer-legal").innerHTML = temp.innerHTML;
      } else {
        firstCol.textContent = temp.textContent.trim();
      }
    }

    const box = footer.querySelector(".ux-footer-newsletter");
    renderNewsletterBox(box);

    footer.addEventListener("submit", (e) => {
      const form = e.target.closest(".ux-nl-form");
      if (!form) return;
      e.preventDefault();
      const emailInput = form.querySelector('input[name="nlEmail"]');
      const statusEl = form.querySelector(".ux-nl-status");
      const email = (emailInput?.value || "").trim();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      if (!emailValid) {
        statusEl.className = "ux-nl-status is-error";
        statusEl.textContent = t("nlInvalidEmail");
        emailInput?.focus();
        return;
      }
      const topics = [...form.querySelectorAll('input[name="nlTopic"]:checked')].map((el) => el.value);
      const record = {
        email,
        topics: topics.length ? topics : ["arrivals"],
        lang: getLang(),
        subscribedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(NEWSLETTER_KEY, JSON.stringify(record));
      } catch (_) {}
      delete box.dataset.editing;
      renderNewsletterBox(box);
    });

    footer.addEventListener("click", (e) => {
      if (e.target.closest("[data-nl-edit]")) {
        box.dataset.editing = "1";
        renderNewsletterBox(box);
        return;
      }
      if (e.target.closest("[data-nl-unsub]")) {
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

  function getRecentVehicles() {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_VEHICLES_KEY) || "[]");
      return Array.isArray(list) ? list.filter((x) => x && x.id) : [];
    } catch (_) {
      return [];
    }
  }

  function recordRecentVehicle(item) {
    if (!item || !item.id) return;
    const entry = {
      id: String(item.id),
      title: String(item.title || `${item.year || ""} ${item.make || ""} ${item.model || ""}`.trim() || "Vehicle"),
      price: Number(item.price || 0),
      km: Number(item.km || 0),
      fuel: String(item.fuel || ""),
      photo: String(item.photo || ""),
      viewedAt: Date.now()
    };
    const next = [entry, ...getRecentVehicles().filter((x) => String(x.id) !== entry.id)].slice(0, 8);
    try { localStorage.setItem(RECENT_VEHICLES_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function clearRecentVehicles() {
    try { localStorage.removeItem(RECENT_VEHICLES_KEY); } catch (_) {}
  }

  function renderRecentlyViewed(hostEl, options = {}) {
    if (!hostEl) return;
    const excludeId = options.excludeId ? String(options.excludeId) : "";
    const items = getRecentVehicles().filter((x) => !excludeId || String(x.id) !== excludeId);
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
        <button type="button" class="ux-clear-history" data-ux-clear-recent-vehicles>${t("clearHistory")}</button>
      </div>
      <div class="ux-recent-grid">
        ${items
          .map(
            (car) => `
          <a class="ux-recent-card" href="/vehicle.html?id=${encodeURIComponent(car.id)}" data-recent-vehicle-id="${escapeHtml(car.id)}">
            ${
              car.photo
                ? `<img class="ux-recent-thumb" src="${escapeHtml(car.photo)}" alt="${escapeHtml(car.title)}" loading="lazy" decoding="async">`
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
    hostEl.querySelector("[data-ux-clear-recent-vehicles]")?.addEventListener("click", () => {
      clearRecentVehicles();
      renderRecentlyViewed(hostEl, options);
    });
    if (typeof options.onSelect === "function") {
      hostEl.querySelectorAll(".ux-recent-card").forEach((link) => {
        link.addEventListener("click", (e) => {
          const id = link.dataset.recentVehicleId;
          if (id && options.onSelect(id, e)) e.preventDefault();
        });
      });
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
        <button type="button" class="ux-clear-history" data-ux-clear-recent-articles>${t("clearHistory")}</button>
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

  // ===== Multi-Turn Gemini Auto Advisor Chatbot (Search & Maps Grounding) =====
  const CHAT_STORAGE_KEY = "3pedals:gemini-chat:v1";

  function readChatSession() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) || "null");
      if (parsed && Array.isArray(parsed.messages)) {
        return {
          role: String(parsed.role || "buyer_advisor"),
          mode: String(parsed.mode || "auto"),
          messages: parsed.messages.filter((m) => m && typeof m.text === "string").slice(-24)
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
        subtitle: sw ? "Utafutaji wa Google, Ramani & Ushauri" : "Live Search, Maps Grounding & Specs",
        roleLabel: sw ? "Jukumu" : "Role",
        modeLabel: sw ? "Zana" : "Mode",
        clear: sw ? "Futa" : "Clear",
        close: sw ? "Funga" : "Close",
        locBtn: userLocation ? (sw ? "Eneo ✓" : "GPS ✓") : (sw ? "Tumia eneo" : "Use GPS"),
        placeholder: sw
          ? "Uliza kuhusu magari, ushuru wa KRA, au yadi karibu nawe…"
          : "Ask about cars in Kenya, import duties, or nearby yards…",
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
          { value: "auto", label: sw ? "Otomatiki (Search/Maps)" : "Auto (Search / Maps)" },
          { value: "search", label: "Google Search" },
          { value: "maps", label: "Google Maps" },
          { value: "fast", label: sw ? "Haraka (Flash Lite)" : "Fast (Flash Lite)" }
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
            <button type="button" class="ux-chat-mini-btn" id="uxChatGpsBtn" title="Share current location for Maps grounding">${lbl.locBtn}</button>
            <button type="button" class="ux-chat-mini-btn" id="uxChatClearBtn">${lbl.clear}</button>
            <button type="button" class="ux-chat-close-btn" id="uxChatCloseBtn" aria-label="${lbl.close}">×</button>
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
          <textarea id="uxChatInput" rows="2" placeholder="${lbl.placeholder}" aria-label="${lbl.placeholder}"></textarea>
          <button type="submit" id="uxChatSendBtn">${lbl.send}</button>
        </form>
      `;

      renderMessages();

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
        if (btn) btn.textContent = "…";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            userLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            if (btn) btn.textContent = chatLabels().locBtn;
          },
          () => {
            if (btn) btn.textContent = "GPS ✕";
          },
          { enableHighAccuracy: false, timeout: 7000 }
        );
      });

      const form = document.getElementById("uxChatForm");
      const input = document.getElementById("uxChatInput");
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
          const sourcesHtml = sources.length
            ? `<div class="ux-chat-sources">${sources
                .map(
                  (s) =>
                    `<a class="ux-chat-source-link" href="${escapeHtml(s.uri)}" target="_blank" rel="noopener noreferrer" data-source-type="${escapeHtml(s.type)}">${s.type === "maps" ? "📍" : "🔎"} <span>${escapeHtml(s.title)}</span></a>${
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
          return `
            <div class="ux-chat-msg ${isUser ? "is-user" : m.isError ? "is-error" : "is-model"}">
              <div class="ux-chat-bubble">
                ${isUser ? `<p>${escapeHtml(m.text)}</p>` : formatChatMarkdown(m.text)}
                ${sourcesHtml}
                ${badge}
              </div>
            </div>
          `;
        })
        .join("");

      if (isSending) {
        box.insertAdjacentHTML(
          "beforeend",
          `<div class="ux-chat-msg is-model"><div class="ux-chat-bubble ux-chat-typing">${lbl.thinking}</div></div>`
        );
      }
      box.scrollTop = box.scrollHeight;
    }

    async function sendMessage(rawText) {
      const text = String(rawText || "").trim();
      if (!text || isSending) return;
      const input = document.getElementById("uxChatInput");
      const sendBtn = document.getElementById("uxChatSendBtn");
      if (input) input.value = "";

      state.messages.push({ role: "user", text });
      writeChatSession(state);
      isSending = true;
      if (sendBtn) sendBtn.disabled = true;
      renderMessages();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        state.messages.push({
          role: "model",
          text: String(data.reply || ""),
          model: data.model || "gemini-4-hydrogen",
          groundingMode: data.groundingMode || "",
          sources: Array.isArray(data.groundingSources) ? data.groundingSources : []
        });
      } catch (err) {
        state.messages.push({
          role: "model",
          isError: true,
          text: err?.message || "Unable to reach the Auto Advisor right now. Please try again."
        });
      } finally {
        isSending = false;
        if (sendBtn) sendBtn.disabled = false;
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

  window.ThreePedalsUX = {
    getTheme,
    setTheme: applyTheme,
    getLang,
    setLang: applyLanguage,
    t,
    recordRecentVehicle,
    getRecentVehicles,
    clearRecentVehicles,
    renderRecentlyViewed,
    calcReadingStats,
    recordRecentArticle,
    getRecentArticles,
    clearRecentArticles,
    renderRecentReads,
    generateQrSvg
  };

  function boot() {
    applyTheme(getTheme());
    initHeaderControls();
    initBackToTop();
    initFooterNewsletter();
    initGeminiAdvisorChat();
    applyLanguage(getLang());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
