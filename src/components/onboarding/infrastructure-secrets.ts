export type SecretInstallTarget = "supabase" | "frontend";

export interface InfrastructureSecretVariable {
  name: string;
  label: string;
  description: string;
  targets: SecretInstallTarget[];
  required: boolean;
  sensitive: boolean;
  placeholder?: string;
}

export interface InfrastructureSecretProvider {
  id: string;
  name: string;
  summary: string;
  required: boolean;
  docsUrl: string;
  consoleUrl?: string;
  instructions: string[];
  variables: InfrastructureSecretVariable[];
}

export type InfrastructureSecretValues = Record<string, string>;

export const INFRASTRUCTURE_SECRET_PROVIDERS: InfrastructureSecretProvider[] = [
  {
    id: "supabase",
    name: "Supabase",
    summary: "Connects the frontend and Edge Functions to the salon database and auth project.",
    required: true,
    docsUrl: "https://supabase.com/docs/guides/functions/secrets",
    consoleUrl: "https://supabase.com/dashboard/projects",
    instructions: [
      "Open your Supabase project dashboard.",
      "Copy the project URL and publishable/anon key from Project Settings > API.",
      "Use the service role key only for Edge Functions. Never expose it in browser-facing env.",
    ],
    variables: [
      {
        name: "VITE_SUPABASE_URL",
        label: "Frontend Supabase URL",
        description: "Used by the browser app to connect to Supabase.",
        targets: ["frontend"],
        required: true,
        sensitive: false,
        placeholder: "https://your-project.supabase.co",
      },
      {
        name: "VITE_SUPABASE_PUBLISHABLE_KEY",
        label: "Frontend publishable key",
        description: "The browser-safe Supabase publishable or anon key.",
        targets: ["frontend"],
        required: true,
        sensitive: false,
        placeholder: "sb_publishable_...",
      },
      {
        name: "SUPABASE_URL",
        label: "Edge Function Supabase URL",
        description: "Used by Edge Functions for server-side Supabase clients.",
        targets: ["supabase"],
        required: true,
        sensitive: false,
        placeholder: "https://your-project.supabase.co",
      },
      {
        name: "SUPABASE_ANON_KEY",
        label: "Edge Function anon key",
        description: "Used by Edge Functions that validate user JWTs.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "eyJ...",
      },
      {
        name: "SUPABASE_PUBLISHABLE_KEY",
        label: "Edge Function publishable key",
        description: "Optional alias for newer Supabase publishable-key based integrations.",
        targets: ["supabase"],
        required: false,
        sensitive: true,
        placeholder: "sb_publishable_...",
      },
      {
        name: "SUPABASE_SERVICE_ROLE_KEY",
        label: "Service role key",
        description: "Server-only key for privileged database and auth admin operations.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "eyJ...",
      },
    ],
  },
  {
    id: "site",
    name: "Public Site URL",
    summary: "Gives emails, Stripe redirects, SMS links, and onboarding links the correct public base URL.",
    required: true,
    docsUrl: "https://supabase.com/docs/guides/functions/secrets",
    instructions: [
      "Use the final public URL where salon owners and clients will access this app.",
      "For local testing, use http://localhost:8080 or your tunnel URL.",
      "Set both names unless your deployment has standardized on one.",
    ],
    variables: [
      {
        name: "PUBLIC_SITE_URL",
        label: "Public site URL",
        description: "Used by Edge Functions for checkout, portal, and onboarding redirect URLs.",
        targets: ["supabase"],
        required: true,
        sensitive: false,
        placeholder: "https://your-domain.com",
      },
      {
        name: "SITE_URL",
        label: "Fallback site URL",
        description: "Fallback URL used by SMS and older integrations.",
        targets: ["supabase"],
        required: true,
        sensitive: false,
        placeholder: "https://your-domain.com",
      },
      {
        name: "VITE_SITE_URL",
        label: "Frontend site URL",
        description: "Optional browser-facing URL for self-hosted deployments.",
        targets: ["frontend"],
        required: false,
        sensitive: false,
        placeholder: "https://your-domain.com",
      },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    summary: "Powers the AI assistant, virtual try-on, face shape analysis, style generation, and email drafting.",
    required: true,
    docsUrl: "https://ai.google.dev/gemini-api/docs/api-key",
    consoleUrl: "https://aistudio.google.com/app/apikey",
    instructions: [
      "Create or select a Google AI Studio API key.",
      "Enable billing and set usage limits before production.",
      "Use this key only as an Edge Function secret, never in frontend env.",
    ],
    variables: [
      {
        name: "GEMINI_API_KEY",
        label: "Gemini API key",
        description: "Server-side key used for Gemini text and image models.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "AIza...",
      },
      {
        name: "AI_TRYON_TIER",
        label: "AI try-on tier",
        description: "Optional model quality tier for try-on flows.",
        targets: ["supabase"],
        required: false,
        sensitive: false,
        placeholder: "standard",
      },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    summary: "Enables Checkout, saved cards, post-service payment links, customer portal, subscriptions, and Connect onboarding.",
    required: true,
    docsUrl: "https://docs.stripe.com/keys",
    consoleUrl: "https://dashboard.stripe.com/apikeys",
    instructions: [
      "Copy the secret key from Stripe Developers > API keys.",
      "Create a webhook endpoint for /functions/v1/stripe-webhook and copy its signing secret.",
      "Use test mode keys while verifying a new self-hosted install.",
    ],
    variables: [
      {
        name: "STRIPE_SECRET_KEY",
        label: "Stripe secret key",
        description: "Server-side key for Checkout, PaymentIntents, Customer Portal, and Connect.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "sk_test_...",
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        label: "Stripe webhook signing secret",
        description: "Used to verify Stripe webhook requests.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "whsec_...",
      },
    ],
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    summary: "Enables voice previews and AI receptionist setup.",
    required: true,
    docsUrl: "https://elevenlabs.io/docs/api-reference/authentication",
    consoleUrl: "https://elevenlabs.io/app/settings/api-keys",
    instructions: [
      "Create an API key in ElevenLabs settings.",
      "Generate a long random voice agent secret for webhook/tool authentication.",
      "Store both as Edge Function secrets.",
    ],
    variables: [
      {
        name: "ELEVENLABS_API_KEY",
        label: "ElevenLabs API key",
        description: "Server-side key for voice preview and agent management.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "sk_...",
      },
      {
        name: "VOICE_AGENT_SECRET",
        label: "Voice agent shared secret",
        description: "Random secret used to authenticate voice webhooks and tools.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "generate-a-long-random-value",
      },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    summary: "Sends appointment onboarding links, transactional SMS, and attaches phone numbers to voice agents.",
    required: true,
    docsUrl: "https://help.twilio.com/articles/223136027",
    consoleUrl: "https://console.twilio.com/",
    instructions: [
      "Copy the Account SID and Auth Token from the Twilio Console dashboard.",
      "Buy or select a Twilio phone number that can send SMS.",
      "Use E.164 format for the phone number, for example +15551234567.",
    ],
    variables: [
      {
        name: "TWILIO_ACCOUNT_SID",
        label: "Twilio Account SID",
        description: "Identifies the Twilio account used for SMS and voice setup.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "AC...",
      },
      {
        name: "TWILIO_AUTH_TOKEN",
        label: "Twilio Auth Token",
        description: "Authenticates Twilio API requests.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "auth token",
      },
      {
        name: "TWILIO_PHONE_NUMBER",
        label: "Twilio phone number",
        description: "Default sender number for SMS.",
        targets: ["supabase"],
        required: true,
        sensitive: false,
        placeholder: "+15551234567",
      },
    ],
  },
  {
    id: "resend",
    name: "Resend",
    summary: "Sends booking confirmations, cancellations, staff invites, and transactional emails.",
    required: true,
    docsUrl: "https://resend.com/docs/dashboard/api-keys/introduction",
    consoleUrl: "https://resend.com/api-keys",
    instructions: [
      "Create a Resend API key with permission to send emails.",
      "Verify a sending domain before production.",
      "Set EMAIL_FROM to a sender address on that verified domain.",
    ],
    variables: [
      {
        name: "RESEND_API_KEY",
        label: "Resend API key",
        description: "Server-side key for transactional email.",
        targets: ["supabase"],
        required: true,
        sensitive: true,
        placeholder: "re_...",
      },
      {
        name: "EMAIL_FROM",
        label: "Sender email",
        description: "Verified sender used in outbound email.",
        targets: ["supabase"],
        required: true,
        sensitive: false,
        placeholder: "Your Salon <hello@your-domain.com>",
      },
    ],
  },
  {
    id: "google-business-profile",
    name: "Google Business Profile",
    summary: "Optional review sync and Google Business Profile OAuth connection.",
    required: false,
    docsUrl: "https://developers.google.com/my-business/content/implement-oauth",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    instructions: [
      "Create a Google Cloud project and enable the Business Profile APIs.",
      "Configure the OAuth consent screen.",
      "Create an OAuth client and copy its client ID and client secret.",
    ],
    variables: [
      {
        name: "GOOGLE_BP_CLIENT_ID",
        label: "Google OAuth client ID",
        description: "OAuth client ID for Google Business Profile connection.",
        targets: ["supabase"],
        required: false,
        sensitive: false,
        placeholder: "client-id.apps.googleusercontent.com",
      },
      {
        name: "GOOGLE_BP_CLIENT_SECRET",
        label: "Google OAuth client secret",
        description: "OAuth client secret for Google Business Profile token exchange.",
        targets: ["supabase"],
        required: false,
        sensitive: true,
        placeholder: "GOCSPX-...",
      },
    ],
  },
  {
    id: "demo-mode",
    name: "Demo Mode",
    summary: "Optional local-only demo login and demo data seeding for evaluation installs.",
    required: false,
    docsUrl: "https://supabase.com/docs/guides/functions/secrets",
    instructions: [
      "Leave disabled for production.",
      "Use only for local demos or disposable preview environments.",
      "Set both values to true when you intentionally want demo login and seeding enabled.",
    ],
    variables: [
      {
        name: "VITE_ENABLE_DEMO_LOGIN",
        label: "Frontend demo login flag",
        description: "Shows demo login affordances in the browser app.",
        targets: ["frontend"],
        required: false,
        sensitive: false,
        placeholder: "false",
      },
      {
        name: "ENABLE_DEMO_SEEDING",
        label: "Edge demo seeding flag",
        description: "Allows the seed-demo-data Edge Function to create demo records.",
        targets: ["supabase"],
        required: false,
        sensitive: false,
        placeholder: "false",
      },
    ],
  },
];

export function getAllInfrastructureVariables(): InfrastructureSecretVariable[] {
  return INFRASTRUCTURE_SECRET_PROVIDERS.flatMap((provider) => provider.variables);
}

export function getRequiredInfrastructureVariableNames(): string[] {
  return getAllInfrastructureVariables()
    .filter((variable) => variable.required)
    .map((variable) => variable.name);
}

export function getProviderCompletion(provider: InfrastructureSecretProvider, values: InfrastructureSecretValues) {
  const requiredVariables = provider.variables.filter((variable) => variable.required);
  const completedRequired = requiredVariables.filter((variable) => values[variable.name]?.trim()).length;

  return {
    completedRequired,
    totalRequired: requiredVariables.length,
    complete: requiredVariables.length === 0 || completedRequired === requiredVariables.length,
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function envQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function getVariablesForTarget(target: SecretInstallTarget, values: InfrastructureSecretValues) {
  return getAllInfrastructureVariables()
    .filter((variable) => variable.targets.includes(target))
    .filter((variable) => values[variable.name]?.trim())
    .map((variable) => ({
      name: variable.name,
      value: values[variable.name].trim(),
    }));
}

export function buildSupabaseSecretsCommand(values: InfrastructureSecretValues): string {
  const variables = getVariablesForTarget("supabase", values);

  if (variables.length === 0) {
    return "supabase secrets set # enter at least one Edge Function secret above";
  }

  return [
    "supabase secrets set \\",
    ...variables.map((variable, index) => {
      const suffix = index === variables.length - 1 ? "" : " \\";
      return `  ${variable.name}=${shellQuote(variable.value)}${suffix}`;
    }),
  ].join("\n");
}

export function buildFrontendEnvBlock(values: InfrastructureSecretValues): string {
  const variables = getVariablesForTarget("frontend", values);

  if (variables.length === 0) {
    return "# Enter frontend values above to generate a .env block";
  }

  return variables.map((variable) => `${variable.name}=${envQuote(variable.value)}`).join("\n");
}
