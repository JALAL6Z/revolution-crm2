import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!BOT_TOKEN || !CHAT_ID) {
    return jsonResponse({ error: "Telegram not configured" }, 500);
  }

  try {
    const { text } = await req.json() as { text: string };
    if (!text) return jsonResponse({ error: "text required" }, 400);

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
    });

    const data = await res.json();
    return jsonResponse({ ok: data.ok });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
