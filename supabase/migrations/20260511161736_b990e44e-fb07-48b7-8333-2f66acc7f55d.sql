create table if not exists public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_email text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  allow_testimonial boolean not null default false,
  service_id uuid references public.services(id) on delete set null,
  staff_id uuid references public.staff_profiles(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (appointment_id)
);

alter table public.client_feedback enable row level security;

create policy "Staff can read all feedback"
  on public.client_feedback for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
    or public.has_role(auth.uid(), 'receptionist')
    or public.has_role(auth.uid(), 'staff')
  );

create index if not exists client_feedback_created_idx on public.client_feedback (created_at desc);
create index if not exists client_feedback_rating_idx on public.client_feedback (rating);