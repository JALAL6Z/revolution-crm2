// Crée une séquence de relance automatique pour un prospect.
// Le runner (cron) s'occupera ensuite de générer + envoyer le 1er message puis les relances.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { generateSequenceMessage, SUPPORTED_OUTREACH_CHANNELS } from "../_shared/outreach.ts";
import { assertProspectAccess } from "../_shared/auth.ts";

const RELAY_DELAYS_DAYS = [3, 4, 7];

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

    const { prospect_id, channel, max_steps = 3, tone, custom_angle, start_in_minutes = 0, run_first_now = true } = await req.json() as {
      prospect_id: string; channel: string; max_steps?: number; tone?: string; custom_angle?: string; start_in_minutes?: number; run_first_now?: boolean;
    };
    if (!prospect_id || !channel) return jsonResponse({ error: "prospect_id & channel required" }, 400);
    if (!SUPPORTED_OUTREACH_CHANNELS.includes(channel)) return jsonResponse({ error: "Canal non supporté" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const access = await assertProspectAccess(admin, prospect_id, user.id);
    if (!access.ok) return jsonResponse({ error: access.error }, access.status);
    const prospect = access.prospect;

    const { data: existing } = await admin
      .from("outreach_sequences")
      .select("*")
      .eq("prospect_id", prospect_id)
      .eq("channel", channel)
      .eq("status", "active")
      .maybeSingle();
    if (existing) return jsonResponse({ ok: true, sequence: existing, existing: true });

    const next = new Date(Date.now() + start_in_minutes * 60_000).toISOString();

    const { data, error } = await admin.from("outreach_sequences").insert({
      prospect_id, channel, max_steps, tone, custom_angle,
      next_run_at: next, current_step: 0, status: "active", created_by: user.id,
    }).select("*").single();
    if (error) return jsonResponse({ error: error.message }, 500);

    if (!run_first_now) return jsonResponse({ ok: true, sequence: data, first_message: null });

    const msg = await generateSequenceMessage({ prospect, channel, step: 0, tone, custom_angle });
    const { data: firstMessage, error: msgErr } = await admin.from("outreach_messages").insert({
      prospect_id,
      channel,
      subject: msg.subject || null,
      content: msg.content,
      status: "draft",
      generated_by_ai: true,
      created_by: user.id,
    }).select("*").single();
    if (msgErr) return jsonResponse({ error: msgErr.message }, 500);

    const nextStep = 1;
    const sequencePatch = nextStep >= max_steps
      ? { status: "completed", current_step: nextStep, next_run_at: null }
      : {
        current_step: nextStep,
        next_run_at: new Date(Date.now() + RELAY_DELAYS_DAYS[0] * 86_400_000).toISOString(),
      };
    const { data: updated } = await admin.from("outreach_sequences").update(sequencePatch).eq("id", data.id).select("*").single();

    await admin.from("activity_log").insert({
      action: "sequence_created",
      entity_type: "prospect",
      entity_id: prospect_id,
      user_id: user.id,
      details: { channel, max_steps, first_message_id: firstMessage?.id },
    });

    return jsonResponse({ ok: true, sequence: updated ?? data, first_message: firstMessage });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
