
-- Storage bucket for consultation photos
INSERT INTO storage.buckets (id, name, public) VALUES ('consultation-photos', 'consultation-photos', true);

-- Storage policies for consultation photos
CREATE POLICY "Users can upload own consultation photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'consultation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own consultation photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'consultation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Stylists can view consultation photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'consultation-photos' AND (
    public.has_role(auth.uid(), 'stylist') OR public.has_role(auth.uid(), 'salon_admin')
  ));
CREATE POLICY "Users can delete own consultation photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'consultation-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Face shape enum
CREATE TYPE public.face_shape AS ENUM ('oval', 'round', 'square', 'heart', 'oblong', 'diamond', 'triangle', 'inverted_triangle');

-- Style gallery - curated hairstyles
CREATE TABLE public.style_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- fade, bob, layers, pixie, undercut, braids, etc.
  image_url TEXT NOT NULL,
  gender TEXT DEFAULT 'unisex', -- male, female, unisex
  compatible_face_shapes face_shape[] NOT NULL DEFAULT '{}',
  hair_length TEXT, -- short, medium, long
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.style_gallery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Style gallery viewable by everyone" ON public.style_gallery FOR SELECT USING (true);
CREATE POLICY "Admins manage style gallery" ON public.style_gallery FOR ALL
  USING (public.has_role(auth.uid(), 'salon_admin'));

-- Consultations
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stylist_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  salon_id UUID REFERENCES public.salons(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, reviewed, approved, locked
  selfie_url TEXT,
  face_shape face_shape,
  face_shape_confidence NUMERIC(3,2),
  face_analysis_notes TEXT,
  client_notes TEXT,
  stylist_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clients view own consultations" ON public.consultations FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Clients create own consultations" ON public.consultations FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients update own draft consultations" ON public.consultations FOR UPDATE
  USING (auth.uid() = client_id);
CREATE POLICY "Stylists view assigned consultations" ON public.consultations FOR SELECT
  USING (auth.uid() = stylist_id OR public.has_role(auth.uid(), 'stylist') OR public.has_role(auth.uid(), 'salon_admin'));
CREATE POLICY "Stylists update assigned consultations" ON public.consultations FOR UPDATE
  USING (auth.uid() = stylist_id);

-- Style board - saved looks for a consultation
CREATE TABLE public.style_board_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  style_id UUID REFERENCES public.style_gallery(id) ON DELETE SET NULL,
  inspiration_url TEXT, -- user-uploaded inspiration photo
  try_on_result_url TEXT, -- AI-generated try-on image
  notes TEXT,
  is_selected BOOLEAN DEFAULT false, -- final selection for submission
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.style_board_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own style board items" ON public.style_board_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Stylists view style board items" ON public.style_board_items FOR SELECT
  USING (public.has_role(auth.uid(), 'stylist') OR public.has_role(auth.uid(), 'salon_admin'));

-- Triggers
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
