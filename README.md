# Prism Salon OS

Prism Salon OS is an open-source salon operating system for owners, barbers, stylists, and independent shops. It includes booking, client management, staff calendars, onboarding forms, AI consultation, virtual try-on, payments, messaging, email campaigns, loyalty, payroll views, and an optional voice receptionist.

This repo is designed for self-hosting. There is no required hosted Prism account. Bring your own Supabase project, API keys, payment account, email/SMS provider, and deployment target.

## AI-Agent Setup Path

Most self-hosted installs should be run by an AI coding agent with the salon owner present for account authorization and paid-service decisions.

1. Give the agent this repository and point it at [docs/AI_AGENT_SETUP.md](docs/AI_AGENT_SETUP.md).
2. Have the owner authorize the tools the agent needs:
   - Supabase CLI login or a Supabase connector/plugin with access to the target organization and project.
   - Vercel CLI login, Vercel MCP, or another deployment provider integration with access to the target project/team.
   - GitHub/repository access if the agent will commit, push, or connect Vercel Git deployments.
   - Provider dashboards for Stripe, Google AI Studio/Gemini, ElevenLabs, Twilio, Resend, and Google Cloud when those integrations are enabled.
3. Let the agent do everything it can safely automate: install dependencies, create local env files, link Supabase, push migrations, upload Supabase Edge Function secrets, deploy functions, configure frontend hosting env vars, deploy the frontend, and run verification.
4. Keep the owner in the loop only for steps that require human judgment or authorization: account login, 2FA, paid plan approval, live payment mode, DNS ownership, compliance checks, and credential creation in provider dashboards.

The app also includes a first-run Infrastructure step at `/dashboard/onboarding` where an admin can paste setup values, follow provider links, and generate the Supabase/frontend env commands. Values entered there are not saved by Prism.

## What You Get

- Salon owner, stylist, and client dashboards
- Appointment booking, schedule management, forms, reminders, and client onboarding
- Stripe Checkout, payment links, saved payment methods, subscriptions, and optional Connect
- Gemini-powered AI assistant, consultation, face-shape detection, virtual try-on, and email generation
- ElevenLabs voice agent setup with secure tool callbacks
- Twilio SMS and phone-number attachment for voice workflows
- Resend transactional email
- Google Business Profile review sync and Reserve/place-action helpers
- Supabase Auth, Postgres, Storage, Row Level Security, and Edge Functions

## Tech Stack

- Vite
- React 18
- TypeScript
- React Router
- shadcn-ui/Radix
- Tailwind CSS
- Supabase
- Vitest

The supported app entrypoint is the Vite app under `src/`.

## Quick Start

For a local code check without provider setup:

```sh
npm install
cp .env.example .env
npm run setup:doctor
npm run dev
```

The local app runs at `http://localhost:8080`.

The frontend requires:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Provider integrations are optional. The app should still build without Stripe, Gemini, ElevenLabs, Twilio, Resend, or Google credentials, but those specific features need their keys to run.

Demo login and sample-data seeding are disabled by default. Enable them only for local or non-production environments with `VITE_ENABLE_DEMO_LOGIN=true` and `ENABLE_DEMO_SEEDING=true`.

## Self-Hosting

Use [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for the full setup path:

1. Create or start a Supabase project.
2. Apply database migrations.
3. Configure Supabase Auth URLs.
4. Set Edge Function secrets.
5. Deploy Edge Functions.
6. Configure Vercel or another static frontend host.
7. Configure webhooks, OAuth callback URLs, DNS, and provider dashboards.
8. Deploy the Vite frontend.

Run this any time you change credentials:

```sh
npm run setup:doctor
```

The doctor prints missing key names only. It never prints secret values.

If an AI agent or implementation consultant is setting this up for a salon owner, use [docs/AI_AGENT_SETUP.md](docs/AI_AGENT_SETUP.md). It gives the agent a detailed credential interview flow, secret handling rules, provider runbooks, validation checklist, and owner handoff template.

## Environment Variables

Start with [.env.example](.env.example). Core frontend variables are required. Everything else is grouped by provider so an owner can enable only the integrations they use.

## Scripts

```sh
npm run dev           # Start Vite on localhost:8080
npm run build         # Build production frontend
npm run preview       # Preview production build
npm run lint          # Run ESLint
npm run test          # Run Vitest
npm run setup:doctor  # Check self-hosting env readiness
```

## Open-Source License

MIT. See [LICENSE](LICENSE).

## Contributing

Issues, fixes, docs improvements, and provider setup improvements are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Security

Self-hosters are responsible for their own keys, webhook secrets, Supabase project settings, SMS compliance, payment compliance, and client data handling. See [SECURITY.md](SECURITY.md) for reporting and deployment guidance.

If you enable Twilio SMS, start from [docs/SMS_COMPLIANCE_TEMPLATE.md](docs/SMS_COMPLIANCE_TEMPLATE.md) and adapt it to your deployment before sending messages to real clients.
