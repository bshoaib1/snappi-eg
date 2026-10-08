-- Supports the joins and filters used by the Snappi administration and member workspaces.
create index if not exists activity_log_actor_id_idx on public.activity_log (actor_id);
create index if not exists brand_profiles_assigned_owner_idx on public.brand_profiles (assigned_owner);
create index if not exists campaign_creators_creator_id_idx on public.campaign_creators (creator_id);
create index if not exists campaigns_brand_id_idx on public.campaigns (brand_id);
create index if not exists campaigns_owner_id_idx on public.campaigns (owner_id);
create index if not exists content_submissions_campaign_id_idx on public.content_submissions (campaign_id);
create index if not exists content_submissions_creator_id_idx on public.content_submissions (creator_id);
create index if not exists support_requests_assigned_to_idx on public.support_requests (assigned_to);
create index if not exists support_requests_requester_id_idx on public.support_requests (requester_id);
create index if not exists user_permissions_workspace_role_id_idx on public.user_permissions (workspace_role_id);
