import { promises as fs } from "node:fs";
import path from "node:path";
import { buildStylePrompt, SYSTEM_INSTRUCTION } from "../supabase/functions/generate-tryon/lib/prompt.ts";
import {
  resolveModelChain,
  buildGenerationConfig,
  MODEL_NB_LEGACY,
  type Tier,
} from "../supabase/functions/generate-tryon/lib/models.ts";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Case {
  id: string;
  category: string;
  source: string;
  reference: string;
  styleName: string;
  styleDescription: string | null;
}

interface Manifest {
  description: string;
  cases: Case[];
}

interface CaseResult {
  id: string;
  category: string;
  status: "ok" | "error";
  modelUsed?: string;
  outputFile?: string;
  latencyMs: number;
  error?: string;
}

async function readImage(abs: string) {
  const buf = await fs.readFile(abs);
  const ext = path.extname(abs).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { base64: buf.toString("base64"), mimeType };
}

async function callGemini(
  apiKey: string,
  model: string,
  body: string
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; text: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
    }
  );
  if (!res.ok) {
    return { ok: false, status: res.status, text: (await res.text()).slice(0, 500) };
  }
  return { ok: true, data: await res.json() };
}

interface DetectedUserAttrs {
  hairType: string;
  hairColor: string;
}

async function detectUser(
  apiKey: string,
  base64: string,
  mimeType: string
): Promise<DetectedUserAttrs | null> {
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze the person's hair in this photo. Call the report_attrs function with:
- hair_type: one of "straight", "wavy", "curly", "coily"
- natural_hair_color: one of "black", "dark_brown", "brown", "light_brown", "red", "auburn", "blonde", "platinum", "gray", "white", "other"`,
          },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: "report_attrs",
            description: "Report detected user hair attributes",
            parameters: {
              type: "object",
              properties: {
                hair_type: {
                  type: "string",
                  enum: ["straight", "wavy", "curly", "coily"],
                },
                natural_hair_color: {
                  type: "string",
                  enum: ["black", "dark_brown", "brown", "light_brown", "red", "auburn", "blonde", "platinum", "gray", "white", "other"],
                },
              },
              required: ["hair_type", "natural_hair_color"],
            },
          },
        ],
      },
    ],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["report_attrs"] } },
  });

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: requestBody,
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const fn = parts.find((p: { functionCall?: { args?: { hair_type?: string; natural_hair_color?: string } } }) => p.functionCall)?.functionCall;
  if (!fn?.args?.hair_type || !fn?.args?.natural_hair_color) return null;
  return { hairType: fn.args.hair_type, hairColor: fn.args.natural_hair_color };
}

function extractImagePart(data: unknown): { base64: string; mimeType: string } | null {
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
    }>;
  };
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const inline = p.inlineData;
    if (inline?.data && inline.mimeType?.startsWith("image/")) {
      return { base64: inline.data, mimeType: inline.mimeType };
    }
  }
  return null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function runCase(
  c: Case,
  fixturesDir: string,
  runDir: string,
  apiKey: string,
  tier: Tier,
  userAttrs: DetectedUserAttrs | null
): Promise<CaseResult> {
  const t0 = Date.now();
  try {
    const [selfie, style] = await Promise.all([
      readImage(path.join(fixturesDir, c.source)),
      readImage(path.join(fixturesDir, c.reference)),
    ]);

    const prompt = buildStylePrompt({
      styleName: c.styleName,
      styleDescription: c.styleDescription,
      hasStyleImage: true,
      userAttributes: userAttrs,
    });

    const parts = [
      { text: prompt },
      { inlineData: { mimeType: style.mimeType, data: style.base64 } },
      { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
    ];
    const fullConfig = buildGenerationConfig();
    // Legacy gemini-2.5-flash-image does not accept imageConfig; strip for parity with production.
    const legacyConfig = { responseModalities: fullConfig.responseModalities };

    const chain = resolveModelChain(tier);
    const errors: string[] = [];

    for (const model of chain) {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: model === MODEL_NB_LEGACY ? legacyConfig : fullConfig,
      });
      const attempt = await callGemini(apiKey, model, body);
      if (!attempt.ok) {
        errors.push(`${model}:${attempt.status}:${attempt.text.slice(0, 120)}`);
        continue;
      }

      const image = extractImagePart(attempt.data);
      if (!image) {
        errors.push(`${model}:no-image-part`);
        continue;
      }

      const outExt = image.mimeType === "image/jpeg" ? "jpg" : "png";
      const outFile = `${c.id}.${outExt}`;
      await fs.writeFile(
        path.join(runDir, outFile),
        Buffer.from(image.base64, "base64")
      );

      return {
        id: c.id,
        category: c.category,
        status: "ok",
        modelUsed: model,
        outputFile: outFile,
        latencyMs: Date.now() - t0,
      };
    }

    return {
      id: c.id,
      category: c.category,
      status: "error",
      latencyMs: Date.now() - t0,
      error: errors.join(" | "),
    };
  } catch (err) {
    return {
      id: c.id,
      category: c.category,
      status: "error",
      latencyMs: Date.now() - t0,
      error: (err as Error).message,
    };
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");

  const tier = (process.env.AI_TRYON_TIER as Tier | undefined) ?? "default";

  const repoRoot = path.resolve(__dirname, "..");
  const fixturesDir = path.join(repoRoot, "evals/women-hair");
  const manifest: Manifest = JSON.parse(
    await fs.readFile(path.join(fixturesDir, "manifest.json"), "utf8")
  );

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(repoRoot, "evals/out", stamp);
  await fs.mkdir(runDir, { recursive: true });

  // Detect user attrs once per unique source image (v3).
  const uniqueSources = [...new Set(manifest.cases.map((c) => c.source))];
  const attrsCache = new Map<string, DetectedUserAttrs | null>();
  for (const src of uniqueSources) {
    console.log(`[detect] ${src}`);
    const img = await readImage(path.join(fixturesDir, src));
    const attrs = await detectUser(apiKey, img.base64, img.mimeType);
    attrsCache.set(src, attrs);
    console.log(`[detect]   ${src} → ${attrs ? `${attrs.hairColor}/${attrs.hairType}` : "null (detection failed)"}`);
  }

  const results: CaseResult[] = [];
  for (const c of manifest.cases) {
    console.log(`[..] ${c.id} (${c.category})`);
    const r = await runCase(c, fixturesDir, runDir, apiKey, tier, attrsCache.get(c.source) ?? null);
    results.push(r);
    if (r.status === "ok") {
      console.log(`[ok]   ${c.id} → ${r.outputFile} (${r.modelUsed}, ${r.latencyMs}ms)`);
    } else {
      console.log(`[err]  ${c.id}: ${r.error}`);
    }
  }

  await fs.writeFile(
    path.join(runDir, "summary.json"),
    JSON.stringify({ tier, results }, null, 2)
  );

  const indexHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Try-on eval ${escapeHtml(stamp)} (${escapeHtml(tier)})</title><style>body{font-family:system-ui;margin:24px}figure{margin:0;text-align:center}figcaption{font-size:12px;color:#555}.row{display:flex;gap:12px;margin:20px 0;padding:12px;border:1px solid #eee;border-radius:8px}.ok{background:#f3fff3}.err{background:#fff3f3}img{height:280px;border-radius:4px}</style></head><body><h1>Try-on eval ${escapeHtml(stamp)} — tier: ${escapeHtml(tier)}</h1>${results
    .map((r) => {
      const c = manifest.cases.find((x) => x.id === r.id)!;
      return `<div class="row ${escapeHtml(r.status)}">
        <figure><img src="../../women-hair/${escapeHtml(c.source)}"><figcaption>source</figcaption></figure>
        <figure><img src="../../women-hair/${escapeHtml(c.reference)}"><figcaption>reference (${escapeHtml(c.styleName)})</figcaption></figure>
        <figure>${
          r.outputFile
            ? `<img src="${escapeHtml(r.outputFile)}">`
            : `<pre style="white-space:pre-wrap;color:#b00">${escapeHtml(r.error ?? "")}</pre>`
        }<figcaption>${escapeHtml(r.id)} (${escapeHtml(r.category)}) — ${escapeHtml(r.status)}${
        r.modelUsed ? ` — ${escapeHtml(r.modelUsed)}` : ""
      } — ${r.latencyMs}ms</figcaption></figure>
      </div>`;
    })
    .join("")}</body></html>`;
  await fs.writeFile(path.join(runDir, "index.html"), indexHtml);

  const failures = results.filter((r) => r.status === "error").length;
  console.log(`\nRun complete: ${runDir}`);
  console.log(`Failures: ${failures}/${results.length}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
