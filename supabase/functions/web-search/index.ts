// Recherche web gratuite via DuckDuckGo HTML (pas de clé requise) avec cache 7 jours.
// Utile pour enrichir un prospect avec infos web fraîches.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ddgSearch(query: string, limit = 10) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RevolutionCRM/1.0)",
      "Accept": "text/html",
    },
  });
  if (!res.ok) throw new Error(`DDG ${res.status}`);
  const html = await res.text();
  const results: { title: string; url: string; snippet: string }[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && results.length < limit) {
    const cleanUrl = decodeURIComponent(m[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0]);
    const title = m[2].replace(/<[^>]+>/g, "").trim();
    const snippet = m[3].replace(/<[^>]+>/g, "").trim();
    if (title && cleanUrl.startsWith("http")) results.push({ title, url: cleanUrl, snippet });
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { query, limit = 10 } = await req.json() as { query: string; limit?: number };
    if (!query || query.length < 2) return jsonResponse({ error: "query required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const hash = await sha256(query.toLowerCase().trim() + "|" + limit);
    const { data: cached } = await admin.from("web_search_cache").select("*").eq("query_hash", hash).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (cached) return jsonResponse({ ok: true, results: cached.results, cached: true });

    const results = await ddgSearch(query, limit);
    await admin.from("web_search_cache").upsert({ query_hash: hash, query, results }, { onConflict: "query_hash" });
    return jsonResponse({ ok: true, results, cached: false });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
