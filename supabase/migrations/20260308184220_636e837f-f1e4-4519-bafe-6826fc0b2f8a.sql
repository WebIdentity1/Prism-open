
-- Create security definer function to get user's conversation IDs
CREATE OR REPLACE FUNCTION public.get_my_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_conversation_ids FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_conversation_ids TO authenticated;

-- Drop the recursive policy
DROP POLICY IF EXISTS "View co-participants" ON public.conversation_participants;

-- Replace with security definer based policy
CREATE POLICY "View co-participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

-- Also fix conversations policy which has same issue (references conversation_participants)
DROP POLICY IF EXISTS "Participants view conversations" ON public.conversations;
CREATE POLICY "Participants view conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_my_conversation_ids()));

DROP POLICY IF EXISTS "Participants update conversations" ON public.conversations;
CREATE POLICY "Participants update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT public.get_my_conversation_ids()));

-- Fix messages policy too
DROP POLICY IF EXISTS "Participants view messages" ON public.messages;
CREATE POLICY "Participants view messages" ON public.messages
  FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));

DROP POLICY IF EXISTS "Participants send messages" ON public.messages;
CREATE POLICY "Participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (SELECT public.get_my_conversation_ids())
  );

DROP POLICY IF EXISTS "Recipients update read status" ON public.messages;
CREATE POLICY "Recipients update read status" ON public.messages
  FOR UPDATE TO authenticated
  USING (conversation_id IN (SELECT public.get_my_conversation_ids()));
