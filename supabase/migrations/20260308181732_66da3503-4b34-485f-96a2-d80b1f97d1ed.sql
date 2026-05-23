
ALTER TABLE public.stylist_profiles
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS sliding_scale_tiers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_commission_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enable_greater_of boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.stylist_profiles.commission_type IS 'flat or sliding_scale';
COMMENT ON COLUMN public.stylist_profiles.sliding_scale_tiers IS 'JSON array of {min, max, rate} objects for sliding scale';
COMMENT ON COLUMN public.stylist_profiles.product_commission_rate IS 'Percentage commission on product sales';
COMMENT ON COLUMN public.stylist_profiles.hourly_rate IS 'Hourly compensation rate in dollars';
COMMENT ON COLUMN public.stylist_profiles.enable_greater_of IS 'If true, pay MAX(hourly earnings, commission earnings)';
