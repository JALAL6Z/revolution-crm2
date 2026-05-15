// Agent WhatsApp dédié : récupère / enrichit les données du prospect (analyse digitale si dispo,
// notes, secteur, site web) puis génère un message WhatsApp ultra personnalisé.
// Renvoie aussi un lien wa.me prêt à l'emploi (le SDR clique → WhatsApp s'ouvre pré-rempli).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";
import { startActivity, finishActivity } from "../_shared/activity.ts";

function normalizePhone(raw: string | null | undefined, defaultCC = "33"): string | null {
  if (!raw) return null;
  let n = String(raw).replace(/[^\d+]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (n.startsWith("0") && !n.startsWith("00")) n = `+${defaultCC}${n.slice(1)}`;
  if (!n.startsWith("+") && n.length >= 9) n = `+${n}`;
  const digits = n.replace(/[^\d]/g, "");
  return digits.length >= 8 ? digits : null;
}

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

    const { prospect_id, tone, custom_angle, sender_name, default_country_code } = await req.json() as {
      prospect_id: string; tone?: string; custom_angle?: string; sender_name?: string; default_country_code?: string;
    };
    if (!prospect_id) return jsonResponse({ error: "prospect_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: p, error } = await admin.from("prospects").select("*").eq("id", prospect_id).single();
    if (error || !p) return jsonResponse({ error: "Prospect introuvable" }, 404);

    activityId = await startActivity({
      userId: user.id, category: "outreach", action: "agent-whatsapp",
      targetType: "prospect", targetId: prospect_id,
      payload: { tone, custom_angle, sender_name },
    });

    const cleanedPhone = normalizePhone(p.phone, default_country_code ?? "33");
    if (!cleanedPhone) {
      await finishActivity(activityId, { ok: false, durationMs: Date.now() - startTs, error: "no_phone" });
      return jsonResponse({ error: "Ce prospect n'a pas de numéro de téléphone exploitable." }, 400);
    }

    const analysis = p.digital_analysis ?? null;
    const analysisBlock = analysis ? `
Analyse IA :
- Score : ${analysis.score}/100
- Pain points : ${(analysis.pain_points ?? []).join(", ") || "—"}
- Services recommandés : ${(analysis.recommended_services ?? []).map((s: any) => s.service).join(", ") || "—"}
- Angle commercial : ${analysis.angle ?? "—"}
` : `Aucune analyse IA disponible pour ce prospect — base-toi sur les infos brutes.`;

    const tool = {
      type: "function",
      function: {
        name: "build_whatsapp",
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", description: "Le message WhatsApp final, sans markdown, prêt à être copié-collé. 40-90 mots." },
            short_pitch: { type: "string", description: "Une phrase d'identification (qui je suis, pourquoi je contacte) en 12 mots max" },
            cta: { type: "string", description: "Le call-to-action utilisé dans le message" },
          },
          required: ["content", "short_pitch", "cta"],
          additionalProperties: false,
        },
      },
    };

    const systemPrompt = `Tu es un closer SMMA expert en prospection WhatsApp.
Règles strictes:
- 40 à 90 mots, jamais plus.
- AUCUN markdown (pas de **, pas de #, pas d'emojis si pas nécessaire — max 1 emoji).
- Tutoie ou vouvoie selon le ton demandé.
- Premier message: présente-toi en une ligne (qui tu es, ce que tu fais), montre que tu connais le prospect (un détail concret), propose un échange court.
- INTERDIT: "J'espère que vous allez bien", "Je me permets", "N'hésitez pas".
- Le message doit s'afficher tel quel sur WhatsApp Web/mobile sans formatage.`;

    const userPrompt = `Tu écris un PREMIER message WhatsApp à ce prospect:

Entreprise : ${p.name}
Contact : ${p.contact_name ?? p.dirigeant ?? "le dirigeant"}
Secteur : ${p.sector ?? "—"}
Ville : ${p.city ?? "—"}
Site : ${p.website ?? "PAS DE SITE WEB"}
Note Google : ${p.rating ?? "—"} (${p.reviews_count ?? 0} avis)
Notes internes : ${p.notes || "—"}

${analysisBlock}

${custom_angle ? `Angle imposé : ${custom_angle}` : ""}
${sender_name ? `Tu signes "${sender_name}".` : ""}
Ton : ${tone ?? "humain, direct, pro"}

Génère LE message WhatsApp parfait pour ouvrir la conversation et obtenir un call de 10 min.`;

    const { parsed, provider } = await callAI({
      provider: "auto",
      systemPrompt, userPrompt, tool, toolName: "build_whatsapp",
    });

    // Enregistre le draft dans outreach_messages
    const { data: saved } = await admin.from("outreach_messages").insert({
      prospect_id, channel: "whatsapp",
      content: parsed.content, status: "draft",
      generated_by_ai: true, created_by: user.id,
    }).select("*").single();

    const waLink = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(parsed.content)}`;

    await admin.from("activity_log").insert({
      action: "whatsapp_message_generated", entity_type: "prospect", entity_id: prospect_id,
      user_id: user.id, details: { message_id: saved?.id, provider },
    });

    await finishActivity(activityId, {
      ok: true, durationMs: Date.now() - startTs,
      result: { message_id: saved?.id, provider, phone: cleanedPhone },
    });

    return jsonResponse({
      ok: true,
      message: saved,
      content: parsed.content,
      short_pitch: parsed.short_pitch,
      cta: parsed.cta,
      phone: cleanedPhone,
      wa_link: waLink,
    });
  } catch (e) {
    await finishActivity(activityId, { ok: false, durationMs: Date.now() - startTs, error: (e as Error).message });
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
