// Analyse plusieurs prospects en parallèle (max 25 à la fois) en réutilisant analyze-prospect.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertAdminRole } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const access = await assertAdminRole(admin, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);

    const { prospect_ids } = await req.json() as { prospect_ids: string[] };
    if (!Array.isArray(prospect_ids) || prospect_ids.length === 0) return jsonResponse({ error: "prospect_ids[] required" }, 400);
    const ids = prospect_ids.slice(0, 25);

    const callOne = async (id: string) => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/analyze-prospect`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ prospect_id: id }),
        });
        const d = await r.json();
        return { id, ok: r.ok, ...d };
      } catch (e) {
        return { id, ok: false, error: (e as Error).message };
      }
    };
    // Bursts of 5 to be friendly with rate limits
    const results: any[] = [];
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);
      results.push(...await Promise.all(batch.map(callOne)));
      if (i + 5 < ids.length) await new Promise((r) => setTimeout(r, 1500));
    }
    const success = results.filter((r) => r.ok).length;
    return jsonResponse({ ok: true, total: ids.length, success, failed: ids.length - success, results });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
