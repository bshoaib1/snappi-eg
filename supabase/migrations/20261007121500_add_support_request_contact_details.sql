alter table public.support_requests
  add column if not exists requester_name text,
  add column if not exists requester_email text,
  add column if not exists requester_phone text,
  add column if not exists preferred_reply text,
  add column if not exists source text;

create index if not exists support_requests_status_priority_created_idx
  on public.support_requests(status, priority, created_at desc);

comment on column public.support_requests.requester_name is 'Public visitor name when no authenticated requester profile exists.';
comment on column public.support_requests.requester_email is 'Reply email supplied with the support request.';
comment on column public.support_requests.requester_phone is 'Optional phone or WhatsApp number supplied by the requester.';
comment on column public.support_requests.preferred_reply is 'Requested reply channel such as Email, Phone, or WhatsApp.';
comment on column public.support_requests.source is 'Page and technical context associated with the request.';
