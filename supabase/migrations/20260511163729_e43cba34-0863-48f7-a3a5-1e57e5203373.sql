create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null unique,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

drop policy if exists "Owners read own referral code" on public.referral_codes;
create policy "Owners read own referral code"
  on public.referral_codes for select
  to authenticated
  using (lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists "Staff read all referral codes" on public.referral_codes;
create policy "Staff read all referral codes"
  on public.referral_codes for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
    or public.has_role(auth.uid(), 'receptionist')
    or public.has_role(auth.uid(), 'staff')
  );

alter table public.appointments
  add column if not exists referral_code text;

create index if not exists appointments_referral_code_idx
  on public.appointments (referral_code) where referral_code is not null;

-- Helper: returns existing code for current authenticated user, or creates one
create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_code text;
  v_attempt int := 0;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    raise exception 'Not authenticated';
  end if;

  select code into v_code from public.referral_codes where owner_email = v_email;
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_attempt := v_attempt + 1;
    -- 8-char uppercase alphanumeric, no ambiguous chars
    v_code := upper(substring(translate(encode(gen_random_bytes(8), 'base64'), '+/=OIl01', 'XYZAB234'), 1, 8));
    begin
      insert into public.referral_codes (owner_email, code) values (v_email, v_code);
      return v_code;
    exception when unique_violation then
      if v_attempt > 5 then raise; end if;
    end;
  end loop;
end;
$$;

revoke all on function public.get_or_create_referral_code() from public;
grant execute on function public.get_or_create_referral_code() to authenticated;

-- Staff-only view: per code, total bookings + completed (status = completed)
create or replace view public.referral_stats
with (security_invoker = on) as
select
  rc.code,
  rc.owner_email,
  rc.created_at,
  count(a.id) filter (where a.id is not null) as total_referrals,
  count(a.id) filter (where a.status = 'completed') as completed_referrals,
  max(a.created_at) as last_referral_at
from public.referral_codes rc
left join public.appointments a
  on a.referral_code = rc.code
  and lower(a.client_email) <> lower(rc.owner_email)
group by rc.id, rc.code, rc.owner_email, rc.created_at;

grant select on public.referral_stats to authenticated;