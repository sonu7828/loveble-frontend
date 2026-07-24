-- Add receptionist (front desk) role with same permissions as scheduler
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';