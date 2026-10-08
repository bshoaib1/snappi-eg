-- Super Admin RPC for role, account status, and operational privilege management.
create or replace function public.admin_update_user_access(
  target_user_id uuid,
  next_role public.app_role,
  next_status public.account_status,
  allow_creators boolean default false,
  allow_brands boolean default false,
  allow_campaigns boolean default false,
  allow_content boolean default false,
  allow_support boolean default false
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  existing_role public.app_role;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can change roles and privileges';
  end if;

  select role into existing_role from public.profiles where id = target_user_id;
  if existing_role is null then raise exception 'User not found'; end if;
  if existing_role = 'super_admin' or next_role = 'super_admin' then
    raise exception 'Super Admin access is protected';
  end if;

  update public.profiles
  set role = next_role, status = next_status
  where id = target_user_id;

  if next_role = 'operations_admin' then
    insert into public.user_permissions (
      user_id, manage_creators, manage_brands, manage_campaigns, manage_content, manage_support, updated_at
    ) values (
      target_user_id, allow_creators, allow_brands, allow_campaigns, allow_content, allow_support, now()
    )
    on conflict (user_id) do update set
      manage_creators = excluded.manage_creators,
      manage_brands = excluded.manage_brands,
      manage_campaigns = excluded.manage_campaigns,
      manage_content = excluded.manage_content,
      manage_support = excluded.manage_support,
      updated_at = now();
  else
    delete from public.user_permissions where user_id = target_user_id;
  end if;
end;
$$;

revoke execute on function public.admin_update_user_access(uuid, public.app_role, public.account_status, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_update_user_access(uuid, public.app_role, public.account_status, boolean, boolean, boolean, boolean, boolean) to authenticated;

drop trigger if exists set_user_permissions_updated_at on public.user_permissions;
create trigger set_user_permissions_updated_at before update on public.user_permissions
for each row execute procedure public.set_updated_at();

drop trigger if exists audit_user_permissions on public.user_permissions;
create trigger audit_user_permissions after insert or update or delete on public.user_permissions
for each row execute procedure public.audit_row_change();
