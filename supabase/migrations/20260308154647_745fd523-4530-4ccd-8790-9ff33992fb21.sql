
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Allow system inserts (via trigger security definer)
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: create notifications on appointment changes
CREATE OR REPLACE FUNCTION public.notify_on_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_name text;
  stylist_name text;
  service_name text;
  salon_name text;
  salon_owner_id uuid;
  appt_time text;
BEGIN
  -- Get related names
  SELECT full_name INTO client_name FROM public.profiles WHERE user_id = NEW.client_id LIMIT 1;
  SELECT full_name INTO stylist_name FROM public.profiles WHERE user_id = NEW.stylist_id LIMIT 1;
  SELECT name INTO service_name FROM public.services WHERE id = NEW.service_id LIMIT 1;
  SELECT name, owner_id INTO salon_name, salon_owner_id FROM public.salons WHERE id = NEW.salon_id LIMIT 1;

  appt_time := to_char(NEW.start_time AT TIME ZONE 'UTC', 'Mon DD at HH12:MI AM');

  IF TG_OP = 'INSERT' THEN
    -- Notify stylist about new booking
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (NEW.stylist_id, 'New Appointment',
      COALESCE(client_name, 'A client') || ' booked ' || COALESCE(service_name, 'a service') || ' on ' || appt_time,
      'appointment', '/dashboard/appointments');

    -- Notify salon admin
    IF salon_owner_id IS NOT NULL AND salon_owner_id != NEW.stylist_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (salon_owner_id, 'New Booking',
        COALESCE(client_name, 'A client') || ' booked with ' || COALESCE(stylist_name, 'a stylist') || ' on ' || appt_time,
        'appointment', '/dashboard/appointments');
    END IF;

    -- Notify client (confirmation)
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (NEW.client_id, 'Booking Confirmed',
      'Your appointment with ' || COALESCE(stylist_name, 'your stylist') || ' at ' || COALESCE(salon_name, 'the salon') || ' on ' || appt_time || ' is confirmed.',
      'appointment', '/dashboard/appointments');
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    IF NEW.status = 'cancelled' THEN
      -- Notify stylist
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.stylist_id, 'Appointment Cancelled',
        COALESCE(client_name, 'A client') || '''s appointment on ' || appt_time || ' was cancelled.',
        'appointment', '/dashboard/appointments');
      -- Notify client
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.client_id, 'Appointment Cancelled',
        'Your appointment on ' || appt_time || ' at ' || COALESCE(salon_name, 'the salon') || ' has been cancelled.',
        'appointment', '/dashboard/appointments');
      -- Notify admin
      IF salon_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (salon_owner_id, 'Appointment Cancelled',
          COALESCE(client_name, 'A client') || '''s appointment with ' || COALESCE(stylist_name, 'a stylist') || ' on ' || appt_time || ' was cancelled.',
          'appointment', '/dashboard/appointments');
      END IF;
    ELSIF NEW.status = 'confirmed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.client_id, 'Appointment Confirmed',
        'Your appointment on ' || appt_time || ' has been confirmed!',
        'appointment', '/dashboard/appointments');
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.client_id, 'Appointment Completed',
        'Your appointment with ' || COALESCE(stylist_name, 'your stylist') || ' is complete. We hope you loved it!',
        'appointment', '/dashboard/appointments');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function: create notifications on consultation changes
CREATE OR REPLACE FUNCTION public.notify_on_consultation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  client_name text;
  salon_owner_id uuid;
BEGIN
  SELECT full_name INTO client_name FROM public.profiles WHERE user_id = NEW.client_id LIMIT 1;

  IF NEW.salon_id IS NOT NULL THEN
    SELECT owner_id INTO salon_owner_id FROM public.salons WHERE id = NEW.salon_id LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status = 'submitted' THEN
    -- Notify salon admin
    IF salon_owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (salon_owner_id, 'New Consultation',
        COALESCE(client_name, 'A client') || ' submitted a new consultation.',
        'consultation', '/dashboard/consultations/' || NEW.id);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If stylist assigned
    IF OLD.stylist_id IS NULL AND NEW.stylist_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.stylist_id, 'Consultation Assigned',
        'You have been assigned a new consultation from ' || COALESCE(client_name, 'a client') || '.',
        'consultation', '/dashboard/consultations/' || NEW.id);
    END IF;

    -- If status changed to reviewed
    IF OLD.status != NEW.status AND NEW.status = 'reviewed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (NEW.client_id, 'Consultation Reviewed',
        'Your consultation has been reviewed by your stylist!',
        'consultation', '/dashboard/consultations/' || NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach triggers
CREATE TRIGGER on_appointment_change
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_appointment_change();

CREATE TRIGGER on_consultation_change
  AFTER INSERT OR UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_consultation_change();
