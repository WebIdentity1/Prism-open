import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { AiAssistant } from "./AiAssistant";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";
import {
  getPendingSalonResolutionState,
  shouldRedirectToSalonOnboarding,
} from "./dashboard-layout-state";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonResolved, setSalonResolved] = useState(false);
  const [resolvedRole, setResolvedRole] = useState<AppRole | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const pendingState = getPendingSalonResolutionState(role);

    setSalonId(pendingState.salonId);
    setSalonResolved(pendingState.salonResolved);
    setResolvedRole(pendingState.salonResolved ? role : null);
    setOnboardingStatus(pendingState.onboardingStatus);

    if (pendingState.salonResolved) return;

    const resolve = async () => {
      if (role === "salon_admin") {
        const { data } = await supabase
          .from("salons")
          .select("id, onboarding_status")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setSalonId(data?.id || null);
        setOnboardingStatus((data?.onboarding_status as string | null) ?? null);
      } else if (role === "stylist") {
        const { data } = await supabase
          .from("stylist_profiles")
          .select("salon_id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setSalonId(data?.salon_id || null);
      }
      if (!cancelled) {
        setSalonResolved(true);
        setResolvedRole(role);
      }
    };
    resolve();
    return () => {
      cancelled = true;
    };
  }, [user, role]);

  useEffect(() => {
    if (shouldRedirectToSalonOnboarding({
      role,
      resolvedRole,
      salonResolved,
      onboardingStatus,
      pathname: location.pathname,
    })) {
      navigate("/dashboard/onboarding", { replace: true });
    }
  }, [salonResolved, resolvedRole, role, onboardingStatus, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const userName = user.user_metadata?.full_name || user.email || "User";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background dark:bg-obsidian">
        <AppSidebar role={role} userName={userName} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center glass-subtle border-b border-border/50 px-4 shrink-0 backdrop-blur-md">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            {user && <NotificationBell userId={user.id} />}
          </header>
          <main className="flex-1 overflow-auto p-8">
            <div className="animate-in">
              {children}
            </div>
          </main>
        </div>
      </div>
      {(role === "salon_admin" || role === "stylist") && (
        <AiAssistant salonId={salonId} userName={userName} />
      )}
    </SidebarProvider>
  );
}
