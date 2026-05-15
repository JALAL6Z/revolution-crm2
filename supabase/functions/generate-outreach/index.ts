// Génère un message d'outreach adapté au prospect et au canal choisi.
// Utilise l'analyse digitale stockée pour personnaliser.
// Spécial WhatsApp: agent dédié — message court, humain, avec CTA léger.
// Journalisé dans ai_activity_logs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";
import { startActivity, finishActivity } from "../_shared/activity.ts";
import { assertProspectAccess } from "../_shared/auth.ts";

const CHANNEL_RULES: Record<string, string> = {
  email: "Email pro 90-150 mots. Objet accrocheur (max 50 char). Personnalisé avec un détail concret. Pas de jargon. CTA clair (proposer un call 15min). Signature simple.",
  whatsapp: "Message WhatsApp 40-70 mots, ton humain, comme un pro qui prend 30s pour t'écrire. PAS DE MARKDOWN ni de gras (le texte doit s'afficher tel quel sur WhatsApp). Émojis avec parcimonie (1-2 max). Tutoiement bienveillant possible. CTA léger : 'Ok pour un échange de 10 min cette semaine ?'. Identifie-toi en une ligne.",
  linkedin: "Note de connexion LinkedIn 280 caractères MAX. Direct, basé sur un point précis vu sur leur profil/entreprise. Question ouverte.",
  instagram: "DM Instagram 30-60 mots, ton décontracté pro, pas de pavé. Référence à leur compte/contenu. CTA = call ou audit gratuit.",
  tiktok: "DM TikTok 20-40 mots, très court, casual, référence à leur contenu. CTA simple (audit, échange).",
  sms: "SMS pro 160 caractères MAX. Direct, identifié, CTA call.",
};

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

    const { prospect_id, channel, tone, custom_angle } = await req.json() as {
      prospect_id: string; channel: string; tone?: string; custom_angle?: string;
    };
    if (!prospect_id || !channel) return jsonResponse({ error: "prospect_id & channel required" }, 400);
    if (!CHANNEL_RULES[channel]) return jsonResponse({ error: "Invalid channel" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const access = await assertProspectAccess(admin, prospect_id, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const prospect = access.prospect;

    activityId = await startActivity({
      userId: user.id,
      category: "outreach",
      action: `generate-outreach:${channel}`,
      targetType: "prospect",
      targetId: prospect_id,
      payload: { channel, tone, custom_angle },
    });

    const analysis = prospect.digital_analysis ?? null;
    const summary = analysis ? `
Analyse IA :
- Score : ${analysis.score}/100
- Pain points : ${(analysis.pain_points ?? []).join(", ") || "—"}
- Services recommandés : ${(analysis.recommended_services ?? []).map((s: any) => s.service).join(", ") || "—"}
- Angle commercial : ${analysis.angle ?? "—"}
` : "Aucune analyse IA disponible — génère un message générique mais qualitatif.";

    const tool = {
      type: "function",
      function: {
        name: "generate_message",
        parameters: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Objet (uniquement pour email, sinon vide)" },
            content: { type: "string", description: "Le message complet, prêt à envoyer" },
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  angle: { type: "string" },
                  content: { type: "string" },
                },
                required: ["angle", "content"],
                additionalProperties: false,
              },
              description: "2 variantes alternatives pour A/B test",
            },
            follow_up_1: { type: "string", description: "Relance courte J+2 prête à envoyer" },
            follow_up_2: { type: "string", description: "Relance courte J+5 prête à envoyer" },
            personalization_notes: { type: "array", items: { type: "string" }, description: "Détails utilisés pour personnaliser" },
          },
          required: ["subject", "content", "variants", "follow_up_1", "follow_up_2", "personalization_notes"],
          additionalProperties: false,
        },
      },
    };

    const systemPrompt = `Tu es un copywriter outbound expert pour SMMA. Tu écris des messages qui convertissent.
Règles du canal "${channel}" : ${CHANNEL_RULES[channel]}
Ton : ${tone ?? "professionnel mais humain et direct"}.
Tu n'utilises JAMAIS de formulations bateau ("J'espère que vous allez bien", "Je me permets de"). Tu vas droit au but.
Tu personnalises avec UN détail concret du prospect. Tu termines par un CTA clair et simple.`;

    const userPrompt = `Prospect :
- Entreprise : ${prospect.name}
- Contact : ${prospect.contact_name ?? prospect.dirigeant ?? "—"}
- Secteur : ${prospect.sector ?? "—"}
- Ville : ${prospect.city ?? "—"}
- Site : ${prospect.website ?? "PAS DE SITE"}
- Note Google : ${prospect.rating ?? "—"} (${prospect.reviews_count ?? 0} avis)

${summary}

${custom_angle ? `Angle imposé par le SDR : ${custom_angle}` : ""}

Génère LE message ${channel} parfait pour ouvrir la conversation, plus 2 variantes A/B et 2 relances courtes.`;

    const { parsed, provider } = await callAI({
      provider: "auto",
      systemPrompt,
      userPrompt,
      tool,
      toolName: "generate_message",
    });

    const { data: saved, error: insErr } = await admin.from("outreach_messages").insert({
      prospect_id,
      channel,
      subject: parsed.subject || null,
      content: parsed.content,
      status: "draft",
      generated_by_ai: true,
      created_by: user.id,
    }).select("*").single();

    if (insErr) {
      await finishActivity(activityId, { ok: false, durationMs: Date.now() - startTs, error: insErr.message });
      return jsonResponse({ error: insErr.message }, 500);
    }

    // Construit le lien wa.me prêt à l'emploi côté client
    let waLink: string | null = null;
    if (channel === "whatsapp" && prospect.phone) {
      const cleaned = String(prospect.phone).replace(/[^\d]/g, "");
      waLink = `https://wa.me/${cleaned}?text=${encodeURIComponent(parsed.content)}`;
    }

    await finishActivity(activityId, {
      ok: true, durationMs: Date.now() - startTs,
      result: { message_id: saved.id, provider, channel, variants_count: parsed.variants?.length ?? 0 },
    });

    return jsonResponse({ ok: true, message: saved, wa_link: waLink, variants: parsed.variants ?? [], follow_ups: [parsed.follow_up_1, parsed.follow_up_2].filter(Boolean), personalization_notes: parsed.personalization_notes ?? [] });
  } catch (e) {
    await finishActivity(activityId, { ok: false, durationMs: Date.now() - startTs, error: (e as Error).message });
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
