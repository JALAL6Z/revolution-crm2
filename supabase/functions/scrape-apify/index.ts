// Apify generic runner: launches an Actor and stores items as scraping_results.
// Supports Instagram, TikTok, LinkedIn via different actor IDs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertJobOwner, requireUser } from "../_shared/auth.ts";
import { scoreLead } from "../_shared/scoring.ts";
import { autoImportJobResults, duckDuckGoSearch } from "../_shared/free_scraping.ts";

const ACTORS: Record<string, { id: string; mapper: (it: any, job_id: string) => any; source: string }> = {
  instagram: {
    id: "apify~instagram-scraper",
    source: "instagram",
    mapper: (it, job_id) => ({
      job_id,
      name: it.fullName || it.username || "IG account",
      contact_name: it.fullName ?? null,
      instagram_handle: it.username,
      email: it.businessEmail || extractEmail(it.biography) || null,
      phone: it.businessPhoneNumber || null,
      website: it.externalUrl || null,
      sector: it.businessCategoryName || null,
      followers: it.followersCount ?? null,
      engagement_rate: null,
      source: "instagram",
      source_url: `https://instagram.com/${it.username}`,
      raw_data: it,
      ai_score: scoreLead({
        followers: it.followersCount,
        email: it.businessEmail || extractEmail(it.biography),
        website: it.externalUrl,
      }),
    }),
  },
  tiktok: {
    id: "clockworks~tiktok-scraper",
    source: "tiktok",
    mapper: (it, job_id) => ({
      job_id,
      name: it.authorMeta?.nickName || it.authorMeta?.name || "TikTok",
      instagram_handle: it.authorMeta?.name,
      followers: it.authorMeta?.fans ?? null,
      sector: it.hashtags?.[0]?.name ?? null,
      source: "tiktok",
      source_url: it.webVideoUrl,
      raw_data: it,
      ai_score: scoreLead({ followers: it.authorMeta?.fans }),
    }),
  },
  linkedin: {
    id: "curious_coder~linkedin-companies",
    source: "linkedin",
    mapper: (it, job_id) => ({
      job_id,
      name: it.name || it.companyName,
      website: it.websiteUrl ?? null,
      sector: it.industry ?? null,
      employees_count: it.employeeCount ?? null,
      city: it.headquarter?.city ?? null,
      country: it.headquarter?.country ?? null,
      linkedin_url: it.url ?? null,
      source: "linkedin",
      source_url: it.url ?? null,
      raw_data: it,
      ai_score: scoreLead({ website: it.websiteUrl, employees_count: it.employeeCount, sector: it.industry }),
    }),
  },
};

function extractEmail(text?: string): string | null {
  if (!text) return null;
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { job_id, platform, input } = await req.json() as { job_id: string; platform: keyof typeof ACTORS; input: any };
    const actor = ACTORS[platform];
    if (!actor) return jsonResponse({ error: `Unknown platform: ${platform}` }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const ownership = await assertJobOwner(admin, job_id, auth.user.id);
    if (!ownership.ok) return jsonResponse({ error: ownership.error }, ownership.status);

    await admin.from("scraping_jobs").update({ status: "running", started_at: new Date().toISOString(), progress: 10 }).eq("id", job_id);
    const t0 = Date.now();

    let rows: any[] = [];
    if (!APIFY_API_TOKEN) {
      const seeds = input?.queries ?? input?.hashtags ?? input?.directUrls ?? [];
      const site = platform === "linkedin" ? "linkedin.com/company" : platform === "tiktok" ? "tiktok.com" : "instagram.com";
      const perSeedLimit = Math.max(3, Math.ceil(30 / Math.max(1, seeds.length)));
      const found: any[] = [];
      for (const seed of seeds.slice(0, 5)) {
        const cleaned = String(seed).replace(/^https?:\/\/(www\.)?/, "").replace(/^[@#]/, "");
        const query = `site:${site} ${cleaned}`;
        const results = await duckDuckGoSearch(query, perSeedLimit);
        found.push(...results);
        await admin.from("scraping_jobs").update({ progress: Math.min(80, 20 + found.length * 2) }).eq("id", job_id);
      }
      const dedup = new Map<string, any>();
      for (const result of found) dedup.set(result.url, result);
      rows = [...dedup.values()].slice(0, input?.maxItems ?? input?.resultsLimit ?? input?.resultsPerPage ?? 30).map((result) => {
        const url = result.url;
        const title = result.title.replace(/\s*\|\s*(Instagram|TikTok|LinkedIn).*$/i, "").trim();
        const handle = platform === "instagram"
          ? url.match(/instagram\.com\/([^/?#]+)/i)?.[1]
          : platform === "tiktok"
            ? url.match(/tiktok\.com\/@([^/?#]+)/i)?.[1]
            : null;
        return {
          job_id,
          name: title || handle || `${platform} lead`,
          contact_name: title || null,
          instagram_handle: platform === "instagram" || platform === "tiktok" ? handle : null,
          linkedin_url: platform === "linkedin" ? url : null,
          sector: null,
          source: actor.source,
          source_url: url,
          raw_data: { provider: "duckduckgo", ...result },
          ai_score: scoreLead({ website: url }),
        };
      });
      if (!rows.length) {
        rows = seeds.slice(0, input?.maxItems ?? input?.resultsLimit ?? input?.resultsPerPage ?? 10).map((seed: string) => {
          const value = String(seed);
          const cleaned = value.replace(/^https?:\/\/(www\.)?/, "").replace(/^[@#]/, "");
          const url = platform === "instagram"
            ? (value.startsWith("http") ? value : `https://www.instagram.com/${cleaned.replace(/^instagram\.com\//, "")}/`)
            : platform === "tiktok"
              ? (value.startsWith("http") ? value : `https://www.tiktok.com/tag/${cleaned}`)
              : `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(cleaned)}`;
          const handle = platform === "instagram" ? url.match(/instagram\.com\/([^/?#]+)/i)?.[1] : platform === "tiktok" ? cleaned : null;
          return {
            job_id,
            name: cleaned || `${platform} lead`,
            contact_name: cleaned || null,
            instagram_handle: platform === "instagram" || platform === "tiktok" ? handle : null,
            linkedin_url: platform === "linkedin" ? url : null,
            source: actor.source,
            source_url: url,
            raw_data: { provider: "free_seed_fallback", seed },
            ai_score: scoreLead({ website: url }),
          };
        });
      }
    } else {
      // Run-sync-get-dataset-items: simpler, blocks until done (max 5min on free)
      const r = await fetch(
        `https://api.apify.com/v2/acts/${actor.id}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}&timeout=120`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const data = await r.json();
      if (!r.ok) {
        await admin.from("scraping_jobs").update({ status: "failed", error_message: data?.error?.message || `Apify ${r.status}`, completed_at: new Date().toISOString() }).eq("id", job_id);
        return jsonResponse({ error: data?.error?.message || "Apify error" }, 502);
      }

      const items = Array.isArray(data) ? data : [];
      rows = items.map((it) => actor.mapper(it, job_id));
    }
    if (rows.length) {
      const { error } = await admin.from("scraping_results").insert(rows);
      if (error) {
        await admin.from("scraping_jobs").update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        }).eq("id", job_id);
        return jsonResponse({ error: error.message }, 500);
      }
    }

    await admin.from("scraping_jobs").update({
      status: "completed",
      progress: 100,
      results_count: rows.length,
      duration_ms: Date.now() - t0,
      error_message: APIFY_API_TOKEN ? null : "Mode gratuit DuckDuckGo: résultats sociaux publics, pas de métriques/followers Apify.",
      completed_at: new Date().toISOString(),
    }).eq("id", job_id);

    const autoImport = await autoImportJobResults(admin, job_id, auth.user.id);
    return jsonResponse({ ok: true, count: rows.length, mode: APIFY_API_TOKEN ? "apify" : "duckduckgo", auto_import: autoImport });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
