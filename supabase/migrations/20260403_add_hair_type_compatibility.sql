-- Add hair type detection results to consultations
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS detected_hair_type TEXT,
  ADD COLUMN IF NOT EXISTS detected_hair_thickness TEXT;

-- Add hair type compatibility to style gallery
-- Array of hair types this style works with. Empty = works for all types.
ALTER TABLE public.style_gallery
  ADD COLUMN IF NOT EXISTS compatible_hair_types TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing styles with sensible defaults (case-insensitive matching)
-- Most conventional cuts work for straight, wavy, and medium-curly hair
UPDATE public.style_gallery SET compatible_hair_types = '{"straight","wavy","curly"}' WHERE LOWER(category) IN ('bobs', 'short', 'waves', 'classic', 'bangs', 'layered', 'fades');

-- Braids and natural styles work best with curly/coily hair
UPDATE public.style_gallery SET compatible_hair_types = '{"curly","coily"}' WHERE LOWER(category) IN ('braids', 'natural');

-- Ensure any style with empty array gets all types (universal styles)
UPDATE public.style_gallery SET compatible_hair_types = '{"straight","wavy","curly","coily"}' WHERE compatible_hair_types = '{}';
