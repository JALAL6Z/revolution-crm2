// Agent Brief Créa — génère un brief créatif complet pour une campagne Ads d'un client.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

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

    const { client_id, platform = "meta", objective = "leads" } = await req.json() as { client_id: string; platform?: string; objective?: string };
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: client } = await admin.from("clients").select("*").eq("id", client_id).single();
    if (!client) return jsonResponse({ error: "Client introuvable" }, 404);

    const tool = {
      type: "function",
      function: {
        name: "creative_brief",
        parameters: {
          type: "object",
          properties: {
            campaign_name: { type: "string" },
            audience: {
              type: "object",
              properties: {
                demographics: { type: "string" },
                interests: { type: "array", items: { type: "string" } },
                pain_points: { type: "array", items: { type: "string" } },
              },
              required: ["demographics", "interests", "pain_points"],
              additionalProperties: false,
            },
            hooks: { type: "array", items: { type: "string" }, description: "5 accroches puissantes pour le scroll-stopper" },
            visual_concepts: { type: "array", items: { type: "string" }, description: "3 concepts visuels précis (cadrage, ambiance, props)" },
            ugc_scripts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  hook: { type: "string" },
                  script: { type: "string" },
                  shot_list: { type: "array", items: { type: "string" } },
                },
                required: ["hook", "script", "shot_list"],
                additionalProperties: false,
              },
              description: "3 scripts UGC/TikTok Ads prêts à tourner",
            },
            storyboard: { type: "array", items: { type: "string" }, description: "Storyboard scène par scène pour une vidéo courte" },
            designer_brief: { type: "string", description: "Brief précis pour designer/motion designer" },
            copy_variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  body: { type: "string" },
                  cta: { type: "string" },
                },
                required: ["headline", "body", "cta"],
                additionalProperties: false,
              },
              description: "3 variantes de copy A/B",
            },
            kpis: { type: "array", items: { type: "string" }, description: "KPIs à suivre (CTR cible, CPL, ROAS)" },
            production_notes: { type: "string" },
          },
          required: ["campaign_name", "audience", "hooks", "visual_concepts", "ugc_scripts", "storyboard", "designer_brief", "copy_variants", "kpis", "production_notes"],
          additionalProperties: false,
        },
      },
    };

    const ctx = `Client: ${client.company_name}\nServices: ${(client.services ?? []).join(", ")}\nPlateforme: ${platform}\nObjectif: ${objective}\nMRR: ${client.mrr ?? 0}€`;

    const { parsed } = await callAI({
      provider: "auto",
      systemPrompt: "Tu es Directeur Créatif d'une SMMA. Tu écris des briefs créatifs ULTRA actionnables pour des campagnes Ads. Tu connais les codes Meta/TikTok/Google, UGC, hooks vidéo, storyboard, motion design. Pas de blabla, du concret pour le studio.",
      userPrompt: `Génère un brief créatif complet pour:\n${ctx}`,
      tool,
      toolName: "creative_brief",
    });

    await admin.from("activity_log").insert({
      action: "creative_brief_generated", entity_type: "client", entity_id: client_id, user_id: user.id, details: { platform, objective },
    });

    return jsonResponse({ ok: true, brief: parsed });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
