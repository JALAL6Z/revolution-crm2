// Helper pour journaliser les actions IA / scrapers dans ai_activity_logs.
// Utilise SUPABASE_SERVICE_ROLE_KEY car certaines edge functions tournent sans user.
import { createClient } from "jsr:@supabase/supabase-js@2";

export interface ActivityCtx {
  userId?: string | null;
  category: "scraper" | "agent" | "outreach" | "audit" | "enrichment" | "report";
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export async function startActivity(ctx: ActivityCtx): Promise<string | null> {
  try {
    const admin = getAdmin();
    const { data, error } = await admin.from("ai_activity_logs").insert({
      user_id: ctx.userId ?? null,
      category: ctx.category,
      action: ctx.action,
      target_type: ctx.targetType ?? null,
      target_id: ctx.targetId ?? null,
      payload: ctx.payload ?? {},
      status: "running",
    }).select("id").single();
    if (error) { console.warn("activity start err", error.message); return null; }
    return data.id as string;
  } catch (e) {
    console.warn("activity start failed", e);
    return null;
  }
}

export async function finishActivity(
  id: string | null,
  result: { ok: boolean; durationMs: number; error?: string; result?: Record<string, unknown> },
) {
  if (!id) return;
  try {
    const admin = getAdmin();
    await admin.from("ai_activity_logs")
      .update({
        status: result.ok ? "success" : "error",
        duration_ms: result.durationMs,
        error_message: result.error ?? null,
        result: result.result ?? {},
        finished_at: new Date().toISOString(),
      })
      .eq("id", id);
  } catch (e) {
    console.warn("activity finish failed", e);
  }
}

/** Wrapper pratique pour entourer un bloc d'exécution */
export async function withActivity<T>(
  ctx: ActivityCtx,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  const id = await startActivity(ctx);
  try {
    const result = await fn();
    await finishActivity(id, { ok: true, durationMs: Date.now() - start, result: { summary: "ok" } });
    return result;
  } catch (e) {
    await finishActivity(id, { ok: false, durationMs: Date.now() - start, error: (e as Error).message });
    throw e;
  }
}
