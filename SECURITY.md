# Security Policy

## Supported Versions

This project is early-stage open source. Security fixes should target the default branch unless maintainers document a release branch.

## Reporting a Vulnerability

Please do not open a public issue for suspected vulnerabilities involving authentication, RLS policy bypass, payment handling, message delivery, provider credentials, webhook verification, or client data exposure.

Report privately to the repository maintainers. Include:

- Affected feature or route
- Steps to reproduce
- Expected and actual impact
- Whether provider credentials, payment data, SMS/email delivery, or client records are involved

## Self-Hosting Responsibilities

Self-hosters control their own infrastructure and credentials. Before using this with real clients:

- Rotate any keys that may have been exposed.
- Use separate development and production Supabase projects.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Verify Supabase Auth redirect URLs and site URLs.
- Configure Stripe webhook signing with `STRIPE_WEBHOOK_SECRET`.
- Configure `VOICE_AGENT_SECRET` before exposing voice-agent tools.
- Keep demo login and demo seeding disabled in production. Demo mode creates known-password accounts and is intended only for local sandboxes.
- Review every public Edge Function and Row Level Security policy for your deployment.
- Confirm SMS consent, STOP/HELP handling, payment, tax, privacy, and data-retention requirements for your jurisdiction.

## Secrets

Never commit:

- `.env` or `.env.local`
- Supabase service-role keys
- Stripe secret or webhook keys
- Twilio auth tokens
- ElevenLabs API keys
- Gemini API keys
- Resend API keys
- Google OAuth client secrets
