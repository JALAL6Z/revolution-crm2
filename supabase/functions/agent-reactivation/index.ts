// Agent Reactivation — détecte les clients dormants (60j+ sans activité)
// et génère un message de réactivation personnalisé pour chacun.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

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

    const body = await req.json().catch(() => ({})) as { days?: number; client_ids?: string[] };
    const days = body.days ?? 60;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    let query = admin.from("clients").select("*");
    if (body.client_ids?.length) {
      query = query.in("id", body.client_ids);
    } else {
      query = query.or(`status.eq.churned,updated_at.lt.${cutoff}`);
    }
    const { data: dormants, error } = await query.limit(20);
    if (error) return jsonResponse({ error: error.message }, 500);

    const messages: { client_id: string; client_name: string; segment: string; winback_probability: number; offer: string; subject: string; body: string; follow_ups: string[] }[] = [];

    for (const c of dormants ?? []) {
      try {
        const { parsed } = await callAI({
          provider: "auto",
          systemPrompt: "Tu es account manager SMMA. Tu écris des messages de réactivation chaleureux, courts, qui rappellent une victoire passée et proposent une nouvelle opportunité concrète. Ton humain, pas commercial.",
          userPrompt: `Réactive ce client:\nNom: ${c.company_name}\nContact: ${c.contact_name ?? "—"}\nServices passés: ${(c.services ?? []).join(", ")}\nMRR historique: ${c.mrr ?? 0}€\nNotes: ${c.notes ?? "—"}`,
          tool: {
            type: "function",
            function: {
              name: "reactivation_message",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Objet email court et accrocheur" },
                  body: { type: "string", description: "Corps du message en 5-8 lignes max" },
                  segment: { type: "string", enum: ["cold", "warm", "hot"], description: "Chance de réactivation" },
                  winback_probability: { type: "integer", minimum: 0, maximum: 100 },
                  offer: { type: "string", description: "Offre de retour personnalisée" },
                  follow_ups: { type: "array", items: { type: "string" }, description: "Relances J+3 et J+7" },
                },
                required: ["subject", "body", "segment", "winback_probability", "offer", "follow_ups"],
                additionalProperties: false,
              },
            },
          },
          toolName: "reactivation_message",
        });
        messages.push({ client_id: c.id, client_name: c.company_name, segment: parsed.segment, winback_probability: parsed.winback_probability, offer: parsed.offer, subject: parsed.subject, body: parsed.body, follow_ups: parsed.follow_ups ?? [] });
      } catch (e) {
        console.error("reactivation gen failed for", c.id, e);
      }
    }

    await admin.from("activity_log").insert({
      action: "reactivation_batch", entity_type: "client", entity_id: null, user_id: user.id, details: { count: messages.length, days },
    });

    return jsonResponse({ ok: true, messages, total_dormants: dormants?.length ?? 0 });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
