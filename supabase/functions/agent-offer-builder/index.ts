// Agent Offer Builder — transforme un prospect en proposition commerciale SMMA prête à envoyer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";
import { startActivity, finishActivity } from "../_shared/activity.ts";
import { assertProspectAccess } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startTs = Date.now();
  let activityId: string | null = null;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { prospect_id, objective, budget_hint } = await req.json() as {
      prospect_id: string;
      objective?: string;
      budget_hint?: string;
    };
    if (!prospect_id) return jsonResponse({ error: "prospect_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const access = await assertProspectAccess(admin, prospect_id, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const prospect = access.prospect;

    activityId = await startActivity({
      userId: user.id,
      category: "agent",
      action: "agent-offer-builder",
      targetType: "prospect",
      targetId: prospect_id,
      payload: { objective, budget_hint },
    });

    const tool = {
      type: "function",
      function: {
        name: "build_offer",
        parameters: {
          type: "object",
          properties: {
            offer_name: { type: "string" },
            positioning: { type: "string", description: "Positionnement de l'offre en 2-3 phrases" },
            pain_summary: { type: "string", description: "Résumé des douleurs business du prospect" },
            promise: { type: "string", description: "Promesse commerciale réaliste et défendable" },
            packages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "string" },
                  setup_fee: { type: "string" },
                  deliverables: { type: "array", items: { type: "string" } },
                  timeline: { type: "string" },
                  best_for: { type: "string" },
                },
                required: ["name", "price", "setup_fee", "deliverables", "timeline", "best_for"],
                additionalProperties: false,
              },
            },
            recommended_package: { type: "string" },
            guarantee_or_risk_reversal: { type: "string" },
            bonuses: { type: "array", items: { type: "string" } },
            implementation_plan_30_days: { type: "array", items: { type: "string" } },
            client_next_steps: { type: "array", items: { type: "string" } },
            proposal_message: { type: "string", description: "Message court pour envoyer la proposition" },
            invoice_services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  detail: { type: "string", description: "4-6 points séparés par ·" },
                  amount: { type: "number" },
                },
                required: ["name", "detail", "amount"],
                additionalProperties: false,
              },
              description: "Services directement utilisables par le générateur de facture",
            },
          },
          required: ["offer_name", "positioning", "pain_summary", "promise", "packages", "recommended_package", "guarantee_or_risk_reversal", "bonuses", "implementation_plan_30_days", "client_next_steps", "proposal_message", "invoice_services"],
          additionalProperties: false,
        },
      },
    };

    const analysis = prospect.digital_analysis ?? {};
    const { parsed, provider } = await callAI({
      provider: "auto",
      systemPrompt: "Tu es directeur commercial d'une agence SMMA. Tu construis des offres simples, vendables, profitables et adaptées au niveau de maturité du prospect. Tu évites les promesses irréalistes.",
      userPrompt: `Prospect: ${prospect.name}
Secteur: ${prospect.sector ?? "—"} | Ville: ${prospect.city ?? "—"}
Site: ${prospect.website ?? "aucun"} | Note Google: ${prospect.rating ?? "—"} (${prospect.reviews_count ?? 0} avis)
Pain points: ${(analysis.pain_points ?? prospect.pain_points ?? []).join(", ") || "—"}
Services recommandés: ${JSON.stringify(analysis.recommended_services ?? prospect.recommended_services ?? [])}
Budget estimé: ${budget_hint ?? analysis.estimated_budget ?? "à estimer"}
Objectif: ${objective ?? analysis.next_best_action ?? "générer une proposition commerciale"}

Crée une proposition en 3 packs maximum, avec un pack recommandé clair et des services facturables.`,
      tool,
      toolName: "build_offer",
    });

    await admin.from("activity_log").insert({
      action: "offer_generated",
      entity_type: "prospect",
      entity_id: prospect_id,
      user_id: user.id,
      details: { offer_name: parsed.offer_name, recommended_package: parsed.recommended_package, provider },
    });

    await finishActivity(activityId, {
      ok: true,
      durationMs: Date.now() - startTs,
      result: { provider, offer_name: parsed.offer_name },
    });

    return jsonResponse({ ok: true, offer: parsed });
  } catch (e) {
    await finishActivity(activityId, { ok: false, durationMs: Date.now() - startTs, error: (e as Error).message });
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
