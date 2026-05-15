// Envoie des notifications push Web Push (VAPID)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:contact@revolution-ecom.com";

// Génère le header Authorization VAPID
async function buildVapidHeader(endpoint: string, sub: string, pub: string) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 12 * 3600;

  const header = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" })).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const payload = btoa(JSON.stringify({ aud: audience, exp, sub })).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const unsigned = `${header}.${payload}`;

  // Import private key
  const keyData = Uint8Array.from(atob(pub.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
  const privateKeyData = Uint8Array.from(atob(sub.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    privateKeyData.buffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  return `vapid t=${unsigned}.${sigB64}, k=${pub}`;
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: any) {
  const body = JSON.stringify(payload);
  try {
    const auth = await buildVapidHeader(sub.endpoint, VAPID_PRIVATE, VAPID_PUBLIC);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
        "TTL": "86400",
      },
      body,
    });
    return res.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { user_ids, title, body, url = "/", tag } = await req.json() as {
      user_ids?: string[];
      title: string;
      body: string;
      url?: string;
      tag?: string;
    };

    let query = admin.from("push_subscriptions").select("user_id, endpoint, p256dh, auth");
    if (user_ids?.length) query = query.in("user_id", user_ids);
    const { data: subs } = await query;

    if (!subs?.length) return jsonResponse({ ok: true, sent: 0 });

    const payload = { title, body, icon: "/favicon.png", badge: "/favicon.png", url, tag };
    const results = await Promise.all(subs.map((s) => sendPush(s, payload)));
    const sent = results.filter(Boolean).length;

    return jsonResponse({ ok: true, sent, total: subs.length });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
