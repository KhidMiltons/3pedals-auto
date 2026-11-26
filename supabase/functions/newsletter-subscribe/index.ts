import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ALLOWED_TOPICS = new Set(["arrivals", "duty", "drops"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const action = body?.action === "unsubscribe" ? "unsubscribe" : "subscribe";
    const lang = body?.lang === "sw" ? "sw" : "en";
    const source = String(body?.source || "footer").slice(0, 60);

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return new Response(
        JSON.stringify({ error: "Enter a valid email address." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Newsletter storage is not configured on this Edge environment." }),
        { status: 500, headers: corsHeaders }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const now = new Date().toISOString();

    if (action === "unsubscribe") {
      const { error } = await admin
        .from("newsletter_subscriptions")
        .update({
          status: "unsubscribed",
          unsubscribed_at: now,
          updated_at: now
        })
        .eq("email", email);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message || "Could not unsubscribe right now." }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          status: "unsubscribed",
          email,
          cadence: "weekly"
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const rawTopics = Array.isArray(body?.topics) ? body.topics : [];
    const cleanTopics = Array.from(
      new Set(
        rawTopics
          .map((item: unknown) => String(item || "").trim().toLowerCase())
          .filter((item: string) => ALLOWED_TOPICS.has(item))
      )
    );
    const topics = cleanTopics.length ? cleanTopics : ["arrivals"];

    const { error } = await admin
      .from("newsletter_subscriptions")
      .upsert(
        {
          email,
          topics,
          cadence: "weekly",
          lang,
          status: "active",
          source,
          subscribed_at: now,
          unsubscribed_at: null,
          updated_at: now
        },
        { onConflict: "email" }
      );

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message || "Could not save newsletter subscription." }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: "active",
        email,
        topics,
        cadence: "weekly",
        lang
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
