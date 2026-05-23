ALTER TABLE public.appointments ADD COLUMN payment_status text NOT NULL DEFAULT 'pending';

-- Update existing completed appointments to 'pending' (they already have the default)
-- Update cancelled/no_show to 'n/a' since they don't need payment
UPDATE public.appointments SET payment_status = 'n/a' WHERE status IN ('cancelled', 'no_show');