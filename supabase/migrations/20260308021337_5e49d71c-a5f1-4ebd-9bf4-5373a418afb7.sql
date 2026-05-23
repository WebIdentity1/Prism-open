
-- Create appointment status enum
CREATE TYPE public.appointment_status AS ENUM ('booked', 'confirmed', 'completed', 'cancelled', 'no_show');

-- Stylist availability (recurring weekly slots)
CREATE TABLE public.stylist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stylist_id uuid NOT NULL,
  salon_id uuid REFERENCES public.salons(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stylist_id, salon_id, day_of_week, start_time)
);

-- Appointments table
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  stylist_id uuid NOT NULL,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'booked',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_appointments_client ON public.appointments(client_id);
CREATE INDEX idx_appointments_stylist ON public.appointments(stylist_id);
CREATE INDEX idx_appointments_salon ON public.appointments(salon_id);
CREATE INDEX idx_appointments_start ON public.appointments(start_time);
CREATE INDEX idx_availability_stylist ON public.stylist_availability(stylist_id);

-- Enable RLS
ALTER TABLE public.stylist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS for stylist_availability
CREATE POLICY "Stylists manage own availability" ON public.stylist_availability
  FOR ALL TO authenticated
  USING (auth.uid() = stylist_id)
  WITH CHECK (auth.uid() = stylist_id);

CREATE POLICY "Availability viewable by authenticated" ON public.stylist_availability
  FOR SELECT TO authenticated
  USING (true);

-- RLS for appointments
CREATE POLICY "Clients view own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients create own appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients update own appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Stylists view assigned appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (auth.uid() = stylist_id);

CREATE POLICY "Stylists update assigned appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (auth.uid() = stylist_id);

CREATE POLICY "Salon admins view salon appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.salons WHERE salons.id = appointments.salon_id AND salons.owner_id = auth.uid()
  ));

CREATE POLICY "Salon admins update salon appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.salons WHERE salons.id = appointments.salon_id AND salons.owner_id = auth.uid()
  ));

-- Updated_at triggers
CREATE TRIGGER set_updated_at_stylist_availability
  BEFORE UPDATE ON public.stylist_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
