-- Careers management: a dedicated permission plus public, publishable vacancies.
alter table public.workspace_roles add column if not exists manage_careers boolean not null default false;
alter table public.user_permissions add column if not exists manage_careers boolean not null default false;

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
    when permission_name = 'manage_careers' then coalesce((select manage_careers from public.user_permissions where user_id = auth.uid()), false)
    else false
  end
$$;

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
    manage_careers = new.manage_careers,
    updated_at = now()
  where workspace_role_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_workspace_role_permissions on public.workspace_roles;
create trigger sync_workspace_role_permissions
after update of manage_users, manage_creators, manage_brands, manage_campaigns, manage_content, manage_support, manage_careers
on public.workspace_roles for each row execute procedure public.sync_workspace_role_permissions();

create table if not exists public.career_openings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 120),
  department text not null default '',
  location text not null default 'Egypt',
  workplace_type text not null default 'hybrid' check (workplace_type in ('on_site','hybrid','remote')),
  employment_type text not null default 'full_time' check (employment_type in ('full_time','part_time','contract','internship','freelance')),
  summary text not null default '',
  requirements text not null default '',
  application_email text not null default 'careers@snappi-eg.com',
  application_url text,
  opens_on date,
  closes_on date,
  status text not null default 'draft' check (status in ('draft','published','closed','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_openings enable row level security;
create index if not exists career_openings_status_created_idx on public.career_openings(status, created_at desc);

drop policy if exists career_openings_public_read on public.career_openings;
create policy career_openings_public_read on public.career_openings for select
using (status = 'published' or public.has_admin_permission('manage_careers'));
drop policy if exists career_openings_admin_write on public.career_openings;
create policy career_openings_admin_write on public.career_openings for all to authenticated
using (public.has_admin_permission('manage_careers')) with check (public.has_admin_permission('manage_careers'));

grant select on public.career_openings to anon, authenticated;
grant insert, update, delete on public.career_openings to authenticated;

drop trigger if exists set_career_openings_updated_at on public.career_openings;
create trigger set_career_openings_updated_at before update on public.career_openings
for each row execute procedure public.set_updated_at();
drop trigger if exists audit_career_openings on public.career_openings;
create trigger audit_career_openings after insert or update or delete on public.career_openings
for each row execute procedure public.audit_row_change();

revoke execute on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated;
revoke execute on function public.sync_workspace_role_permissions() from public, anon, authenticated;
