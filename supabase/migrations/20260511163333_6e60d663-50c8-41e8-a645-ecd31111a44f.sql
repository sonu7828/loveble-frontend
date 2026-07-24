alter table public.client_feedback
  add column if not exists featured boolean not null default false,
  add column if not exists display_first_name text;

create index if not exists client_feedback_featured_idx
  on public.client_feedback (featured) where featured;

create or replace view public.public_testimonials
with (security_invoker = on) as
select
  cf.id,
  cf.rating,
  cf.comment,
  cf.created_at,
  coalesce(cf.display_first_name,
    initcap(split_part(coalesce(a.client_first_name, ''), ' ', 1))
  ) as first_name,
  s.name as service_name,
  l.city as location_city,
  l.slug as location_slug,
  split_part(sp.full_name, ' ', 1) as provider_first_name
from public.client_feedback cf
left join public.appointments a on a.id = cf.appointment_id
left join public.services s on s.id = cf.service_id
left join public.locations l on l.id = cf.location_id
left join public.staff_profiles sp on sp.id = cf.staff_id
where cf.featured = true
  and cf.allow_testimonial = true
  and cf.comment is not null
  and length(trim(cf.comment)) > 0;

grant select on public.public_testimonials to anon, authenticated;

drop policy if exists "Public can read featured testimonials" on public.client_feedback;
create policy "Public can read featured testimonials"
  on public.client_feedback for select
  to anon, authenticated
  using (featured = true and allow_testimonial = true);

drop policy if exists "Staff can curate feedback" on public.client_feedback;
create policy "Staff can curate feedback"
  on public.client_feedback for update
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
  );