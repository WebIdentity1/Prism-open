
-- Add branding columns to salons
ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS brand_primary_color text NOT NULL DEFAULT '#0f766e',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text NOT NULL DEFAULT '#f0fdfa',
  ADD COLUMN IF NOT EXISTS brand_font text NOT NULL DEFAULT 'DM Sans';

-- Add ai_conversation to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS ai_conversation jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create brand_assets table
CREATE TABLE public.brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  type text NOT NULL DEFAULT 'photo',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon owners manage brand assets"
  ON public.brand_assets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.salons WHERE salons.id = brand_assets.salon_id AND salons.owner_id = auth.uid()));

CREATE POLICY "Brand assets viewable by authenticated"
  ON public.brand_assets FOR SELECT
  USING (true);

-- Create brand-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-assets', 'brand-assets', true);

-- Storage RLS for brand-assets bucket
CREATE POLICY "Salon owners upload brand assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view brand assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Salon owners delete brand assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'brand-assets' AND auth.role() = 'authenticated');
