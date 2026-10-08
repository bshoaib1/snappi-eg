create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text not null,
  city text not null default '',
  social_url text,
  portfolio_urls text[] not null default '{}',
  categories text[] not null default '{}',
  languages text[] not null default '{}',
  availability text,
  is_over_18 boolean not null default false,
  consent boolean not null default false,
  status text not null default 'new' check (status in ('new','under_review','shortlisted','interview_requested','approved','waitlisted','rejected','onboarded')),
  assigned_to uuid references public.profiles(id) on delete set null,
  converted_user_id uuid references public.profiles(id) on delete set null,
  internal_notes text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  work_email text not null,
  phone text not null,
  company_name text not null,
  industry text,
  website_url text,
  package_name text not null default 'Not Sure Yet' check (package_name in ('Starter','Growth','Premium','Not Sure Yet')),
  campaign_objective text,
  preferred_launch_date date,
  status text not null default 'new' check (status in ('new','consultation_required','package_selected','contacted','awaiting_payment','approved','converted','declined')),
  assigned_to uuid references public.profiles(id) on delete set null,
  converted_user_id uuid references public.profiles(id) on delete set null,
  internal_notes text,
  source text,
  consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_subscriptions (
  id uuid primary key default gen_random_uuid(),
  brand_user_id uuid not null references public.profiles(id) on delete cascade,
  package_name text not null check (package_name in ('Starter','Growth','Premium')),
  status text not null default 'awaiting_payment' check (status in ('consultation_required','awaiting_payment','active','expiring_soon','expired','paused','cancelled')),
  starts_on date,
  ends_on date,
  payment_method text,
  payment_reference text,
  confirmation_note text,
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists creator_applications_status_created_idx on public.creator_applications(status, created_at desc);
create index if not exists brand_requests_status_created_idx on public.brand_requests(status, created_at desc);
create index if not exists brand_subscriptions_brand_status_idx on public.brand_subscriptions(brand_user_id, status);
create index if not exists brand_subscriptions_expiry_idx on public.brand_subscriptions(ends_on) where status in ('active','expiring_soon');

alter table public.creator_applications enable row level security;
alter table public.brand_requests enable row level security;
alter table public.brand_subscriptions enable row level security;

revoke all on public.creator_applications from anon;
revoke all on public.brand_requests from anon;
revoke all on public.brand_subscriptions from anon;
grant select, update on public.creator_applications to authenticated;
grant select, update on public.brand_requests to authenticated;
grant select, insert, update on public.brand_subscriptions to authenticated;
grant all on public.creator_applications to service_role;
grant all on public.brand_requests to service_role;
grant all on public.brand_subscriptions to service_role;

drop policy if exists creator_applications_admin_read on public.creator_applications;
create policy creator_applications_admin_read on public.creator_applications for select to authenticated
using (is_super_admin() or has_admin_permission('manage_creators'));

drop policy if exists creator_applications_admin_update on public.creator_applications;
create policy creator_applications_admin_update on public.creator_applications for update to authenticated
using (is_super_admin() or has_admin_permission('manage_creators'))
with check (is_super_admin() or has_admin_permission('manage_creators'));

drop policy if exists brand_requests_admin_read on public.brand_requests;
create policy brand_requests_admin_read on public.brand_requests for select to authenticated
using (is_super_admin() or has_admin_permission('manage_brands'));

drop policy if exists brand_requests_admin_update on public.brand_requests;
create policy brand_requests_admin_update on public.brand_requests for update to authenticated
using (is_super_admin() or has_admin_permission('manage_brands'))
with check (is_super_admin() or has_admin_permission('manage_brands'));

drop policy if exists brand_subscriptions_admin_read on public.brand_subscriptions;
create policy brand_subscriptions_admin_read on public.brand_subscriptions for select to authenticated
using (is_super_admin() or has_admin_permission('manage_brands') or brand_user_id = (select auth.uid()));

drop policy if exists brand_subscriptions_admin_insert on public.brand_subscriptions;
create policy brand_subscriptions_admin_insert on public.brand_subscriptions for insert to authenticated
with check (is_super_admin() or has_admin_permission('manage_brands'));

drop policy if exists brand_subscriptions_admin_update on public.brand_subscriptions;
create policy brand_subscriptions_admin_update on public.brand_subscriptions for update to authenticated
using (is_super_admin() or has_admin_permission('manage_brands'))
with check (is_super_admin() or has_admin_permission('manage_brands'));

drop trigger if exists set_creator_applications_updated_at on public.creator_applications;
create trigger set_creator_applications_updated_at before update on public.creator_applications for each row execute function public.set_updated_at();
drop trigger if exists set_brand_requests_updated_at on public.brand_requests;
create trigger set_brand_requests_updated_at before update on public.brand_requests for each row execute function public.set_updated_at();
drop trigger if exists set_brand_subscriptions_updated_at on public.brand_subscriptions;
create trigger set_brand_subscriptions_updated_at before update on public.brand_subscriptions for each row execute function public.set_updated_at();

drop trigger if exists audit_creator_applications_change on public.creator_applications;
create trigger audit_creator_applications_change after insert or update or delete on public.creator_applications for each row execute function public.audit_row_change();
drop trigger if exists audit_brand_requests_change on public.brand_requests;
create trigger audit_brand_requests_change after insert or update or delete on public.brand_requests for each row execute function public.audit_row_change();
drop trigger if exists audit_brand_subscriptions_change on public.brand_subscriptions;
create trigger audit_brand_subscriptions_change after insert or update or delete on public.brand_subscriptions for each row execute function public.audit_row_change();
