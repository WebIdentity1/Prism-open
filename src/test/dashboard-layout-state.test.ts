import { describe, expect, test } from "vitest";
import {
  getPendingSalonResolutionState,
  shouldRedirectToSalonOnboarding,
} from "@/components/dashboard/dashboard-layout-state";

describe("dashboard layout salon resolution", () => {
  test("marks salon admin resolution pending while salon lookup is in flight", () => {
    expect(getPendingSalonResolutionState("salon_admin")).toEqual({
      salonId: null,
      salonResolved: false,
      onboardingStatus: null,
    });
  });

  test("does not redirect salon admins while salon lookup is unresolved", () => {
    expect(
      shouldRedirectToSalonOnboarding({
        role: "salon_admin",
        resolvedRole: "salon_admin",
        salonResolved: false,
        onboardingStatus: null,
        pathname: "/dashboard",
      }),
    ).toBe(false);
  });

  test("does not redirect salon admins using stale resolution from a previous role", () => {
    expect(
      shouldRedirectToSalonOnboarding({
        role: "salon_admin",
        resolvedRole: "client",
        salonResolved: true,
        onboardingStatus: null,
        pathname: "/dashboard",
      }),
    ).toBe(false);
  });

  test("redirects incomplete salon admins after salon lookup resolves", () => {
    expect(
      shouldRedirectToSalonOnboarding({
        role: "salon_admin",
        resolvedRole: "salon_admin",
        salonResolved: true,
        onboardingStatus: "pending",
        pathname: "/dashboard",
      }),
    ).toBe(true);
  });
});
