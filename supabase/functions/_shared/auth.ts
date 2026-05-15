import { createClient } from "jsr:@supabase/supabase-js@2";
import { jsonResponse } from "./cors.ts";

export interface AuthContext {
  user: { id: string; email?: string };
  authHeader: string;
}

export function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service configuration missing");
  return createClient(url, key);
}

export async function requireUser(req: Request): Promise<AuthContext | Response> {
  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !publishableKey) {
    return jsonResponse({ error: "Supabase auth configuration missing" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return { user: { id: user.id, email: user.email }, authHeader };
}

export async function assertJobOwner(admin: ReturnType<typeof getAdminClient>, jobId: string, userId: string) {
  const { data: job, error } = await admin
    .from("scraping_jobs")
    .select("id, created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!job) return { ok: false as const, status: 404, error: "Scraping job not found" };
  if (job.created_by !== userId) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, job };
}

export async function assertAdminRole(admin: ReturnType<typeof getAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { ok: false as const, status: 403, error: "Admin role required" };
  return { ok: true as const };
}

export async function assertProspectAccess(admin: ReturnType<typeof getAdminClient>, prospectId: string, userId: string) {
  const [{ data: roleRow, error: roleError }, { data: prospect, error: prospectError }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    admin.from("prospects").select("*").eq("id", prospectId).maybeSingle(),
  ]);

  if (roleError) throw new Error(roleError.message);
  if (prospectError) throw new Error(prospectError.message);
  if (!prospect) return { ok: false as const, status: 404, error: "Prospect not found" };
  if (roleRow?.role === "admin" || prospect.assigned_to === userId) return { ok: true as const, prospect };
  return { ok: false as const, status: 403, error: "Forbidden" };
}

export async function requireAdminOrCron(req: Request): Promise<{ ok: true } | Response> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && providedSecret === cronSecret) return { ok: true };

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const admin = getAdminClient();
  const access = await assertAdminRole(admin, auth.user.id);
  if (!access.ok) {
    return jsonResponse({ error: "Admin role or valid cron secret required" }, 403);
  }

  return { ok: true };
}
