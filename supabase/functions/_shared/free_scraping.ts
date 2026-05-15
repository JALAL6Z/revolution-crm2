import { extractDomain, normalizePhone } from "./scoring.ts";

const UA = "Mozilla/5.0 (compatible; RevolutionCRM/1.0; +https://revolution-crm.vercel.app)";

export function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

export function stripTags(value = "") {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

export function extractEmail(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

export async function fetchText(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,application/json;q=0.9,*/*;q=0.8" },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: "", error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

function cleanDdgUrl(raw: string) {
  const value = decodeHtml(raw);
  if (value.startsWith("//duckduckgo.com/l/?")) {
    const params = new URLSearchParams(value.split("?")[1]);
    const uddg = params.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  }
  if (value.startsWith("/l/?")) {
    const params = new URLSearchParams(value.split("?")[1]);
    const uddg = params.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  }
  return value;
}

export async function duckDuckGoSearch(query: string, limit = 10) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchText(url, 12000);
  if (!res.ok) return [];
  const results: { title: string; url: string; snippet: string }[] = [];
  const blockRe = /<div[^>]+class="result[\s\S]*?(?=<div[^>]+class="result|<\/body>)/g;
  const blocks = res.text.match(blockRe) ?? [];
  for (const block of blocks) {
    const link = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const target = cleanDdgUrl(link[1]);
    if (!target.startsWith("http")) continue;
    const title = stripTags(link[2]);
    const snippet = stripTags(block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "");
    if (title) results.push({ title, url: target, snippet });
    if (results.length >= limit) break;
  }
  return results;
}

export async function findWebsite(query: string) {
  const results = await duckDuckGoSearch(query, 5);
  return results.find((r) => {
    try {
      const host = new URL(r.url).hostname;
      return !/(facebook|instagram|linkedin|tiktok|youtube|pagesjaunes|societe|pappers|annuaire)/i.test(host);
    } catch {
      return false;
    }
  })?.url ?? null;
}

export async function crawlEmails(input: { domain?: string; company?: string }) {
  let website = input.domain ? `https://${input.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}` : null;
  if (!website && input.company) website = await findWebsite(`${input.company} site officiel contact`);
  if (!website) return { website: null, emails: [] as string[] };

  const base = new URL(website.startsWith("http") ? website : `https://${website}`);
  const urls = [
    base.origin,
    `${base.origin}/contact`,
    `${base.origin}/contactez-nous`,
    `${base.origin}/mentions-legales`,
    `${base.origin}/a-propos`,
  ];
  const emails = new Set<string>();
  for (const url of urls) {
    const res = await fetchText(url, 8000);
    if (!res.text) continue;
    for (const match of res.text.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)) {
      const email = match[0].toLowerCase();
      if (!/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email)) emails.add(email);
    }
  }
  return { website: base.origin, emails: [...emails] };
}

export async function openStreetMapSearch(filters: { query: string; location: string; limit?: number }) {
  const limit = Math.min(filters.limit ?? 20, 100);
  const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&extratags=1&limit=${limit}&q=${encodeURIComponent(`${filters.query} ${filters.location}`)}`;
  const res = await fetch(searchUrl, { headers: { "User-Agent": UA, "Accept": "application/json" } });
  if (!res.ok) throw new Error(`OpenStreetMap ${res.status}`);
  const data = await res.json();
  return (data ?? []).slice(0, limit).map((place: any) => {
    const tags = place.extratags ?? {};
    const address = place.address ?? {};
    const street = [address.house_number, address.road].filter(Boolean).join(" ");
    const city = address.city ?? address.town ?? address.village ?? address.municipality ?? filters.location;
    const website = tags.website ?? tags["contact:website"] ?? null;
    const phone = tags.phone ?? tags["contact:phone"] ?? null;
    const email = tags.email ?? tags["contact:email"] ?? null;
    return {
      name: place.name ?? address.amenity ?? address.shop ?? "Etablissement local",
      website,
      email,
      phone: normalizePhone(phone),
      address: street || null,
      city,
      zip: address.postcode ?? null,
      country: address.country ?? "France",
      category: place.type ?? place.class ?? null,
      sector: place.type ?? filters.query,
      source_url: place.osm_type && place.osm_id ? `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}` : null,
      raw_data: place,
    };
  });
}

export async function dataGouvCompanySearch(filters: {
  activite?: string;
  departement?: string;
  ville?: string;
  limit?: number;
}) {
  const params = new URLSearchParams({
    per_page: String(Math.min(filters.limit ?? 20, 100)),
    page: "1",
  });
  const q = [filters.activite, filters.ville].filter(Boolean).join(" ");
  if (q) params.set("q", q);
  if (filters.departement) params.set("departement", filters.departement);
  const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`API Entreprises ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((it: any) => {
    const siege = it.siege ?? {};
    const dirigeant = it.dirigeants?.[0];
    const name = it.nom_complet ?? it.nom_raison_sociale ?? it.nom_entreprise ?? "Entreprise";
    return {
      name,
      siren: it.siren ?? null,
      sector: it.activite_principale ?? it.libelle_activite_principale ?? it.section_activite_principale ?? filters.activite ?? null,
      category: it.nature_juridique ?? null,
      address: siege.geo_adresse ?? siege.adresse ?? null,
      city: siege.libelle_commune ?? siege.commune ?? filters.ville ?? null,
      zip: siege.code_postal ?? null,
      country: "France",
      employees_count: Number.parseInt(it.tranche_effectif_salarie ?? siege.tranche_effectif_salarie ?? "", 10) || null,
      contact_name: dirigeant ? [dirigeant.prenoms, dirigeant.nom].filter(Boolean).join(" ") : null,
      source_url: it.siren ? `https://annuaire-entreprises.data.gouv.fr/entreprise/${it.siren}` : null,
      raw_data: it,
    };
  });
}

export async function autoImportJobResults(admin: any, jobId: string, userId: string) {
  const { data: job } = await admin.from("scraping_jobs").select("auto_import").eq("id", jobId).maybeSingle();
  if (!job?.auto_import) return { imported: 0, skipped: 0 };

  const { data: results } = await admin.from("scraping_results").select("*").eq("job_id", jobId).eq("import_status", "pending");
  if (!results?.length) return { imported: 0, skipped: 0 };

  const { data: existing } = await admin.from("prospects").select("id,email,phone,siren,website");
  const emailMap = new Map<string, string>();
  const phoneMap = new Map<string, string>();
  const sirenMap = new Map<string, string>();
  const domainMap = new Map<string, string>();
  for (const p of existing ?? []) {
    if (p.email) emailMap.set(String(p.email).trim().toLowerCase(), p.id);
    if (p.phone) phoneMap.set(normalizePhone(p.phone) ?? p.phone, p.id);
    if (p.siren) sirenMap.set(String(p.siren).replace(/\D/g, "").slice(0, 9), p.id);
    const domain = extractDomain(p.website);
    if (domain) domainMap.set(domain, p.id);
  }

  let imported = 0;
  let skipped = 0;
  for (const r of results) {
    const email = r.email ? String(r.email).trim().toLowerCase() : null;
    const phone = normalizePhone(r.phone);
    const siren = r.siren ? String(r.siren).replace(/\D/g, "").slice(0, 9) : null;
    const domain = extractDomain(r.website);
    const dupId = (email && emailMap.get(email)) || (phone && phoneMap.get(phone)) || (siren && sirenMap.get(siren)) || (domain && domainMap.get(domain)) || r.duplicate_of;
    if (dupId) {
      await admin.from("scraping_results").update({ import_status: "skipped_duplicate", duplicate_of: dupId, imported_prospect_id: dupId }).eq("id", r.id);
      skipped++;
      continue;
    }
    const { data: prospect, error } = await admin.from("prospects").insert({
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
      created_by: userId,
      notes: `Import auto via scraping (${r.source})`,
    }).select("id").single();
    if (error) {
      console.error("auto import prospect", error.message);
      continue;
    }
    if (email) emailMap.set(email, prospect.id);
    if (phone) phoneMap.set(phone, prospect.id);
    if (siren) sirenMap.set(siren, prospect.id);
    if (domain) domainMap.set(domain, prospect.id);
    await admin.from("scraping_results").update({ import_status: "imported", imported_prospect_id: prospect.id, imported_at: new Date().toISOString() }).eq("id", r.id);
    imported++;
  }

  await admin.from("scraping_jobs").update({ imported_count: imported, duplicates_count: skipped }).eq("id", jobId);
  return { imported, skipped };
}
