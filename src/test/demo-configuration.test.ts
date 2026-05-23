import { describe, expect, test } from "vitest";
import { isDemoLoginEnabled } from "../lib/demo-login";
import {
  buildDemoSeedingDisabledResponse,
  isDemoSeedingEnabled,
} from "../../supabase/functions/_shared/demo-seeding";

describe("demo configuration", () => {
  test("keeps frontend demo login disabled unless explicitly enabled", () => {
    expect(isDemoLoginEnabled({})).toBe(false);
    expect(isDemoLoginEnabled({ VITE_ENABLE_DEMO_LOGIN: "false" })).toBe(false);
    expect(isDemoLoginEnabled({ VITE_ENABLE_DEMO_LOGIN: "TRUE" })).toBe(false);
    expect(isDemoLoginEnabled({ VITE_ENABLE_DEMO_LOGIN: "true" })).toBe(true);
  });

  test("keeps demo seeding disabled unless explicitly enabled", () => {
    expect(isDemoSeedingEnabled({ get: () => undefined })).toBe(false);
    expect(isDemoSeedingEnabled({ get: () => "false" })).toBe(false);
    expect(isDemoSeedingEnabled({ get: () => "TRUE" })).toBe(false);
    expect(isDemoSeedingEnabled({ get: () => "true" })).toBe(true);
  });

  test("returns a 403 response when demo seeding is disabled", async () => {
    const response = buildDemoSeedingDisabledResponse({
      "Access-Control-Allow-Origin": "*",
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      error:
        "Demo seeding is disabled. Set ENABLE_DEMO_SEEDING=true only in local or non-production environments.",
    });
  });
});
