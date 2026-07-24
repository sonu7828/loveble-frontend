
ALTER TABLE public.vouchers
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id),
  ADD COLUMN IF NOT EXISTS entitlements jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.vouchers.entitlements IS 'Array of {service_id, service_name, quantity, unit_label} describing what the voucher covers (e.g. 30 units botox, 1 pen microneedling).';
