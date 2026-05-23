-- Voice agent tables for ElevenLabs + Twilio integration

CREATE TABLE IF NOT EXISTS public.salon_voice_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  elevenlabs_agent_id TEXT NOT NULL,
  phone_number TEXT,
  phone_type TEXT DEFAULT 'twilio' CHECK (phone_type IN ('twilio', 'sip')),
  voice_id TEXT DEFAULT 'pNInz6obpgDQGcFmaJgB',
  is_active BOOLEAN DEFAULT true,
  transfer_phone TEXT,
  greeting TEXT DEFAULT 'Hello! Thank you for calling. How can I help you today?',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(salon_id)
);

CREATE TABLE IF NOT EXISTS public.voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  voice_agent_id UUID REFERENCES public.salon_voice_agents(id) ON DELETE SET NULL,
  elevenlabs_conversation_id TEXT,
  caller_phone TEXT,
  caller_name TEXT,
  client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  transcript JSONB,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed', 'transferred')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.salon_voice_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;

-- Salon owners can manage their voice agent config
CREATE POLICY "Salon owners can view their voice agent"
  ON public.salon_voice_agents FOR SELECT
  USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

CREATE POLICY "Salon owners can insert voice agent"
  ON public.salon_voice_agents FOR INSERT
  WITH CHECK (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

CREATE POLICY "Salon owners can update their voice agent"
  ON public.salon_voice_agents FOR UPDATE
  USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

CREATE POLICY "Salon owners can delete their voice agent"
  ON public.salon_voice_agents FOR DELETE
  USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Salon owners can view call logs
CREATE POLICY "Salon owners can view call logs"
  ON public.voice_call_logs FOR SELECT
  USING (salon_id IN (SELECT id FROM public.salons WHERE owner_id = auth.uid()));

-- Service role can insert call logs (from webhook)
CREATE POLICY "Service role can insert call logs"
  ON public.voice_call_logs FOR INSERT
  WITH CHECK (true);

-- Index for querying call logs
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_salon_id ON public.voice_call_logs(salon_id);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_created_at ON public.voice_call_logs(created_at DESC);
