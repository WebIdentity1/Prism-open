import type { AppRole } from "@/hooks/useAuth";

export interface SalonResolutionState {
  salonId: string | null;
  salonResolved: boolean;
  onboardingStatus: string | null;
}

export interface SalonOnboardingRedirectInput {
  role: AppRole;
  resolvedRole: AppRole | null;
  salonResolved: boolean;
  onboardingStatus: string | null;
  pathname: string;
}

export function getPendingSalonResolutionState(role: AppRole): SalonResolutionState {
  if (role === "salon_admin" || role === "stylist") {
    return {
      salonId: null,
      salonResolved: false,
      onboardingStatus: null,
    };
  }

  return {
    salonId: null,
    salonResolved: true,
    onboardingStatus: null,
  };
}

export function shouldRedirectToSalonOnboarding({
  role,
  resolvedRole,
  salonResolved,
  onboardingStatus,
  pathname,
}: SalonOnboardingRedirectInput): boolean {
  if (!salonResolved || role !== "salon_admin") return false;
  if (resolvedRole !== role) return false;
  if (pathname.startsWith("/dashboard/onboarding")) return false;
  return onboardingStatus !== "complete";
}
