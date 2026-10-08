-- Reusable Administration roles and grantable user-management permission.
create table if not exists public.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 60),
  description text not null default '',
  manage_users boolean not null default false,
  manage_creators boolean not null default false,
  manage_brands boolean not null default false,
  manage_campaigns boolean not null default false,
  manage_content boolean not null default false,
  manage_support boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspace_roles enable row level security;
alter table public.user_permissions add column if not exists manage_users boolean not null default false;
alter table public.user_permissions add column if not exists workspace_role_id uuid references public.workspace_roles(id) on delete set null;

insert into public.workspace_roles (name, description, manage_creators, manage_brands, manage_campaigns, manage_content, manage_support)
values ('Operations Manager', 'Standard operational access without Administration or Audit Trail access.', true, true, true, true, true)
on conflict (name) do nothing;

create or replace function public.has_admin_permission(permission_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    when public.current_app_role() <> 'operations_admin' then false
    when permission_name = 'manage_users' then coalesce((select manage_users from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_creators' then coalesce((select manage_creators from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_brands' then coalesce((select manage_brands from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_campaigns' then coalesce((select manage_campaigns from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_content' then coalesce((select manage_content from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_support' then coalesce((select manage_support from public.user_permissions where user_id = auth.uid()), false)
    else false
  end
$$;

drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin() or public.has_admin_permission('manage_users'));

drop policy if exists user_permissions_read_own_or_super on public.user_permissions;
create policy user_permissions_read_own_or_super on public.user_permissions for select to authenticated
using (user_id = auth.uid() or public.is_super_admin() or public.has_admin_permission('manage_users'));

drop policy if exists workspace_roles_admin_read on public.workspace_roles;
create policy workspace_roles_admin_read on public.workspace_roles for select to authenticated
using (public.is_admin());
drop policy if exists workspace_roles_super_write on public.workspace_roles;
create policy workspace_roles_super_write on public.workspace_roles for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on public.workspace_roles from anon;
grant select on public.workspace_roles to authenticated;
grant insert, update, delete on public.workspace_roles to authenticated;

drop trigger if exists set_workspace_roles_updated_at on public.workspace_roles;
create trigger set_workspace_roles_updated_at before update on public.workspace_roles
for each row execute procedure public.set_updated_at();
drop trigger if exists audit_workspace_roles on public.workspace_roles;
create trigger audit_workspace_roles after insert or update or delete on public.workspace_roles
for each row execute procedure public.audit_row_change();

create or replace function public.sync_workspace_role_permissions()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.user_permissions set
    manage_users = new.manage_users,
    manage_creators = new.manage_creators,
    manage_brands = new.manage_brands,
    manage_campaigns = new.manage_campaigns,
    manage_content = new.manage_content,
    manage_support = new.manage_support,
    updated_at = now()
  where workspace_role_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_workspace_role_permissions on public.workspace_roles;
create trigger sync_workspace_role_permissions after update of manage_users, manage_creators, manage_brands, manage_campaigns, manage_content, manage_support on public.workspace_roles
for each row execute procedure public.sync_workspace_role_permissions();

revoke execute on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;
revoke execute on function public.sync_workspace_role_permissions() from public, anon, authenticated;
