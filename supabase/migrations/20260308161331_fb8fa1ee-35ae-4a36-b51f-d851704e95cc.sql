
-- Add unique constraint on profiles.user_id if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- Add FK from appointments.client_id -> profiles.user_id
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_client_id_profiles_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(user_id);

-- Add FK from appointments.stylist_id -> profiles.user_id
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_stylist_id_profiles_fkey
  FOREIGN KEY (stylist_id) REFERENCES public.profiles(user_id);

-- Add FK from consultations.client_id -> profiles.user_id
ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_client_id_profiles_fkey
  FOREIGN KEY (client_id) REFERENCES public.profiles(user_id);
