create extension if not exists pgcrypto;

do $$
begin
  execute 'drop table if exists public.ads_reports cascade';
  execute 'drop table if exists public.funnel_events cascade';
  execute 'drop table if exists public.integration_settings cascade';
  execute 'drop table if exists public.web_search_cache cascade';
  execute 'drop table if exists public.enrichment_cache cascade';
  execute 'drop table if exists public.activity_log cascade';
  execute 'drop table if exists public.site_audits cascade';
  execute 'drop table if exists public.scraping_results cascade';
  execute 'drop table if exists public.scraping_jobs cascade';
  execute 'drop table if exists public.outreach_sequences cascade';
  execute 'drop table if exists public.outreach_messages cascade';
  execute 'drop table if exists public.ai_messages cascade';
  execute 'drop table if exists public.ai_activity_logs cascade';
  execute 'drop table if exists public.call_scripts cascade';
  execute 'drop table if exists public.campaign_alerts cascade';
  execute 'drop table if exists public.campaigns cascade';
  execute 'drop table if exists public.appointments cascade';
  execute 'drop table if exists public.invoices cascade';
  execute 'drop table if exists public.clients cascade';
  execute 'drop table if exists public.prospects cascade';
  execute 'drop table if exists public.user_roles cascade';
  execute 'drop table if exists public.profiles cascade';
exception
  when undefined_table then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_team_member(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _user_id is not null;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  city text,
  sector text,
  source text not null default 'manual',
  status text not null default 'a_contacter',
  score integer,
  analysis_score integer,
  next_action_at timestamptz,
  last_contact_at timestamptz,
  digital_analysis jsonb,
  pain_points text[],
  recommended_services text[],
  ai_note text,
  analyzed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  address text,
  country text,
  source_url text,
  linkedin_url text,
  instagram_handle text,
  dirigeant text,
  employees_count integer,
  reviews_count integer,
  rating numeric,
  budget_estimate_min numeric,
  budget_estimate_max numeric,
  revenue_estimate numeric,
  category text,
  notes text,
  tags text[],
  siren text,
  zip text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  prospect_id uuid references public.prospects(id) on delete set null,
  services text[] default '{}'::text[],
  mrr numeric,
  total_billed numeric,
  status text,
  start_date date,
  notes text,
  account_manager uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  client_id uuid references public.clients(id) on delete set null,
  amount numeric not null default 0,
  status text not null default 'draft',
  description text,
  due_date date,
  paid_at timestamptz,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scheduled_at timestamptz not null,
  duration_minutes integer,
  notes text,
  outcome text,
  type text,
  assigned_to uuid references auth.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  prospect_id uuid references public.prospects(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null,
  name text not null,
  objective text,
  status text,
  monthly_budget numeric,
  target_roas numeric,
  current_spend numeric,
  current_roas numeric,
  current_conversions integer,
  current_clicks integer,
  current_impressions integer,
  current_ctr numeric,
  current_cpl numeric,
  active boolean not null default true,
  external_account_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_alerts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  metric text not null,
  operator text not null,
  threshold numeric not null,
  active boolean not null default true,
  last_triggered_at timestamptz,
  last_value numeric,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.call_scripts (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.prospects(id) on delete set null,
  title text not null,
  objective text,
  tone text,
  script text not null,
  hook text,
  objections jsonb,
  closing text,
  variables jsonb,
  model_used text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  category text not null,
  status text not null,
  payload jsonb,
  result jsonb,
  error_message text,
  duration_ms integer,
  target_id text,
  target_type text,
  user_id uuid references auth.users(id) on delete set null,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null,
  subject text,
  content text not null,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  reply_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null,
  subject text,
  content text not null,
  status text not null default 'draft',
  generated_by_ai boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  replied_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outreach_sequences (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  channel text not null,
  status text not null default 'active',
  current_step integer not null default 0,
  max_steps integer not null default 3,
  next_run_at timestamptz,
  stopped_reason text,
  tone text,
  custom_angle text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scraping_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  source text not null,
  platform text,
  query text,
  input jsonb,
  filters jsonb not null default '{}'::jsonb,
  mode text not null default 'manual',
  name text,
  status text not null default 'queued',
  progress integer not null default 0,
  results_count integer not null default 0,
  imported_count integer not null default 0,
  duplicates_count integer not null default 0,
  auto_import boolean not null default false,
  auto_enrich boolean not null default false,
  cost_credits numeric,
  duration_ms integer,
  error_message text,
  external_run_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scraping_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scraping_jobs(id) on delete cascade,
  name text,
  contact_name text,
  email text,
  phone text,
  website text,
  city text,
  sector text,
  source text not null,
  source_url text,
  linkedin_url text,
  instagram_handle text,
  siren text,
  address text,
  country text,
  zip text,
  rating numeric,
  reviews_count integer,
  employees_count integer,
  revenue_estimate numeric,
  category text,
  engagement_rate numeric,
  followers integer,
  ai_score numeric,
  raw_data jsonb,
  import_status text not null default 'pending',
  duplicate_of uuid references public.prospects(id) on delete set null,
  imported_prospect_id uuid references public.prospects(id) on delete set null,
  imported_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.site_audits (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  prospect_id uuid references public.prospects(id) on delete set null,
  findings jsonb,
  recommendations jsonb,
  score_global integer,
  score_mobile integer,
  score_perf integer,
  score_seo integer,
  score_ux integer,
  pdf_url text,
  generated_by uuid references auth.users(id) on delete set null,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.enrichment_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  provider text not null,
  payload jsonb not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.web_search_cache (
  id uuid primary key default gen_random_uuid(),
  query_hash text not null unique,
  query text not null,
  results jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  prospect_id uuid references public.prospects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  source text,
  status_from text,
  status_to text,
  channel text,
  amount numeric,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ads_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  period_start date not null,
  period_end date not null,
  platforms text[] not null default '{}'::text[],
  raw_data jsonb not null default '{}'::jsonb,
  kpis jsonb,
  recommendations jsonb,
  ai_summary text,
  status text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  provider text not null,
  label text not null,
  api_key text,
  base_url text,
  model text,
  notes text,
  enabled boolean not null default true,
  priority integer not null default 0,
  last_test_at timestamptz,
  last_test_status text,
  last_test_message text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'admin')
  on conflict (user_id) do update set role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'activity_log',
    'ads_reports',
    'ai_activity_logs',
    'ai_messages',
    'appointments',
    'call_scripts',
    'campaign_alerts',
    'campaigns',
    'clients',
    'enrichment_cache',
    'funnel_events',
    'integration_settings',
    'invoices',
    'outreach_messages',
    'outreach_sequences',
    'profiles',
    'prospects',
    'scraping_jobs',
    'scraping_results',
    'site_audits',
    'user_roles',
    'web_search_cache'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute 'drop policy if exists "Authenticated users can manage rows" on public.' || quote_ident(table_name);
    execute format(
      'create policy "Authenticated users can manage rows" on public.%I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      table_name
    );
  end loop;
end $$;

create index if not exists profiles_updated_at_idx on public.profiles(updated_at desc);
create index if not exists user_roles_user_id_idx on public.user_roles(user_id);
create index if not exists prospects_created_at_idx on public.prospects(created_at desc);
create index if not exists prospects_status_created_at_idx on public.prospects(status, created_at desc);
create index if not exists prospects_source_created_at_idx on public.prospects(source, created_at desc);
create index if not exists prospects_email_lower_idx on public.prospects(lower(email)) where email is not null;
create index if not exists prospects_phone_idx on public.prospects(phone) where phone is not null;
create index if not exists prospects_siren_idx on public.prospects(siren) where siren is not null;
create index if not exists clients_company_name_idx on public.clients(company_name);
create index if not exists clients_prospect_id_idx on public.clients(prospect_id);
create index if not exists invoices_client_id_idx on public.invoices(client_id);
create index if not exists invoices_status_idx on public.invoices(status);
create index if not exists appointments_scheduled_at_idx on public.appointments(scheduled_at);
create index if not exists campaigns_client_id_idx on public.campaigns(client_id);
create index if not exists campaigns_platform_idx on public.campaigns(platform);
create index if not exists campaign_alerts_campaign_id_idx on public.campaign_alerts(campaign_id);
create index if not exists outreach_messages_prospect_id_idx on public.outreach_messages(prospect_id);
create index if not exists outreach_messages_created_at_idx on public.outreach_messages(created_at desc);
create index if not exists outreach_sequences_prospect_id_idx on public.outreach_sequences(prospect_id);
create index if not exists outreach_sequences_next_run_at_idx on public.outreach_sequences(next_run_at);
create index if not exists scraping_jobs_created_by_idx on public.scraping_jobs(created_by);
create index if not exists scraping_jobs_status_idx on public.scraping_jobs(status);
create index if not exists scraping_jobs_source_idx on public.scraping_jobs(source);
create index if not exists scraping_results_job_id_idx on public.scraping_results(job_id);
create index if not exists scraping_results_import_status_idx on public.scraping_results(import_status);
create index if not exists scraping_results_duplicate_of_idx on public.scraping_results(duplicate_of);
create index if not exists site_audits_prospect_id_idx on public.site_audits(prospect_id);
create index if not exists funnel_events_created_at_idx on public.funnel_events(created_at desc);
create index if not exists funnel_events_event_type_idx on public.funnel_events(event_type);
create index if not exists funnel_events_prospect_id_idx on public.funnel_events(prospect_id);
create index if not exists funnel_events_client_id_idx on public.funnel_events(client_id);
create index if not exists funnel_events_source_idx on public.funnel_events(source);
create index if not exists ads_reports_client_id_idx on public.ads_reports(client_id);
create index if not exists ads_reports_period_idx on public.ads_reports(period_start, period_end);
create index if not exists integration_settings_kind_idx on public.integration_settings(kind);
create index if not exists integration_settings_provider_idx on public.integration_settings(provider);
create index if not exists integration_settings_enabled_idx on public.integration_settings(enabled);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists trg_prospects_updated_at on public.prospects;
create trigger trg_prospects_updated_at
before update on public.prospects
for each row execute function public.set_updated_at();

drop trigger if exists trg_campaigns_updated_at on public.campaigns;
create trigger trg_campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

drop trigger if exists trg_outreach_messages_updated_at on public.outreach_messages;
create trigger trg_outreach_messages_updated_at
before update on public.outreach_messages
for each row execute function public.set_updated_at();

drop trigger if exists trg_outreach_sequences_updated_at on public.outreach_sequences;
create trigger trg_outreach_sequences_updated_at
before update on public.outreach_sequences
for each row execute function public.set_updated_at();

drop trigger if exists trg_integration_settings_updated_at on public.integration_settings;
create trigger trg_integration_settings_updated_at
before update on public.integration_settings
for each row execute function public.set_updated_at();
