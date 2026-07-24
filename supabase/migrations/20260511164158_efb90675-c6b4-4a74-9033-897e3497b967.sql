create table if not exists public.client_credits (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  amount_cents integer not null,
  reason text not null,
  note text,
  appointment_id uuid references public.appointments(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_credits_email_idx on public.client_credits (lower(client_email));
create index if not exists client_credits_created_idx on public.client_credits (created_at desc);

alter table public.client_credits enable row level security;

drop policy if exists "Clients read own credits" on public.client_credits;
create policy "Clients read own credits"
  on public.client_credits for select
  to authenticated
  using (lower(client_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Staff read all credits" on public.client_credits;
create policy "Staff read all credits"
  on public.client_credits for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
    or public.has_role(auth.uid(), 'receptionist')
    or public.has_role(auth.uid(), 'staff')
  );

drop policy if exists "Staff issue credits" on public.client_credits;
create policy "Staff issue credits"
  on public.client_credits for insert
  to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
  );

create or replace view public.client_credit_balances
with (security_invoker = on) as
select
  lower(client_email) as client_email,
  coalesce(sum(amount_cents), 0)::integer as balance_cents,
  count(*)::integer as entries,
  max(created_at) as last_activity_at
from public.client_credits
group by lower(client_email);

grant select on public.client_credit_balances to authenticated;