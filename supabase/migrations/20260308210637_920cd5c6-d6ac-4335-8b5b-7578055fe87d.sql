
-- Forms table: stores form definitions
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Form submissions table
CREATE TABLE public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  client_id uuid,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: link forms to services for booking flow
CREATE TABLE public.service_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  is_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, form_id)
);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_forms ENABLE ROW LEVEL SECURITY;

-- Forms policies
CREATE POLICY "Salon admins manage forms" ON public.forms FOR ALL
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = forms.salon_id AND salons.owner_id = auth.uid()));

CREATE POLICY "Active forms viewable by everyone" ON public.forms FOR SELECT
  USING (is_active = true AND is_public = true);

-- Form submissions policies
CREATE POLICY "Salon admins view submissions" ON public.form_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = form_submissions.salon_id AND salons.owner_id = auth.uid()));

CREATE POLICY "Stylists view salon submissions" ON public.form_submissions FOR SELECT
  USING (has_role(auth.uid(), 'stylist'));

CREATE POLICY "Clients submit forms" ON public.form_submissions FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients view own submissions" ON public.form_submissions FOR SELECT
  USING (auth.uid() = client_id);

-- Anonymous submissions (no client_id)
CREATE POLICY "Anyone can submit public forms" ON public.form_submissions FOR INSERT
  WITH CHECK (client_id IS NULL AND EXISTS (SELECT 1 FROM forms WHERE forms.id = form_submissions.form_id AND forms.is_active = true AND forms.is_public = true));

-- Service forms policies
CREATE POLICY "Salon admins manage service forms" ON public.service_forms FOR ALL
  USING (EXISTS (SELECT 1 FROM services s JOIN salons sa ON sa.id = s.salon_id WHERE s.id = service_forms.service_id AND sa.owner_id = auth.uid()));

CREATE POLICY "Service forms viewable by everyone" ON public.service_forms FOR SELECT
  USING (true);

-- Updated_at trigger for forms
CREATE TRIGGER update_forms_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
