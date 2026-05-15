import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertJobOwner, requireUser } from "../_shared/auth.ts";
import { scoreLead } from "../_shared/scoring.ts";
import { autoImportJobResults, crawlEmails } from "../_shared/free_scraping.ts";

interface Filters {
  domain?: string;
  company?: string;
  department?: string;       // 'executive', 'sales', 'marketing'
  seniority?: string;        // 'senior', 'executive'
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY");

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { job_id, filters } = await req.json() as { job_id: string; filters: Filters };
    if (!job_id || (!filters.domain && !filters.company)) {
      return jsonResponse({ error: "job_id + (domain or company) required" }, 400);
    }
    const limit = Math.min(filters.limit ?? 25, 100);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const ownership = await assertJobOwner(admin, job_id, auth.user.id);
    if (!ownership.ok) return jsonResponse({ error: ownership.error }, ownership.status);

    await admin.from("scraping_jobs").update({ status: "running", started_at: new Date().toISOString(), progress: 20 }).eq("id", job_id);
    const t0 = Date.now();

    let rows: any[] = [];
    if (!HUNTER_API_KEY) {
      const free = await crawlEmails({ domain: filters.domain, company: filters.company });
      const company = filters.company || filters.domain || free.website || "Entreprise";
      rows = free.emails.length
        ? free.emails.slice(0, limit).map((email) => ({
          job_id,
          name: company,
          email,
          website: free.website,
          source: "hunter" as const,
          source_url: free.website,
          raw_data: { provider: "free_crawl", email },
          ai_score: scoreLead({ email, website: free.website }),
        }))
        : [{
          job_id,
          name: company,
          website: free.website,
          source: "hunter" as const,
          source_url: free.website,
          raw_data: { provider: "free_crawl", message: "Aucun email public trouvé" },
          ai_score: scoreLead({ website: free.website }),
        }];
      await admin.from("scraping_jobs").update({ progress: 80 }).eq("id", job_id);
    } else {
      const params = new URLSearchParams({ api_key: HUNTER_API_KEY, limit: String(limit) });
      if (filters.domain) params.set("domain", filters.domain);
      if (filters.company) params.set("company", filters.company);
      if (filters.department) params.set("department", filters.department);
      if (filters.seniority) params.set("seniority", filters.seniority);

      const r = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
      const data = await r.json();
      if (!r.ok) {
        await admin.from("scraping_jobs").update({ status: "failed", error_message: data?.errors?.[0]?.details || `Hunter ${r.status}`, completed_at: new Date().toISOString() }).eq("id", job_id);
        return jsonResponse({ error: data?.errors?.[0]?.details || "Hunter error" }, 502);
      }

      const company = data.data?.organization || filters.company || filters.domain;
      const emails = (data.data?.emails || []) as any[];

      rows = emails.map((e) => ({
        job_id,
        name: company,
        contact_name: [e.first_name, e.last_name].filter(Boolean).join(" ") || null,
        email: e.value,
        phone: e.phone_number ?? null,
        website: filters.domain ? `https://${filters.domain}` : null,
        sector: data.data?.industry ?? null,
        linkedin_url: e.linkedin ?? null,
        source: "hunter" as const,
        source_url: filters.domain ? `https://${filters.domain}` : null,
        raw_data: e,
        ai_score: scoreLead({ email: e.value, sector: data.data?.industry }),
      }));
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
      error_message: HUNTER_API_KEY ? null : "Mode gratuit crawl: emails publics uniquement, pas de vérification Hunter.",
      completed_at: new Date().toISOString(),
    }).eq("id", job_id);

    const autoImport = await autoImportJobResults(admin, job_id, auth.user.id);
    return jsonResponse({ ok: true, count: rows.length, mode: HUNTER_API_KEY ? "hunter" : "free_crawl", auto_import: autoImport });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
