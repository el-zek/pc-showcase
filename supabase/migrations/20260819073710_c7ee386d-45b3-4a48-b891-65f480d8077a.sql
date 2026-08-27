
do $$ begin
  create type public.app_role as enum ('admin','manager','cashier','staff');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists email text,
  add column if not exists status text not null default 'active',
  add column if not exists last_seen_at timestamptz;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, update, delete on public.user_roles to authenticated, anon;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
drop policy if exists "open access user_roles" on public.user_roles;
create policy "open access user_roles" on public.user_roles for all to anon, authenticated using (true) with check (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table if not exists public.permission_catalog (
  permission_key text primary key,
  module text not null,
  action text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.permission_catalog to authenticated, anon;
grant all on public.permission_catalog to service_role;
alter table public.permission_catalog enable row level security;
drop policy if exists "open access permission_catalog" on public.permission_catalog;
create policy "open access permission_catalog" on public.permission_catalog for all to anon, authenticated using (true) with check (true);

insert into public.permission_catalog (permission_key, module, action, description) values
  ('sales.view','Sales','View','View sales records'),
  ('sales.create','Sales','Create','Create sales records'),
  ('sales.update','Sales','Update','Edit sales records'),
  ('sales.delete','Sales','Delete','Delete sales records'),
  ('sales.export','Sales','Export','Export sales data'),
  ('reports.view','Reports','View','View reports'),
  ('reports.export','Reports','Export','Export reports'),
  ('inventory.view','Inventory','View','View inventory'),
  ('inventory.update','Inventory','Update','Update inventory'),
  ('customers.view','Customers','View','View customers'),
  ('customers.update','Customers','Update','Edit customers'),
  ('finance.view','Finance','View','View finance records'),
  ('finance.update','Finance','Update','Edit finance records'),
  ('compliance.view','Compliance','View','View compliance and tax records'),
  ('compliance.update','Compliance','Update','Edit compliance and tax records'),
  ('employees.view','Employees','View','View employees'),
  ('employees.update','Employees','Update','Edit employees'),
  ('administration.manage','Administration','Manage','Manage administration settings and access')
on conflict (permission_key) do nothing;

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission_key text not null references public.permission_catalog(permission_key) on delete cascade,
  scope text not null default 'ALL' check (scope in ('ALL','BRANCH','DEPARTMENT','TEAM','OWN')),
  created_at timestamptz not null default now(),
  unique (role, permission_key)
);
create index if not exists role_permissions_role_idx on public.role_permissions(role);
grant select, insert, update, delete on public.role_permissions to authenticated, anon;
grant all on public.role_permissions to service_role;
alter table public.role_permissions enable row level security;
drop policy if exists "open access role_permissions" on public.role_permissions;
create policy "open access role_permissions" on public.role_permissions for all to anon, authenticated using (true) with check (true);

insert into public.role_permissions (role, permission_key)
select 'admin'::public.app_role, permission_key from public.permission_catalog
on conflict (role, permission_key) do nothing;

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  permission_key text not null references public.permission_catalog(permission_key) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  scope text not null default 'ALL' check (scope in ('ALL','BRANCH','DEPARTMENT','TEAM','OWN')),
  created_at timestamptz not null default now(),
  unique (user_id, permission_key)
);
grant select, insert, update, delete on public.user_permission_overrides to authenticated, anon;
grant all on public.user_permission_overrides to service_role;
alter table public.user_permission_overrides enable row level security;
drop policy if exists "open access user_permission_overrides" on public.user_permission_overrides;
create policy "open access user_permission_overrides" on public.user_permission_overrides for all to anon, authenticated using (true) with check (true);

create table if not exists public.business_settings (
  setting_key text primary key,
  setting_value text not null default '',
  description text,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.business_settings to authenticated, anon;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
drop policy if exists "open access business_settings" on public.business_settings;
create policy "open access business_settings" on public.business_settings for all to anon, authenticated using (true) with check (true);
drop trigger if exists trg_business_settings_updated on public.business_settings;
create trigger trg_business_settings_updated before update on public.business_settings
for each row execute function public.update_updated_at_column();

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_label text,
  action text not null,
  resource_type text not null,
  resource_id text,
  previous_value text,
  new_value text,
  status text not null default 'success',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs(created_at desc);
grant select, insert on public.admin_audit_logs to authenticated, anon;
grant all on public.admin_audit_logs to service_role;
alter table public.admin_audit_logs enable row level security;
drop policy if exists "open access admin_audit_logs" on public.admin_audit_logs;
create policy "open access admin_audit_logs" on public.admin_audit_logs for all to anon, authenticated using (true) with check (true);

create or replace function public.has_permission(_user_id uuid, _permission_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select (
    exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
      where ur.user_id = _user_id and rp.permission_key = _permission_key
    )
    or exists (
      select 1 from public.user_permission_overrides upo
      where upo.user_id = _user_id and upo.permission_key = _permission_key and upo.effect = 'allow'
    )
  ) and not exists (
    select 1 from public.user_permission_overrides d
    where d.user_id = _user_id and d.permission_key = _permission_key and d.effect = 'deny'
  );
$$;
grant execute on function public.has_permission(uuid, text) to authenticated, anon;
