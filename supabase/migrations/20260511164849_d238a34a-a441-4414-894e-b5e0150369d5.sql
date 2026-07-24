create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subject text not null,
  preview_text text,
  body_markdown text not null,
  cta_label text,
  cta_url text,
  audience_type text not null check (audience_type in ('all_clients','lapsed','win_back','vip')),
  audience_params jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  recurrence text not null default 'once' check (recurrence in ('once','daily','weekly','monthly')),
  cooldown_days integer not null default 30,
  scheduled_at timestamptz,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger marketing_campaigns_touch
  before update on public.marketing_campaigns
  for each row execute function public.touch_updated_at();

alter table public.marketing_campaigns enable row level security;

drop policy if exists "Admins manage campaigns" on public.marketing_campaigns;
create policy "Admins manage campaigns"
  on public.marketing_campaigns for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'scheduler'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'scheduler'));

drop policy if exists "Staff read campaigns" on public.marketing_campaigns;
create policy "Staff read campaigns"
  on public.marketing_campaigns for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
    or public.has_role(auth.uid(), 'receptionist')
    or public.has_role(auth.uid(), 'staff')
  );

create table if not exists public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  client_email text not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent' check (status in ('sent','failed','skipped'))
);

create index if not exists marketing_sends_campaign_email_idx
  on public.marketing_sends (campaign_id, lower(client_email), sent_at desc);

alter table public.marketing_sends enable row level security;

drop policy if exists "Staff read sends" on public.marketing_sends;
create policy "Staff read sends"
  on public.marketing_sends for select
  to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'scheduler')
    or public.has_role(auth.uid(), 'receptionist')
    or public.has_role(auth.uid(), 'staff')
  );