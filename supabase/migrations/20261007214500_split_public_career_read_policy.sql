-- Keep anonymous career reads independent from the authenticated permission helper.
drop policy if exists career_openings_public_read on public.career_openings;
create policy career_openings_public_read on public.career_openings for select to anon
using (status = 'published');
create policy career_openings_authenticated_read on public.career_openings for select to authenticated
using (status = 'published' or public.has_admin_permission('manage_careers'));
