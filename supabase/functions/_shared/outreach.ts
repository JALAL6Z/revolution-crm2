import { callAI } from "./ai.ts";

export const CHANNEL_RULES: Record<string, string> = {
  email: "Email pro 90-150 mots. Objet accrocheur max 50 caractères. Personnalisé avec un détail concret. CTA call 15 min.",
  whatsapp: "Message WhatsApp 40-70 mots, ton humain et direct. Pas de markdown. 1 emoji maximum.",
  linkedin: "Note LinkedIn 280 caractères maximum. Directe, basée sur un point précis.",
  instagram: "DM Instagram 30-60 mots, ton décontracté pro. Pas de pavé.",
  tiktok: "DM TikTok 20-40 mots, très court et casual.",
  sms: "SMS 160 caractères maximum. Direct, identifié, CTA simple.",
};

export const SUPPORTED_OUTREACH_CHANNELS = Object.keys(CHANNEL_RULES);

export async function generateSequenceMessage(params: {
  prospect: any;
  channel: string;
  step: number;
  tone?: string | null;
  custom_angle?: string | null;
}) {
  const { prospect, channel, step, tone, custom_angle } = params;
  const isFollowUp = step > 0;
  const followUpHint = step === 1
    ? "Première relance. Référence brièvement le premier message, nouvel angle, plus court."
    : step === 2
      ? "Deuxième relance. Très court, style breakup: demande poliment si on clôt le sujet."
      : "Relance finale. Très court, utile, sans insistance.";
  const analysis = prospect.digital_analysis ?? null;
  const summary = analysis
    ? `Analyse: score ${analysis.score}/100; pain points: ${(analysis.pain_points ?? []).join(", ")}; angle: ${analysis.angle ?? "—"}`
    : "Aucune analyse IA stockée.";

  const tool = {
    type: "function",
    function: {
      name: "generate_sequence_message",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Objet uniquement pour email, sinon vide" },
          content: { type: "string", description: "Message prêt à envoyer" },
          angle: { type: "string", description: "Angle de persuasion utilisé" },
        },
        required: ["subject", "content", "angle"],
        additionalProperties: false,
      },
    },
  };

  const result = await callAI({
    provider: "auto",
    systemPrompt: `Tu es copywriter outbound expert pour une SMMA. Règles canal "${channel}": ${CHANNEL_RULES[channel] ?? ""}. Ton: ${tone ?? "professionnel, humain, direct"}. Interdit: "J'espère que vous allez bien", "Je me permets", jargon inutile. Personnalise avec un détail concret.`,
    userPrompt: `Prospect:
- Entreprise: ${prospect.name}
- Contact: ${prospect.contact_name ?? prospect.dirigeant ?? "—"}
- Secteur: ${prospect.sector ?? "—"}
- Ville: ${prospect.city ?? "—"}
- Site: ${prospect.website ?? "PAS DE SITE"}
- Note Google: ${prospect.rating ?? "—"} (${prospect.reviews_count ?? 0} avis)

${summary}
${custom_angle ? `Angle imposé: ${custom_angle}` : ""}
${isFollowUp ? `\nContexte: ${followUpHint}` : ""}

Génère le message ${channel} ${isFollowUp ? `de relance étape ${step}` : "d'ouverture"} pour obtenir une réponse ou un call court.`,
    tool,
    toolName: "generate_sequence_message",
  });

  return result.parsed as { subject: string; content: string; angle: string };
}
