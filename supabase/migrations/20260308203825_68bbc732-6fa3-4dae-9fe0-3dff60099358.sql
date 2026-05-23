
-- Allow salon admins to create appointments for any client in their salon
CREATE POLICY "Salon admins create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM salons
    WHERE salons.id = appointments.salon_id
    AND salons.owner_id = auth.uid()
  )
);

-- Allow stylists to create appointments assigned to themselves
CREATE POLICY "Stylists create assigned appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = stylist_id
  AND has_role(auth.uid(), 'stylist')
);
