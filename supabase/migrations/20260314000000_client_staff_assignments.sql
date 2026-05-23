-- Client-Staff Ownership Assignments
-- Each client has one primary stylist per salon, auto-assigned on first booking.
-- Salon admins can manually reassign.

CREATE TABLE public.client_staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  stylist_id UUID NOT NULL,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,  -- null = auto-assigned via trigger, otherwise the admin who reassigned
  UNIQUE (client_id, salon_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_csa_salon ON public.client_staff_assignments(salon_id);
CREATE INDEX idx_csa_stylist_salon ON public.client_staff_assignments(stylist_id, salon_id);
CREATE INDEX idx_csa_client ON public.client_staff_assignments(client_id);

-- RLS
ALTER TABLE public.client_staff_assignments ENABLE ROW LEVEL SECURITY;

-- Salon admins: full CRUD for their salon
CREATE POLICY "Salon admins manage assignments"
  ON public.client_staff_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.salons
      WHERE salons.id = client_staff_assignments.salon_id
        AND salons.owner_id = auth.uid()
    )
  );

-- Stylists: read their own assignments
CREATE POLICY "Stylists view own assignments"
  ON public.client_staff_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = stylist_id);

-- Clients: see who their stylist is
CREATE POLICY "Clients view own assignments"
  ON public.client_staff_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

-- Auto-assignment trigger: on first appointment, assign client to that stylist
CREATE OR REPLACE FUNCTION public.auto_assign_client_stylist()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip block-time entries where client_id = stylist_id
  IF NEW.client_id = NEW.stylist_id THEN
    RETURN NEW;
  END IF;

  -- Only insert if no assignment exists yet (first booking wins)
  INSERT INTO public.client_staff_assignments (client_id, stylist_id, salon_id)
  VALUES (NEW.client_id, NEW.stylist_id, NEW.salon_id)
  ON CONFLICT (client_id, salon_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auto_assign_client_stylist
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_client_stylist();
