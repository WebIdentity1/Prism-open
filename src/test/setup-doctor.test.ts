import { describe, expect, test } from "vitest";
import {
  buildEnvReport,
  parseEnvFile,
} from "../../scripts/setup-doctor.mjs";

describe("setup doctor env parsing", () => {
  test("parses dotenv-style content without leaking secret values", () => {
    const env = parseEnvFile(`
# comment
VITE_SUPABASE_URL=https://example.supabase.co
GEMINI_API_KEY="abc123"
EMPTY_VALUE=
`);

    expect(env).toEqual({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      GEMINI_API_KEY: "abc123",
      EMPTY_VALUE: "",
    });
  });

  test("requires only the public Supabase client vars for the frontend base app", () => {
    const report = buildEnvReport({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });

    expect(report.ready).toBe(true);
    expect(report.missingRequired).toEqual([]);
    expect(report.groups.find((group) => group.name === "Gemini AI")?.enabled).toBe(false);
    expect(report.groups.find((group) => group.name === "Supabase Edge Functions")?.enabled).toBe(false);
    expect(report.groups.find((group) => group.name === "Demo Mode")?.enabled).toBe(false);
  });

  test("marks optional provider groups enabled only when every group key is present", () => {
    const report = buildEnvReport({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      GEMINI_API_KEY: "gemini-key",
      STRIPE_SECRET_KEY: "stripe-key",
    });

    expect(report.ready).toBe(true);
    expect(report.groups.find((group) => group.name === "Gemini AI")?.enabled).toBe(true);
    expect(report.groups.find((group) => group.name === "Stripe Payments")?.enabled).toBe(false);
    expect(report.groups.find((group) => group.name === "Stripe Payments")?.missing).toEqual([
      "STRIPE_WEBHOOK_SECRET",
    ]);
  });

  test("reports demo mode as enabled only when both client and server flags are present", () => {
    const report = buildEnvReport({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      VITE_ENABLE_DEMO_LOGIN: "false",
      ENABLE_DEMO_SEEDING: "false",
    });

    expect(report.groups.find((group) => group.name === "Demo Mode")?.enabled).toBe(false);
    expect(report.groups.find((group) => group.name === "Demo Mode")?.missing).toEqual([
      "VITE_ENABLE_DEMO_LOGIN",
      "ENABLE_DEMO_SEEDING",
    ]);

    const partiallyEnabledReport = buildEnvReport({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      VITE_ENABLE_DEMO_LOGIN: "true",
    });

    expect(partiallyEnabledReport.groups.find((group) => group.name === "Demo Mode")?.enabled).toBe(false);
    expect(partiallyEnabledReport.groups.find((group) => group.name === "Demo Mode")?.missing).toEqual([
      "ENABLE_DEMO_SEEDING",
    ]);

    const enabledReport = buildEnvReport({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      VITE_ENABLE_DEMO_LOGIN: "true",
      ENABLE_DEMO_SEEDING: "true",
    });

    expect(enabledReport.groups.find((group) => group.name === "Demo Mode")?.enabled).toBe(true);
  });
});
