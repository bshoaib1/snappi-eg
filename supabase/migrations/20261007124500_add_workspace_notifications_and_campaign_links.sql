alter table public.campaigns add column if not exists brief_url text, add column if not exists drive_folder_url text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null default '',
  category text not null default 'general',
  link_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

drop policy if exists notifications_read_own_or_admin on public.notifications;
create policy notifications_read_own_or_admin on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or is_super_admin() or has_admin_permission('manage_users'));
drop policy if exists notifications_update_own_or_admin on public.notifications;
create policy notifications_update_own_or_admin on public.notifications for update to authenticated
using (user_id = (select auth.uid()) or is_super_admin() or has_admin_permission('manage_users'))
with check (user_id = (select auth.uid()) or is_super_admin() or has_admin_permission('manage_users'));

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
drop trigger if exists audit_notifications_change on public.notifications;
create trigger audit_notifications_change after insert or update or delete on public.notifications for each row execute function public.audit_row_change();
