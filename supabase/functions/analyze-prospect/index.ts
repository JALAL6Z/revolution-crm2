// Analyse les besoins digitaux d'un prospect via le routeur IA interne.
// Vérifie RÉELLEMENT : site web (HTTP), PageSpeed, avis Google (web search).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";
import { assertProspectAccess } from "../_shared/auth.ts";

// ── Vérifie si un site web est accessible ─────────────────────────────────
async function checkWebsite(url: string): Promise<{ accessible: boolean; status: number | null; redirected: boolean; finalUrl: string | null; loadTime: number | null }> {
  if (!url) return { accessible: false, status: null, redirected: false, finalUrl: null, loadTime: null };
  const normalized = url.startsWith("http") ? url : `https://${url}`;
  const start = Date.now();
  try {
    const res = await fetch(normalized, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RevolutionCRM/1.0)" },
    });
    const loadTime = Date.now() - start;
    return {
      accessible: res.ok || res.status < 500,
      status: res.status,
      redirected: res.redirected,
      finalUrl: res.url !== normalized ? res.url : null,
      loadTime,
    };
  } catch {
    return { accessible: false, status: null, redirected: false, finalUrl: null, loadTime: null };
  }
}

// ── PageSpeed Insights (API gratuite, pas de clé requise) ─────────────────
async function checkPageSpeed(url: string): Promise<{ score: number | null; fcp: string | null; lcp: string | null }> {
  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { score: null, fcp: null, lcp: null };
    const data = await res.json();
    const cats = data?.lighthouseResult?.categories;
    const audits = data?.lighthouseResult?.audits;
    return {
      score: cats?.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
      fcp: audits?.["first-contentful-paint"]?.displayValue ?? null,
      lcp: audits?.["largest-contentful-paint"]?.displayValue ?? null,
    };
  } catch {
    return { score: null, fcp: null, lcp: null };
  }
}

// ── Recherche DuckDuckGo pour les vrais avis Google ───────────────────────
async function searchGoogleReviews(businessName: string, city: string): Promise<string> {
  try {
    const query = encodeURIComponent(`${businessName} ${city} avis google`);
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${query}&format=json&no_redirect=1&no_html=1&skip_disambig=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const snippets = [
      data.AbstractText,
      ...(data.RelatedTopics ?? []).slice(0, 3).map((t: any) => t.Text ?? ""),
    ].filter(Boolean).join(" ");
    return snippets.slice(0, 600);
  } catch {
    return "";
  }
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
    if (!prospect_id) return jsonResponse({ error: "prospect_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const access = await assertProspectAccess(admin, prospect_id, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const prospect = access.prospect;

    // ── Vérifications réelles en parallèle ────────────────────────────────
    const [siteCheck, reviewsSnippet] = await Promise.all([
      prospect.website ? checkWebsite(prospect.website) : Promise.resolve({ accessible: false, status: null, redirected: false, finalUrl: null, loadTime: null }),
      searchGoogleReviews(prospect.name, prospect.city ?? ""),
    ]);

    // PageSpeed seulement si le site est accessible (évite timeout inutile)
    const pageSpeed = siteCheck.accessible && prospect.website
      ? await checkPageSpeed(prospect.website)
      : { score: null, fcp: null, lcp: null };

    // ── Contexte enrichi avec données RÉELLES ──────────────────────────────
    const siteStatus = !prospect.website
      ? "AUCUN SITE WEB"
      : !siteCheck.accessible
      ? `SITE INACCESSIBLE (erreur ${siteCheck.status ?? "timeout"}) — le site ne charge pas du tout`
      : `Site accessible (HTTP ${siteCheck.status}, chargé en ${siteCheck.loadTime}ms${siteCheck.redirected ? ", redirigé vers " + siteCheck.finalUrl : ""})`;

    const speedStatus = pageSpeed.score != null
      ? `Score PageSpeed mobile : ${pageSpeed.score}/100 (FCP: ${pageSpeed.fcp ?? "?"}, LCP: ${pageSpeed.lcp ?? "?"})`
      : siteCheck.accessible ? "PageSpeed non disponible" : "Site inaccessible — pas de mesure possible";

    const reviewsStatus = prospect.reviews_count && prospect.reviews_count > 0
      ? `${prospect.reviews_count} avis Google · Note : ${prospect.rating ?? "?"}/5`
      : reviewsSnippet
      ? `Données avis depuis le web : ${reviewsSnippet}`
      : "Aucun avis Google trouvé en base — à vérifier manuellement";

    const context = `
Entreprise : ${prospect.name}
Secteur : ${prospect.sector ?? "inconnu"}
Ville : ${prospect.city ?? "—"} (${prospect.country ?? "France"})
Téléphone : ${prospect.phone ?? "—"}
Email : ${prospect.email ?? "—"}

— VÉRIFICATION SITE WEB EN TEMPS RÉEL —
URL déclarée : ${prospect.website ?? "aucune"}
Résultat : ${siteStatus}
Performance : ${speedStatus}

— AVIS GOOGLE —
${reviewsStatus}

— RÉSEAUX SOCIAUX —
Instagram : ${prospect.instagram_handle ?? "non trouvé"}
LinkedIn : ${prospect.linkedin_url ?? "non trouvé"}

— DONNÉES ENTREPRISE —
Dirigeant : ${prospect.dirigeant ?? "—"}
Effectif : ${prospect.employees_count ?? "?"} employés
CA estimé : ${prospect.revenue_estimate ?? "?"} €
SIREN : ${prospect.siren ?? "—"}
`.trim();

    const systemPrompt = `Tu es un consultant senior en transformation digitale pour Revolution Agency, une SMMA full-service.

POSITIONNEMENT CLÉ : Nous pouvons aider TOUS les types de prospects, qu'ils aient un site ou non, car nos services vont bien au-delà du web :
- Automatisation des tâches métier (devis PDF automatiques, relances clients auto, prise de RDV en ligne, facturation automatique, CRM personnalisé)
- Génération de clients (Google Ads local, Meta Ads, SEO local, Google My Business)
- Présence digitale (site web, refonte, app mobile, réseaux sociaux)
- Outils IA métier (chatbot client, agent SDR, réponse automatique aux avis Google, rapport automatique)

Un garage avec un bon site web a quand même besoin d'automatiser ses devis, ses relances, son agenda.
Un restaurant avec 115 avis Google peut doubler ses réservations avec Meta Ads et un système de réservation auto.
Un artisan sans site EST une opportunité mais un artisan AVEC un site obsolète l'est tout autant.

RÈGLE ABSOLUE : base-toi UNIQUEMENT sur les données réelles fournies. Ne suppose rien.
- Si le site est "INACCESSIBLE" → c'est un fait réel, c'est une opportunité de refonte.
- Si les avis indiquent un nombre précis → utilise ce chiffre exact, c'est une force à exploiter.
- Identifie toujours AU MOINS une opportunité d'automatisation métier pour chaque prospect.
- Le score doit refléter le POTENTIEL COMMERCIAL, pas juste l'absence de digital.`;

    const tool = {
      type: "function",
      function: {
        name: "analyze_prospect",
        description: "Renvoie l'analyse digitale structurée basée sur les données réelles vérifiées",
        parameters: {
          type: "object",
          properties: {
            score: { type: "integer", minimum: 0, maximum: 100, description: "Score de qualité du lead 0-100" },
            ai_note: { type: "string", description: "Note synthèse de 3-5 phrases basée sur les faits vérifiés" },
            pain_points: { type: "array", items: { type: "string" }, description: "Problèmes digitaux réels identifiés (basés sur les vérifications)" },
            recommended_services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service: { type: "string" },
                  why: { type: "string", description: "Justification basée sur un fait réel observé" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  estimated_budget: { type: "string" },
                },
                required: ["service", "why", "priority"],
                additionalProperties: false,
              },
            },
            best_channels: { type: "array", items: { type: "string", enum: ["email", "whatsapp", "linkedin", "instagram", "tiktok", "phone"] } },
            angle: { type: "string", description: "Angle d'attaque commercial basé sur la réalité observée" },
            estimated_budget: { type: "string" },
            closing_probability: { type: "integer", minimum: 0, maximum: 100 },
            urgency: { type: "string", enum: ["high", "medium", "low"] },
            primary_service_to_sell: { type: "string" },
            next_best_action: { type: "string" },
            score_reason: { type: "string", description: "Justification du score basée sur les données réelles" },
            buying_triggers: { type: "array", items: { type: "string" } },
            site_status: { type: "string", description: "Résumé du statut réel du site web (accessible/inaccessible/absent)" },
          },
          required: ["score", "ai_note", "pain_points", "recommended_services", "best_channels", "angle", "estimated_budget", "closing_probability", "urgency", "primary_service_to_sell", "next_best_action", "score_reason", "buying_triggers", "site_status"],
          additionalProperties: false,
        },
      },
    };

    const aiResult = await callAI({
      systemPrompt,
      userPrompt: `Analyse ce prospect et identifie toutes les opportunités commerciales (automatisation, digital, ads, outils IA) :\n\n${context}`,
      provider: "auto",
      tool,
      toolName: "analyze_prospect",
    });
    const analysis = aiResult.parsed;

    // Mise à jour base avec données réelles aussi
    await admin.from("prospects").update({
      digital_analysis: {
        ...analysis,
        _verified: {
          site_accessible: siteCheck.accessible,
          site_status_code: siteCheck.status,
          site_load_time_ms: siteCheck.loadTime,
          pagespeed_score: pageSpeed.score,
          checked_at: new Date().toISOString(),
        },
      },
      analysis_score: analysis.score,
      ai_note: analysis.ai_note,
      pain_points: analysis.pain_points,
      recommended_services: (analysis.recommended_services ?? []).map((s: any) => s.service),
      score: analysis.score,
    }).eq("id", prospect_id);

    await admin.from("activity_log").insert({
      action: "prospect_analyzed",
      entity_type: "prospect",
      entity_id: prospect_id,
      user_id: user.id,
      details: { score: analysis.score, site_accessible: siteCheck.accessible, pagespeed: pageSpeed.score },
    });

    return jsonResponse({ ok: true, analysis });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
