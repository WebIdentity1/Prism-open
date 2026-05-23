type EnvReader = {
  get(key: string): string | undefined | null;
};

const ENABLE_DEMO_SEEDING_KEY = "ENABLE_DEMO_SEEDING";
const DISABLED_MESSAGE =
  "Demo seeding is disabled. Set ENABLE_DEMO_SEEDING=true only in local or non-production environments.";

export function isDemoSeedingEnabled(env: EnvReader): boolean {
  return env.get(ENABLE_DEMO_SEEDING_KEY) === "true";
}

export function buildDemoSeedingDisabledResponse(headers: HeadersInit): Response {
  return new Response(JSON.stringify({ error: DISABLED_MESSAGE }), {
    status: 403,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
