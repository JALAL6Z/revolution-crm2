// Scoring IA simple basé sur signaux SMMA : faible note = douleur, beaucoup d'avis = traction,
// pas de site = besoin web, secteur high-ticket boost.
export interface ScoringInput {
  rating?: number | null;
  reviews_count?: number | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  followers?: number | null;
  engagement_rate?: number | null;
  revenue_estimate?: number | null;
  employees_count?: number | null;
  sector?: string | null;
}

const HIGH_TICKET = ["immobilier", "btp", "dentaire", "avocat", "clinique", "esthetique", "auto", "luxury", "hotel"];

export function scoreLead(i: ScoringInput): number {
  let score = 50;

  // Pain signals (mauvaise reput = besoin)
  if (i.rating != null && i.rating > 0 && i.rating < 4) score += 15;
  if (i.reviews_count != null && i.reviews_count >= 30) score += 10;

  // No website = besoin urgent
  if (!i.website) score += 12;

  // Has contactable info
  if (i.email) score += 8;
  if (i.phone) score += 5;

  // Traction sociale
  if (i.followers != null) {
    if (i.followers >= 10000) score += 8;
    else if (i.followers >= 1000) score += 4;
  }
  if (i.engagement_rate != null && i.engagement_rate > 3) score += 5;

  // Capacité à payer
  if (i.revenue_estimate != null) {
    if (i.revenue_estimate >= 1_000_000) score += 10;
    else if (i.revenue_estimate >= 200_000) score += 5;
  }
  if (i.employees_count != null) {
    if (i.employees_count >= 10) score += 5;
    else if (i.employees_count >= 3) score += 2;
  }

  // Secteur high-ticket
  if (i.sector && HIGH_TICKET.some((s) => i.sector!.toLowerCase().includes(s))) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function extractDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizePhone(p?: string | null): string | null {
  if (!p) return null;
  return p.replace(/[^\d+]/g, "");
}
