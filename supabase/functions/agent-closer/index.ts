// Agent Closer — génère un script d'appel personnalisé pour un prospect:
// pitch d'ouverture, questions de découverte, traitement des 5 objections types, closing.
// Sauvegarde l'historique dans `call_scripts` et journalise dans `ai_activity_logs`.
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
  let userId: string | null = null;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);
    userId = user.id;

    const { prospect_id, tone, objective } = await req.json() as {
      prospect_id: string; tone?: string; objective?: string;
    };
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const access = await assertProspectAccess(admin, prospect_id, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const p = access.prospect;

    activityId = await startActivity({
      userId, category: "agent", action: "agent-closer",
      targetType: "prospect", targetId: prospect_id,
      payload: { tone, objective },
    });

    const tool = {
      type: "function",
      function: {
        name: "build_call_script",
        description: "Script d'appel structuré pour closer un prospect",
        parameters: {
          type: "object",
          properties: {
            opening: { type: "string", description: "Pitch d'ouverture personnalisé (3-4 phrases max)" },
            discovery_questions: { type: "array", items: { type: "string" }, description: "5 à 7 questions de découverte ouvertes" },
            value_props: { type: "array", items: { type: "string" }, description: "3 propositions de valeur ciblées sur ses pain points" },
            objections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  objection: { type: "string" },
                  response: { type: "string" },
                },
                required: ["objection", "response"],
                additionalProperties: false,
              },
              description: "Top 5 objections probables avec réponse de closing",
            },
            closing: { type: "string", description: "Phrase de closing + proposition d'agenda concret" },
            tone_advice: { type: "string", description: "Conseil court sur le ton à adopter avec ce prospect" },
            call_plan: { type: "array", items: { type: "string" }, description: "Plan d'appel étape par étape en 5-7 points" },
            discovery_diagnosis: { type: "string", description: "Ce qu'il faut chercher à diagnostiquer pendant l'appel" },
            simulation: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  prospect_says: { type: "string" },
                  closer_replies: { type: "string" },
                },
                required: ["prospect_says", "closer_replies"],
                additionalProperties: false,
              },
              description: "Mini simulation de 4 échanges réalistes",
            },
            post_call_summary_template: { type: "string", description: "Template de résumé après appel prêt à remplir" },
            proposal_angle: { type: "string", description: "Angle à utiliser si une proposition commerciale est envoyée après l'appel" },
          },
          required: ["opening", "discovery_questions", "value_props", "objections", "closing", "tone_advice", "call_plan", "discovery_diagnosis", "simulation", "post_call_summary_template", "proposal_angle"],
          additionalProperties: false,
        },
      },
    };

    const ctx = `Entreprise: ${p.name}
Secteur: ${p.sector ?? "—"} | Ville: ${p.city ?? "—"}
Site web: ${p.website ? `${p.website} (${p.ai_note?.includes("INACCESSIBLE") ? "NE FONCTIONNE PAS" : "existant"})` : "AUCUN SITE"}
Avis Google: ${p.reviews_count ? `${p.reviews_count} avis · ${p.rating}/5` : "inconnu"}
Pain points identifiés: ${(p.pain_points ?? []).join(", ") || "à découvrir pendant l'appel"}
Services recommandés: ${(p.recommended_services ?? []).join(", ") || "à qualifier"}
Note IA: ${p.ai_note ?? "—"}
Dirigeant: ${p.dirigeant ?? "—"}`;

    const { parsed, provider } = await callAI({
      provider: "auto",
      systemPrompt: `Tu es un closer d'élite pour Revolution Agency, une SMMA full-service.

NOTRE POSITIONNEMENT DIFFÉRENCIANT : Nous aidons TOUS les types de business, même ceux avec un site web. Notre vraie valeur = automatisation et génération de clients automatique.

Ce qu'on vend selon le prospect :
- Pas de site → Site vitrine pro + SEO local (argument : "vos concurrents vous volent des clients")
- Site qui ne fonctionne pas → Refonte urgente + raison de perte de clients
- Site OK mais peu de clients → Google Ads local + Meta Ads (ROI mesurable en 30 jours)
- Beaucoup d'avis Google → Stratégie réputation + campagnes ciblées sur ce signal fort
- Artisan/service → Automatisation devis PDF, relances clients, agenda en ligne, rappels SMS
- Restaurant → Système réservation auto + Meta Ads + gestion avis Google
- Commerce → Automatisation commandes, relances paniers abandonnés, fidélisation auto
- Tout prospect → Toujours mentionner l'automatisation comme gain de temps concret (ex: "plus de devis manuels", "relances faites automatiquement pendant que vous travaillez")

Style : Chris Voss (empathie tactique, mirroring) + direct + concret. Zéro blabla. Script court et actionnable.`,
      userPrompt: `${objective ? `Objectif de l'appel: ${objective}\n` : ""}Prépare un script d'appel${tone ? ` (ton: ${tone})` : ""} hyper-personnalisé pour ce prospect. Intègre TOUJOURS un angle automatisation adapté à leur secteur :
${ctx}`,
      tool,
      toolName: "build_call_script",
    });

    // Construit un script texte complet pour réutilisation/export
    const fullScript = [
      `=== OUVERTURE ===`, parsed.opening,
      ``, `=== QUESTIONS DE DÉCOUVERTE ===`, ...(parsed.discovery_questions ?? []).map((q: string, i: number) => `${i + 1}. ${q}`),
      ``, `=== PROPOSITIONS DE VALEUR ===`, ...(parsed.value_props ?? []).map((v: string) => `• ${v}`),
      ``, `=== OBJECTIONS / RÉPONSES ===`, ...(parsed.objections ?? []).map((o: any) => `❓ ${o.objection}\n→ ${o.response}`),
      ``, `=== CLOSING ===`, parsed.closing,
      ``, `=== TONALITÉ ===`, parsed.tone_advice,
      ``, `=== PLAN D'APPEL ===`, ...(parsed.call_plan ?? []).map((s: string, i: number) => `${i + 1}. ${s}`),
      ``, `=== DIAGNOSTIC À CREUSER ===`, parsed.discovery_diagnosis,
      ``, `=== SIMULATION ===`, ...(parsed.simulation ?? []).map((s: { prospect_says: string; closer_replies: string }) => `Prospect: ${s.prospect_says}\nCloser: ${s.closer_replies}`),
      ``, `=== RÉSUMÉ APRÈS APPEL ===`, parsed.post_call_summary_template,
      ``, `=== ANGLE PROPOSITION ===`, parsed.proposal_angle,
    ].join("\n");

    // Sauvegarde dans call_scripts (historique)
    const { data: saved } = await admin.from("call_scripts").insert({
      prospect_id,
      title: `Script d'appel — ${p.name}`,
      objective: objective ?? null,
      tone: tone ?? null,
      script: fullScript,
      hook: parsed.opening,
      objections: parsed.objections ?? [],
      closing: parsed.closing,
      variables: {
        prospect_name: p.name,
        sector: p.sector,
        city: p.city,
        pain_points: p.pain_points,
        recommended_services: p.recommended_services,
        call_plan: parsed.call_plan,
        discovery_diagnosis: parsed.discovery_diagnosis,
        simulation: parsed.simulation,
        post_call_summary_template: parsed.post_call_summary_template,
        proposal_angle: parsed.proposal_angle,
      },
      model_used: provider,
      created_by: user.id,
    }).select("*").single();

    await admin.from("activity_log").insert({
      action: "call_script_generated", entity_type: "prospect", entity_id: prospect_id, user_id: user.id, details: { script_id: saved?.id },
    });

    await finishActivity(activityId, {
      ok: true, durationMs: Date.now() - startTs,
      result: { script_id: saved?.id, provider },
    });

    return jsonResponse({ ok: true, script: parsed, script_id: saved?.id });
  } catch (e) {
    await finishActivity(activityId, {
      ok: false, durationMs: Date.now() - startTs, error: (e as Error).message,
    });
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
