alter table public.appointments
  add column if not exists intake_reminder_48h_sent_at timestamptz,
  add column if not exists intake_reminder_24h_sent_at timestamptz;