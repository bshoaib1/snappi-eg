-- Preserve readable workspace names when Auth accounts have incomplete metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      case when lower(coalesce(new.email, '')) = 'basem@snappi-eg.com' then 'Basem Shoaib' end,
      initcap(replace(replace(split_part(coalesce(new.email, ''), '@', 1), '.', ' '), '_', ' '))
    ),
    case when lower(coalesce(new.email, '')) = 'basem@snappi-eg.com' then 'super_admin'::public.app_role else 'creator'::public.app_role end,
    case when lower(coalesce(new.email, '')) = 'basem@snappi-eg.com' then 'active'::public.account_status else 'invited'::public.account_status end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Repair existing profile rows without replacing a name already supplied by a user.
update public.profiles as profile
set full_name = coalesce(
  nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
  case when lower(profile.email) = 'basem@snappi-eg.com' then 'Basem Shoaib' end,
  initcap(replace(replace(split_part(profile.email, '@', 1), '.', ' '), '_', ' '))
)
from auth.users as auth_user
where auth_user.id = profile.id
  and nullif(trim(profile.full_name), '') is null;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
