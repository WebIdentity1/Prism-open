
-- Add onboarding columns to salons
ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Set existing salons to 'complete' so they aren't forced through the wizard
UPDATE public.salons SET onboarding_status = 'complete' WHERE onboarding_status = 'pending';

-- Create import_jobs table
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'clients' or 'services'
  status text NOT NULL DEFAULT 'pending', -- pending, processing, complete, failed
  file_url text,
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon owners manage import jobs"
  ON public.import_jobs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.salons WHERE salons.id = import_jobs.salon_id AND salons.owner_id = auth.uid()
  ));

-- Create imports storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Salon admins upload imports"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'imports' AND auth.role() = 'authenticated');

CREATE POLICY "Salon admins read imports"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'imports' AND auth.role() = 'authenticated');
