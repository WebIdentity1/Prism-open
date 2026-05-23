
-- Internal notes on clients
CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  author_id UUID NOT NULL,
  salon_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon staff view notes" ON public.client_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM salons WHERE salons.id = client_notes.salon_id AND salons.owner_id = auth.uid())
    OR auth.uid() = author_id
    OR has_role(auth.uid(), 'stylist')
  );

CREATE POLICY "Salon staff insert notes" ON public.client_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND (
      EXISTS (SELECT 1 FROM salons WHERE salons.id = client_notes.salon_id AND salons.owner_id = auth.uid())
      OR has_role(auth.uid(), 'stylist')
    )
  );

CREATE POLICY "Authors delete own notes" ON public.client_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  segment TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admins manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = campaigns.salon_id AND salons.owner_id = auth.uid()));

-- Campaign recipients log
CREATE TABLE public.campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salon admins manage recipients" ON public.campaign_recipients
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM campaigns c
    JOIN salons s ON s.id = c.salon_id
    WHERE c.id = campaign_recipients.campaign_id AND s.owner_id = auth.uid()
  ));

-- Loyalty points tracking
CREATE TABLE public.loyalty_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  appointment_id UUID REFERENCES public.appointments(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients view own points" ON public.loyalty_points
  FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Salon admins manage points" ON public.loyalty_points
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = loyalty_points.salon_id AND salons.owner_id = auth.uid()));

-- Referrals tracking
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  salon_id UUID NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Salon admins manage referrals" ON public.referrals
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = referrals.salon_id AND salons.owner_id = auth.uid()));

CREATE POLICY "Clients create referrals" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referrer_id);
