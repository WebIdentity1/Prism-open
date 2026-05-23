
-- Add salon-level settings columns
ALTER TABLE salons ADD COLUMN IF NOT EXISTS default_commission_rate numeric DEFAULT 50;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"booking_confirmed": true, "booking_cancelled": true, "consultation_submitted": true, "appointment_reminder": true}'::jsonb;

-- Create membership_tiers table
CREATE TABLE membership_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly',
  included_services text[] DEFAULT '{}',
  cleanup_window_start integer DEFAULT 12,
  cleanup_window_end integer DEFAULT 20,
  max_credits integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create client_memberships table
CREATE TABLE client_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  tier_id uuid NOT NULL REFERENCES membership_tiers(id),
  salon_id uuid NOT NULL REFERENCES salons(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  credits_remaining integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_memberships ENABLE ROW LEVEL SECURITY;

-- RLS for membership_tiers
CREATE POLICY "Salon admins manage tiers" ON membership_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = membership_tiers.salon_id AND salons.owner_id = auth.uid()));
CREATE POLICY "Tiers viewable by everyone" ON membership_tiers FOR SELECT USING (true);

-- RLS for client_memberships
CREATE POLICY "Clients view own memberships" ON client_memberships FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Salon admins manage memberships" ON client_memberships FOR ALL
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = client_memberships.salon_id AND salons.owner_id = auth.uid()));

-- Allow salon admins to update stylist commission rates
CREATE POLICY "Salon admins update stylist profiles" ON stylist_profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = stylist_profiles.salon_id AND salons.owner_id = auth.uid()));
