
-- Tighten the insert policy - only allow system/trigger inserts by restricting to own user_id
DROP POLICY "System inserts notifications" ON public.notifications;
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
