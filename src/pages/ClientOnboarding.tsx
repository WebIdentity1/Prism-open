import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, User, CreditCard, ShieldCheck, Sparkles, CheckCircle2, Calendar, Clock, Scissors, MapPin, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface OnboardingData {
  appointment: {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    onboarding_completed: boolean;
  };
  salon: {
    id: string;
    name: string;
    cancellation_window_hours: number | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    logo_url: string | null;
  };
  service: { name: string; price: number; duration_minutes: number } | null;
  stylist_name: string;
  client: {
    user_id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
  };
}

type Step = "profile" | "payment" | "policy" | "consultation" | "complete";
const STEPS: Step[] = ["profile", "payment", "policy", "consultation"];

// Stored verbatim in profiles.sms_consent_text so we can prove what
// the client agreed to. Twilio TFV reviewers and TCPA audits can verify this string.
const SMS_CONSENT_DISCLOSURE = (salonName: string) =>
  `I agree to receive transactional SMS messages from ${salonName} at the phone number above, ` +
  `including appointment confirmations, reminders, check-in links, and changes to my booking. ` +
  `Message frequency varies by appointment activity. Message and data rates may apply. ` +
  `Reply STOP to unsubscribe at any time, or HELP for help. Consent is not a condition of purchase. ` +
  `See our Privacy Policy at /privacy for details.`;

const ClientOnboarding = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [step, setStep] = useState<Step>("profile");
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);

  // Policy
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Payment
  const [paymentSkipped, setPaymentSkipped] = useState(false);

  useEffect(() => {
    if (!appointmentId || !token) {
      setError("Invalid link. Please check your SMS and try again.");
      setLoading(false);
      return;
    }
    validateToken();
  }, [appointmentId, token]);

  const validateToken = async () => {
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("client-onboarding", {
        body: { action: "validate", appointment_id: appointmentId, token },
      });
      if (fnError) throw new Error(fnError.message);
      if (result?.error) throw new Error(result.error);

      setData(result);
      setFullName(result.client?.full_name || "");
      setPhone(result.client?.phone || "");
      setEmail(result.client?.email || "");

      if (result.appointment.onboarding_completed) {
        setStep("complete");
      }
    } catch (e: any) {
      setError(e.message || "Could not validate your link");
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step === "complete" ? STEPS.length : STEPS.indexOf(step);
  const progressPercent = step === "complete" ? 100 : ((stepIndex) / STEPS.length) * 100;

  const handleProfileSave = async () => {
    if (!fullName.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("client-onboarding", {
        body: {
          action: "update_profile",
          appointment_id: appointmentId,
          token,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          sms_consent: smsConsent && !!phone.trim(),
          sms_consent_text: smsConsent && !!phone.trim()
            ? SMS_CONSENT_DISCLOSURE(data?.salon.name || "this salon")
            : null,
        },
      });
      if (fnError || result?.error) throw new Error(result?.error || fnError?.message);
      setStep("payment");
    } catch (e: any) {
      toast.error("Error saving profile", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentSetup = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const customerEmail = email.trim() || data.client.email || undefined;
      const customerName = fullName.trim() || data.client.full_name || undefined;

      const { data: checkoutResult, error: checkoutError } = await supabase.functions.invoke("create-checkout", {
        body: {
          mode: "setup",
          line_items: [],
          success_url: `${window.location.origin}/onboard/${appointmentId}?token=${token}&payment_done=true`,
          cancel_url: `${window.location.origin}/onboard/${appointmentId}?token=${token}&payment_skipped=true`,
          customer_email: customerEmail,
          customer_name: customerName,
          customer_reference_id: data.client.user_id,
          onboarding_token: token,
          metadata: {
            type: "card_setup",
            salon_id: data.salon.id,
            appointment_id: appointmentId,
          },
        },
      });
      if (checkoutError) throw new Error(checkoutError.message);
      if (checkoutResult?.url) {
        window.location.href = checkoutResult.url;
        return;
      }
      // If no URL, skip payment
      setStep("policy");
    } catch (e: any) {
      toast.error("Payment setup error", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // Handle return from Stripe
  useEffect(() => {
    if (searchParams.get("payment_done") === "true") {
      setPaymentSkipped(false);
      setStep("policy");
    } else if (searchParams.get("payment_skipped") === "true") {
      setPaymentSkipped(true);
      setStep("policy");
    }
  }, [searchParams]);

  const handlePolicyAccept = async () => {
    if (!policyAccepted) {
      toast.error("Please accept the cancellation policy");
      return;
    }
    setSaving(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("client-onboarding", {
        body: { action: "accept_policy", appointment_id: appointmentId, token },
      });
      if (fnError || result?.error) throw new Error(result?.error || fnError?.message);
      setStep("consultation");
    } catch (e: any) {
      toast.error("Error", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Link Invalid</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { appointment, salon, service, stylist_name } = data;
  const cancellationHours = salon.cancellation_window_hours ?? 24;

  return (
    <div className="min-h-screen bg-background glow-prism">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {salon.logo_url && (
              <img src={salon.logo_url} alt={salon.name} className="h-10 w-10 rounded-full object-cover" />
            )}
            <div>
              <h1 className="text-lg font-semibold">{salon.name}</h1>
              <p className="text-xs text-muted-foreground">Pre-visit check-in</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Appointment summary */}
        <div className="glass-elevated rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium">{format(parseISO(appointment.start_time), "EEEE, MMMM d 'at' h:mm a")}</span>
            </div>
            {service && (
              <div className="flex items-center gap-2 text-sm">
                <Scissors className="h-4 w-4 text-primary" />
                <span>{service.name} — ${service.price}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              <span>{stylist_name}</span>
            </div>
            {salon.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{salon.address}{salon.city ? `, ${salon.city}` : ""}</span>
              </div>
            )}
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {Math.min(stepIndex + 1, STEPS.length)} of {STEPS.length}</span>
            <span>{Math.round(progressPercent)}% complete</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Step: Profile */}
        {step === "profile" && (
          <div className="glass-elevated rounded-xl p-6">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <User className="h-5 w-5 text-primary" /> Your Details
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Please review and complete your information</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" className="rounded-lg" />
              </div>

              {/* SMS opt-in — required to send any SMS. Unchecked by default per CTIA. */}
              {phone.trim().length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="sms-consent"
                      checked={smsConsent}
                      onCheckedChange={(c) => setSmsConsent(!!c)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="sms-consent" className="text-xs leading-relaxed font-normal text-muted-foreground">
                      I agree to receive transactional SMS messages from{" "}
                      <span className="text-foreground font-medium">{salon.name}</span>{" "}
                      at the number above — appointment confirmations, reminders, check-in links,
                      and changes to my booking. Message frequency varies. Msg &amp; data rates may
                      apply. Reply <span className="font-medium">STOP</span> to unsubscribe,{" "}
                      <span className="font-medium">HELP</span> for help. Consent is not a condition
                      of purchase. See our{" "}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Privacy Policy
                      </a>.
                    </Label>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-lg" />
              </div>
              <Button onClick={handleProfileSave} disabled={saving} className="w-full bg-gradient-prism text-white rounded-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === "payment" && (
          <div className="glass-elevated rounded-xl p-6">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <CreditCard className="h-5 w-5 text-champagne" /> Payment Card
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Save a card on file for your visit. You won't be charged now.</p>
            </div>
            <div className="space-y-4">
              <Button onClick={handlePaymentSetup} disabled={saving} className="w-full bg-gradient-champagne text-obsidian rounded-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Add Card via Secure Checkout
              </Button>
              <Button variant="ghost" onClick={() => setStep("policy")} className="w-full text-muted-foreground rounded-full">
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Step: Cancellation Policy */}
        {step === "policy" && (
          <div className="glass-elevated rounded-xl p-6">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <ShieldCheck className="h-5 w-5 text-primary" /> Cancellation Policy
              </h3>
            </div>
            <div className="space-y-4">
              <div className="glass-subtle rounded-lg p-4 text-sm space-y-2">
                <p className="font-medium">Please review our cancellation policy:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cancellations must be made at least <strong className="text-foreground">{cancellationHours} hours</strong> before your appointment.</li>
                  <li>Late cancellations or no-shows may result in a charge or loss of deposit.</li>
                  <li>To reschedule, please contact us at {salon.phone || "the salon"} with at least {cancellationHours} hours notice.</li>
                </ul>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="policy"
                  checked={policyAccepted}
                  onCheckedChange={(c) => setPolicyAccepted(!!c)}
                />
                <Label htmlFor="policy" className="text-sm leading-relaxed font-normal">
                  I acknowledge and accept the cancellation policy for {salon.name}.
                </Label>
              </div>
              <Button onClick={handlePolicyAccept} disabled={saving || !policyAccepted} className="w-full bg-gradient-prism text-white rounded-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Accept & Confirm
              </Button>
            </div>
          </div>
        )}

        {/* Step: AI Consultation (optional) */}
        {step === "consultation" && (
          <div className="glass-elevated rounded-xl p-6">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-lg font-medium">
                <Sparkles className="h-5 w-5 text-primary" /> You're All Set!
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Your appointment is confirmed. Want to try something new?</p>
            </div>
            <div className="space-y-4">
              <div className="glass rounded-xl border-2 border-dashed border-primary/30 p-6 text-center space-y-3">
                <Sparkles className="h-8 w-8 text-primary mx-auto" />
                <h3 className="font-medium">AI Hair Try-On</h3>
                <p className="text-sm text-muted-foreground">
                  Upload a selfie and virtually try different hairstyles before your appointment. See what looks great on you!
                </p>
                <Button
                  onClick={() => navigate(`/consultation?appointment_id=${appointmentId}&salon=${data.salon.id}`)}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4 mr-2" /> Try It Now
                </Button>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Or you can skip this and come prepared for your visit.
                </p>
                <Button variant="ghost" onClick={() => setStep("complete")}>
                  I'm done — close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Complete */}
        {step === "complete" && (
          <div className="glass-elevated rounded-xl p-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-glass-teal mx-auto" />
              <h2 className="text-xl font-medium">Check-in Complete!</h2>
              <p className="text-muted-foreground">
                You're all set for your appointment at {salon.name} on{" "}
                {format(parseISO(appointment.start_time), "EEEE, MMMM d 'at' h:mm a")}.
              </p>
              <p className="text-sm text-muted-foreground">You can close this page now.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientOnboarding;
