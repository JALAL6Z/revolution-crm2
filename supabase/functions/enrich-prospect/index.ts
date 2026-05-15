// Enrichissement email/phone d'un prospect via plusieurs sources en cascade :
// 1. Hunter.io (domaine → email)
// 2. Dropcontact (prénom + nom + domaine → email vérifié)
// 3. Recherche web DuckDuckGo (fallback gratuit)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

// ── Hunter.io ─────────────────────────────────────────────────────────────
async function hunterDomainSearch(domain: string, apiKey: string): Promise<{ email: string; confidence: number } | null> {
  try {
    const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data?.data?.emails ?? [];
    if (!emails.length) return null;
    // Priorité : founder/owner > autre
    const best = emails.sort((a: any, b: any) => {
      const priority = ["founder", "owner", "ceo", "directeur", "gérant", "president"];
      const aScore = priority.findIndex(p => (a.position ?? "").toLowerCase().includes(p)) !== -1 ? 1 : 0;
      const bScore = priority.findIndex(p => (b.position ?? "").toLowerCase().includes(p)) !== -1 ? 1 : 0;
      return bScore - aScore || (b.confidence ?? 0) - (a.confidence ?? 0);
    })[0];
    return best ? { email: best.value, confidence: best.confidence ?? 50 } : null;
  } catch { return null; }
}

async function hunterEmailFinder(firstName: string, lastName: string, domain: string, apiKey: string): Promise<{ email: string; confidence: number } | null> {
  try {
    const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const email = data?.data?.email;
    const confidence = data?.data?.score ?? 0;
    return email ? { email, confidence } : null;
  } catch { return null; }
}

// ── Dropcontact ───────────────────────────────────────────────────────────
async function dropcontact(firstName: string, lastName: string, website: string, apiKey: string): Promise<{ email: string; confidence: number } | null> {
  try {
    // Enqueue
    const res = await fetch("https://api.dropcontact.com/v1/enrich", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Token": apiKey,
      },
      body: JSON.stringify({
        data: [{ first_name: firstName, last_name: lastName, website }],
        siren: false,
        language: "fr",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const contact = data?.data?.[0];
    const email = contact?.email?.[0]?.email;
    const confidence = contact?.email?.[0]?.qualification === "Verified" ? 90 : 60;
    return email ? { email, confidence } : null;
  } catch { return null; }
}

// ── Extract domain from URL or company name ───────────────────────────────
function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch { return null; }
}

// ── Parse full name ───────────────────────────────────────────────────────
function parseName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") ?? "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { prospect_id } = await req.json() as { prospect_id: string };
    if (!prospect_id) return jsonResponse({ error: "prospect_id requis" }, 400);

    const { data: p } = await admin.from("prospects").select("*").eq("id", prospect_id).maybeSingle();
    if (!p) return jsonResponse({ error: "Prospect introuvable" }, 404);

    // Récupère les clés API depuis integration_settings
    const { data: settings } = await admin.from("integration_settings")
      .select("provider, api_key")
      .in("provider", ["hunter", "dropcontact"])
      .eq("enabled", true);

    const hunterKey = settings?.find(s => s.provider === "hunter")?.api_key ?? Deno.env.get("HUNTER_API_KEY") ?? "";
    const dropcontactKey = settings?.find(s => s.provider === "dropcontact")?.api_key ?? Deno.env.get("DROPCONTACT_API_KEY") ?? "";

    const domain = extractDomain(p.website);
    const { first, last } = parseName(p.contact_name || p.name);
    const results: { source: string; email?: string; confidence?: number; error?: string }[] = [];

    let bestEmail: string | null = null;
    let bestConfidence = 0;

    // 1. Hunter domain search (si on a un domaine)
    if (hunterKey && domain) {
      const r = await hunterDomainSearch(domain, hunterKey);
      results.push({ source: "hunter_domain", email: r?.email, confidence: r?.confidence });
      if (r && r.confidence > bestConfidence) { bestEmail = r.email; bestConfidence = r.confidence; }
    }

    // 2. Hunter email finder (si on a un contact name + domaine)
    if (hunterKey && domain && first && last) {
      const r = await hunterEmailFinder(first, last, domain, hunterKey);
      results.push({ source: "hunter_finder", email: r?.email, confidence: r?.confidence });
      if (r && r.confidence > bestConfidence) { bestEmail = r.email; bestConfidence = r.confidence; }
    }

    // 3. Dropcontact (si on a nom + site)
    if (dropcontactKey && p.website && first) {
      const r = await dropcontact(first, last, p.website, dropcontactKey);
      results.push({ source: "dropcontact", email: r?.email, confidence: r?.confidence });
      if (r && r.confidence > bestConfidence) { bestEmail = r.email; bestConfidence = r.confidence; }
    }

    // Sauvegarde si trouvé
    if (bestEmail && !p.email) {
      await admin.from("prospects").update({ email: bestEmail }).eq("id", prospect_id);
    }

    return jsonResponse({
      ok: true,
      email_found: bestEmail,
      confidence: bestConfidence,
      already_had_email: !!p.email,
      results,
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
