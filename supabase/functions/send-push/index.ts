// Envoie des notifications push via la spec Web Push + VAPID
// Utilise npm:web-push pour le chiffrement et la signature
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return jsonResponse({ error: "VAPID keys not configured" }, 500);
    }

    webpush.setVapidDetails(
      "mailto:contact@revolution-ecom.com",
      VAPID_PUBLIC,
      VAPID_PRIVATE
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { user_ids, title, body, url = "/", tag, icon = "/favicon.png" } = await req.json() as {
      user_ids?: string[];
      title: string;
      body: string;
      url?: string;
      tag?: string;
      icon?: string;
    };

    let query = admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
    if (user_ids?.length) query = query.in("user_id", user_ids);
    const { data: subs, error: dbErr } = await query;

    if (dbErr) return jsonResponse({ error: dbErr.message }, 500);
    if (!subs?.length) return jsonResponse({ ok: true, sent: 0, total: 0 });

    const payload = JSON.stringify({ title, body, icon, badge: "/favicon.png", url, tag });

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 86400 }
        )
      )
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r) => (r as PromiseRejectedResult).reason?.message);

    console.log(`Push: ${sent}/${subs.length} sent`, errors.length ? errors : "");

    return jsonResponse({ ok: true, sent, total: subs.length, errors: errors.slice(0, 3) });
  } catch (e) {
    console.error("send-push error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
