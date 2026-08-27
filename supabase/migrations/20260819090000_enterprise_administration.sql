-- Enterprise Administration extends the existing profiles/user_roles model.
-- It deliberately does not introduce a second role or authorization engine.

create table if not exists public.permission_catalog (
  permission_key text primary key,
  module text not null,
  action text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.permission_catalog to authenticated;
alter table public.permission_catalog enable row level security;
create policy "authenticated users read permission catalog" on public.permission_catalog
  for select to authenticated using (true);

insert into public.permission_catalog (permission_key, module, action, description)
values
  ('sales.view', 'Sales', 'View', 'View sales records'),
  ('sales.create', 'Sales', 'Create', 'Create sales records'),
  ('sales.update', 'Sales', 'Update', 'Edit sales records'),
  ('sales.delete', 'Sales', 'Delete', 'Delete sales records'),
  ('sales.export', 'Sales', 'Export', 'Export sales data'),
  ('reports.view', 'Reports', 'View', 'View reports'),
  ('reports.export', 'Reports', 'Export', 'Export reports'),
  ('inventory.view', 'Inventory', 'View', 'View inventory'),
  ('inventory.update', 'Inventory', 'Update', 'Update inventory'),
  ('administration.manage', 'Administration', 'Manage', 'Manage administration settings and access')
on conflict (permission_key) do nothing;

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission_key text not null references public.permission_catalog(permission_key) on delete cascade,
  scope text not null default 'ALL' check (scope in ('ALL', 'BRANCH', 'DEPARTMENT', 'TEAM', 'OWN')),
  created_at timestamptz not null default now(),
  unique (role, permission_key)
);

create index if not exists role_permissions_role_idx on public.role_permissions(role);
grant select, insert, update, delete on public.role_permissions to authenticated;
alter table public.role_permissions enable row level security;
create policy "authenticated users read role permissions" on public.role_permissions
  for select to authenticated using (true);
create policy "admins manage role permissions" on public.role_permissions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null references public.permission_catalog(permission_key) on delete cascade,
  effect text not null check (effect in ('allow', 'deny')),
  scope text not null default 'ALL' check (scope in ('ALL', 'BRANCH', 'DEPARTMENT', 'TEAM', 'OWN')),
  created_at timestamptz not null default now(),
  unique (user_id, permission_key)
);

grant select, insert, update, delete on public.user_permission_overrides to authenticated;
alter table public.user_permission_overrides enable row level security;
create policy "users read own permission overrides" on public.user_permission_overrides
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "admins manage permission overrides" on public.user_permission_overrides
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.business_settings (
  setting_key text primary key,
  setting_value text not null default '',
  description text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.business_settings to authenticated;
alter table public.business_settings enable row level security;
create policy "authenticated users read business settings" on public.business_settings
  for select to authenticated using (true);
create policy "admins manage business settings" on public.business_settings
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null default auth.uid() references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  previous_value text,
  new_value text,
  request_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
grant select, insert on public.admin_audit_logs to authenticated;
alter table public.admin_audit_logs enable row level security;
create policy "admins read audit logs" on public.admin_audit_logs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins append audit logs" on public.admin_audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() and public.has_role(auth.uid(), 'admin'));

create or replace function public.has_permission(_user_id uuid, _permission_key text)
returns boolean language sql stable security definer set search_path = public
as $$
  (
    exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
      where ur.user_id = _user_id
        and rp.permission_key = _permission_key
        and rp.scope is not null
    )
    or exists (
      select 1
      from public.user_permission_overrides upo
      where upo.user_id = _user_id
        and upo.permission_key = _permission_key
        and upo.effect = 'allow'
    )
  )
  and not exists (
    select 1
    from public.user_permission_overrides denied
    where denied.user_id = _user_id
      and denied.permission_key = _permission_key
      and denied.effect = 'deny'
  );
$$;

grant execute on function public.has_permission(uuid, text) to authenticated;
