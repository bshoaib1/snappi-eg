alter function public.set_updated_at() set search_path = public;
create index if not exists creator_applications_assigned_to_idx on public.creator_applications(assigned_to);
create index if not exists creator_applications_converted_user_idx on public.creator_applications(converted_user_id);
create index if not exists brand_requests_assigned_to_idx on public.brand_requests(assigned_to);
create index if not exists brand_requests_converted_user_idx on public.brand_requests(converted_user_id);
create index if not exists brand_subscriptions_confirmed_by_idx on public.brand_subscriptions(confirmed_by);
