# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on localhost:8080 (HMR enabled)
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint.config.js)
npm run test         # Run tests once (Vitest, jsdom environment)
npm run test:watch   # Run tests in watch mode
npx vitest run src/path/to/file.test.ts  # Run a single test file
```

## Architecture

**Prism** — AI-powered salon management platform built with React 18 + TypeScript + Vite (SWC). Uses "Liquid Luxe" design system with glassmorphism, Outfit font, and Prism violet (#7B61FF) / Champagne (#C4A882) / Glass teal (#3ECFCF) color palette.

### Stack
- **UI:** shadcn-ui components (`src/components/ui/`) on Radix primitives + Tailwind CSS
- **Routing:** React Router v6 — top-level routes in `src/App.tsx`, dashboard subroutes in `src/pages/Dashboard.tsx`
- **State:** TanStack React Query for server state, local state via hooks
- **Backend:** Supabase (auth, database, edge functions in `supabase/functions/`)
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts for financial/analytics dashboards
- **Theming:** next-themes with class strategy, CSS variables defined in `src/index.css`

### Key Patterns
- **Path alias:** `@/` resolves to `src/`
- **Auth:** `useAuth()` hook (`src/hooks/useAuth.tsx`) manages Supabase auth state and role-based access. Three roles: `client`, `stylist`, `salon_admin`. Dashboard renders different views based on role (e.g., `SalonAppointments` for `salon_admin` vs `Appointments` for others).
- **Supabase client:** Import from `@/integrations/supabase/client` — types are auto-generated in `@/integrations/supabase/types.ts`. Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` env vars.
- **shadcn config:** `components.json` at root — add components via `npx shadcn-ui@latest add <component>`
- **Tailwind class merging:** Use `cn()` from `@/lib/utils`
- **Analytics:** Meta Pixel + Google Analytics via `TrackingProvider` (`src/components/TrackingProvider.tsx`) and helpers in `src/lib/tracking.ts`
- **Provider hierarchy (App.tsx):** ThemeProvider → QueryClientProvider → TooltipProvider → Toaster/Sonner → BrowserRouter
- **Testing:** Vitest + React Testing Library + jsdom. Setup file at `src/test/setup.ts`.

### Route Structure
- `/` — Landing page
- `/login`, `/signup`, `/forgot-password`, `/reset-password` — Auth flows
- `/dashboard/*` — Authenticated area wrapped in `DashboardLayout` with sidebar (`AppSidebar`), ~27 nested pages (overview, appointments, financials, staff, campaigns, loyalty, voice agent, etc.)
- `/consultation` — AI style consultation
- `/salon/:salonId`, `/stylist/:stylistId` — Public profiles
- `/form/:formId`, `/onboard/:appointmentId` — Client-facing forms

### Component Organization
- `src/components/ui/` — shadcn primitives (do not edit directly, re-add via CLI)
- `src/components/dashboard/` — Dashboard-specific components and sub-features (ai-widgets, email-editor)
- `src/components/landing/` — Marketing/landing page sections
- `src/components/consultation/` — AI consultation flow
- `src/components/onboarding/` — Client onboarding forms
- `src/pages/dashboard/` — One file per dashboard route

### Supabase Edge Functions
Located in `supabase/functions/` — includes AI features (face shape detection, virtual try-on, AI assistant), Stripe integration (checkout, connect accounts, customer portal, webhooks), communications (email, SMS, voice agent), CSV import, Google Business Profile sync, and demo data seeding.

## AI Try-On

The try-on feature lives in `supabase/functions/generate-tryon/`. Pure logic is extracted into `lib/prompt.ts` (the hair-swap prompt builder) and `lib/models.ts` (tier → model ID). Both are unit-tested in `src/test/generate-tryon/`.

**Models (Google Gemini Nano Banana family):**
- Default: `gemini-3.1-flash-image-preview` (Nano Banana 2) at 2K output — interactive try-on
- Pro upgrade: `gemini-3-pro-image-preview` (Nano Banana Pro) — triggered by `tier: "pro"` in the request body, exposed via the "Enhance (Pro)" button in `TryOnReview`
- Legacy fallback: `gemini-2.5-flash-image` (original Nano Banana, 1K cap) — retained only for availability fallback; do not make it the default

**Prompt contract:** the anchor phrases in `CORE_ANCHORS` ("Match my head shape exactly", "natural shadows", "Clean edges around ears and neckline", "No floating") are community-validated and measurably outperform paraphrases. Do not reword them without re-running the eval harness.

**Eval workflow:** populate `evals/women-hair/images/` and `evals/women-hair/references/` per `evals/README.md`, then `GEMINI_API_KEY=... npm run eval:tryon` (add `AI_TRYON_TIER=pro` to compare tiers). Outputs go under `evals/out/<timestamp>/` including an `index.html` viewer. Run before shipping any prompt or model change.

**Decision gate:** if curly or coily cases fail on both default and Pro tiers, do not ship. Escalate to an open-source diffusion fallback investigation such as HairFastGAN, Stable-Hair V2, or HairFusion adaptive blending before changing the production prompt.

**Attribute extraction (v2):** every style in `style_gallery` gets a `tryon_attributes` JSONB populated by the `analyze-style-image` edge function (Nano Banana 2, `gemini-3.1-flash-image-preview` + `responseSchema` — single-model consistency with the generator). **Injection into the generation prompt is currently DISABLED** — eval showed mixed quality (coily color regressed, latency 1.5–3× higher) so `generate-tryon` ignores `tryon_attributes` for now. All plumbing remains: the DB column, the analyzer function, `classify:all` script, and the dormant `renderAttributesBlock` in `lib/prompt.ts` (no-op when `attributes` is null). Re-enable is a one-line change: restore the `tryon_attributes` load + `attributes` pass in `generate-tryon/index.ts`. Schema lives at `supabase/functions/analyze-style-image/lib/schema.ts`; the analyzer prompt (with few-shot texture calibration + bangs/layers decision rule + coily under-detection mitigation) is at `supabase/functions/analyze-style-image/lib/analyze-prompt.ts`. To re-classify the whole gallery after schema changes, run `SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run classify:all` — the runner batches `styleIds` in chunks of 5 to stay under Supabase edge wall-time limits and is idempotent (filters `tryon_attributes IS NULL`). To analyze a one-off image without writing the DB, POST `{ imageUrl, styleName }` to the function.
