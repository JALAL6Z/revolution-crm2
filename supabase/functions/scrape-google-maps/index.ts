import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertJobOwner, requireUser } from "../_shared/auth.ts";
import { scoreLead, extractDomain, normalizePhone } from "../_shared/scoring.ts";
import { autoImportJobResults, openStreetMapSearch } from "../_shared/free_scraping.ts";

interface Filters {
  query: string;          // ex: "restaurant"
  location: string;       // ex: "Marseille, France"
  min_rating?: number;
  max_rating?: number;
  min_reviews?: number;
  max_reviews?: number;
  no_website_only?: boolean;
  limit?: number;         // 20..100
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const job_id: string = body.job_id;
    const filters: Filters = body.filters || {};
    if (!job_id || !filters.query || !filters.location) {
      return jsonResponse({ error: "job_id, filters.query and filters.location are required" }, 400);
    }
    const limit = Math.min(filters.limit ?? 20, 100);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const ownership = await assertJobOwner(admin, job_id, auth.user.id);
    if (!ownership.ok) return jsonResponse({ error: ownership.error }, ownership.status);

    // Mark running
    await admin.from("scraping_jobs").update({
      status: "running",
      started_at: new Date().toISOString(),
      progress: 5,
    }).eq("id", job_id);

    const t0 = Date.now();
    let rows: any[] = [];
    const collected: Record<string, unknown>[] = [];
    let nextStart: number | undefined = 0;
    let pages = 0;

    if (!SERPAPI_KEY) {
      const freeRows = await openStreetMapSearch({ query: filters.query, location: filters.location, limit });
      rows = freeRows.map((r) => ({
        job_id,
        ...r,
        rating: null,
        reviews_count: null,
        source: "google_maps" as const,
        ai_score: scoreLead({ website: r.website, phone: r.phone, email: r.email, sector: r.sector }),
      }));
      await admin.from("scraping_jobs").update({ progress: 80 }).eq("id", job_id);
    } else {
      while (collected.length < limit && pages < 5) {
        const params = new URLSearchParams({
          engine: "google_maps",
          type: "search",
          q: filters.query,
          location: filters.location,
          z: "14",
          api_key: SERPAPI_KEY,
          hl: "fr",
          gl: "fr",
        });
        if (nextStart) params.set("start", String(nextStart));

        const r = await fetch(`https://serpapi.com/search.json?${params}`);
        const data = await r.json();
        if (!r.ok) {
          await admin.from("scraping_jobs").update({
            status: "failed",
            error_message: data?.error || `SerpAPI ${r.status}`,
            completed_at: new Date().toISOString(),
          }).eq("id", job_id);
          return jsonResponse({ error: data?.error || "SerpAPI error" }, 502);
        }

        const items = (data.local_results || []) as Record<string, unknown>[];
        if (!items.length) break;
        collected.push(...items);
        pages += 1;
        nextStart = (nextStart ?? 0) + 20;

        await admin.from("scraping_jobs").update({
          progress: Math.min(80, 10 + pages * 15),
        }).eq("id", job_id);

        if (items.length < 20) break;
      }

      rows = collected.slice(0, limit).map((it) => {
        const rating = (it.rating as number) ?? null;
        const reviews = (it.reviews as number) ?? null;
        const website = (it.website as string) ?? null;
        const phone = (it.phone as string) ?? null;
        const address = (it.address as string) ?? null;
        const types = (it.types as string[]) ?? [];
        return {
          job_id,
          name: (it.title as string) ?? "Sans nom",
          website,
          phone: normalizePhone(phone),
          address,
          city: address ? address.split(",").slice(-2)[0]?.trim() : filters.location,
          category: types?.[0] ?? null,
          sector: types?.[0] ?? filters.query,
          rating,
          reviews_count: reviews,
          source: "google_maps" as const,
          source_url: (it.place_id_search as string) ?? (it.website as string) ?? null,
          raw_data: it,
          ai_score: scoreLead({ rating, reviews_count: reviews, website, phone }),
        };
      });
    }

    // Map + filter
    rows = rows.filter((r) => {
      if (filters.min_rating != null && (r.rating ?? 0) < filters.min_rating) return false;
      if (filters.max_rating != null && (r.rating ?? 99) > filters.max_rating) return false;
      if (filters.min_reviews != null && (r.reviews_count ?? 0) < filters.min_reviews) return false;
      if (filters.max_reviews != null && (r.reviews_count ?? 0) > filters.max_reviews) return false;
      if (filters.no_website_only && r.website) return false;
      return true;
    });

    // Dedup against existing prospects (by phone or website domain)
    const phones = rows.map((r) => r.phone).filter(Boolean);
    const domains = rows.map((r) => extractDomain(r.website)).filter(Boolean) as string[];

    const { data: existingByPhone } = phones.length
      ? await admin.from("prospects").select("id, phone").in("phone", phones)
      : { data: [] };
    const phoneMap = new Map((existingByPhone ?? []).map((p) => [p.phone, p.id]));

    const enrichedRows = rows.map((r) => {
      const dup = r.phone ? phoneMap.get(r.phone) : undefined;
      return { ...r, duplicate_of: dup ?? null };
    });

    if (enrichedRows.length) {
      const { error: insErr } = await admin.from("scraping_results").insert(enrichedRows);
      if (insErr) {
        await admin.from("scraping_jobs").update({
          status: "failed",
          error_message: insErr.message,
          completed_at: new Date().toISOString(),
        }).eq("id", job_id);
        return jsonResponse({ error: insErr.message }, 500);
      }
    }

    await admin.from("scraping_jobs").update({
      status: "completed",
      progress: 100,
      results_count: enrichedRows.length,
      duplicates_count: enrichedRows.filter((r) => r.duplicate_of).length,
      duration_ms: Date.now() - t0,
      error_message: SERPAPI_KEY ? null : "Mode gratuit OpenStreetMap: données Google rating/avis indisponibles sans SerpAPI.",
      completed_at: new Date().toISOString(),
    }).eq("id", job_id);

    const autoImport = await autoImportJobResults(admin, job_id, auth.user.id);
    return jsonResponse({ ok: true, count: enrichedRows.length, mode: SERPAPI_KEY ? "serpapi" : "openstreetmap", auto_import: autoImport });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
