// Importe une liste de scraping_results dans la table prospects.
// Dédup STRICTE sur 4 clés exactes : domaine du site, email (lowercase), téléphone normalisé, SIREN.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const normPhone = (p?: string | null) => p ? p.replace(/[^\d+]/g, "").replace(/^00/, "+") : null;
const normEmail = (e?: string | null) => e ? e.trim().toLowerCase() : null;
const normSiren = (s?: string | null) => s ? s.replace(/\D/g, "").slice(0, 9) : null;
const normDomain = (w?: string | null) => {
  if (!w) return null;
  try {
    const u = new URL(w.startsWith("http") ? w : `https://${w}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch { return null; }
};

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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { result_ids } = await req.json() as { result_ids: string[] };
    if (!Array.isArray(result_ids) || !result_ids.length) {
      return jsonResponse({ error: "result_ids[] required" }, 400);
    }

    const { data: results, error: rErr } = await admin
      .from("scraping_results")
      .select("*")
      .in("id", result_ids);
    if (rErr) return jsonResponse({ error: rErr.message }, 500);

    // Préchargement de tous les prospects existants pour la dédup en mémoire (évite N requêtes)
    const { data: existing } = await admin
      .from("prospects")
      .select("id, email, phone, siren, website");

    const idxEmail = new Map<string, string>();
    const idxPhone = new Map<string, string>();
    const idxSiren = new Map<string, string>();
    const idxDomain = new Map<string, string>();
    for (const p of existing ?? []) {
      const e = normEmail(p.email); if (e) idxEmail.set(e, p.id);
      const ph = normPhone(p.phone); if (ph) idxPhone.set(ph, p.id);
      const s = normSiren(p.siren); if (s && s.length === 9) idxSiren.set(s, p.id);
      const d = normDomain(p.website); if (d) idxDomain.set(d, p.id);
    }

    let imported = 0, skipped = 0;
    for (const r of results || []) {
      const e = normEmail(r.email);
      const ph = normPhone(r.phone);
      const s = normSiren(r.siren);
      const d = normDomain(r.website);

      const dupId =
        (e && idxEmail.get(e)) ||
        (ph && idxPhone.get(ph)) ||
        (s && s.length === 9 && idxSiren.get(s)) ||
        (d && idxDomain.get(d)) ||
        r.duplicate_of;

      if (dupId) {
        await admin.from("scraping_results").update({
          import_status: "skipped_duplicate",
          imported_prospect_id: dupId,
          duplicate_of: dupId,
        }).eq("id", r.id);
        skipped++;
        continue;
      }

      const { data: prospect, error: pErr } = await admin.from("prospects").insert({
        name: r.name,
        contact_name: r.contact_name,
        email: r.email,
        phone: r.phone,
        website: r.website,
        address: r.address,
        city: r.city,
        zip: r.zip,
        country: r.country ?? "France",
        sector: r.sector,
        category: r.category,
        rating: r.rating,
        reviews_count: r.reviews_count,
        employees_count: r.employees_count,
        revenue_estimate: r.revenue_estimate,
        siren: r.siren,
        dirigeant: r.dirigeant,
        linkedin_url: r.linkedin_url,
        instagram_handle: r.instagram_handle,
        score: r.ai_score,
        source: r.source,
        source_url: r.source_url,
        created_by: user.id,
        notes: `Importé via scraping (${r.source})`,
      }).select("id").single();

      if (pErr) {
        console.error(pErr);
        continue;
      }

      // Ajoute aux index pour éviter les doublons intra-batch
      if (e) idxEmail.set(e, prospect.id);
      if (ph) idxPhone.set(ph, prospect.id);
      if (s && s.length === 9) idxSiren.set(s, prospect.id);
      if (d) idxDomain.set(d, prospect.id);

      await admin.from("scraping_results").update({
        import_status: "imported",
        imported_prospect_id: prospect.id,
        imported_at: new Date().toISOString(),
      }).eq("id", r.id);
      imported++;
    }

    if (results?.length) {
      const job_id = results[0].job_id;
      const { count: importedCount } = await admin.from("scraping_results")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job_id).eq("import_status", "imported");
      const { count: dupCount } = await admin.from("scraping_results")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job_id).eq("import_status", "skipped_duplicate");
      await admin.from("scraping_jobs").update({
        imported_count: importedCount ?? 0,
        duplicates_count: dupCount ?? 0,
      }).eq("id", job_id);
    }

    return jsonResponse({ ok: true, imported, skipped });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
