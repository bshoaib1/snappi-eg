-- Keep Careers policies explicit per action and index its profile relationship.
create index if not exists career_openings_created_by_idx on public.career_openings(created_by);

drop policy if exists career_openings_admin_write on public.career_openings;
create policy career_openings_admin_insert on public.career_openings for insert to authenticated
with check (public.has_admin_permission('manage_careers'));
create policy career_openings_admin_update on public.career_openings for update to authenticated
using (public.has_admin_permission('manage_careers')) with check (public.has_admin_permission('manage_careers'));
create policy career_openings_admin_delete on public.career_openings for delete to authenticated
using (public.has_admin_permission('manage_careers'));
