
-- Create reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  stylist_id uuid NOT NULL,
  salon_id uuid NOT NULL,
  appointment_id uuid NOT NULL UNIQUE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own reviews
CREATE POLICY "Clients insert own reviews"
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (auth.uid() = client_id);

-- Clients can view their own reviews
CREATE POLICY "Clients view own reviews"
ON public.reviews FOR SELECT TO authenticated
USING (auth.uid() = client_id);

-- Stylists can view reviews about them
CREATE POLICY "Stylists view their reviews"
ON public.reviews FOR SELECT TO authenticated
USING (auth.uid() = stylist_id);

-- Salon admins can view all salon reviews
CREATE POLICY "Salon admins view salon reviews"
ON public.reviews FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM salons WHERE salons.id = reviews.salon_id AND salons.owner_id = auth.uid()
));

-- Anyone authenticated can read reviews (for booking flow avg ratings)
CREATE POLICY "Authenticated read all reviews"
ON public.reviews FOR SELECT TO authenticated
USING (true);
