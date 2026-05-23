# AI Agent Setup Guide for Prism Salon OS

This guide is written for AI coding agents, implementation consultants, and technical assistants setting up Prism Salon OS for a salon owner.

The expected setup model is:

1. The salon owner brings their own accounts, credentials, domain, and infrastructure.
2. The AI agent guides them through creating or locating each credential.
3. The AI agent applies configuration without exposing secret values in logs, commits, screenshots, or chat transcripts.
4. The AI agent validates the setup feature by feature before handing the deployment back to the owner.

Use this guide together with:

- [Self-hosting guide](./SELF_HOSTING.md)
- [Environment example](../.env.example)
- [Security policy](../SECURITY.md)
- [Contributing guide](../CONTRIBUTING.md)

## Agent Access And Authorization Checklist

Do this before collecting provider secrets. The goal is to give the agent enough authenticated access to finish setup without repeatedly interrupting the owner.

Ask the owner to authorize or confirm:

| Area | Preferred access | What the agent should verify | Human-only moments |
| --- | --- | --- | --- |
| Repository | GitHub app/connector, GitHub CLI, or local write access | `git status`, default branch, remote URL, ability to push if requested | Approving repo permissions, choosing public/private visibility |
| Supabase | Supabase CLI login and, when available, a Supabase agent connector/plugin scoped to the target org/project | `supabase projects list`, selected project ref, `supabase link --project-ref <ref>` | Browser login, 2FA, project creation, billing plan approval |
| Vercel | Vercel CLI login, Vercel MCP, or deployment-provider connector scoped to the target team/project | `vercel whoami`, `vercel link`, project/team scope, env var access | Browser login, 2FA, team selection, paid plan/domain approval |
| Domain/DNS | Registrar/DNS dashboard access or owner screenshare | Final hostname, DNS records needed by Vercel or another host | Buying domains, changing production DNS |
| Provider dashboards | Owner access to Stripe, Google AI Studio/Gemini, ElevenLabs, Twilio, Resend, and Google Cloud as needed | Key names, webhook URLs, OAuth redirect URLs, feature enablement status | Creating accounts, accepting terms, enabling billing, live mode approval |

If the agent platform supports connectors or plugins, ask the owner to install and authorize them first. Prefer scoped, revocable access. If a connector cannot perform migrations, deploy functions, or set secrets, fall back to the CLI path.

Use this owner-facing prompt:

```text
Before I configure Prism, please authorize the setup tools so I can do the mechanical work without asking for every click:

1. Supabase: log in to the CLI or authorize the Supabase connector for the project/org.
2. Vercel: log in to the CLI, authorize Vercel MCP/connector, or give me deployment-provider access.
3. GitHub: authorize repo access if you want me to push or connect Git deployments.
4. Provider dashboards: be ready to approve billing, 2FA, OAuth consent, DNS, and live payment/SMS decisions.

I will not print, commit, or repeat secret values. I will stop only when a provider requires human login, payment approval, legal/compliance judgment, or a credential that must be created in a dashboard.
```

## Agent Operating Rules

Treat credentials as production secrets even during a local demo.

- Never commit `.env`, `.env.local`, provider keys, service-role keys, webhook secrets, access tokens, or OAuth client secrets.
- Never print full secrets back to the user.
- Never include secrets in issue comments, pull requests, terminal summaries, screenshots, browser-visible pages, or final answers.
- Prefer provider dashboards, password managers, secret managers, or local `.env` files over chat messages for credential transfer.
- If the user pastes a secret into chat, do not repeat it. Move it immediately into the correct local secret store, then tell the user to rotate it if the chat is not private or durable access is unclear.
- Use separate development and production provider projects whenever possible.
- Ask the user before enabling paid services that can incur usage charges, especially Gemini image generation, Stripe live mode, Twilio SMS/phone, ElevenLabs voice, and paid Supabase projects.
- Leave demo login and demo seeding disabled in production.
- Default to automation after access is granted. Do not ask the owner to run commands the agent can run safely.
- When a command can mutate production data, deploy a live environment, charge money, send messages, change DNS, or enable public access, explain the action and get explicit owner approval first.
- If an official provider dashboard changes, use the official docs linked at the end of this file and guide the owner through the current UI rather than guessing from memory.

When you need the user to provide a secret, use this wording:

```text
I need your <provider> <credential name>. Please paste it into your local password manager or into the secure terminal prompt I open. I will not print it back, commit it, or store it anywhere except the deployment secret store.
```

When running commands, avoid this pattern because it may persist secrets in shell history:

```sh
supabase secrets set STRIPE_SECRET_KEY=<actual-secret-value>
```

Prefer one of these safer patterns:

```sh
# Option A: user-maintained local env file, never committed
supabase secrets set --env-file .env.supabase.production
```

```sh
# Option B: hidden terminal prompt for a single value
read -rsp "STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
printf "\n"
supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
unset STRIPE_SECRET_KEY
```

Add `.env.supabase.production` and similar files to `.gitignore` if they are not already ignored by a broad `.env*` rule.

## Setup Outcomes

At the end of a production setup, the owner should have:

- A deployed frontend URL, for example `https://booking.example-salon.com`.
- A Supabase project with migrations applied.
- Supabase Auth URL configuration pointing to the frontend.
- Supabase Edge Functions deployed.
- Required Supabase Edge Function secrets set.
- Optional provider credentials set only for enabled features.
- Stripe webhooks configured if payments are enabled.
- Google OAuth redirect URI configured if Google Business Profile is enabled.
- Email sender domain verified if Resend email is enabled.
- SMS and phone compliance reviewed if Twilio is enabled.
- A private deployment handoff note listing which providers are enabled, which keys were set by name, and what was intentionally skipped. The note must not contain secret values.

## First Conversation With The Owner

Start with scope, not credentials. Ask:

```text
Which setup do you want?
1. Local demo only
2. Production self-hosted deployment
3. Both local demo and production
```

Then ask:

```text
Which features do you want enabled on day one?
- Core booking and dashboards
- AI consultation and virtual try-on with Gemini
- Stripe payments
- ElevenLabs voice receptionist
- Twilio SMS and phone workflows
- Resend transactional email
- Google Business Profile review sync
- Google Reserve feed
- Demo login and sample data for training
```

Then ask:

```text
What domain or public URL should customers use?
Examples:
- https://example-salon.com
- https://booking.example-salon.com
- https://example-salon.vercel.app
```

Then ask:

```text
Do you already have a Supabase project for this app, or should we create a new one?
```

Only after those answers should you collect provider credentials.

## Maximum Automation Runbook

After access is authorized, the agent should execute this path without asking the owner to perform terminal work.

1. Inspect the repo and current env state:

   ```sh
   git status --short
   node --version
   npm --version
   npm install
   npm run setup:doctor
   ```

2. Confirm Supabase access:

   ```sh
   supabase --version
   supabase projects list
   supabase link --project-ref <project-ref>
   ```

   If the CLI is not logged in, ask the owner to complete:

   ```sh
   supabase login
   ```

   If the agent has a Supabase connector/plugin, use it to confirm the organization, project ref, and current project status. Still use the CLI for migrations and Edge Function deployment unless the connector explicitly supports those actions.

3. Apply database and Edge Function setup:

   ```sh
   supabase db push
   supabase secrets set --env-file .env.supabase.production
   supabase functions deploy
   ```

4. Confirm Vercel access or the selected deployment host:

   ```sh
   npx vercel@latest --version
   npx vercel@latest whoami
   npx vercel@latest link
   ```

   If the CLI is not logged in, ask the owner to complete:

   ```sh
   npx vercel@latest login
   ```

   If using Vercel MCP or another Vercel connector, ask the owner to authorize OAuth and scope it to the intended Vercel team/project. Use the connector for project inspection/logs when available; use CLI commands for repeatable deployment steps.

5. Configure frontend hosting env vars. For this Vite single-page app, the production frontend host should normally receive only browser-safe values:

   ```sh
   VITE_SUPABASE_URL=
   VITE_SUPABASE_PUBLISHABLE_KEY=
   VITE_SITE_URL=
   VITE_ENABLE_DEMO_LOGIN=false
   ```

   Do not put `SUPABASE_SERVICE_ROLE_KEY`, provider API keys, webhook secrets, or OAuth client secrets in the frontend host unless a future server-side deployment target actually needs them.

   If the owner prefers a browser-guided flow, run the app and open `/dashboard/onboarding`. The first Infrastructure step has provider links, secret fields, and generated Supabase/frontend env output. Values entered there stay in browser state only and are not saved by Prism.

6. Build and deploy:

   ```sh
   npm run build
   npx vercel@latest --prod
   ```

7. Update URLs after the production frontend URL is known:

   ```sh
   supabase secrets set PUBLIC_SITE_URL=https://<frontend-domain> SITE_URL=https://<frontend-domain>
   ```

   Then update Supabase Auth Site URL/Redirect URLs, Stripe webhook endpoint, Google OAuth redirect URI, DNS, and any owner-facing links that depend on the final hostname.

8. Run verification:

   ```sh
   npm run setup:doctor
   npm run build
   npm run test
   ```

   Then perform the manual feature checklist in the handoff section.

Only stop for the owner when:

- A browser login, OAuth authorization, 2FA code, captcha, or account recovery flow appears.
- A provider requires billing, paid plan approval, live Stripe mode, Twilio number purchase, SMS campaign registration, or legal/compliance acknowledgement.
- DNS or domain ownership needs to be changed.
- The owner must choose between test/live payments, demo/production mode, or which optional integrations to enable.
- A secret exists only in the owner's dashboard or password manager.

## Feature To Credential Map

Use this table to explain why each credential is needed.

| Feature | Required credentials | Where used | Safe to expose in browser |
| --- | --- | --- | --- |
| Frontend Supabase client | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser app | Yes |
| Edge Function Supabase clients | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Functions | No, except anon/publishable keys are public-like |
| Public app URLs | `PUBLIC_SITE_URL`, `SITE_URL` | Links, redirects, checkout returns, emails, SMS | Public URL only |
| Gemini AI | `GEMINI_API_KEY`, optional `AI_TRYON_TIER` | AI assistant, try-on, face analysis, generated styles, email generation | No |
| Stripe payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout, payment links, saved cards, subscriptions, Connect, webhook processing | No |
| ElevenLabs voice | `ELEVENLABS_API_KEY`, `VOICE_AGENT_SECRET` | Voice agent creation, voice previews, protected voice callbacks | No |
| Twilio SMS/phone | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS delivery and phone-number attachment | No |
| Resend email | `RESEND_API_KEY`, `EMAIL_FROM` | Appointment email, invites, messages, reminders | API key no, from address yes |
| Google Business Profile | `GOOGLE_BP_CLIENT_ID`, `GOOGLE_BP_CLIENT_SECRET` | OAuth connection, review sync, place actions | Client ID is public-like, client secret no |
| Demo mode | `VITE_ENABLE_DEMO_LOGIN`, `ENABLE_DEMO_SEEDING` | Demo login and sample data | Use only outside production |

Salon-level marketing settings such as Meta Pixel ID, Meta Conversions API token, and Google Analytics Measurement ID are managed in the app's salon settings. They are not part of the initial infrastructure secret setup unless the owner explicitly wants marketing tracking configured on day one.

## Required Core Setup

Core setup enables login, database access, booking, dashboards, storage, and Edge Functions.

### Values To Collect

Ask the owner or create:

- Supabase project URL
- Supabase project ref
- Supabase anon or publishable key
- Supabase service-role key
- Public frontend URL

The frontend env file needs:

```sh
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Supabase Edge Functions need:

```sh
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PUBLIC_SITE_URL=
SITE_URL=
```

For Supabase-hosted projects:

- `VITE_SUPABASE_URL` and `SUPABASE_URL` are usually the same project API URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_ANON_KEY` can usually use the same public anon or publishable key expected by the current project.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to the frontend.
- `PUBLIC_SITE_URL` and `SITE_URL` should be the deployed frontend URL.

### Agent Steps

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create local env file:

   ```sh
   cp .env.example .env
   ```

3. Fill only public frontend values in `.env`:

   ```sh
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
   ```

4. Log in and link Supabase:

   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   ```

5. Apply migrations:

   ```sh
   supabase db push
   ```

6. Put server-side secrets in a local, ignored file:

   ```sh
   cp .env.example .env.supabase.production
   ```

   Edit `.env.supabase.production` so it contains only Edge Function secrets and public URL values. Remove frontend-only values if your deployment platform stores those separately.

7. Upload Supabase function secrets:

   ```sh
   supabase secrets set --env-file .env.supabase.production
   ```

8. Deploy Edge Functions:

   ```sh
   supabase functions deploy
   ```

9. Configure Supabase Auth URL settings:

   ```text
   Site URL:
   https://your-frontend-domain.example

   Redirect URLs:
   http://localhost:8080/*
   https://your-frontend-domain.example/*
   ```

10. Run local validation:

    ```sh
    npm run setup:doctor
    npm run build
    npm run test
    ```

## Deployment Target Setup

Prism is a Vite single-page app. The deployment target needs:

- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback rewrite to `/index.html`
- Frontend env vars:

  ```sh
  VITE_SUPABASE_URL=
  VITE_SUPABASE_PUBLISHABLE_KEY=
  VITE_ENABLE_DEMO_LOGIN=false
  ```

For production, set `VITE_ENABLE_DEMO_LOGIN=false` unless this is a training sandbox with no real customer data.

### Vercel Agent Runbook

Use Vercel when the owner wants the lowest-friction hosted frontend. This repo includes `vercel.json` with the SPA fallback rewrite to `/index.html`.

Authenticate and link:

```sh
npx vercel@latest login
npx vercel@latest whoami
npx vercel@latest link
```

If the owner has already authorized Vercel MCP, the agent can also use that integration to inspect projects and deployment logs. CLI deployment is still the canonical path because it is repeatable from the repo.

Set frontend env vars through the Vercel dashboard or CLI. Prefer the CLI's interactive secret prompt or file-redirect form rather than putting values directly in shell history:

```sh
npx vercel@latest env add VITE_SUPABASE_URL production
npx vercel@latest env add VITE_SUPABASE_PUBLISHABLE_KEY production
npx vercel@latest env add VITE_SITE_URL production
npx vercel@latest env add VITE_ENABLE_DEMO_LOGIN production
```

For Preview deployments, repeat the same names for `preview` if the owner wants branch deploys to work:

```sh
npx vercel@latest env add VITE_SUPABASE_URL preview
npx vercel@latest env add VITE_SUPABASE_PUBLISHABLE_KEY preview
npx vercel@latest env add VITE_SITE_URL preview
npx vercel@latest env add VITE_ENABLE_DEMO_LOGIN preview
```

Then deploy:

```sh
npm run build
npx vercel@latest --prod
```

After Vercel prints the production URL:

1. Set `PUBLIC_SITE_URL` and `SITE_URL` in Supabase Edge Function secrets to that URL.
2. Add the Vercel URL and custom domain to Supabase Auth redirect URLs.
3. Update Stripe webhook URLs and Google OAuth redirect URLs if the Supabase project or function base URL changed.
4. Redeploy or promote again if any Vercel env vars changed after the first production deployment.

After deployment, update:

- Supabase Auth Site URL
- Supabase Auth Redirect URLs
- `PUBLIC_SITE_URL` Supabase secret
- `SITE_URL` Supabase secret
- Stripe webhook endpoint if the Supabase project changes
- Google OAuth redirect URI if the Supabase project changes

## Provider Setup Runbooks

### Gemini AI

Enable when the owner wants:

- AI assistant
- Face-shape analysis
- AI consultation
- Virtual try-on
- Style image generation
- Style image classification
- AI-generated email campaigns

Ask:

```text
Do you want AI consultation, try-on, and generated marketing content enabled? Gemini usage can incur API charges. Do you already have a Google AI Studio or Google Cloud project for this salon?
```

Collect:

```sh
GEMINI_API_KEY=
AI_TRYON_TIER=default
```

Notes for the owner:

- Create or select a Gemini API key in Google AI Studio.
- Put billing and usage limits on the Google project when available.
- Use a separate key for this Prism deployment.
- Rotate the key immediately if it is pasted into a public chat, repository, ticket, or browser screenshot.

Apply:

```sh
supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY" AI_TRYON_TIER="${AI_TRYON_TIER:-default}"
```

Validate:

```sh
npm run setup:doctor
```

Then test in the app:

1. Log in as a salon owner or client.
2. Open the consultation flow.
3. Run face-shape detection or virtual try-on with a test image.
4. Confirm the app returns a result or a provider error that does not expose the key.

### Stripe Payments

Enable when the owner wants:

- Deposits at booking
- Full payment at booking
- Payment links
- Saved card charging
- Client memberships and subscriptions
- Optional Stripe Connect onboarding for salon payouts

Ask:

```text
Do you want Stripe in test mode first, or should this deployment accept live payments immediately?
```

For most owners, start with Stripe test mode, verify checkout, then switch to live mode.

Collect:

```sh
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Use the matching mode:

- Test mode secret key with test mode webhook secret.
- Live mode secret key with live mode webhook secret.
- Do not mix test and live values.

Webhook endpoint:

```text
https://<your-supabase-project>.supabase.co/functions/v1/stripe-webhook
```

Configure Stripe webhook events for the flows this app handles:

```text
checkout.session.completed
payment_intent.succeeded
payment_intent.payment_failed
invoice.paid
invoice.payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
account.updated
```

Apply:

```sh
supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
```

Validate:

1. Run `npm run setup:doctor`.
2. In the app, set booking payment mode to deposit or full payment.
3. Book a test appointment.
4. Confirm redirect to Stripe Checkout.
5. Complete checkout with a Stripe test card if in test mode.
6. Confirm the appointment payment status updates after the webhook fires.

If webhooks fail:

- Confirm the endpoint URL points to the same Supabase project as the deployed functions.
- Confirm the webhook secret begins with the expected Stripe webhook-secret prefix for your current Stripe mode.
- Confirm Edge Functions were deployed after setting secrets.
- Confirm the Stripe event is being delivered to `stripe-webhook`.

### ElevenLabs Voice Agent

Enable when the owner wants:

- AI voice receptionist
- Browser voice-agent demo
- ElevenLabs conversational agent setup
- Secure voice callback tools

Ask:

```text
Do you want the AI voice receptionist enabled now? ElevenLabs usage may incur voice and agent charges.
```

Collect:

```sh
ELEVENLABS_API_KEY=
VOICE_AGENT_SECRET=
```

Generate `VOICE_AGENT_SECRET` yourself if the owner does not already have one:

```sh
openssl rand -hex 32
```

Explain:

- `ELEVENLABS_API_KEY` authenticates Prism to ElevenLabs.
- `VOICE_AGENT_SECRET` is a shared secret Prism uses to reject unauthorized voice callback/tool requests.
- The voice secret is not obtained from ElevenLabs; it is generated for this deployment.

Apply:

```sh
supabase secrets set ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" VOICE_AGENT_SECRET="$VOICE_AGENT_SECRET"
```

Validate:

1. Run `npm run setup:doctor`.
2. Open `/dashboard/voice-agent`.
3. Create a test voice agent.
4. Preview a voice.
5. Use the browser demo if available.
6. Confirm call logs appear only after actual voice interactions.

If tool calls fail:

- Confirm `VOICE_AGENT_SECRET` matches what was present when the agent was created.
- Re-save or recreate the voice agent after changing the secret.
- Confirm `voice-agent-tools` and `voice-agent-webhook` functions are deployed.

### Twilio SMS And Phone

Enable when the owner wants:

- SMS appointment/onboarding links
- Client onboarding SMS
- Payment-link SMS fallback
- Twilio phone-number attachment for voice workflows

Ask:

```text
Do you want Prism to send SMS messages? SMS requires Twilio setup and may require regulatory approval, opt-in records, and local compliance review.
```

Collect:

```sh
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

Phone-number format:

```text
+15551234567
```

Agent cautions:

- Confirm the owner controls the Twilio account.
- Confirm the sending number is SMS-capable.
- Confirm the business has appropriate consent language and opt-in records before sending real SMS.
- Adapt [SMS_COMPLIANCE_TEMPLATE.md](./SMS_COMPLIANCE_TEMPLATE.md) with the owner before production SMS.
- If the account is in trial mode, messages may only go to verified recipient numbers.

Apply:

```sh
supabase secrets set \
  TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" \
  TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" \
  TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER"
```

Validate:

1. Run `npm run setup:doctor`.
2. Book a test appointment with a consenting test phone number.
3. Trigger client onboarding SMS.
4. Confirm either SMS delivery succeeds or the function returns a manual onboarding URL without exposing credentials.

### Resend Email

Enable when the owner wants:

- Appointment confirmations
- Appointment reminders
- Staff invites
- Client/staff messages by email
- Transactional salon emails

Ask:

```text
What email address should clients see as the sender? It should use a domain the salon controls, such as Appointments <appointments@example-salon.com>.
```

Collect:

```sh
RESEND_API_KEY=
EMAIL_FROM=
```

Recommended `EMAIL_FROM` format:

```text
Salon Name <appointments@example-salon.com>
```

Agent cautions:

- Verify the sending domain in Resend before sending real client emails.
- Prefer a Resend key limited to sending email if the owner's plan and workflow allow it.
- Avoid using `onboarding@resend.dev` for production.

Apply:

```sh
supabase secrets set RESEND_API_KEY="$RESEND_API_KEY" EMAIL_FROM="$EMAIL_FROM"
```

Validate:

1. Run `npm run setup:doctor`.
2. Invite a test stylist.
3. Book a test appointment.
4. Confirm the email arrives from the configured sender.
5. Check spam placement before sending real campaign or transactional volume.

### Google Business Profile

Enable when the owner wants:

- Google review sync
- Replying to Google reviews from Prism
- Google Business Profile place-action helpers
- Google Reserve feed configuration

Ask:

```text
Do you have owner or manager access to the salon's Google Business Profile location?
```

Collect:

```sh
GOOGLE_BP_CLIENT_ID=
GOOGLE_BP_CLIENT_SECRET=
```

OAuth callback URL:

```text
https://<your-supabase-project>.supabase.co/functions/v1/google-bp-auth
```

Google Cloud setup checklist:

1. Create or select a Google Cloud project for the salon or agency.
2. Enable the required Google Business Profile APIs.
3. Configure OAuth consent screen.
4. Create OAuth credentials for a web application.
5. Add the callback URL above as an authorized redirect URI.
6. Add the salon owner or operator as a test user if the OAuth app is still in testing mode.

Apply:

```sh
supabase secrets set GOOGLE_BP_CLIENT_ID="$GOOGLE_BP_CLIENT_ID" GOOGLE_BP_CLIENT_SECRET="$GOOGLE_BP_CLIENT_SECRET"
```

Validate:

1. Run `npm run setup:doctor`.
2. Open dashboard settings.
3. Connect Google Business Profile.
4. Select the correct account and location.
5. Sync reviews.
6. Confirm the review list appears under dashboard reviews.

If OAuth fails:

- Compare the exact redirect URI in the Google error with the URI registered in Google Cloud.
- Confirm the Supabase project ref in the callback URL is the production project.
- Confirm the OAuth app has access to Business Profile APIs.
- Confirm the logged-in Google user manages the requested business location.

### Google Reserve Feed

Google Reserve feed support depends on the app and Google partner requirements. The app can expose a feed URL when Google Reserve is enabled for a salon.

Feed URL pattern:

```text
https://<your-supabase-project>.supabase.co/functions/v1/google-reserve-feed?salon_id=<salon-id>
```

Agent notes:

- This is not the same as Google Business Profile OAuth.
- The owner may need separate Google approval or partner access.
- In the app, enable Google Reserve in dashboard settings only after the salon profile, services, staff, and availability are accurate.

### Demo Mode

Enable only for local demos, screenshots, sales training, or non-production onboarding.

Frontend:

```sh
VITE_ENABLE_DEMO_LOGIN=true
```

Edge Functions:

```sh
ENABLE_DEMO_SEEDING=true
```

Apply only to a sandbox Supabase project:

```sh
supabase secrets set ENABLE_DEMO_SEEDING=true
```

Disable for production:

```sh
VITE_ENABLE_DEMO_LOGIN=false
supabase secrets unset ENABLE_DEMO_SEEDING
```

Agent cautions:

- Demo mode creates known demo accounts.
- Do not enable it in any deployment containing real salon, staff, or client data.
- If demo mode was accidentally enabled in production, disable it, rotate affected credentials, inspect users, and remove demo data before going live.

## Recommended Credential Collection Script

Use this script shape when the user wants the agent to collect secrets through the terminal. It writes to `.env.supabase.production` without echoing values.

```sh
#!/usr/bin/env bash
set -euo pipefail

target=".env.supabase.production"
touch "$target"
chmod 600 "$target"

set_secret() {
  local key="$1"
  local prompt="$2"
  local value
  local tmp
  read -rsp "$prompt: " value
  printf "\n"

  if [[ "$value" == *"'"* || "$value" == *$'\n'* ]]; then
    printf "Value for %s contains an unsupported quote or newline. Enter it manually in %s.\n" "$key" "$target" >&2
    unset value
    return 1
  fi

  tmp="$(mktemp)"
  if [ -f "$target" ]; then
    grep -v "^${key}=" "$target" > "$tmp" || true
  else
    : > "$tmp"
  fi
  printf "%s='%s'\n" "$key" "$value" >> "$tmp"
  mv "$tmp" "$target"
  chmod 600 "$target"
  unset value tmp
}

set_secret "SUPABASE_URL" "SUPABASE_URL"
set_secret "SUPABASE_ANON_KEY" "SUPABASE_ANON_KEY"
set_secret "SUPABASE_PUBLISHABLE_KEY" "SUPABASE_PUBLISHABLE_KEY"
set_secret "SUPABASE_SERVICE_ROLE_KEY" "SUPABASE_SERVICE_ROLE_KEY"
set_secret "PUBLIC_SITE_URL" "PUBLIC_SITE_URL"
set_secret "SITE_URL" "SITE_URL"
```

Do not commit this script or the generated env file with real values. Prefer creating the script in a temporary directory or deleting it after use.

## Full Production Secret Template

Use this as the maximum production Supabase Edge Function secret template. Remove providers the owner does not enable.

```sh
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<public-anon-or-publishable-key>
SUPABASE_PUBLISHABLE_KEY=<public-anon-or-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
PUBLIC_SITE_URL=https://<frontend-domain>
SITE_URL=https://<frontend-domain>

GEMINI_API_KEY=<optional-gemini-key>
AI_TRYON_TIER=default

STRIPE_SECRET_KEY=<optional-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<optional-stripe-webhook-secret>

ELEVENLABS_API_KEY=<optional-elevenlabs-key>
VOICE_AGENT_SECRET=<optional-random-shared-secret>

TWILIO_ACCOUNT_SID=<optional-twilio-account-sid>
TWILIO_AUTH_TOKEN=<optional-twilio-auth-token>
TWILIO_PHONE_NUMBER=<optional-e164-phone-number>

RESEND_API_KEY=<optional-resend-key>
EMAIL_FROM=Salon Name <appointments@example-salon.com>

GOOGLE_BP_CLIENT_ID=<optional-google-oauth-client-id>
GOOGLE_BP_CLIENT_SECRET=<optional-google-oauth-client-secret>
```

Apply:

```sh
supabase secrets set --env-file .env.supabase.production
```

List names only:

```sh
supabase secrets list
```

Do not paste the output into public places if the CLI ever includes sensitive metadata.

## Local Development Secret Template

For local Supabase development, after `supabase start`, run:

```sh
supabase status
```

Then set:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54341
VITE_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
```

Local Edge Functions can be served with an env file:

```sh
supabase functions serve --env-file .env.supabase.local
```

Local demo mode:

```sh
VITE_ENABLE_DEMO_LOGIN=true
ENABLE_DEMO_SEEDING=true
```

Production values should not be reused in local development unless the owner explicitly accepts the risk.

## Human Intervention Guide

When a provider cannot be configured fully by the agent, guide the owner with exact context and then resume automation.

Use this pattern:

```text
I need you for one provider-owned step:

Provider: <provider>
Page to open: <official URL>
What to do: <one short task>
Value I need afterward: <key name, URL, confirmation, or screenshot without secrets>
Why this is needed: <feature it enables>
What I will do next: <command or validation I will run after you finish>
```

Common human-only setup points:

| Provider | Human action | Agent follow-up |
| --- | --- | --- |
| Supabase | Create project, approve paid plan, complete browser login/2FA, copy project API values | Link project, push migrations, set secrets, deploy functions |
| Vercel | Authorize CLI/MCP, choose team/project, approve paid plan, add custom domain | Link project, set frontend env, deploy, inspect logs |
| DNS registrar | Buy domain or approve DNS record changes | Verify domain resolves and update app URLs |
| Stripe | Choose test/live mode, create account, complete business verification, create webhook endpoint if dashboard-only | Set Stripe secrets and run checkout/webhook tests |
| Google AI Studio/Gemini | Create API key, enable billing/quotas | Set `GEMINI_API_KEY` and test AI flows |
| ElevenLabs | Create API key, accept plan/usage charges | Generate `VOICE_AGENT_SECRET`, set secrets, test voice agent |
| Twilio | Buy/select SMS-capable number, complete SMS/voice compliance steps | Set Twilio secrets and test with consenting number |
| Resend | Verify sending domain and choose sender address | Set `RESEND_API_KEY`/`EMAIL_FROM` and send test email |
| Google Cloud | Configure OAuth consent, enable Business Profile APIs, add redirect URI | Set Google OAuth secrets and test review sync |

Do not ask the owner to run repo commands unless the agent lacks terminal access. Prefer asking them to approve or authenticate, then continue the setup yourself.

## Deployment Handoff Template

After setup, give the owner a handoff note like this. Do not include secret values.

```md
# Prism Deployment Handoff

Date:
Agent:
Repository:
Branch or commit:

## Public URLs

- Frontend:
- Supabase project URL:
- Stripe webhook endpoint:
- Google OAuth callback:

## Enabled Features

- Core booking and dashboards: enabled
- Gemini AI: enabled/disabled
- Stripe payments: enabled/disabled
- ElevenLabs voice: enabled/disabled
- Twilio SMS/phone: enabled/disabled
- Resend email: enabled/disabled
- Google Business Profile: enabled/disabled
- Demo mode: disabled for production

## Secret Names Set

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SERVICE_ROLE_KEY
- PUBLIC_SITE_URL
- SITE_URL

## Verification Performed

- npm run setup:doctor:
- npm run build:
- npm run test:
- Owner signup:
- Salon onboarding:
- Staff invite:
- Client booking:
- Stripe checkout:
- Email delivery:
- SMS delivery:
- Gemini consultation:
- Voice agent:
- Google review sync:

## Owner Follow-Up

- Rotate any credentials that were shared outside a secure channel.
- Confirm SMS compliance and opt-in language before texting real clients.
- Confirm payment, tax, refund, and cancellation policies before live payments.
- Review data retention and privacy obligations before storing real client photos.
```

## Troubleshooting Matrix

| Symptom | Likely cause | Agent action |
| --- | --- | --- |
| Frontend loads but login fails | Supabase Auth URL config missing deployed URL | Add frontend URL to Supabase Site URL and Redirect URLs |
| Blank app or Supabase client errors | Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` | Set frontend env vars in deployment target and redeploy |
| Edge Function says key is not configured | Missing Supabase function secret | Run `supabase secrets set` and redeploy or retry function |
| Stripe checkout starts but payment never updates | Webhook missing or wrong webhook secret | Check Stripe endpoint URL, webhook signing secret, and event delivery |
| Google OAuth redirect mismatch | Google authorized redirect URI differs from function URL | Register exact `google-bp-auth` function URL in Google Cloud |
| Resend returns domain error | `EMAIL_FROM` domain not verified | Verify domain in Resend or change sender to a verified domain |
| Twilio SMS fails in trial account | Recipient not verified or sender not SMS-capable | Verify test recipient or use a production Twilio number |
| Voice agent tools return unauthorized | `VOICE_AGENT_SECRET` mismatch | Re-set secret and recreate or resave the ElevenLabs agent |
| Demo login appears in production | `VITE_ENABLE_DEMO_LOGIN=true` in frontend deployment | Set false, redeploy, unset `ENABLE_DEMO_SEEDING` |
| Setup doctor reports optional providers disabled | Missing optional provider keys | Only configure providers the owner wants enabled |

## Official Provider References

Use official provider docs when dashboard names move:

- Supabase CLI secrets: <https://supabase.com/docs/reference/cli/supabase-secrets>
- Supabase Auth redirect URLs: <https://supabase.com/docs/guides/auth/redirect-urls>
- Supabase local development and migrations: <https://supabase.com/docs/guides/local-development/overview>
- Vercel CLI overview: <https://vercel.com/docs/cli>
- Vercel CLI login: <https://vercel.com/docs/cli/login>
- Vercel CLI link: <https://vercel.com/docs/cli/link>
- Vercel CLI env vars: <https://vercel.com/docs/cli/env>
- Vercel deployments from CLI: <https://vercel.com/docs/cli/deploying-from-cli>
- Vercel Vite deployments: <https://vercel.com/docs/frameworks/vite>
- Vercel MCP for AI agents: <https://vercel.com/docs/ai-resources/vercel-mcp>
- Stripe webhooks: <https://docs.stripe.com/webhooks>
- Gemini API keys: <https://ai.google.dev/gemini-api/docs/api-key>
- ElevenLabs API authentication: <https://elevenlabs.io/docs/api-reference/authentication>
- Twilio Auth Token and Account SID: <https://www.twilio.com/docs/iam/api/authtoken>
- Resend API keys: <https://resend.com/docs/api-reference/api-keys/create-api-key>
- Google Business Profile OAuth: <https://developers.google.com/my-business/content/implement-oauth>
