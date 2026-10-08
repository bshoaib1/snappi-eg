-- Keeps internal support notes separate from request rows visible to requesters.
create table if not exists public.support_request_admin_notes (
  request_id uuid primary key references public.support_requests(id) on delete cascade,
  internal_notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.support_request_admin_notes enable row level security;

drop policy if exists support_notes_admin_access on public.support_request_admin_notes;
create policy support_notes_admin_access
on public.support_request_admin_notes
for all
to authenticated
using (public.has_admin_permission('manage_support'))
with check (public.has_admin_permission('manage_support'));

grant select, insert, update, delete on public.support_request_admin_notes to authenticated;
