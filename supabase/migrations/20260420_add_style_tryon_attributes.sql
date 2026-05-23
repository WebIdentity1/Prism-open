-- Add structured try-on attributes cache + provenance to style_gallery.
-- Populated by the analyze-style-image edge function. Rendered into the generation
-- prompt by supabase/functions/generate-tryon. NULL = not yet classified.
ALTER TABLE public.style_gallery
  ADD COLUMN IF NOT EXISTS tryon_attributes JSONB,
  ADD COLUMN IF NOT EXISTS tryon_classified_with TEXT,
  ADD COLUMN IF NOT EXISTS tryon_classified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.style_gallery.tryon_attributes IS 'Structured visual attributes extracted from the reference image by analyze-style-image.';
COMMENT ON COLUMN public.style_gallery.tryon_classified_with IS 'Gemini model ID used for the latest classification. Null = not classified.';
COMMENT ON COLUMN public.style_gallery.tryon_classified_at IS 'Timestamp of the latest classification. Null = not classified.';
