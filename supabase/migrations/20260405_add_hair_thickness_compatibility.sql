-- Add hair thickness compatibility to style gallery
-- Array of thicknesses this style works with. Empty = works for all.
ALTER TABLE public.style_gallery
  ADD COLUMN IF NOT EXISTS compatible_hair_thicknesses TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: set all existing styles to universal until AI classifier runs
UPDATE public.style_gallery
  SET compatible_hair_thicknesses = '{"fine","medium","thick"}'
  WHERE compatible_hair_thicknesses = '{}';
