-- Server-side abuse controls for unauthenticated website forms.
create table if not exists public.public_submission_rate_limits (
  bucket text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  primary key (bucket, identifier_hash)
);

alter table public.public_submission_rate_limits enable row level security;
revoke all on public.public_submission_rate_limits from public, anon, authenticated;
grant all on public.public_submission_rate_limits to service_role;

create or replace function public.consume_public_submission_limit(
  p_bucket text,
  p_identifier_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  if p_bucket not in ('join_ip_minute', 'join_ip_hour', 'join_email_hour', 'support_ip_minute', 'support_ip_hour', 'support_email_hour', 'lead_ip_minute', 'lead_ip_hour', 'lead_email_hour')
    or length(p_identifier_hash) <> 64
    or p_max_requests < 1
    or p_max_requests > 100
    or p_window_seconds < 10
    or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit request';
  end if;

  insert into public.public_submission_rate_limits as limits (
    bucket, identifier_hash, window_started_at, request_count
  ) values (
    p_bucket, p_identifier_hash, now(), 1
  )
  on conflict (bucket, identifier_hash) do update set
    window_started_at = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else limits.request_count + 1
    end
  returning request_count <= p_max_requests into allowed;

  return allowed;
end;
$$;

revoke execute on function public.consume_public_submission_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_submission_limit(text, text, integer, integer) to service_role;

