import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const REQUIRED_ENV = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

export const PROVIDER_GROUPS = [
  {
    name: "Supabase Edge Functions",
    keys: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    note: "Required to deploy and run Edge Functions locally.",
  },
  {
    name: "Gemini AI",
    keys: ["GEMINI_API_KEY"],
    note: "Enables AI assistant, virtual try-on, face analysis, image generation, and email generation.",
  },
  {
    name: "Stripe Payments",
    keys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    note: "Enables checkout, saved cards, subscriptions, payment links, and Connect webhooks.",
  },
  {
    name: "ElevenLabs Voice",
    keys: ["ELEVENLABS_API_KEY", "VOICE_AGENT_SECRET"],
    note: "Enables voice previews, receptionist setup, and secure voice tool callbacks.",
  },
  {
    name: "Twilio SMS/Phone",
    keys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"],
    note: "Enables SMS delivery and direct Twilio phone-number attachment for voice agents.",
  },
  {
    name: "Resend Email",
    keys: ["RESEND_API_KEY", "EMAIL_FROM"],
    note: "Enables transactional email delivery.",
  },
  {
    name: "Demo Mode",
    keys: ["VITE_ENABLE_DEMO_LOGIN", "ENABLE_DEMO_SEEDING"],
    trueValueKeys: ["VITE_ENABLE_DEMO_LOGIN", "ENABLE_DEMO_SEEDING"],
    note: "Optional local/non-production demo login and sample-data seeding. Leave disabled in production.",
  },
  {
    name: "Google Business Profile",
    keys: ["GOOGLE_BP_CLIENT_ID", "GOOGLE_BP_CLIENT_SECRET"],
    note: "Enables Google Business Profile OAuth, review sync, and Reserve/place-action sync.",
  },
];

export function parseEnvFile(content) {
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) env[key] = value;
  }

  return env;
}

export function loadEnvFiles(rootDir = process.cwd()) {
  const env = {};
  const files = [".env", ".env.local"];

  for (const file of files) {
    const filePath = path.join(rootDir, file);
    if (!fs.existsSync(filePath)) continue;
    Object.assign(env, parseEnvFile(fs.readFileSync(filePath, "utf8")));
  }

  return { ...env, ...process.env };
}

function missingKeys(env, keys) {
  return keys.filter((key) => !env[key]);
}

function missingGroupKeys(env, group) {
  const trueValueKeys = new Set(group.trueValueKeys || []);
  return group.keys.filter((key) => {
    if (trueValueKeys.has(key)) return env[key] !== "true";
    return !env[key];
  });
}

export function buildEnvReport(env) {
  const missingRequired = missingKeys(env, REQUIRED_ENV);

  const groups = PROVIDER_GROUPS.map((group) => {
    const missing = missingGroupKeys(env, group);
    return {
      ...group,
      enabled: missing.length === 0,
      missing,
    };
  });

  return {
    ready: missingRequired.length === 0,
    required: REQUIRED_ENV,
    missingRequired,
    groups,
  };
}

function statusLabel(enabled) {
  return enabled ? "enabled" : "disabled";
}

export function formatEnvReport(report) {
  const lines = [];
  lines.push("Prism self-hosting setup doctor");
  lines.push("");

  if (report.ready) {
    lines.push("Core frontend env: ready");
  } else {
    lines.push(`Core frontend env: missing ${report.missingRequired.join(", ")}`);
  }

  lines.push("");
  lines.push("Optional provider groups:");
  for (const group of report.groups) {
    const missing = group.missing.length > 0 ? ` (missing: ${group.missing.join(", ")})` : "";
    lines.push(`- ${group.name}: ${statusLabel(group.enabled)}${missing}`);
    lines.push(`  ${group.note}`);
  }

  lines.push("");
  lines.push("No secret values are printed by this check.");
  return lines.join("\n");
}

function main() {
  const report = buildEnvReport(loadEnvFiles());
  console.log(formatEnvReport(report));
  process.exit(report.ready ? 0 : 1);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main();
}
