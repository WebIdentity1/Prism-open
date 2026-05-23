-- Function to auto-award loyalty points when appointment is completed
CREATE OR REPLACE FUNCTION public.award_loyalty_points_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  salon_rec RECORD;
  svc_price numeric;
  dollar_points integer;
  service_points integer;
  total_points integer;
BEGIN
  -- Only fire when status changes to 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Get salon loyalty config
  SELECT
    loyalty_enabled,
    loyalty_points_per_dollar,
    loyalty_points_per_service
  INTO salon_rec
  FROM public.salons
  WHERE id = NEW.salon_id;

  IF NOT FOUND OR NOT salon_rec.loyalty_enabled THEN
    RETURN NEW;
  END IF;

  -- Get service price
  svc_price := 0;
  IF NEW.service_id IS NOT NULL THEN
    SELECT price INTO svc_price FROM public.services WHERE id = NEW.service_id;
  END IF;

  -- Calculate points
  dollar_points := FLOOR(svc_price * salon_rec.loyalty_points_per_dollar);
  service_points := salon_rec.loyalty_points_per_service;
  total_points := dollar_points + service_points;

  IF total_points <= 0 THEN
    RETURN NEW;
  END IF;

  -- Insert loyalty points
  INSERT INTO public.loyalty_points (client_id, salon_id, appointment_id, points, reason)
  VALUES (
    NEW.client_id,
    NEW.salon_id,
    NEW.id,
    total_points,
    CASE
      WHEN dollar_points > 0 AND service_points > 0 THEN
        dollar_points || ' pts ($' || svc_price || ') + ' || service_points || ' pts (service bonus)'
      WHEN dollar_points > 0 THEN
        dollar_points || ' pts for $' || svc_price || ' spent'
      ELSE
        service_points || ' pts service bonus'
    END
  );

  RETURN NEW;
END;
$$;

-- Create trigger on appointments
CREATE TRIGGER trg_award_loyalty_on_complete
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.award_loyalty_points_on_complete();