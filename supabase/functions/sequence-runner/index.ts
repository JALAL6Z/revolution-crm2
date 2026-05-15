// Cron runner : exécute toutes les séquences dont next_run_at <= now.
// - Génère un message via generate-outreach (étape 1) ou un message de relance (étapes 2+)
// - Programme la prochaine relance (J+3, J+7)
// - Stop si réponse reçue ou max atteint
// Appelé par pg_cron toutes les 15 minutes (peut aussi être appelé manuellement).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, requireUser } from "../_shared/auth.ts";
import { generateSequenceMessage } from "../_shared/outreach.ts";

const RELAY_DELAYS_DAYS = [3, 4, 7]; // entre étape n et n+1

async function runnerAccess(req: Request) {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && providedSecret === cronSecret) {
    return { scope: "all" as const, userId: null as string | null };
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);

  return { scope: data ? "all" as const : "own" as const, userId: auth.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const access = await runnerAccess(req);
    if (access instanceof Response) return access;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const now = new Date().toISOString();
    let query = admin
      .from("outreach_sequences")
      .select("*, prospects(*)")
      .eq("status", "active")
      .lte("next_run_at", now)
      .limit(20);
    if (access.scope === "own") query = query.eq("created_by", access.userId);
    const { data: due, error } = await query;
    if (error) return jsonResponse({ error: error.message }, 500);

    const processed: any[] = [];
    for (const seq of due ?? []) {
      const prospect = seq.prospects;
      if (!prospect) {
        await admin.from("outreach_sequences").update({ status: "stopped", stopped_reason: "prospect missing" }).eq("id", seq.id);
        continue;
      }
      // Stop si prospect a répondu (statut > contacte)
      if (["rdv_pris", "rdv_effectue", "client", "perdu"].includes(prospect.status)) {
        await admin.from("outreach_sequences").update({ status: "stopped", stopped_reason: `prospect status: ${prospect.status}` }).eq("id", seq.id);
        continue;
      }
      // Stop si replies déjà reçues sur ce canal
      const { count: replyCount } = await admin.from("outreach_messages").select("id", { head: true, count: "exact" })
        .eq("prospect_id", prospect.id).in("status", ["replied"]);
      if ((replyCount ?? 0) > 0) {
        await admin.from("outreach_sequences").update({ status: "stopped", stopped_reason: "reply received" }).eq("id", seq.id);
        continue;
      }

      try {
        const msg = await generateSequenceMessage({ prospect, channel: seq.channel, step: seq.current_step, tone: seq.tone, custom_angle: seq.custom_angle });
        await admin.from("outreach_messages").insert({
          prospect_id: prospect.id,
          channel: seq.channel,
          subject: msg.subject || null,
          content: msg.content,
          status: "draft",
          generated_by_ai: true,
          created_by: seq.created_by,
        });

        const nextStep = seq.current_step + 1;
        if (nextStep >= seq.max_steps) {
          await admin.from("outreach_sequences").update({ status: "completed", current_step: nextStep, next_run_at: null }).eq("id", seq.id);
        } else {
          const delay = RELAY_DELAYS_DAYS[Math.min(nextStep - 1, RELAY_DELAYS_DAYS.length - 1)];
          const nextRun = new Date(Date.now() + delay * 86_400_000).toISOString();
          await admin.from("outreach_sequences").update({ current_step: nextStep, next_run_at: nextRun }).eq("id", seq.id);
        }
        processed.push({ id: seq.id, prospect: prospect.name, step: seq.current_step });
      } catch (e) {
        console.error("seq error", seq.id, e);
        await admin.from("outreach_sequences").update({ next_run_at: new Date(Date.now() + 3600_000).toISOString() }).eq("id", seq.id);
      }
    }

    return jsonResponse({ ok: true, processed_count: processed.length, processed });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
