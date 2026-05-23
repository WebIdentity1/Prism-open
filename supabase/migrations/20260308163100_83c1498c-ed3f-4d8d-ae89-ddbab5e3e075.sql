
-- Create appointment_photos table
CREATE TABLE public.appointment_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  stylist_id uuid NOT NULL,
  salon_id uuid NOT NULL,
  photo_url text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_photos ENABLE ROW LEVEL SECURITY;

-- Stylists can insert photos for their appointments
CREATE POLICY "Stylists insert appointment photos"
ON public.appointment_photos FOR INSERT TO authenticated
WITH CHECK (auth.uid() = stylist_id);

-- Stylists can view photos they took
CREATE POLICY "Stylists view their photos"
ON public.appointment_photos FOR SELECT TO authenticated
USING (auth.uid() = stylist_id);

-- Salon admins can view all salon photos
CREATE POLICY "Salon admins view salon photos"
ON public.appointment_photos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM salons WHERE salons.id = appointment_photos.salon_id AND salons.owner_id = auth.uid()
));

-- Clients can view their own photos
CREATE POLICY "Clients view own photos"
ON public.appointment_photos FOR SELECT TO authenticated
USING (auth.uid() = client_id);

-- Create storage bucket for appointment photos
INSERT INTO storage.buckets (id, name, public) VALUES ('appointment-photos', 'appointment-photos', true);

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated upload appointment photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'appointment-photos');

-- Storage RLS: anyone can view (public bucket)
CREATE POLICY "Public read appointment photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'appointment-photos');
