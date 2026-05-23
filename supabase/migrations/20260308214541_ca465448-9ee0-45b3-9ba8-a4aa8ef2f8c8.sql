
ALTER TABLE public.salons
  ADD COLUMN surge_pricing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN surge_pricing_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN offpeak_discounts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN offpeak_discount_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN google_reserve_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN meta_pixel_id text DEFAULT NULL,
  ADD COLUMN meta_conversions_api_key text DEFAULT NULL,
  ADD COLUMN google_analytics_id text DEFAULT NULL;
