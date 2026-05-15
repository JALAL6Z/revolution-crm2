import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { assertJobOwner, requireUser } from "../_shared/auth.ts";
import { scoreLead } from "../_shared/scoring.ts";
import { autoImportJobResults, dataGouvCompanySearch } from "../_shared/free_scraping.ts";

interface Filters {
  activite?: string;       // libellé NAF / mot-clé
  code_naf?: string;
  departement?: string;    // "13"
  ville?: string;
  effectif_min?: number;
  effectif_max?: number;
  ca_min?: number;
  ca_max?: number;
  date_creation_min?: string; // YYYY-MM-DD
  limit?: number;          // max 100
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const PAPPERS_API_KEY = Deno.env.get("PAPPERS_API_KEY");

    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { job_id, filters } = await req.json() as { job_id: string; filters: Filters };
    if (!job_id) return jsonResponse({ error: "job_id required" }, 400);
    const limit = Math.min(filters.limit ?? 20, 100);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const ownership = await assertJobOwner(admin, job_id, auth.user.id);
    if (!ownership.ok) return jsonResponse({ error: ownership.error }, ownership.status);

    await admin.from("scraping_jobs").update({ status: "running", started_at: new Date().toISOString(), progress: 10 }).eq("id", job_id);
    const t0 = Date.now();

    const collected: Record<string, unknown>[] = [];
    let rows: any[] = [];
    if (!PAPPERS_API_KEY) {
      const freeRows = await dataGouvCompanySearch({
        activite: filters.activite,
        departement: filters.departement,
        ville: filters.ville,
        limit,
      });
      rows = freeRows.map((it) => ({
        job_id,
        ...it,
        source: "pappers" as const,
        ai_score: scoreLead({
          employees_count: it.employees_count,
          sector: it.sector,
        }),
      }));
      await admin.from("scraping_jobs").update({ progress: 80 }).eq("id", job_id);
    } else {
      let page = 1;
      while (collected.length < limit && page <= 5) {
        const params = new URLSearchParams({
          api_token: PAPPERS_API_KEY,
          par_page: String(Math.min(20, limit)),
          page: String(page),
        });
        if (filters.activite) params.set("activite", filters.activite);
        if (filters.code_naf) params.set("code_naf", filters.code_naf);
        if (filters.departement) params.set("departement", filters.departement);
        if (filters.ville) params.set("code_postal", filters.ville);
        if (filters.effectif_min != null) params.set("effectif_min", String(filters.effectif_min));
        if (filters.effectif_max != null) params.set("effectif_max", String(filters.effectif_max));
        if (filters.ca_min != null) params.set("chiffre_affaires_min", String(filters.ca_min));
        if (filters.ca_max != null) params.set("chiffre_affaires_max", String(filters.ca_max));
        if (filters.date_creation_min) params.set("date_creation_min", filters.date_creation_min);

        const r = await fetch(`https://api.pappers.fr/v2/recherche?${params}`);
        const data = await r.json();
        if (!r.ok) {
          await admin.from("scraping_jobs").update({ status: "failed", error_message: data?.message || `Pappers ${r.status}`, completed_at: new Date().toISOString() }).eq("id", job_id);
          return jsonResponse({ error: data?.message || "Pappers error" }, 502);
        }
        const items = (data.resultats || []) as Record<string, unknown>[];
        if (!items.length) break;
        collected.push(...items);
        if (items.length < 20) break;
        page++;
        await admin.from("scraping_jobs").update({ progress: Math.min(80, 20 + page * 15) }).eq("id", job_id);
      }

      rows = collected.slice(0, limit).map((it: any) => {
        const siege = it.siege || {};
        return {
          job_id,
          name: it.nom_entreprise || it.denomination || "Sans nom",
          siren: it.siren,
          sector: it.libelle_code_naf,
          category: it.code_naf,
          address: [siege.numero_voie, siege.type_voie, siege.libelle_voie].filter(Boolean).join(" "),
          city: siege.ville,
          zip: siege.code_postal,
          country: "France",
          employees_count: it.effectif ?? null,
          revenue_estimate: it.chiffre_affaires ?? null,
          contact_name: it.representants?.[0]?.nom_complet ?? null,
          source: "pappers" as const,
          source_url: `https://www.pappers.fr/entreprise/${it.siren}`,
          raw_data: it,
          ai_score: scoreLead({
            revenue_estimate: it.chiffre_affaires,
            employees_count: it.effectif,
            sector: it.libelle_code_naf,
          }),
        };
      });
    }

    let insertedCount = 0;
    if (rows.length) {
      const { data: insertedRows, error } = await admin.from("scraping_results").insert(rows).select("id");
      if (error) {
        await admin.from("scraping_jobs").update({
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString(),
        }).eq("id", job_id);
        return jsonResponse({ error: error.message }, 500);
      }
      insertedCount = insertedRows?.length ?? rows.length;
    }

    await admin.from("scraping_jobs").update({
      status: "completed",
      progress: 100,
      results_count: insertedCount,
      duration_ms: Date.now() - t0,
      error_message: PAPPERS_API_KEY ? null : "Mode gratuit API Annuaire Entreprises/data.gouv: certains champs financiers Pappers peuvent être absents.",
      completed_at: new Date().toISOString(),
    }).eq("id", job_id);

    const autoImport = await autoImportJobResults(admin, job_id, auth.user.id);
    return jsonResponse({ ok: true, count: insertedCount, mode: PAPPERS_API_KEY ? "pappers" : "data_gouv", auto_import: autoImport });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
