-- Add loyalty configuration columns to salons
ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS loyalty_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_dollar numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_service integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_referral_points integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS loyalty_point_value_cents integer NOT NULL DEFAULT 1;