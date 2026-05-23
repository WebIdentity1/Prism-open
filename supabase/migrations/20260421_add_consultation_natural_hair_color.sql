-- Add natural hair color detected from the user's selfie.
-- Populated by detect-face-shape via Consultation.tsx after analysis.
-- Consumed by generate-tryon (v3) to anchor color preservation in the prompt.
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS detected_natural_hair_color TEXT;

COMMENT ON COLUMN public.consultations.detected_natural_hair_color IS 'User''s natural hair color classified from their selfie at consultation time (e.g. "black", "dark_brown"). Null = not detected.';
