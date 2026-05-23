# AI Try-On Evaluation

Runs `supabase/functions/generate-tryon/lib/prompt.ts` + `lib/models.ts` directly against the Gemini REST API across a women's-hair fixture corpus. Hits the real API — costs money, not CI-safe.

## Populate fixtures

Place consented, licensed photos in:
- `evals/women-hair/images/` — source portraits of the person
- `evals/women-hair/references/` — target hairstyles

Filenames must match `manifest.json`. JPG, PNG, or WebP. Prefer front-facing portraits, even lighting. Include a mix of hair textures: long straight, long wavy, curly, coily, and a cross-texture case.

## Run

```bash
GEMINI_API_KEY=... npm run eval:tryon
# Pro tier instead of default
AI_TRYON_TIER=pro GEMINI_API_KEY=... npm run eval:tryon
```

Outputs land under `evals/out/<ISO-timestamp>/`:
- `<case-id>.png|jpg` — generated image
- `summary.json` — per-case status, model used, latency, any error
- `index.html` — side-by-side viewer (source | reference | output)

## A/B before shipping

1. Run default tier. Open `index.html` and review every case.
2. Run with `AI_TRYON_TIER=pro`. Compare.
3. If curly or coily cases fail on BOTH tiers, do NOT ship — escalate to the open-source diffusion options listed in the plan's out-of-scope section.
