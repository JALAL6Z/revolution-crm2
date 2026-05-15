delete from public.integration_settings
where provider in ('lovable', 'lovable_ai', 'lovable-gateway');

update public.integration_settings
set api_key = null
where provider in ('gemini', 'groq', 'openai', 'claude');

create unique index if not exists integration_settings_provider_unique
on public.integration_settings(provider);

insert into public.integration_settings (
  kind,
  provider,
  label,
  api_key,
  base_url,
  model,
  notes,
  enabled,
  priority
) values
  (
    'ai',
    'gemini',
    'Gemini',
    null,
    'https://generativelanguage.googleapis.com/v1beta',
    'gemini-2.5-flash',
    'Provider principal gratuit. La cle doit rester dans GEMINI_API_KEY cote Supabase secrets.',
    true,
    10
  ),
  (
    'ai',
    'groq',
    'Groq',
    null,
    'https://api.groq.com/openai/v1/chat/completions',
    'openai/gpt-oss-20b',
    'Fallback rapide gratuit. La cle doit rester dans GROQ_API_KEY cote Supabase secrets.',
    true,
    20
  ),
  (
    'ai',
    'openai',
    'OpenAI',
    null,
    'https://api.openai.com/v1/chat/completions',
    'gpt-4o-mini',
    'Provider premium optionnel, desactive par defaut.',
    false,
    80
  ),
  (
    'ai',
    'claude',
    'Claude',
    null,
    'https://api.anthropic.com/v1/messages',
    'claude-3-5-sonnet-latest',
    'Provider premium optionnel, desactive par defaut.',
    false,
    90
  )
on conflict (provider) do update set
  kind = excluded.kind,
  label = excluded.label,
  api_key = null,
  base_url = excluded.base_url,
  model = excluded.model,
  notes = excluded.notes,
  enabled = excluded.enabled,
  priority = excluded.priority,
  updated_at = now();
