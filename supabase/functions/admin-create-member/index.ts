import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAdminClient, requireUser } from "../_shared/auth.ts";

const ALLOWED_ROLES = new Set(["admin", "setter", "closer"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const auth = await requireUser(req);
    if (auth instanceof Response) return auth;

    const admin = getAdminClient();
    const { data: roleRow, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", auth.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow) return jsonResponse({ error: "Acces admin requis" }, 403);

    const body = await req.json() as {
      email?: string;
      password?: string;
      full_name?: string;
      phone?: string;
      role?: string;
    };

    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const fullName = body.full_name?.trim();
    const role = ALLOWED_ROLES.has(body.role ?? "") ? body.role! : "setter";

    if (!email || !password || !fullName) {
      return jsonResponse({ error: "email, password et full_name requis" }, 400);
    }
    if (password.length < 6) {
      return jsonResponse({ error: "Mot de passe trop court" }, 400);
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: body.phone ?? null, role },
    });
    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message ?? "Creation utilisateur impossible" }, 400);
    }

    const userId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      phone: body.phone?.trim() || null,
    });
    if (profileError) throw new Error(profileError.message);

    const { error: upsertRoleError } = await admin.from("user_roles").upsert({
      user_id: userId,
      role,
    }, { onConflict: "user_id" });
    if (upsertRoleError) throw new Error(upsertRoleError.message);

    return jsonResponse({
      ok: true,
      user: { id: userId, email, full_name: fullName, role },
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
