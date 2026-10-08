drop policy if exists creator_profile_photos_admin_read on storage.objects;
create policy creator_profile_photos_admin_read on storage.objects for select to authenticated
using (bucket_id = 'creator-profile-photos' and (public.is_super_admin() or public.has_admin_permission('manage_creators')));
