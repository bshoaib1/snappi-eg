-- Launch workflow: reliable lead records, creator notifications, Drive metadata,
-- and reversible campaign deletion approval.

alter table public.creator_applications
  add column if not exists status_email_sent_at timestamptz,
  add column if not exists status_email_error text;

alter table public.brand_requests
  add column if not exists crm_synced_at timestamptz,
  add column if not exists crm_sync_error text,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_error text;

alter table public.content_submissions
  add column if not exists drive_file_url text,
  add column if not exists thumbnail_url text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.campaigns
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

create table if not exists public.campaign_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists campaign_deletion_requests_one_pending
  on public.campaign_deletion_requests(campaign_id) where status = 'pending';
create index if not exists campaign_deletion_requests_status_created
  on public.campaign_deletion_requests(status, created_at desc);

alter table public.campaign_deletion_requests enable row level security;
revoke all on public.campaign_deletion_requests from public, anon;
grant select, insert, update on public.campaign_deletion_requests to authenticated;

drop policy if exists campaign_deletion_requests_read on public.campaign_deletion_requests;
create policy campaign_deletion_requests_read on public.campaign_deletion_requests
for select to authenticated
using (public.has_admin_permission('manage_campaigns'));

drop policy if exists campaign_deletion_requests_insert on public.campaign_deletion_requests;
create policy campaign_deletion_requests_insert on public.campaign_deletion_requests
for insert to authenticated
with check (
  public.has_admin_permission('manage_campaigns')
  and requested_by = (select auth.uid())
  and status = 'pending'
);

drop policy if exists campaign_deletion_requests_super_admin_update on public.campaign_deletion_requests;
create policy campaign_deletion_requests_super_admin_update on public.campaign_deletion_requests
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create or replace function public.review_campaign_deletion_request(
  request_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deletion_request public.campaign_deletion_requests%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'Only the Super Admin can decide campaign deletion requests';
  end if;
  if decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into deletion_request
  from public.campaign_deletion_requests
  where id = request_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending deletion request not found'; end if;

  update public.campaign_deletion_requests
  set status = decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      decision_note = nullif(trim(note), ''),
      updated_at = now()
  where id = request_id;

  if decision = 'approved' then
    update public.campaigns
    set status = 'cancelled', archived_at = now(), archived_by = auth.uid(), updated_at = now()
    where id = deletion_request.campaign_id;
  end if;
end;
$$;

revoke all on function public.review_campaign_deletion_request(uuid,text,text) from public, anon;
grant execute on function public.review_campaign_deletion_request(uuid,text,text) to authenticated;

drop trigger if exists audit_campaign_deletion_requests_change on public.campaign_deletion_requests;
create trigger audit_campaign_deletion_requests_change
after insert or update or delete on public.campaign_deletion_requests
for each row execute procedure public.audit_row_change();

