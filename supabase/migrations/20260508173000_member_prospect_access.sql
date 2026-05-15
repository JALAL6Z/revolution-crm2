create index if not exists prospects_assigned_to_idx on public.prospects(assigned_to);
create index if not exists user_roles_role_idx on public.user_roles(role);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  next_role text := 'setter';
begin
  if requested_role in ('admin', 'setter', 'closer') then
    next_role := requested_role;
  end if;

  insert into public.profiles (id, full_name, phone, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  insert into public.user_roles (user_id, role)
  values (new.id, next_role)
  on conflict (user_id) do update set role = excluded.role;

  return new;
end;
$$;

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
    'campaign_alerts',
    'campaigns',
    'clients',
    'enrichment_cache',
    'funnel_events',
    'integration_settings',
    'invoices',
    'scraping_jobs',
    'scraping_results',
    'site_audits',
    'web_search_cache'
  ]
  loop
    execute 'drop policy if exists "Authenticated users can manage rows" on public.' || quote_ident(table_name);
    execute 'drop policy if exists "Admins can manage rows" on public.' || quote_ident(table_name);
    execute format(
      'create policy "Admins can manage rows" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))',
      table_name
    );
  end loop;
end $$;

drop policy if exists "Authenticated users can manage rows" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Admins can manage profiles"
  on public.profiles
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Authenticated users can manage rows" on public.user_roles;
drop policy if exists "Admins can manage user roles" on public.user_roles;
drop policy if exists "Users can read own role" on public.user_roles;

create policy "Admins can manage user roles"
  on public.user_roles
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Users can read own role"
  on public.user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Authenticated users can manage rows" on public.prospects;
drop policy if exists "Admins can manage prospects" on public.prospects;
drop policy if exists "Assigned members can read prospects" on public.prospects;
drop policy if exists "Assigned members can update prospects" on public.prospects;

create policy "Admins can manage prospects"
  on public.prospects
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Assigned members can read prospects"
  on public.prospects
  for select
  to authenticated
  using (
    assigned_to = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Assigned members can update prospects"
  on public.prospects
  for update
  to authenticated
  using (
    assigned_to = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  )
  with check (
    assigned_to = auth.uid()
    or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "Authenticated users can manage rows" on public.outreach_messages;
drop policy if exists "Admins can manage outreach messages" on public.outreach_messages;
drop policy if exists "Assigned members can manage outreach messages" on public.outreach_messages;

create policy "Admins can manage outreach messages"
  on public.outreach_messages
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Assigned members can manage outreach messages"
  on public.outreach_messages
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.prospects p
      where p.id = outreach_messages.prospect_id
        and p.assigned_to = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.prospects p
      where p.id = outreach_messages.prospect_id
        and p.assigned_to = auth.uid()
    )
  );

drop policy if exists "Authenticated users can manage rows" on public.outreach_sequences;
drop policy if exists "Admins can manage outreach sequences" on public.outreach_sequences;
drop policy if exists "Assigned members can manage outreach sequences" on public.outreach_sequences;

create policy "Admins can manage outreach sequences"
  on public.outreach_sequences
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Assigned members can manage outreach sequences"
  on public.outreach_sequences
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.prospects p
      where p.id = outreach_sequences.prospect_id
        and p.assigned_to = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.prospects p
      where p.id = outreach_sequences.prospect_id
        and p.assigned_to = auth.uid()
    )
  );

drop policy if exists "Authenticated users can manage rows" on public.call_scripts;
drop policy if exists "Admins can manage call scripts" on public.call_scripts;
drop policy if exists "Assigned members can read call scripts" on public.call_scripts;

create policy "Admins can manage call scripts"
  on public.call_scripts
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Assigned members can read call scripts"
  on public.call_scripts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.prospects p
      where p.id = call_scripts.prospect_id
        and p.assigned_to = auth.uid()
    )
  );
