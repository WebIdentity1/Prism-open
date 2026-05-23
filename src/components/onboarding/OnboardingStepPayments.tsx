import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  salon: any;
  onNext: () => void;
  onBack: () => void;
  onSalonUpdate: (salon: any) => void;
}

type AccountStatus = "unknown" | "checking" | "none" | "incomplete" | "connected";

const OnboardingStepPayments = ({ salon, onNext, onBack, onSalonUpdate }: Props) => {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<AccountStatus>("unknown");

  const accountId = salon?.stripe_account_id;

  useEffect(() => {
    if (!accountId) {
      setStatus("none");
      return;
    }
    let cancelled = false;
    setStatus("checking");
    supabase.functions
      .invoke("connect-account-status", { body: { salon_id: salon.id } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          // Account exists in DB but we can't verify — treat as incomplete so user can resume
          setStatus("incomplete");
          return;
        }
        setStatus(data.charges_enabled ? "connected" : "incomplete");
      });
    return () => { cancelled = true; };
  }, [accountId, salon?.id]);

  const extractError = async (data: any, error: any): Promise<string | undefined> => {
    let detail: string | undefined = data?.error;
    if (!detail && error) {
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === "function") {
          const body = await ctx.json();
          detail = body?.error || body?.message;
        }
      } catch { /* ignore */ }
      detail = detail || error.message;
    }
    return detail;
  };

  const startStripeOnboarding = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-connect-account", {
      body: { salon_id: salon.id },
    });
    setLoading(false);
    if (error || !data?.url) {
      const detail = await extractError(data, error);
      console.error("create-connect-account failed:", { error, data, detail });
      toast.error(detail ? `Payment setup failed: ${detail}` : "Failed to start payment setup");
      return;
    }
    // Same-tab redirect to Stripe; return_url brings the user back to /dashboard/onboarding,
    // where the status check on mount picks up where they left off.
    window.location.href = data.url;
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("connect-account-status", {
      body: { salon_id: salon.id },
    });
    setChecking(false);
    if (error || !data) {
      const detail = await extractError(data, error);
      toast.error(detail ? `Status check failed: ${detail}` : "Failed to check status");
      return;
    }
    if (data.charges_enabled) {
      setStatus("connected");
      toast.success("Stripe setup complete — you can accept payments.");
      onSalonUpdate({ ...salon, stripe_account_id: data.account_id });
    } else {
      setStatus("incomplete");
      toast.info(
        data.details_submitted
          ? "Stripe is reviewing your account. This can take a few minutes."
          : "Setup not yet complete. Click Resume to finish Stripe onboarding."
      );
    }
  };

  return (
    <div className="glass-elevated rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-xl font-medium">Payment Setup</h2>
        <p className="text-sm text-muted-foreground mt-1">Connect your payment account to start accepting bookings and collecting deposits.</p>
      </div>
      <div className="space-y-6">
        {status === "checking" || status === "unknown" ? (
          <div className="p-6 glass rounded-xl border border-champagne/20 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your Stripe account…
          </div>
        ) : status === "connected" ? (
          <div className="p-6 glass rounded-xl border border-champagne/30 flex items-center gap-4">
            <CheckCircle className="h-8 w-8 text-champagne shrink-0" />
            <div>
              <p className="font-medium">Payment account connected</p>
              <p className="text-sm text-muted-foreground">You're all set to accept payments from clients.</p>
            </div>
          </div>
        ) : status === "incomplete" ? (
          <div className="space-y-4">
            <div className="p-6 glass rounded-xl border border-amber-500/30 flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">Stripe setup not finished</p>
                <p className="text-sm text-muted-foreground mt-1">Your account was created but isn't ready to accept payments yet. Resume the Stripe onboarding to add your business details and bank account.</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={startStripeOnboarding} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                {loading ? "Loading…" : "Resume Stripe setup"}
              </Button>
              <Button variant="outline" onClick={handleCheckStatus} disabled={checking} className="flex-1">
                {checking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {checking ? "Checking…" : "Check status"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 glass rounded-xl border border-champagne/20 text-center space-y-4">
            <CreditCard className="h-10 w-10 text-champagne mx-auto" />
            <div>
              <p className="font-medium">Accept payments securely</p>
              <p className="text-sm text-muted-foreground">We use Stripe to process payments. You'll be redirected to set up your account — Stripe collects business details and bank info to enable payouts.</p>
            </div>
            <Button onClick={startStripeOnboarding} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              {loading ? "Setting up…" : "Set Up Payments"}
            </Button>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} className="rounded-full">Back</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onNext} className="rounded-full">Skip for now</Button>
            <Button onClick={onNext} className="bg-gradient-prism text-white rounded-full">Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStepPayments;
