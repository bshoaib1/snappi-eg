-- SNAPPI ADMIN PERMISSIONS UPGRADE
-- Run once in Supabase SQL Editor after snappi_admin_schema.sql.

create table if not exists public.user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  manage_creators boolean not null default false,
  manage_brands boolean not null default false,
  manage_campaigns boolean not null default false,
  manage_content boolean not null default false,
  manage_support boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_permissions enable row level security;

create or replace function public.has_admin_permission(permission_name text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    when public.current_app_role() <> 'operations_admin' then false
    when permission_name = 'manage_creators' then coalesce((select manage_creators from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_brands' then coalesce((select manage_brands from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_campaigns' then coalesce((select manage_campaigns from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_content' then coalesce((select manage_content from public.user_permissions where user_id = auth.uid()), false)
    when permission_name = 'manage_support' then coalesce((select manage_support from public.user_permissions where user_id = auth.uid()), false)
    else false
  end
$$;

create or replace function public.admin_set_account_status(target_user_id uuid, next_status public.account_status)
returns void
language plpgsql security definer
set search_path = public
as $$
declare target_role public.app_role;
begin
  select role into target_role from public.profiles where id = target_user_id;
  if target_role = 'super_admin' then
    raise exception 'Super Admin status cannot be changed from this action';
  end if;
  if not (
    public.is_super_admin()
    or (target_role = 'creator' and public.has_admin_permission('manage_creators'))
    or (target_role = 'brand' and public.has_admin_permission('manage_brands'))
  ) then
    raise exception 'Insufficient permission';
  end if;
  update public.profiles set status = next_status where id = target_user_id;
end;
$$;

-- Permissions are visible to their owner, but only Super Admin can grant or change them.
drop policy if exists user_permissions_read_own_or_super on public.user_permissions;
create policy user_permissions_read_own_or_super on public.user_permissions for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
drop policy if exists user_permissions_super_write on public.user_permissions;
create policy user_permissions_super_write on public.user_permissions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Creator data.
drop policy if exists creator_profiles_read_own_or_admin on public.creator_profiles;
create policy creator_profiles_read_own_or_admin on public.creator_profiles for select to authenticated using (user_id = auth.uid() or public.has_admin_permission('manage_creators'));
drop policy if exists creator_profiles_admin_write on public.creator_profiles;
create policy creator_profiles_admin_write on public.creator_profiles for all to authenticated using (public.has_admin_permission('manage_creators')) with check (public.has_admin_permission('manage_creators'));

-- Brand data.
drop policy if exists brand_profiles_read_own_or_admin on public.brand_profiles;
create policy brand_profiles_read_own_or_admin on public.brand_profiles for select to authenticated using (user_id = auth.uid() or public.has_admin_permission('manage_brands'));
drop policy if exists brand_profiles_admin_write on public.brand_profiles;
create policy brand_profiles_admin_write on public.brand_profiles for all to authenticated using (public.has_admin_permission('manage_brands')) with check (public.has_admin_permission('manage_brands'));

-- Campaign and assignment data.
drop policy if exists campaigns_read_participants on public.campaigns;
create policy campaigns_read_participants on public.campaigns for select to authenticated using (public.has_admin_permission('manage_campaigns') or brand_id = auth.uid() or public.user_is_campaign_creator(id));
drop policy if exists campaigns_admin_write on public.campaigns;
create policy campaigns_admin_write on public.campaigns for all to authenticated using (public.has_admin_permission('manage_campaigns')) with check (public.has_admin_permission('manage_campaigns'));
drop policy if exists campaign_creators_read_participants on public.campaign_creators;
create policy campaign_creators_read_participants on public.campaign_creators for select to authenticated using (public.has_admin_permission('manage_campaigns') or creator_id = auth.uid() or public.user_is_campaign_brand(campaign_id));
drop policy if exists campaign_creators_admin_write on public.campaign_creators;
create policy campaign_creators_admin_write on public.campaign_creators for all to authenticated using (public.has_admin_permission('manage_campaigns')) with check (public.has_admin_permission('manage_campaigns'));

-- Content workflow.
drop policy if exists content_read_participants on public.content_submissions;
create policy content_read_participants on public.content_submissions for select to authenticated using (public.has_admin_permission('manage_content') or creator_id = auth.uid() or public.user_is_campaign_brand(campaign_id));
drop policy if exists content_admin_write on public.content_submissions;
create policy content_admin_write on public.content_submissions for all to authenticated using (public.has_admin_permission('manage_content')) with check (public.has_admin_permission('manage_content'));

-- Support workflow.
drop policy if exists support_read_own_or_admin on public.support_requests;
create policy support_read_own_or_admin on public.support_requests for select to authenticated using (requester_id = auth.uid() or public.has_admin_permission('manage_support'));
drop policy if exists support_admin_write on public.support_requests;
create policy support_admin_write on public.support_requests for all to authenticated using (public.has_admin_permission('manage_support')) with check (public.has_admin_permission('manage_support'));

-- AUDIT IS PERMANENTLY SUPER ADMIN ONLY. It is not represented as a grantable permission.
drop policy if exists activity_admin_read on public.activity_log;
drop policy if exists activity_super_admin_read on public.activity_log;
create policy activity_super_admin_read on public.activity_log for select to authenticated using (public.is_super_admin());

revoke all on public.user_permissions from anon;
grant select on public.user_permissions to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status) to authenticated;

-- SECURITY DEFINER hardening: remove PostgreSQL's default PUBLIC execute grant.
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.has_admin_permission(text) from public, anon;
revoke execute on function public.user_is_campaign_brand(uuid) from public, anon;
revoke execute on function public.user_is_campaign_creator(uuid) from public, anon;
revoke execute on function public.admin_set_account_status(uuid, public.account_status) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_role_profile() from public, anon, authenticated;
revoke execute on function public.audit_row_change() from public, anon, authenticated;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;
grant execute on function public.user_is_campaign_brand(uuid) to authenticated;
grant execute on function public.user_is_campaign_creator(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status) to authenticated;
