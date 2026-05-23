
-- Stylist levels/tiers table
CREATE TABLE public.stylist_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stylist_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admins manage stylist levels"
  ON public.stylist_levels FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = stylist_levels.salon_id AND salons.owner_id = auth.uid()));

CREATE POLICY "Stylist levels viewable by authenticated"
  ON public.stylist_levels FOR SELECT
  TO authenticated
  USING (true);

-- Per-level service price overrides
CREATE TABLE public.service_level_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.stylist_levels(id) ON DELETE CASCADE,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, level_id)
);

ALTER TABLE public.service_level_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admins manage service level prices"
  ON public.service_level_prices FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM services s
    JOIN salons sa ON sa.id = s.salon_id
    WHERE s.id = service_level_prices.service_id AND sa.owner_id = auth.uid()
  ));

CREATE POLICY "Service level prices viewable by authenticated"
  ON public.service_level_prices FOR SELECT
  TO authenticated
  USING (true);

-- Add level_id to stylist_profiles
ALTER TABLE public.stylist_profiles ADD COLUMN level_id uuid REFERENCES public.stylist_levels(id) ON DELETE SET NULL;
