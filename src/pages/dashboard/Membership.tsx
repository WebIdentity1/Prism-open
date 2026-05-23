import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Crown, Check, Clock, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MembershipTier {
  id: string;
  name: string;
  price: number;
  billing_interval: string;
  max_credits: number | null;
  included_services: string[] | null;
  cleanup_window_start: number | null;
  cleanup_window_end: number | null;
  salon_id: string;
}

interface ClientMembership {
  id: string;
  tier_id: string;
  status: string;
  credits_remaining: number | null;
  current_period_end: string | null;
}

const Membership = () => {
  const { user } = useAuth(false);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [membership, setMembership] = useState<ClientMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: tierData } = await supabase
        .from("membership_tiers")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      setTiers(tierData || []);

      if (user) {
        const { data: memData } = await supabase
          .from("client_memberships")
          .select("*")
          .eq("client_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        setMembership(memData);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSubscribe = async (tier: MembershipTier) => {
    setCheckoutLoading(tier.id);
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `${tier.name} Membership` },
            unit_amount: Math.round(tier.price * 100),
            recurring: { interval: tier.billing_interval === "yearly" ? "year" : "month" },
          },
          quantity: 1,
        }],
        success_url: `${window.location.origin}/dashboard/membership?subscribed=true`,
        cancel_url: `${window.location.origin}/dashboard/membership`,
        metadata: { type: "membership", tier_id: tier.id, salon_id: tier.salon_id },
      },
    });
    setCheckoutLoading(null);
    if (error) {
      toast.error(error.message || "Failed to start checkout");
      return;
    }
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setPortalLoading(false);
    if (error) {
      toast.error("Unable to open subscription portal");
      return;
    }
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded" /></div>;
  }

  const activeTierId = membership?.tier_id;

  return (
    <div>
      <h1 className="text-2xl font-light tracking-tight mb-1">Membership</h1>
      <p className="text-muted-foreground mb-8">View plans and manage your membership</p>

      {membership && (
        <div className="mb-8 p-6 glass-elevated rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              <span className="font-semibold text-lg">Active Membership</span>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleManage} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ExternalLink className="h-3 w-3 mr-1" />}
              Manage
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Plan: <span className="font-medium text-foreground">{tiers.find(t => t.id === activeTierId)?.name}</span>
            {" · "}Credits remaining: <span className="font-medium text-foreground">{membership.credits_remaining ?? "N/A"}</span>
            {membership.current_period_end && (
              <> · Renews: <span className="font-medium text-foreground">{new Date(membership.current_period_end).toLocaleDateString()}</span></>
            )}
          </p>
        </div>
      )}

      {tiers.length === 0 ? (
        <p className="text-muted-foreground">No membership plans available yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier, i) => {
            const isCurrent = tier.id === activeTierId;
            return (
              <div
                key={tier.id}
                className={`relative rounded-xl p-7 flex flex-col hover:bg-[var(--glass-bg-elevated)] transition-colors duration-150 ${
                  isCurrent ? "glass-elevated" : "glass"
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-4 badge-prism">Current Plan</Badge>
                )}
                {i === 1 && !isCurrent && (
                  <Badge className="absolute -top-3 left-4 badge-champagne">Popular</Badge>
                )}
                <h3 className="text-xl font-medium mb-1">{tier.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-light">${tier.price}</span>
                  <span className="text-muted-foreground text-sm">/{tier.billing_interval}</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {tier.max_credits && (
                    <li className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{tier.max_credits} service credit{tier.max_credits > 1 ? "s" : ""} per period</span>
                    </li>
                  )}
                  {tier.cleanup_window_start != null && tier.cleanup_window_end != null && (
                    <li className="flex items-start gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>Cleanup visits: Day {tier.cleanup_window_start}–{tier.cleanup_window_end}</span>
                    </li>
                  )}
                  {tier.included_services?.map((service) => (
                    <li key={service} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{service}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full rounded-full" onClick={handleManage} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Manage Plan
                  </Button>
                ) : (
                  <Button onClick={() => handleSubscribe(tier)} className="w-full bg-gradient-prism text-white rounded-full" disabled={!!checkoutLoading}>
                    {checkoutLoading === tier.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    {membership ? "Switch Plan" : "Subscribe"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Membership;
