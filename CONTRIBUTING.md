# Contributing

Thanks for helping improve Prism Salon OS.

## Development Setup

```sh
npm install
cp .env.example .env
npm run setup:doctor
npm run dev
```

Before opening a pull request, run:

```sh
npm run build
npm run test
```

Run `npm run lint` when your change touches application code.

## Contribution Guidelines

- Keep the Vite app in `src/` as the supported frontend path.
- Keep provider integrations optional unless the feature cannot work without that provider.
- Do not commit `.env`, `.env.local`, provider keys, API tokens, Supabase service-role keys, or webhook secrets.
- Prefer small, focused pull requests.
- Add tests when changing prompt builders, schema helpers, setup checks, or logic that can be isolated from provider APIs.
- For provider features, document required keys and webhook/OAuth callback URLs.

## Local Provider Testing

Most third-party features can be tested in partial mode:

- Gemini features require `GEMINI_API_KEY`.
- Stripe checkout and webhooks require `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- SMS requires Twilio credentials and a verified sender or phone number.
- Voice-agent setup requires ElevenLabs credentials and a generated `VOICE_AGENT_SECRET`.
- Email delivery requires Resend credentials and a verified sending domain.

Do not use production salon data when developing locally.
