import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { callAI } from "../_shared/ai.ts";

type ProviderId = "gemini" | "groq" | "openai" | "claude";

const PROVIDERS: Record<ProviderId, {
  label: string;
  env: string;
  model: string;
  base_url: string;
  priority: number;
  recommended: boolean;
}> = {
  gemini: {
    label: "Gemini",
    env: "GEMINI_API_KEY",
    model: "gemini-2.5-flash",
    base_url: "https://generativelanguage.googleapis.com/v1beta",
    priority: 10,
    recommended: true,
  },
  groq: {
    label: "Groq",
    env: "GROQ_API_KEY",
    model: "openai/gpt-oss-20b",
    base_url: "https://api.groq.com/openai/v1/chat/completions",
    priority: 20,
    recommended: true,
  },
  openai: {
    label: "OpenAI",
    env: "OPENAI_API_KEY",
    model: "gpt-4o-mini",
    base_url: "https://api.openai.com/v1/chat/completions",
    priority: 80,
    recommended: false,
  },
  claude: {
    label: "Claude",
    env: "ANTHROPIC_API_KEY",
    model: "claude-3-5-sonnet-latest",
    base_url: "https://api.anthropic.com/v1/messages",
    priority: 90,
    recommended: false,
  },
};

async function syncIntegrationRows(admin: any) {
  await admin
    .from("integration_settings")
    .delete()
    .in("provider", ["lovable", "lovable_ai", "lovable-gateway"]);

  for (const [provider, meta] of Object.entries(PROVIDERS) as [ProviderId, typeof PROVIDERS[ProviderId]][]) {
    const { data: existingRows } = await admin
      .from("integration_settings")
      .select("id,enabled")
      .eq("provider", provider)
      .order("created_at", { ascending: true });
    const existing = existingRows?.[0];
    const duplicateIds = (existingRows ?? []).slice(1).map((row: { id: string }) => row.id);
    if (duplicateIds.length) {
      await admin.from("integration_settings").delete().in("id", duplicateIds);
    }

    const payload = {
      kind: "ai",
      provider,
      label: meta.label,
      api_key: null,
      base_url: meta.base_url,
      model: meta.model,
      notes: `${meta.label} configure via secret serveur ${meta.env}.`,
      enabled: existing?.enabled ?? meta.recommended,
      priority: meta.priority,
    };

    if (existing?.id) {
      await admin.from("integration_settings").update(payload).eq("id", existing.id);
    } else {
      await admin.from("integration_settings").insert(payload);
    }
  }
}

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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({})) as { provider?: ProviderId; statusOnly?: boolean };
    await syncIntegrationRows(admin);

    let query = admin.from("integration_settings").select("*").eq("kind", "ai");
    if (body.provider) query = query.eq("provider", body.provider);
    const { data: rows, error } = await query.order("priority", { ascending: true });
    if (error) return jsonResponse({ error: error.message }, 500);

    const providers = body.provider ? [body.provider] : Object.keys(PROVIDERS) as ProviderId[];
    const results: {
      provider: string;
      label: string;
      ok: boolean;
      configured: boolean;
      enabled: boolean;
      model: string;
      source: "server_secret" | "database" | "missing";
      message: string;
    }[] = [];

    for (const provider of providers) {
      const meta = PROVIDERS[provider];
      const row = (rows ?? []).find((r) => r.provider === provider);
      const hasDatabaseKey = Boolean(row?.api_key);
      const hasServerSecret = Boolean(Deno.env.get(meta.env));
      const configured = hasDatabaseKey || hasServerSecret;
      const enabled = row?.enabled ?? meta.recommended;
      const model = row?.model ?? meta.model;
      const source = hasDatabaseKey ? "database" : hasServerSecret ? "server_secret" : "missing";

      if (body.statusOnly) {
        results.push({
          provider,
          label: meta.label,
          ok: configured && enabled,
          configured,
          enabled,
          model,
          source,
          message: configured ? `Configuré via ${source === "server_secret" ? "secret serveur" : "base CRM"}` : `Clé ${meta.env} absente`,
        });
        continue;
      }

      if (!configured) {
        const message = `Clé ${meta.env} absente`;
        await admin.from("integration_settings").update({
          last_test_status: "error",
          last_test_message: message,
          last_test_at: new Date().toISOString(),
        }).eq("provider", provider);
        results.push({ provider, label: meta.label, ok: false, configured, enabled, model, source, message });
        continue;
      }

      try {
        const { parsed } = await callAI({
          provider,
          systemPrompt: "Tu es un assistant de test. Réponds uniquement en JSON valide.",
          userPrompt: `Teste cette configuration IA et renvoie {"status":"ok","provider":"${provider}","model":"${model}"}`,
          tool: {
            type: "function",
            function: {
              name: "integration_test",
              parameters: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  provider: { type: "string" },
                  model: { type: "string" },
                },
                required: ["status", "provider", "model"],
                additionalProperties: false,
              },
            },
          },
          toolName: "integration_test",
        });

        const message = `OK - ${parsed.provider} / ${parsed.model}`;
        await admin.from("integration_settings").update({
          last_test_status: "success",
          last_test_message: message,
          last_test_at: new Date().toISOString(),
        }).eq("provider", provider);
        results.push({ provider, label: meta.label, ok: true, configured, enabled, model, source, message });
      } catch (e) {
        const message = (e as Error).message;
        await admin.from("integration_settings").update({
          last_test_status: "error",
          last_test_message: message,
          last_test_at: new Date().toISOString(),
        }).eq("provider", provider);
        results.push({ provider, label: meta.label, ok: false, configured, enabled, model, source, message });
      }
    }

    await admin.from("activity_log").insert({
      action: "integration_test",
      entity_type: "integration_settings",
      entity_id: null,
      user_id: user.id,
      details: { count: results.length, provider: body.provider ?? "all" },
    });

    return jsonResponse({ ok: true, results });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
