// Audit SEO/Perf/UX d'un site via Google PageSpeed Insights (API gratuite, sans clé requise pour usage modéré)
// + analyse IA des résultats pour générer recommandations actionnables.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function sameOriginUrl(base: string, path: string) {
  const u = new URL(base);
  return `${u.origin}${path}`;
}

function stripTags(value = "") {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchOne(html: string, re: RegExp) {
  return html.match(re)?.[1]?.trim() ?? null;
}

function countMatches(html: string, re: RegExp) {
  return html.match(re)?.length ?? 0;
}

function normalizeInternalLink(base: string, href: string) {
  try {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return null;
    const baseUrl = new URL(base);
    const next = new URL(href, baseUrl.origin);
    if (next.hostname !== baseUrl.hostname) return null;
    next.hash = "";
    next.search = "";
    const path = next.pathname.replace(/\/+$/, "") || "/";
    if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mov|mp3)$/i.test(path)) return null;
    return `${next.origin}${path}`;
  } catch {
    return null;
  }
}

function extractInternalLinks(base: string, html: string) {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)]
    .map((m) => normalizeInternalLink(base, m[1]))
    .filter(Boolean) as string[];
  return [...new Set(links)];
}

function inspectHtmlPage(url: string, html: string) {
  const title = stripTags(matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? "");
  const metaDescription = matchOne(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)
    ?? matchOne(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i);
  const canonical = matchOne(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1])).filter(Boolean).slice(0, 5);
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1])).filter(Boolean).slice(0, 10);
  const text = stripTags(html);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const images = countMatches(html, /<img\b/gi);
  const imagesWithoutAlt = countMatches(html, /<img(?![^>]*\balt=)[^>]*>/gi);
  const forms = countMatches(html, /<form\b/gi);
  const phoneLinks = countMatches(html, /href=["']tel:/gi);
  const mailLinks = countMatches(html, /href=["']mailto:/gi);
  const whatsappLinks = countMatches(html, /(?:wa\.me|api\.whatsapp\.com|whatsapp:\/\/)/gi);
  const ctaMatches = [...text.matchAll(/\b(contact|devis|réserver|reserver|appeler|prendre rendez-vous|acheter|commander|s'inscrire|inscription)\b/gi)].length;

  return {
    url,
    title,
    title_length: title.length,
    meta_description: metaDescription,
    meta_description_length: metaDescription?.length ?? 0,
    canonical,
    h1_count: h1s.length,
    h1s,
    h2_count: h2s.length,
    h2s,
    word_count: words,
    images_count: images,
    images_without_alt_count: imagesWithoutAlt,
    forms_count: forms,
    phone_links_count: phoneLinks,
    email_links_count: mailLinks,
    whatsapp_links_count: whatsappLinks,
    cta_mentions_count: ctaMatches,
    issues: [
      title.length < 25 || title.length > 65 ? "title_length" : null,
      !metaDescription || metaDescription.length < 70 || metaDescription.length > 170 ? "meta_description" : null,
      h1s.length !== 1 ? "h1" : null,
      h2s.length < 2 ? "h2_structure" : null,
      !canonical ? "canonical" : null,
      words < 350 ? "thin_content" : null,
      images > 0 && imagesWithoutAlt / images >= 0.3 ? "image_alt" : null,
      forms + phoneLinks + whatsappLinks === 0 ? "no_conversion_path" : null,
    ].filter(Boolean),
  };
}

async function fetchText(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 RevolutionCRM-AuditBot/1.0" },
    });
    if (!res.ok) return { ok: false, status: res.status, text: "" };
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

async function inspectWebsite(url: string) {
  const [{ ok, status, text: html }, robots, sitemap] = await Promise.all([
    fetchText(url),
    fetchText(sameOriginUrl(url, "/robots.txt"), 5000),
    fetchText(sameOriginUrl(url, "/sitemap.xml"), 5000),
  ]);

  if (!ok || !html) {
    return {
      reachable: false,
      status,
      error: "HTML non récupérable",
      robots: { exists: robots.ok, status: robots.status },
      sitemap: { exists: sitemap.ok, status: sitemap.status },
    };
  }

  const homepage = inspectHtmlPage(url, html);
  const linksInternal = countMatches(html, /<a[^>]+href=["'](?:\/|#|mailto:|tel:)/gi);
  const crawlTargets = extractInternalLinks(url, html)
    .filter((link) => link !== normalizeInternalLink(url, url))
    .slice(0, 9);
  const crawledResponses = await Promise.all(crawlTargets.map((link) => fetchText(link, 6000).then((r) => ({ link, ...r }))));
  const crawledPages = [
    homepage,
    ...crawledResponses.filter((r) => r.ok && r.text).map((r) => inspectHtmlPage(r.link, r.text)),
  ];

  const tracking = {
    google_analytics: /gtag\(|google-analytics|G-[A-Z0-9]+|UA-\d+/i.test(html),
    google_tag_manager: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html),
    meta_pixel: /connect\.facebook\.net|fbq\(|facebook pixel/i.test(html),
    tiktok_pixel: /analytics\.tiktok\.com|ttq\(/i.test(html),
    linkedin_insight: /snap\.licdn\.com|linkedin insight/i.test(html),
  };

  const seoScore = [
    homepage.title_length >= 25 && homepage.title_length <= 65,
    Boolean(homepage.meta_description && homepage.meta_description_length >= 70 && homepage.meta_description_length <= 170),
    homepage.h1_count === 1,
    homepage.h2_count >= 2,
    Boolean(homepage.canonical),
    robots.ok,
    sitemap.ok,
    homepage.images_count === 0 || homepage.images_without_alt_count / homepage.images_count < 0.3,
    homepage.word_count >= 350,
  ].filter(Boolean).length;

  const conversionScore = [
    homepage.forms_count > 0 || homepage.phone_links_count > 0 || homepage.whatsapp_links_count > 0,
    homepage.cta_mentions_count >= 2,
    homepage.phone_links_count > 0,
    homepage.email_links_count > 0 || homepage.forms_count > 0,
    homepage.whatsapp_links_count > 0,
  ].filter(Boolean).length;

  const trackingScore = Object.values(tracking).filter(Boolean).length;

  return {
    reachable: true,
    status,
    seo_on_page: {
      title: homepage.title,
      title_length: homepage.title_length,
      meta_description: homepage.meta_description,
      meta_description_length: homepage.meta_description_length,
      canonical: homepage.canonical,
      h1_count: homepage.h1_count,
      h1s: homepage.h1s,
      h2_count: homepage.h2_count,
      h2s: homepage.h2s,
      word_count: homepage.word_count,
      internal_links_count: linksInternal,
      images_count: homepage.images_count,
      images_without_alt_count: homepage.images_without_alt_count,
      robots_exists: robots.ok,
      sitemap_exists: sitemap.ok,
    },
    crawl: {
      pages_checked: crawledPages.length,
      pages: crawledPages.map((page) => ({
        url: page.url,
        title: page.title,
        meta_description: page.meta_description,
        h1_count: page.h1_count,
        word_count: page.word_count,
        cta_mentions_count: page.cta_mentions_count,
        issues: page.issues,
      })),
      issue_counts: crawledPages.reduce((acc: Record<string, number>, page) => {
        for (const issue of page.issues) acc[String(issue)] = (acc[String(issue)] ?? 0) + 1;
        return acc;
      }, {}),
    },
    tracking,
    conversion: {
      forms_count: homepage.forms_count,
      phone_links_count: homepage.phone_links_count,
      email_links_count: homepage.email_links_count,
      whatsapp_links_count: homepage.whatsapp_links_count,
      cta_mentions_count: homepage.cta_mentions_count,
    },
    local_seo: {
      has_phone: homepage.phone_links_count > 0 || /\b(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}\b/.test(stripTags(html)),
      has_address_signal: /\b\d{5}\b|rue|avenue|boulevard|place|chemin|route/gi.test(stripTags(html)),
      has_opening_hours_signal: /horaires|ouvert|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/gi.test(stripTags(html)),
    },
    free_scores: {
      seo_on_page: Math.round((seoScore / 9) * 100),
      conversion: Math.round((conversionScore / 5) * 100),
      tracking: Math.round((trackingScore / 5) * 100),
    },
    robots: { exists: robots.ok, status: robots.status },
    sitemap: { exists: sitemap.ok, status: sitemap.status },
  };
}

async function runPSI(url: string, strategy: "mobile" | "desktop") {
  const params = new URLSearchParams({ url, strategy });
  // SEO + Performance + Accessibility + Best Practices
  ["performance", "accessibility", "best-practices", "seo"].forEach((c) => params.append("category", c));
  const psiKey = Deno.env.get("PAGESPEED_API_KEY");
  if (psiKey) params.set("key", psiKey);
  const res = await fetch(`${PSI_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`PSI ${strategy} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const cats = data.lighthouseResult?.categories ?? {};
  return {
    strategy,
    perf: Math.round((cats.performance?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    a11y: Math.round((cats.accessibility?.score ?? 0) * 100),
    best: Math.round((cats["best-practices"]?.score ?? 0) * 100),
    audits: data.lighthouseResult?.audits ?? {},
  };
}

function topIssues(audits: Record<string, any>) {
  return Object.values(audits)
    .filter((a: any) => a?.score !== null && a?.score !== undefined && a.score < 0.9 && a.title)
    .sort((a: any, b: any) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 12)
    .map((a: any) => ({ title: a.title, description: a.description, score: a.score }));
}

function averageScores(values: Array<number | null | undefined>) {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!nums.length) return null;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function fmtScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}/100` : "indisponible";
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

    const body = await req.json() as { url?: string; prospect_id?: string };
    let url = body.url?.trim();
    const prospect_id = body.prospect_id;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let prospect: any = null;
    if (prospect_id) {
      const { data } = await admin.from("prospects").select("*").eq("id", prospect_id).maybeSingle();
      prospect = data;
      if (!url) url = prospect?.website ?? undefined;
    }
    if (!url) return jsonResponse({ error: "url ou prospect.website requis" }, 400);
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    // Insert pending row
    const { data: row, error: insErr } = await admin.from("site_audits").insert({
      prospect_id: prospect_id ?? null,
      url,
      status: "running",
      generated_by: user.id,
    }).select("*").single();
    if (insErr) return jsonResponse({ error: insErr.message }, 500);

    const websiteInspection = await inspectWebsite(url);
    const pageSpeedEnabled = Boolean(Deno.env.get("PAGESPEED_API_KEY"));
    let mobile: Awaited<ReturnType<typeof runPSI>> | null = null;
    let desktop: Awaited<ReturnType<typeof runPSI>> | null = null;
    const psiErrors: string[] = [];

    if (pageSpeedEnabled) {
      const [mobileResult, desktopResult] = await Promise.allSettled([runPSI(url, "mobile"), runPSI(url, "desktop")]);
      if (mobileResult.status === "fulfilled") {
        mobile = mobileResult.value;
      } else {
        psiErrors.push(`mobile: ${mobileResult.reason?.message ?? String(mobileResult.reason)}`);
      }
      if (desktopResult.status === "fulfilled") {
        desktop = desktopResult.value;
      } else {
        psiErrors.push(`desktop: ${desktopResult.reason?.message ?? String(desktopResult.reason)}`);
      }
    } else {
      psiErrors.push("PageSpeed non configuré: audit gratuit basé sur crawl HTML, SEO on-page, tracking et conversion.");
    }

    const freeScores = (websiteInspection as any).free_scores ?? {};
    const psiSeo = averageScores([mobile?.seo, desktop?.seo]);
    const score_perf = averageScores([mobile?.perf, desktop?.perf]);
    const score_seo = psiSeo == null
      ? freeScores.seo_on_page ?? null
      : Math.round(psiSeo * 0.65 + (freeScores.seo_on_page ?? psiSeo) * 0.35);
    const score_ux = averageScores([mobile?.a11y, desktop?.a11y]);
    const score_mobile = mobile?.perf ?? null;
    const score_global = averageScores([
      score_perf,
      score_seo,
      score_ux,
      score_mobile,
      freeScores.conversion,
      freeScores.tracking,
    ]);

    const findings = {
      mobile_top_issues: mobile ? topIssues(mobile.audits) : [],
      desktop_top_issues: desktop ? topIssues(desktop.audits) : [],
      pagespeed: {
        enabled: pageSpeedEnabled,
        mobile_available: Boolean(mobile),
        desktop_available: Boolean(desktop),
        errors: psiErrors,
      },
      website_inspection: websiteInspection,
    };

    // IA : recommendations actionnables pour SMMA
    const tool = {
      type: "function",
      function: {
        name: "audit_recommendations",
        parameters: {
          type: "object",
          properties: {
            executive_summary: { type: "string", description: "Résumé exécutif 2-3 phrases pour le prospect (français, ton expert mais accessible)" },
            critical_issues: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  impact: { type: "string", enum: ["seo", "perf", "ux", "mobile", "conversion"] },
                  severity: { type: "string", enum: ["high", "medium", "low"] },
                  fix: { type: "string", description: "Comment corriger en 1-2 phrases concrètes" },
                  estimated_revenue_impact: { type: "string", description: "Impact estimé business (ex: '+15% conv mobile')" },
                },
                required: ["title", "impact", "severity", "fix"],
                additionalProperties: false,
              },
            },
            quick_wins: { type: "array", items: { type: "string" }, description: "3-5 actions rapides à fort impact" },
            seven_day_plan: { type: "array", items: { type: "string" }, description: "Plan d'action sur 7 jours, concret et exécutable" },
            thirty_day_plan: { type: "array", items: { type: "string" }, description: "Plan d'amélioration sur 30 jours" },
            category_scores: {
              type: "object",
              properties: {
                seo: { type: "integer", minimum: 0, maximum: 100 },
                ux: { type: "integer", minimum: 0, maximum: 100 },
                speed: { type: "integer", minimum: 0, maximum: 100 },
                tracking: { type: "integer", minimum: 0, maximum: 100 },
                conversion: { type: "integer", minimum: 0, maximum: 100 },
                credibility: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["seo", "ux", "speed", "tracking", "conversion", "credibility"],
              additionalProperties: false,
            },
            recommended_offer: {
              type: "object",
              properties: {
                name: { type: "string" },
                pitch: { type: "string" },
                price_range: { type: "string" },
                deliverables: { type: "array", items: { type: "string" } },
              },
              required: ["name", "pitch", "price_range", "deliverables"],
              additionalProperties: false,
            },
            services_to_pitch: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service: { type: "string" },
                  why: { type: "string" },
                  estimated_budget: { type: "string" },
                },
                required: ["service", "why"],
                additionalProperties: false,
              },
              description: "Services SMMA à proposer au prospect basés sur l'audit",
            },
          },
          required: ["executive_summary", "critical_issues", "quick_wins", "seven_day_plan", "thirty_day_plan", "category_scores", "recommended_offer", "services_to_pitch"],
          additionalProperties: false,
        },
      },
    };

    const aiResult = await callAI({
      provider: "auto",
      systemPrompt: `Tu es un expert SEO, tracking, conversion et performance web pour une SMMA. Tu transformes des audits gratuits (PageSpeed + inspection HTML) en recommandations business actionnables et chiffrées. Tu rédiges en français, ton expert mais accessible.`,
      userPrompt: `Site audité : ${url}
Prospect : ${prospect?.name ?? "—"} (${prospect?.sector ?? "—"}, ${prospect?.city ?? "—"})

Scores Lighthouse :
- Performance mobile : ${fmtScore(mobile?.perf)} | desktop : ${fmtScore(desktop?.perf)}
- SEO : mobile ${fmtScore(mobile?.seo)} | desktop ${fmtScore(desktop?.seo)}
- Accessibilité : mobile ${fmtScore(mobile?.a11y)} | desktop ${fmtScore(desktop?.a11y)}
- Bonnes pratiques : mobile ${fmtScore(mobile?.best)} | desktop ${fmtScore(desktop?.best)}
- Statut PageSpeed : ${psiErrors.length ? psiErrors.join(" | ") : "OK"}

Top problèmes mobile :
${findings.mobile_top_issues.length ? findings.mobile_top_issues.map((i: any, n: number) => `${n + 1}. ${i.title}`).join("\n") : "PageSpeed indisponible: utilise l'inspection HTML/SEO gratuite ci-dessous."}

Inspection gratuite HTML/SEO/tracking/conversion :
${JSON.stringify(websiteInspection, null, 2).slice(0, 6000)}

Génère un audit business complet pour pitcher ce prospect. Appuie-toi aussi sur le SEO on-page, robots/sitemap, tracking pixels, formulaires, CTA et signaux local SEO. Ajoute un plan 7 jours, un plan 30 jours et une offre packagée vendable par une agence SMMA.`,
      tool,
      toolName: "audit_recommendations",
    });
    const recommendations = aiResult.parsed;

    const { data: updated, error: upErr } = await admin.from("site_audits").update({
      score_global,
      score_seo,
      score_perf,
      score_ux,
      score_mobile,
      findings,
      recommendations,
      status: "completed",
    }).eq("id", row.id).select("*").single();
    if (upErr) return jsonResponse({ error: upErr.message }, 500);

    await admin.from("activity_log").insert({
      action: "site_audited",
      entity_type: "site_audit",
      entity_id: row.id,
      user_id: user.id,
      details: { url, score_global },
    });

    return jsonResponse({ ok: true, audit: updated });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
