
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_audience_type_check;
ALTER TABLE public.marketing_campaigns ADD CONSTRAINT marketing_campaigns_audience_type_check
  CHECK (audience_type IN ('everyone','all_clients','lapsed','win_back','vip'));
