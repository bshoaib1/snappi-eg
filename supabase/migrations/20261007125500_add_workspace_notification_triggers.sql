create or replace function public.notify_workspace_change()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare campaign_title text;
begin
  if tg_table_name = 'campaigns' then
    if tg_op = 'INSERT' or old.status is distinct from new.status then
      if new.brand_id is not null then insert into public.notifications(user_id,title,message,category,link_url) values (new.brand_id,'Campaign update: '||new.title,'Campaign status is now '||replace(new.status::text,'_',' ')||'.','campaign','brand-workspace.html'); end if;
      insert into public.notifications(user_id,title,message,category,link_url) select cc.creator_id,'Campaign update: '||new.title,'Campaign status is now '||replace(new.status::text,'_',' ')||'.','campaign','creator-workspace.html' from public.campaign_creators cc where cc.campaign_id=new.id;
    end if;
  elsif tg_table_name = 'campaign_creators' then
    select title into campaign_title from public.campaigns where id=new.campaign_id;
    insert into public.notifications(user_id,title,message,category,link_url) values (new.creator_id,'Campaign opportunity','You were added to '||coalesce(campaign_title,'a Snappi campaign')||'.','campaign','creator-workspace.html');
  elsif tg_table_name = 'support_requests' then
    if new.requester_id is not null and old.status is distinct from new.status then insert into public.notifications(user_id,title,message,category,link_url) values (new.requester_id,'Support request updated',new.subject||' is now '||replace(new.status::text,'_',' ')||'.','support',case when exists(select 1 from public.profiles p where p.id=new.requester_id and p.role='brand') then 'brand-workspace.html' else 'creator-workspace.html' end); end if;
  elsif tg_table_name = 'brand_subscriptions' then
    if tg_op = 'INSERT' or old.status is distinct from new.status or old.ends_on is distinct from new.ends_on then insert into public.notifications(user_id,title,message,category,link_url) values (new.brand_user_id,'Subscription update',new.package_name||' access is '||replace(new.status,'_',' ')||'.','subscription','brand-workspace.html'); end if;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_campaign_change on public.campaigns;
create trigger notify_campaign_change after insert or update of status on public.campaigns for each row execute function public.notify_workspace_change();
drop trigger if exists notify_campaign_creator on public.campaign_creators;
create trigger notify_campaign_creator after insert on public.campaign_creators for each row execute function public.notify_workspace_change();
drop trigger if exists notify_support_change on public.support_requests;
create trigger notify_support_change after update of status on public.support_requests for each row execute function public.notify_workspace_change();
drop trigger if exists notify_subscription_change on public.brand_subscriptions;
create trigger notify_subscription_change after insert or update of status, ends_on on public.brand_subscriptions for each row execute function public.notify_workspace_change();
