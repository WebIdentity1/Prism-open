import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Check, Building2, Scissors, Users, Upload, CreditCard, Rocket, ServerCog } from "lucide-react";
import { cn } from "@/lib/utils";
import OnboardingStepInfrastructure from "@/components/onboarding/OnboardingStepInfrastructure";
import OnboardingStepInfo from "@/components/onboarding/OnboardingStepInfo";
import OnboardingStepServices from "@/components/onboarding/OnboardingStepServices";
import OnboardingStepStaff from "@/components/onboarding/OnboardingStepStaff";
import OnboardingStepClients from "@/components/onboarding/OnboardingStepClients";
import OnboardingStepPayments from "@/components/onboarding/OnboardingStepPayments";
import OnboardingStepReview from "@/components/onboarding/OnboardingStepReview";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS = [
  { key: "infrastructure", label: "Infrastructure", icon: ServerCog },
  { key: "info", label: "Salon Info", icon: Building2 },
  { key: "services", label: "Services", icon: Scissors },
  { key: "staff", label: "Staff", icon: Users },
  { key: "clients", label: "Import Clients", icon: Upload },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "review", label: "Go Live", icon: Rocket },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const stepIndex = (key: string) => STEPS.findIndex((s) => s.key === key);

const SalonOnboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [salon, setSalon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<StepKey>("infrastructure");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("salons")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSalon(data);
          // Resume from last saved step
          const saved = data.onboarding_status as string;
          if (saved && saved !== "pending" && saved !== "complete") {
            setCurrentStep(saved as StepKey);
          }
        }
        setLoading(false);
      });
  }, [user]);

  const updateStep = async (nextStep: StepKey) => {
    if (salon) {
      await supabase.from("salons").update({ onboarding_status: nextStep }).eq("id", salon.id);
    }
    setCurrentStep(nextStep);
  };

  const handleNext = () => {
    const idx = stepIndex(currentStep);
    if (idx < STEPS.length - 1) {
      updateStep(STEPS[idx + 1].key);
    }
  };

  const handleBack = () => {
    const idx = stepIndex(currentStep);
    if (idx > 0) {
      updateStep(STEPS[idx - 1].key);
    }
  };

  const handleComplete = async () => {
    if (salon) {
      await supabase.from("salons").update({ onboarding_status: "complete" }).eq("id", salon.id);
    }
    navigate("/dashboard");
  };

  const handleSalonCreated = (newSalon: any) => {
    setSalon(newSalon);
  };

  if (loading) return <div className="max-w-3xl mx-auto py-12"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-96 w-full" /></div>;

  const activeIdx = stepIndex(currentStep);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-light tracking-tight mb-1">
        Set Up Your Salon
      </h1>
      <p className="text-muted-foreground mb-8">Complete each step to get your salon live on the platform.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-10 overflow-x-auto pb-2">
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <div key={step.key} className="flex items-center gap-1">
              <button
                onClick={() => i <= activeIdx && setCurrentStep(step.key)}
                disabled={i > activeIdx}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all duration-300 whitespace-nowrap",
                  done && "glass-subtle text-glass-teal cursor-pointer",
                  active && "bg-gradient-prism text-white shadow-lg",
                  !done && !active && "glass-subtle text-muted-foreground cursor-not-allowed"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className={cn("w-6 h-px", done ? "bg-primary" : "bg-border")} />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {currentStep === "infrastructure" && (
        <OnboardingStepInfrastructure onNext={handleNext} />
      )}
      {currentStep === "info" && (
        <OnboardingStepInfo salon={salon} user={user!} onNext={handleNext} onSalonCreated={handleSalonCreated} />
      )}
      {currentStep === "services" && salon && (
        <OnboardingStepServices salonId={salon.id} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === "staff" && salon && (
        <OnboardingStepStaff salonId={salon.id} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === "clients" && salon && (
        <OnboardingStepClients salonId={salon.id} onNext={handleNext} onBack={handleBack} />
      )}
      {currentStep === "payments" && salon && (
        <OnboardingStepPayments salon={salon} onNext={handleNext} onBack={handleBack} onSalonUpdate={setSalon} />
      )}
      {currentStep === "review" && salon && (
        <OnboardingStepReview salonId={salon.id} onBack={handleBack} onComplete={handleComplete} />
      )}
    </div>
  );
};

export default SalonOnboarding;
