-- Contact fields and secure self-service profile settings.
alter table public.profiles add column if not exists phone text not null default '';

update public.profiles as profile
set phone = coalesce(auth_user.raw_user_meta_data ->> 'phone', '')
from auth.users as auth_user
where auth_user.id = profile.id and profile.phone = '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      case when lower(coalesce(new.email, '')) = 'basem@snappi-eg.com' then 'Basem Shoaib' end,
      initcap(replace(replace(split_part(coalesce(new.email, ''), '@', 1), '.', ' '), '_', ' '))
    ),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    case when lower(coalesce(new.email, '')) = 'basem@snappi-eg.com' then 'super_admin'::public.app_role else 'creator'::public.app_role end,
    case when lower(coalesce(new.email, '')) = 'basem@snappi-eg.com' then 'active'::public.account_status else 'invited'::public.account_status end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_auth_user_contact()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.profiles set email = coalesce(new.email, email) where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_auth_user_contact on auth.users;
create trigger sync_auth_user_contact after update of email on auth.users
for each row execute procedure public.sync_auth_user_contact();

create or replace function public.update_own_profile(next_full_name text, next_phone text)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if nullif(trim(next_full_name), '') is null then raise exception 'Full name is required'; end if;
  if nullif(trim(next_phone), '') is null then raise exception 'Phone number is required'; end if;

  update public.profiles
  set full_name = trim(next_full_name), phone = trim(next_phone)
  where id = auth.uid();

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', trim(next_full_name), 'phone', trim(next_phone))
  where id = auth.uid();
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_auth_user_contact() from public, anon, authenticated;
revoke execute on function public.update_own_profile(text, text) from public, anon;
grant execute on function public.update_own_profile(text, text) to authenticated;
