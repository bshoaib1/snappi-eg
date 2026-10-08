-- SNAPPI ADMIN WORKSPACE SCHEMA
-- Run this entire file once in Supabase Dashboard → SQL Editor.
-- Public access is denied by default. Administrative access is role checked by RLS.

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('super_admin', 'operations_admin', 'creator', 'brand');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.account_status as enum ('invited', 'active', 'paused', 'suspended', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.creator_application_status as enum ('new', 'under_review', 'shortlisted', 'interview_requested', 'approved', 'waitlisted', 'rejected', 'onboarded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.campaign_status as enum ('discovery', 'scope_confirmed', 'creator_matching', 'creator_approval', 'concepts', 'production', 'brand_review', 'revisions', 'final_approval', 'delivered', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.content_status as enum ('draft_expected', 'submitted', 'internal_review', 'revision_requested', 'ready_for_brand', 'brand_reviewing', 'brand_revision_requested', 'approved', 'delivered', 'archived');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.support_status as enum ('new', 'open', 'waiting_for_user', 'waiting_for_snappi', 'resolved', 'closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.support_priority as enum ('low', 'normal', 'high', 'urgent');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  role public.app_role not null default 'creator',
  status public.account_status not null default 'invited',
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  application_status public.creator_application_status not null default 'new',
  city text,
  categories text[] not null default '{}',
  portfolio_url text,
  availability text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null default '',
  industry text,
  website_url text,
  assigned_owner uuid references public.profiles(id) on delete set null,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brand_id uuid references public.brand_profiles(user_id) on delete restrict,
  owner_id uuid references public.profiles(id) on delete set null,
  status public.campaign_status not null default 'discovery',
  objective text,
  deliverables_count integer not null default 0 check (deliverables_count >= 0),
  next_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_creators (
  campaign_id uuid references public.campaigns(id) on delete cascade,
  creator_id uuid references public.creator_profiles(user_id) on delete cascade,
  assignment_status text not null default 'invited',
  created_at timestamptz not null default now(),
  primary key (campaign_id, creator_id)
);

create table if not exists public.content_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(user_id) on delete restrict,
  version integer not null default 1 check (version > 0),
  status public.content_status not null default 'draft_expected',
  file_path text,
  notes text,
  submitted_at timestamptz,
  review_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  category text not null default 'general',
  message text not null,
  priority public.support_priority not null default 'normal',
  status public.support_status not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  record_table text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() in ('super_admin', 'operations_admin'), false) $$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_app_role() = 'super_admin', false) $$;

create or replace function public.user_is_campaign_brand(campaign_uuid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.campaigns where id = campaign_uuid and brand_id = auth.uid()) $$;

create or replace function public.user_is_campaign_creator(campaign_uuid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from public.campaign_creators where campaign_id = campaign_uuid and creator_id = auth.uid()) $$;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.sync_role_profile()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.role = 'creator' then
    insert into public.creator_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  elsif new.role = 'brand' then
    insert into public.brand_profiles (user_id, company_name) values (new.id, new.full_name) on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_profile_role on public.profiles;
create trigger sync_profile_role after insert or update of role on public.profiles for each row execute procedure public.sync_role_profile();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.activity_log (actor_id, action, record_table, record_id, old_data, new_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
             (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'user_id'),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','creator_profiles','brand_profiles','campaigns','content_submissions','support_requests'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
    execute format('drop trigger if exists audit_%I_change on public.%I', t, t);
    execute format('create trigger audit_%I_change after insert or update or delete on public.%I for each row execute procedure public.audit_row_change()', t, t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_creators enable row level security;
alter table public.content_submissions enable row level security;
alter table public.support_requests enable row level security;
alter table public.activity_log enable row level security;

-- Profiles: users may read their own account; administrators may read all accounts.
drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_super_admin_write on public.profiles;
create policy profiles_super_admin_write on public.profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Role-specific records: owners may read their own row; administrators control writes.
drop policy if exists creator_profiles_read_own_or_admin on public.creator_profiles;
create policy creator_profiles_read_own_or_admin on public.creator_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists creator_profiles_admin_write on public.creator_profiles;
create policy creator_profiles_admin_write on public.creator_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists brand_profiles_read_own_or_admin on public.brand_profiles;
create policy brand_profiles_read_own_or_admin on public.brand_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists brand_profiles_admin_write on public.brand_profiles;
create policy brand_profiles_admin_write on public.brand_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Campaigns: admins see all; brands see their campaigns; assigned creators see their campaigns.
drop policy if exists campaigns_read_participants on public.campaigns;
create policy campaigns_read_participants on public.campaigns for select to authenticated using (
  public.is_admin() or brand_id = auth.uid() or public.user_is_campaign_creator(id)
);
drop policy if exists campaigns_admin_write on public.campaigns;
create policy campaigns_admin_write on public.campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists campaign_creators_read_participants on public.campaign_creators;
create policy campaign_creators_read_participants on public.campaign_creators for select to authenticated using (
  public.is_admin() or creator_id = auth.uid() or public.user_is_campaign_brand(campaign_id)
);
drop policy if exists campaign_creators_admin_write on public.campaign_creators;
create policy campaign_creators_admin_write on public.campaign_creators for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Content: participants may read; admins control workflow writes in the first release.
drop policy if exists content_read_participants on public.content_submissions;
create policy content_read_participants on public.content_submissions for select to authenticated using (
  public.is_admin() or creator_id = auth.uid() or public.user_is_campaign_brand(campaign_id)
);
drop policy if exists content_admin_write on public.content_submissions;
create policy content_admin_write on public.content_submissions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Support: users may read and create their own requests; admins manage the queue.
drop policy if exists support_read_own_or_admin on public.support_requests;
create policy support_read_own_or_admin on public.support_requests for select to authenticated using (requester_id = auth.uid() or public.is_admin());
drop policy if exists support_create_own on public.support_requests;
create policy support_create_own on public.support_requests for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists support_admin_write on public.support_requests;
create policy support_admin_write on public.support_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Audit records are append-only to the application; only administrators can read them.
drop policy if exists activity_admin_read on public.activity_log;
create policy activity_admin_read on public.activity_log for select to authenticated using (public.is_admin());

revoke all on public.profiles, public.creator_profiles, public.brand_profiles, public.campaigns, public.campaign_creators, public.content_submissions, public.support_requests, public.activity_log from anon;
grant usage on schema public to authenticated;
grant select on public.profiles, public.creator_profiles, public.brand_profiles, public.campaigns, public.campaign_creators, public.content_submissions, public.support_requests, public.activity_log to authenticated;
grant insert, update, delete on public.profiles, public.creator_profiles, public.brand_profiles, public.campaigns, public.campaign_creators, public.content_submissions, public.support_requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- If Basem's Auth user existed before this migration, run this after creating the account:
-- insert into public.profiles (id,email,full_name,role,status)
-- select id,email,'Basem Shoaib','super_admin','active' from auth.users where lower(email)='basem@snappi-eg.com'
-- on conflict (id) do update set full_name='Basem Shoaib',role='super_admin',status='active';
