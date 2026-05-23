import { describe, expect, test } from "vitest";
import {
  INFRASTRUCTURE_SECRET_PROVIDERS,
  buildFrontendEnvBlock,
  buildSupabaseSecretsCommand,
  getProviderCompletion,
  getRequiredInfrastructureVariableNames,
} from "@/components/onboarding/infrastructure-secrets";

describe("infrastructure onboarding secrets", () => {
  test("includes every required provider secret even when a current deployment is missing it", () => {
    expect(getRequiredInfrastructureVariableNames()).toEqual(
      expect.arrayContaining([
        "GEMINI_API_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "ELEVENLABS_API_KEY",
        "VOICE_AGENT_SECRET",
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_PHONE_NUMBER",
        "RESEND_API_KEY",
        "EMAIL_FROM",
        "PUBLIC_SITE_URL",
        "SITE_URL",
      ]),
    );

    const googleBusinessProfile = INFRASTRUCTURE_SECRET_PROVIDERS.find(
      (provider) => provider.id === "google-business-profile",
    );
    expect(googleBusinessProfile?.variables.map((variable) => variable.name)).toEqual([
      "GOOGLE_BP_CLIENT_ID",
      "GOOGLE_BP_CLIENT_SECRET",
    ]);
  });

  test("builds a Supabase secrets command with only entered Edge Function secrets", () => {
    expect(
      buildSupabaseSecretsCommand({
        GEMINI_API_KEY: "AIza_test",
        STRIPE_SECRET_KEY: "sk_test_value",
        VITE_SUPABASE_URL: "https://browser-only.example",
        ELEVENLABS_API_KEY: "",
      }),
    ).toBe("supabase secrets set \\\n  GEMINI_API_KEY='AIza_test' \\\n  STRIPE_SECRET_KEY='sk_test_value'");
  });

  test("shell-quotes Supabase secret values safely", () => {
    expect(buildSupabaseSecretsCommand({ VOICE_AGENT_SECRET: "one'two" })).toContain(
      "VOICE_AGENT_SECRET='one'\\''two'",
    );
  });

  test("builds a frontend env block with only entered browser-facing variables", () => {
    expect(
      buildFrontendEnvBlock({
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_"quoted"',
        SUPABASE_SERVICE_ROLE_KEY: "server-only",
      }),
    ).toBe(
      'VITE_SUPABASE_URL="https://example.supabase.co"\nVITE_SUPABASE_PUBLISHABLE_KEY="sb_\\"quoted\\""',
    );
  });

  test("reports required provider completion", () => {
    const stripe = INFRASTRUCTURE_SECRET_PROVIDERS.find((provider) => provider.id === "stripe")!;

    expect(getProviderCompletion(stripe, { STRIPE_SECRET_KEY: "sk_test" })).toEqual({
      completedRequired: 1,
      totalRequired: 2,
      complete: false,
    });

    expect(
      getProviderCompletion(stripe, {
        STRIPE_SECRET_KEY: "sk_test",
        STRIPE_WEBHOOK_SECRET: "whsec_test",
      }).complete,
    ).toBe(true);
  });
});
