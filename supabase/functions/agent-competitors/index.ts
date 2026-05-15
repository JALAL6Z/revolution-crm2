// Agent Concurrents — analyse la concurrence locale d'un prospect.
// Combine recherche web (DuckDuckGo gratuit) + IA pour positionner l'offre.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";
import { assertProspectAccess } from "../_shared/auth.ts";

async function ddgSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await r.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) && results.length < 8) {
      results.push({ url: m[1], title: m[2].trim(), snippet: m[3].replace(/<[^>]+>/g, "").trim() });
    }
    return results;
  } catch { return []; }
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

    const { prospect_id } = await req.json() as { prospect_id: string };
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const access = await assertProspectAccess(admin, prospect_id, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const p = access.prospect;

    const sector = p.sector ?? p.category ?? "entreprise";
    const city = p.city ?? "";
    const queries = [
      `meilleur ${sector} ${city}`,
      `${sector} ${city} avis`,
      `top ${sector} ${city} 2025`,
    ];
    const allResults = (await Promise.all(queries.map(ddgSearch))).flat();

    const tool = {
      type: "function",
      function: {
        name: "competitive_analysis",
        parameters: {
          type: "object",
          properties: {
            competitors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  strengths: { type: "array", items: { type: "string" } },
                  weaknesses: { type: "array", items: { type: "string" } },
                  likely_offer: { type: "string" },
                  content_gaps: { type: "array", items: { type: "string" } },
                },
                required: ["name", "strengths", "weaknesses"],
                additionalProperties: false,
              },
            },
            market_summary: { type: "string", description: "Synthèse du marché local en 3-4 phrases" },
            differentiation_angles: { type: "array", items: { type: "string" }, description: "3 angles de différenciation pour le prospect face à ses concurrents" },
            outbound_angles: { type: "array", items: { type: "string" }, description: "Angles à réutiliser dans des messages outbound" },
            recommended_positioning: { type: "string", description: "Positionnement recommandé pour le prospect" },
            quick_wins: { type: "array", items: { type: "string" }, description: "Actions rapides pour dépasser la concurrence" },
            opportunity_score: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["competitors", "market_summary", "differentiation_angles", "outbound_angles", "recommended_positioning", "quick_wins", "opportunity_score"],
          additionalProperties: false,
        },
      },
    };

    const { parsed } = await callAI({
      provider: "auto",
      systemPrompt: "Tu es un consultant en stratégie SMMA. Tu analyses les concurrents locaux d'un prospect pour identifier comment l'aider à se différencier, quoi dire en prospection et quelles actions rapides vendre.",
      userPrompt: `Prospect: ${p.name} (${sector} à ${city})\n\nRésultats web concurrentiels:\n${allResults.map((r, i) => `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}`).join("\n")}\n\nIdentifie 3-5 vrais concurrents locaux et propose des angles de différenciation.`,
      tool,
      toolName: "competitive_analysis",
    });

    await admin.from("activity_log").insert({
      action: "competitors_analyzed", entity_type: "prospect", entity_id: prospect_id, user_id: user.id, details: { count: parsed.competitors?.length ?? 0 },
    });

    return jsonResponse({ ok: true, analysis: parsed, raw_results: allResults.slice(0, 5) });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
