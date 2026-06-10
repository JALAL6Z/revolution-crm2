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
        description: "Script d'appel cold call expert adapté à l'offre Revolution Agency",
        parameters: {
          type: "object",
          properties: {
            opening: { type: "string", description: "Ouverture mot pour mot — 20 secondes max, accroche chiffrée, confirmer décideur" },
            discovery_questions: { type: "array", items: { type: "string" }, description: "5 questions de découverte qui font mal — adaptées au secteur, parlent de temps perdu et chantiers manqués" },
            lead_magnets: { type: "array", items: { type: "string" }, description: "3 stats/chiffres impactants adaptés au secteur du prospect (ex: 'un plombier perd 24 000€/an en devis non envoyés')" },
            value_props: { type: "array", items: { type: "string" }, description: "3 propositions de valeur concrètes sans jargon tech — en termes de temps récupéré et chantiers gagnés" },
            competitor_handling: { type: "string", description: "Comment répondre si le prospect dit 'j'ai déjà reçu des appels d'autres agences' — différenciation claire vs concurrents" },
            objections: {
              type: "array",
              items: {
                type: "object",
                properties: { objection: { type: "string" }, response: { type: "string" } },
                required: ["objection", "response"],
                additionalProperties: false,
              },
              description: "6 objections types avec réponse de closing — inclure 'j'ai déjà essayé' et 'j'ai un logiciel à 200€/an'",
            },
            closing: { type: "string", description: "Fermeture pour décrocher un RDV de 20 min + message WhatsApp audit à envoyer dans l'heure" },
            tone_advice: { type: "string", description: "Conseil de ton adapté à ce prospect précis — secteur, profil, contexte" },
            call_plan: { type: "array", items: { type: "string" }, description: "Plan d'appel étape par étape en 6 points avec timing" },
            discovery_diagnosis: { type: "string", description: "Ce qu'il faut diagnostiquer — douleurs spécifiques à son secteur et situation actuelle" },
            simulation: {
              type: "array",
              items: {
                type: "object",
                properties: { prospect_says: { type: "string" }, closer_replies: { type: "string" } },
                required: ["prospect_says", "closer_replies"],
                additionalProperties: false,
              },
              description: "5 échanges réalistes incluant au moins un 'j'ai déjà été appelé' et un 'j'ai pas le temps'",
            },
            whatsapp_message: { type: "string", description: "Message WhatsApp audit à envoyer dans l'heure après l'appel — personnalisé avec les données du prospect" },
            post_call_summary_template: { type: "string", description: "Template de résumé après appel à remplir" },
            proposal_angle: { type: "string", description: "Angle commercial pour le RDV de présentation — comment pitcher le pack 450€ + 599€/mois" },
          },
          required: ["opening", "discovery_questions", "lead_magnets", "value_props", "competitor_handling", "objections", "closing", "tone_advice", "call_plan", "discovery_diagnosis", "simulation", "whatsapp_message", "post_call_summary_template", "proposal_angle"],
          additionalProperties: false,
        },
      },
    };

    const ctx = `Entreprise: ${p.name}
Secteur: ${p.sector ?? "—"} | Ville: ${p.city ?? "—"}
Site web: ${p.website ? `${p.website} (${p.ai_note?.includes("INACCESSIBLE") ? "NE FONCTIONNE PAS" : "existant"})` : "AUCUN SITE"}
Avis Google: ${p.reviews_count ? `${p.reviews_count} avis · ${p.rating}/5` : "inconnu"}
Pain points identifiés: ${(p.pain_points ?? []).join(", ") || "à découvrir"}
Services recommandés: ${(p.recommended_services ?? []).join(", ") || "à qualifier"}
Note IA: ${p.ai_note ?? "—"}
Dirigeant: ${p.dirigeant ?? "—"}`;

    const { parsed, provider } = await callAI({
      provider: "auto",
      systemPrompt: `Tu es Warda (ou Sabri), setter expert cold call pour Revolution Agency. Tu as 2 ans d'expérience en prospection téléphonique sur des artisans et commerçants. Tu connais par cœur l'offre et tu sais que les prospects ont DÉJÀ reçu des appels de concurrents.

═══ L'OFFRE REVOLUTION AGENCY — 3 NIVEAUX ═══

NIVEAU 1 — ÉCOSYSTÈME COMPLET (pitcher en priorité TOUJOURS) : 450€ setup + 599€/mois
C'est l'offre principale à vendre. Un écosystème complet clé en main :
• Système de devis depuis le téléphone (PDF automatique au client en 3 min)
• Relances automatiques devis non signés (J+2, J+5, J+14)
• Google My Business optimisé + photos + réponses aux avis chaque semaine
• Google Ads local géré chaque semaine + rapport mensuel des appels générés
• Site vitrine mobile-first si absent ou cassé
• Agenda en ligne + prise de RDV automatique quand il est sur chantier
• Support WhatsApp direct
→ Argument : "C'est pas un outil, c'est un écosystème complet. Une agence Google Ads seule vous coûte 400 à 500€/mois sans rien d'autre."

NIVEAU 2 — ÉCOSYSTÈME SANS GOOGLE ADS (si blocage prix ferme) : 450€ setup + 399€/mois
• Même chose sans la gestion Google Ads
→ Descendre ici seulement si le prospect répète son blocage prix 2 fois. Ne jamais proposer en premier.

NIVEAU 3 — AUTOMATISATION SEULE (si prospect a déjà GMB + site + Google Ads qui fonctionnent) : one-shot setup + 50€/mois
• Système de devis automatique depuis le téléphone
• Relances automatiques devis non signés
• Prise de RDV automatique
• Support WhatsApp
→ Utiliser UNIQUEMENT si le prospect dit clairement qu'il a déjà tout le reste et que ça tourne bien. C'est l'entrée de gamme pour créer la relation — on upsell vers l'écosystème complet à J+90.
→ Argument : "On commence par vous faire gagner du temps sur ce qui vous prend le plus de temps — les devis et les relances. C'est 50€/mois, vous voyez la différence en 30 jours."

═══ ARBRE DE DÉCISION SELON LE PROSPECT ═══
• Pas de site → pitcher Niveau 1 (site + tout)
• Site OK mais peu de clients → pitcher Niveau 1 (Google Ads + écosystème)
• A Google Ads mal configuré → pitcher Niveau 1 ("on gère ça nous-mêmes chaque semaine, pas comme ce que vous avez eu")
• A tout mais perd du temps sur les devis/relances → pitcher Niveau 3 (50€/mois) puis upsell
• Prix trop cher sur Niveau 1 → Niveau 2 (399€/mois)

═══ L'ANGLE CONCURRENTS LOCAUX (OBLIGATOIRE dans l'appel) ═══
Placer cette phrase naturellement pendant la découverte ou la présentation :
→ "On a mis en place cet écosystème chez certains de vos confrères dans la région de Lyon et ses alentours — des plombiers, électriciens, maçons. Ce qui revient le plus c'est qu'ils récupèrent facilement 2 à 3 chantiers par mois qu'ils manquaient avant."

Si le prospect demande des noms → "Je peux pas donner les noms, confidentialité client. Mais je peux vous mettre en contact avec l'un d'eux si vous signez — il vous dira lui-même."

═══ LA PHRASE SIGNATURE ═══
"On vous fait récupérer 10h par semaine et on vous génère 10 chantiers de plus par mois — sans que vous changiez votre façon de travailler."

═══ LES CHIFFRES À PLACER ═══
• 480h perdues/an sur l'administratif = 24 000€ de chantiers non réalisés (à 50€/h)
• 30% des devis ne sont jamais signés par manque de relance
• 2 à 3 chantiers perdus/mois à cause des appels manqués sur chantier
• ROI minimum 3x sur l'écosystème : 7 188€/an pour 599€/mois
• 80% des clients vérifient Google avant d'appeler, même recommandés

═══ L'ARGUMENT RISQUE ZÉRO — À PLACER SYSTÉMATIQUEMENT ═══
"On vous offre 15 jours gratuits sur la totalité de l'écosystème. Si au bout de 15 jours ça vous convient pas, on annule — sans frais, sans engagement, sans justification. Vous avez rien à perdre, juste à voir si ça marche pour vous."

→ C'est l'argument de fermeture le plus puissant. Le placer APRÈS avoir qualifié la douleur, jamais en ouverture.
→ Si le prospect hésite encore après ça : "Qu'est-ce qui vous retient exactement ? Parce que là il y a zéro risque pour vous."

═══ RÈGLES ABSOLUES ═══
1. Ne jamais dire "IA", "intelligence artificielle" ou "automatisation" — dire "système", "outil", "c'est automatique"
2. Ne jamais annoncer le prix avant "un chantier ça représente combien pour vous ?"
3. L'objectif de l'appel = décrocher un RDV de 20 min, PAS vendre
4. Style : Chris Voss (mirroring, empathie tactique) + direct + chiffres concrets
5. Écouter 70%, parler 30%
6. TOUJOURS mentionner les confrères locaux dans l'appel — c'est la preuve sociale la plus forte
7. TOUJOURS mentionner les 15 jours offerts + sans engagement dans le closing

═══ FACE AUX CONCURRENTS ═══
Quand le prospect dit "j'ai déjà reçu des appels" :
→ "Ils vous ont proposé quoi exactement ? Un site ? De la pub ? (écouter) La différence avec nous c'est qu'on a déjà des clients dans votre secteur à Lyon — des artisans comme vous. On ne découvre pas votre métier. Et on vend pas un outil qu'on vous laisse gérer seul — on gère tout nous-mêmes."`,

      userPrompt: `${objective ? `Objectif spécifique: ${objective}\n` : ""}Génère un script d'appel cold call EXPERT, mot pour mot, ultra-personnalisé pour ce prospect.

Adapte TOUT au secteur "${p.sector ?? "artisan/commerçant"}" :
- Les questions de découverte doivent parler de ses douleurs réelles (ex: pour un plombier → devis sur chantier, appels manqués urgences)
- Les lead magnets = stats chiffrées qui font mal dans son secteur précis
- Le ton adapté à son profil (${p.reviews_count ? `${p.reviews_count} avis → il a une activité établie` : "pas d'avis → il débute ou se passe de Google"})

Données prospect :
${ctx}

IMPORTANT : Le prospect a probablement déjà reçu des appels d'autres agences qui lui parlent de "site web" ou "automatisation". Différencie-toi dès l'ouverture en parlant de temps et d'argent concrets, pas de technologie.`,
      tool,
      toolName: "build_call_script",
    });

    const fullScript = [
      `=== OUVERTURE ===`, parsed.opening,
      ``, `=== PLAN D'APPEL ===`, ...(parsed.call_plan ?? []).map((s: string, i: number) => `${i + 1}. ${s}`),
      ``, `=== QUESTIONS DE DÉCOUVERTE ===`, ...(parsed.discovery_questions ?? []).map((q: string, i: number) => `${i + 1}. ${q}`),
      ``, `=== LEAD MAGNETS — STATS À PLACER ===`, ...(parsed.lead_magnets ?? []).map((l: string) => `• ${l}`),
      ``, `=== PROPOSITIONS DE VALEUR ===`, ...(parsed.value_props ?? []).map((v: string) => `• ${v}`),
      ``, `=== FACE AUX CONCURRENTS ===`, parsed.competitor_handling,
      ``, `=== OBJECTIONS / RÉPONSES ===`, ...(parsed.objections ?? []).map((o: any) => `❓ ${o.objection}\n→ ${o.response}`),
      ``, `=== CLOSING + AGENDA ===`, parsed.closing,
      ``, `=== MESSAGE WHATSAPP APRÈS APPEL ===`, parsed.whatsapp_message,
      ``, `=== DIAGNOSTIC À CREUSER ===`, parsed.discovery_diagnosis,
      ``, `=== SIMULATION ===`, ...(parsed.simulation ?? []).map((s: { prospect_says: string; closer_replies: string }) => `Prospect: ${s.prospect_says}\nSetter: ${s.closer_replies}`),
      ``, `=== RÉSUMÉ APRÈS APPEL ===`, parsed.post_call_summary_template,
      ``, `=== ANGLE PROPOSITION RDV ===`, parsed.proposal_angle,
      ``, `=== TONALITÉ ===`, parsed.tone_advice,
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
        lead_magnets: parsed.lead_magnets,
        competitor_handling: parsed.competitor_handling,
        discovery_diagnosis: parsed.discovery_diagnosis,
        simulation: parsed.simulation,
        whatsapp_message: parsed.whatsapp_message,
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
