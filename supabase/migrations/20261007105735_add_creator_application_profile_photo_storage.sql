alter table public.creator_applications add column if not exists profile_photo_path text;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-profile-photos','creator-profile-photos',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=2097152,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
