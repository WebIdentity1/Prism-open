
-- Add GBP columns to salons
ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS google_bp_tokens jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_bp_account_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_bp_location_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS google_bp_last_sync timestamptz DEFAULT NULL;

-- Create google_reviews table
CREATE TABLE IF NOT EXISTS public.google_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  google_review_id text NOT NULL,
  reviewer_name text NOT NULL DEFAULT 'Anonymous',
  reviewer_photo_url text,
  rating smallint NOT NULL,
  comment text,
  reply text,
  reply_updated_at timestamptz,
  review_time timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(salon_id, google_review_id)
);

ALTER TABLE public.google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon owners manage google reviews"
  ON public.google_reviews FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons WHERE salons.id = google_reviews.salon_id AND salons.owner_id = auth.uid()));

CREATE POLICY "Google reviews viewable by salon staff"
  ON public.google_reviews FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.stylist_profiles sp
    WHERE sp.salon_id = google_reviews.salon_id AND sp.user_id = auth.uid()
  ));
