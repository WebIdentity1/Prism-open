import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, X, Rocket, Loader2 } from "lucide-react";

interface Props {
  salonId: string;
  onBack: () => void;
  onComplete: () => void;
}

const OnboardingStepReview = ({ salonId, onBack, onComplete }: Props) => {
  const [counts, setCounts] = useState({ services: 0, staff: 0, stripeReady: false, salonName: "" });
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [salonRes, servicesRes, staffRes] = await Promise.all([
        supabase.from("salons").select("name, stripe_account_id").eq("id", salonId).single(),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
        supabase.from("stylist_profiles").select("id", { count: "exact", head: true }).eq("salon_id", salonId),
      ]);
      setCounts({
        salonName: salonRes.data?.name || "",
        stripeReady: !!salonRes.data?.stripe_account_id,
        services: servicesRes.count || 0,
        staff: staffRes.count || 0,
      });
      setLoading(false);
    };
    load();
  }, [salonId]);

  const handleGoLive = async () => {
    setCompleting(true);
    onComplete();
  };

  const items = [
    { label: "Salon info", ok: !!counts.salonName },
    { label: "Services added", ok: counts.services > 0, detail: `${counts.services} service(s)` },
    { label: "Staff invited", ok: counts.staff > 0, detail: `${counts.staff} stylist(s)` },
    { label: "Payments connected", ok: counts.stripeReady },
  ];

  return (
    <div className="glass-elevated rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-medium">Review & Go Live</h2>
        <p className="text-sm text-muted-foreground mt-1">Here's a summary of your setup. You can always adjust settings later from your dashboard.</p>
      </div>
      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.label} className="flex items-center gap-3 p-3 glass-subtle rounded-xl">
                  {item.ok ? (
                    <Check className="h-5 w-5 text-glass-teal shrink-0" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                  </div>
                  {item.ok ? (
                    <span className="badge-teal text-xs font-medium">Done</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Skipped</span>
                  )}
                </div>
              ))}
            </div>

            <div className="p-6 glass-elevated rounded-xl border border-champagne/20 text-center space-y-3">
              <Rocket className="h-8 w-8 text-champagne mx-auto" />
              <p className="font-medium">Ready to launch {counts.salonName}?</p>
              <p className="text-sm text-muted-foreground">Your salon will be visible to clients and you can start accepting bookings.</p>
            </div>
          </>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-full">Back</Button>
          <Button onClick={handleGoLive} disabled={completing || loading} size="lg" className="bg-gradient-champagne text-obsidian rounded-full">
            {completing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            {completing ? "Launching..." : "Go Live!"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStepReview;
