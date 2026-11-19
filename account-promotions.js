/* 3 Pedals Auto KE — Account Promotions, Repost Reminders & M-Pesa STK Handlers */
(() => {
  "use strict";

  function renderPromotionHistory(rows, listings, { esc, fmt, formatStatus }) {
    const L = Array.isArray(listings) ? listings : [];
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return '<p class="meta">No promotion history to show.</p>';
    return list
      .map((p) => {
        const vehicle = L.find((x) => String(x.id) === String(p.listing_id));
        const payStatus = p.payment_status || "pending";
        const badgeText =
          payStatus === "verified"
            ? ["active", "approved"].includes(String(p.status || "").toLowerCase())
              ? "Promotion active"
              : "Payment verified"
            : payStatus === "cancelled"
              ? "Payment cancelled"
              : payStatus === "failed"
                ? "Payment failed"
                : "Awaiting payment";
        return `<div class="svc promotion-history-item"><div><b>${esc(p.package_name || "Vehicle promotion")}</b><span class="meta">${esc(vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "Vehicle listing")} · KES ${fmt(p.amount)}</span><span class="meta">Payment: ${esc(formatStatus(payStatus))} · Created ${esc(p.created_at ? new Date(p.created_at).toLocaleDateString() : "Date unavailable")}</span></div><span class="st promotion-status-badge">${esc(badgeText)}</span></div>`;
      })
      .join("");
  }

  function bind({
    sb,
    me,
    dialog,
    box,
    menu,
    listings,
    accountOwnerId,
    openAccount,
    $,
    esc,
    fmt,
    formatStatus,
  }) {
    const refreshPromotionHistory = async () => {
      if (
        !dialog.open ||
        !me ||
        me.id !== accountOwnerId ||
        history.state?.accountPage !== "promotions"
      ) {
        return;
      }
      const [promotionResult, settingsResult] = await Promise.all([
        sb
          .from("listing_promotions")
          .select(
            "id,listing_id,package_name,amount,status,payment_status,starts_at,expires_at,created_at"
          )
          .eq("seller_id", accountOwnerId)
          .order("created_at", { ascending: false }),
        sb
          .from("seller_settings")
          .select("promotion_history_cleared_at")
          .eq("seller_id", accountOwnerId)
          .maybeSingle(),
      ]);
      if (promotionResult.error) {
        console.warn("Promotion history refresh failed:", promotionResult.error.message);
        return;
      }
      if (!dialog.open || !me || me.id !== accountOwnerId) return;
      const clearedAt = settingsResult.data?.promotion_history_cleared_at
        ? new Date(settingsResult.data.promotion_history_cleared_at).getTime()
        : 0;
      const rows = (promotionResult.data || []).filter(
        (p) => !clearedAt || new Date(p.created_at || p.starts_at || 0).getTime() > clearedAt
      );
      const list = box.querySelector("#promotionHistoryList");
      if (list) {
        list.innerHTML = renderPromotionHistory(rows, listings, { esc, fmt, formatStatus });
      }
    };

    box.querySelectorAll("[data-reposted]").forEach((bt) => {
      bt.onclick = async () => {
        const msg = $("reminderMessage");
        bt.disabled = true;
        bt.textContent = "Saving…";
        const { error } = await sb
          .from("listings")
          .update({ reposted_at: new Date().toISOString() })
          .eq("id", bt.dataset.reposted)
          .eq("owner", me.id);
        if (error) {
          if (msg) msg.textContent = `Could not update reminder: ${error.message}`;
          bt.disabled = false;
          bt.textContent = "Mark reposted today";
          return;
        }
        window.ThreePedalsAccountUI?.toast("Listing marked reposted today.", "ok");
        openAccount({ refresh: true });
      };
    });

    $("clearPromotionHistory")?.addEventListener("click", async () => {
      const confirmed = await window.ThreePedalsAccountUI?.confirm({
        eyebrow: "PROMOTIONS",
        title: "Clear promotion history?",
        message:
          "This hides past promotion entries from your seller account view. Payment records remain retained securely.",
        confirmText: "Clear history",
      });
      if (!confirmed) return;
      const button = $("clearPromotionHistory");
      const message = $("promotionHistoryMessage");
      const now = new Date().toISOString();
      button.disabled = true;
      if (message) message.textContent = "Clearing history…";
      const { error } = await sb
        .from("seller_settings")
        .upsert(
          { seller_id: me.id, promotion_history_cleared_at: now, updated_at: now },
          { onConflict: "seller_id" }
        );
      if (error) {
        if (message) message.textContent = `Could not clear history: ${error.message}`;
        button.disabled = false;
        return;
      }
      if (message) {
        message.textContent =
          "History cleared from this account. Payment records are retained.";
      }
      window.ThreePedalsAccountUI?.toast("Promotion history cleared.", "ok");
      setTimeout(() => openAccount({ refresh: true }), 600);
    });

    box.querySelectorAll("[data-promote-listing]").forEach((bt) => {
      bt.onclick = () => {
        menu.querySelector('[data-page="promotions"]')?.click();
        const select = $("promoListing");
        if (select) {
          select.value = bt.dataset.promoteListing;
          requestAnimationFrame(() => {
            const body = $("accBody");
            select.focus({ preventScroll: true });
            body.scrollTo({
              top: body.scrollTop + select.getBoundingClientRect().top - body.getBoundingClientRect().top - 24,
              behavior: "smooth",
            });
          });
        }
      };
    });

    $("startPromotion")?.addEventListener("click", async () => {
      const listing_id = $("promoListing").value;
      const package_id = $("promoPackage").value;
      const phone_number = $("promoPhone").value.trim();
      const msg = $("promotionMessage");
      const button = $("startPromotion");
      if (!listing_id || !package_id || !phone_number) {
        if (msg) {
          msg.textContent =
            "Choose a live vehicle and package, then enter your M-Pesa number.";
        }
        return;
      }
      button.disabled = true;
      if (msg) msg.textContent = "Requesting M-Pesa payment prompt…";
      try {
        const { data, error } = await sb.functions.invoke("create-promotion-payment", {
          body: { listing_id, package_id, phone_number },
        });
        if (error) throw error;
        if (msg) {
          msg.textContent =
            data?.message ||
            "Check your phone and approve the M-Pesa prompt. Waiting for secure confirmation…";
        }
        if (!data?.promotion_id) {
          if (msg) {
            msg.textContent =
              data?.message ||
              "The payment request was sent, but no tracking reference was returned. Check Promotion History before trying again.";
          }
          return;
        }
        let lastPollError = null;
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const { data: state, error: pollError } = await sb
            .from("listing_promotions")
            .select("status,payment_status")
            .eq("id", data.promotion_id)
            .maybeSingle();
          if (pollError) {
            lastPollError = pollError;
            continue;
          }
          if (state?.payment_status === "verified") {
            const finalMessage =
              "Payment confirmed. Your promotion history has been refreshed.";
            await openAccount({ refresh: true });
            const refreshedMessage = $("promotionMessage");
            if (refreshedMessage) refreshedMessage.textContent = finalMessage;
            return;
          }
          if (state?.payment_status === "cancelled") {
            const finalMessage =
              "Payment cancelled. No promotion was activated. You can start a new payment when you're ready.";
            await openAccount({ refresh: true });
            const refreshedMessage = $("promotionMessage");
            if (refreshedMessage) refreshedMessage.textContent = finalMessage;
            return;
          }
          if (state?.payment_status === "failed") {
            const finalMessage =
              "M-Pesa payment failed. Check the number and try again only after confirming no payment was deducted.";
            await openAccount({ refresh: true });
            const refreshedMessage = $("promotionMessage");
            if (refreshedMessage) refreshedMessage.textContent = finalMessage;
            return;
          }
        }
        if (msg) {
          msg.textContent = lastPollError
            ? "Your payment prompt was sent, but its status could not be checked. Check Promotion History before retrying."
            : "Payment is still awaiting confirmation. You can close this dashboard and check Promotion History again shortly.";
        }
      } catch (e) {
        if (msg) msg.textContent = e.message || "Could not start M-Pesa payment. Please try again.";
      } finally {
        button.disabled = false;
      }
    });

    return { refreshPromotionHistory };
  }

  window.ThreePedalsAccountPromotions = {
    renderPromotionHistory,
    bind,
  };
})();
