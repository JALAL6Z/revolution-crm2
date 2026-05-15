// Utilitaire d'import CSV simple (UTF-8, support des guillemets, , et ;).
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 1) return { headers: [], rows: [] };

  // Auto-detect separator
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const sep = semiCount > commaCount ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };

  const rawHeaders = parseLine(lines[0]).map((h) => h.trim());
  if (lines.length === 1) return { headers: rawHeaders, rows: [] };

  const rows = lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    rawHeaders.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  });

  return { headers: rawHeaders, rows };
}

/** Champs de destination connus pour le mapping CSV → scraping_results. */
export const CSV_TARGET_FIELDS = [
  { key: "name", label: "Nom entreprise *", required: true },
  { key: "contact_name", label: "Nom du contact" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Téléphone" },
  { key: "website", label: "Site web" },
  { key: "address", label: "Adresse" },
  { key: "city", label: "Ville" },
  { key: "zip", label: "Code postal" },
  { key: "country", label: "Pays" },
  { key: "sector", label: "Secteur" },
  { key: "category", label: "Catégorie" },
  { key: "rating", label: "Note (étoiles)" },
  { key: "reviews_count", label: "Nombre d'avis" },
  { key: "employees_count", label: "Effectif" },
  { key: "revenue_estimate", label: "CA estimé" },
  { key: "siren", label: "SIREN" },
  { key: "dirigeant", label: "Dirigeant" },
  { key: "linkedin_url", label: "URL LinkedIn" },
  { key: "instagram_handle", label: "Handle Instagram" },
  { key: "followers", label: "Followers" },
  { key: "engagement_rate", label: "Engagement %" },
] as const;

export type CSVTargetKey = (typeof CSV_TARGET_FIELDS)[number]["key"];

/** Auto-mapping basé sur des heuristiques sur le nom de colonne. */
export function autoMap(headers: string[]): Record<CSVTargetKey, string | null> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const findHeader = (...needles: string[]): string | null => {
    for (const h of headers) {
      const n = norm(h);
      if (needles.some((needle) => n === norm(needle) || n.includes(norm(needle)))) return h;
    }
    return null;
  };

  const map: Record<string, string | null> = {
    name: findHeader("name", "company", "company_name", "entreprise", "raison_sociale", "denomination", "title"),
    contact_name: findHeader("contact_name", "full_name", "fullname", "contact", "nom_contact", "firstname", "prenom"),
    email: findHeader("email", "mail", "contact_email", "e-mail"),
    phone: findHeader("phone", "tel", "telephone", "mobile", "numero"),
    website: findHeader("website", "url", "site", "web"),
    address: findHeader("address", "adresse", "street"),
    city: findHeader("city", "ville", "town", "location"),
    zip: findHeader("zip", "postal", "cp", "code_postal", "postcode"),
    country: findHeader("country", "pays"),
    sector: findHeader("sector", "industry", "secteur", "domaine"),
    category: findHeader("category", "categorie", "type"),
    rating: findHeader("rating", "note", "stars", "etoiles", "score"),
    reviews_count: findHeader("reviews", "reviewscount", "nbavis", "reviews_count"),
    employees_count: findHeader("employees", "effectif", "headcount", "size"),
    revenue_estimate: findHeader("revenue", "ca", "turnover", "chiffre"),
    siren: findHeader("siren", "siret"),
    dirigeant: findHeader("dirigeant", "ceo", "founder", "owner", "manager"),
    linkedin_url: findHeader("linkedin", "linkedin_url", "linkedinurl"),
    instagram_handle: findHeader("instagram", "ig", "handle"),
    followers: findHeader("followers", "abonnes"),
    engagement_rate: findHeader("engagement", "er"),
  };

  return map as Record<CSVTargetKey, string | null>;
}

/** Convertit une valeur en number sécurisé. */
export function toNumber(v: string | undefined | null): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
