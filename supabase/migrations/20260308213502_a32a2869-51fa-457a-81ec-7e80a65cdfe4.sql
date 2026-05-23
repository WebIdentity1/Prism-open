
ALTER TABLE public.appointments
  ADD COLUMN onboarding_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Allow anonymous/public read access to appointments by matching onboarding_token
-- This is used by the client onboarding page to validate token-based access
CREATE POLICY "Token-based appointment access"
ON public.appointments
FOR SELECT
TO anon, authenticated
USING (onboarding_token IS NOT NULL AND onboarding_token = COALESCE(
  (current_setting('request.headers', true)::json->>'x-onboarding-token')::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid
));

-- Allow updating onboarding_completed via token (from edge function using service role, so no RLS needed for that)
-- But we do need anon users to be able to update onboarding_completed
CREATE POLICY "Token-based appointment onboarding update"
ON public.appointments
FOR UPDATE
TO anon, authenticated
USING (onboarding_token IS NOT NULL)
WITH CHECK (onboarding_token IS NOT NULL);
