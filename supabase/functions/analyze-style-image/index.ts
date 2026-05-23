import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  TRYON_ATTRIBUTES_SCHEMA,
  type TryonAttributes,
} from "./lib/schema.ts";
import { buildAnalyzePrompt } from "./lib/analyze-prompt.ts";

// Analyzer runs on NB2 (same model as the generator) for single-model consistency
// in the try-on subsystem. NB2 supports responseSchema + responseMimeType="application/json"
// despite being an image-preview model (verified by live probe 2026-04-21).
// Existing classifications on 2.5-flash are left in place and not re-run.
const ANALYZER_MODEL = "gemini-3.1-flash-image-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function toBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (m) return { mimeType: m[1], base64: m[2] };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    for (let j = 0; j < chunk.length; j++) binary += String.fromCharCode(chunk[j]);
  }
  return { base64: btoa(binary), mimeType: res.headers.get("content-type") || "image/png" };
}

async function callAnalyzer(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  styleName: string
): Promise<TryonAttributes> {
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: buildAnalyzePrompt(styleName) },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TRYON_ATTRIBUTES_SCHEMA,
      temperature: 0.1,
    },
  });

  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ANALYZER_MODEL}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body }
    );
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Analyzer returned no text part");
      return JSON.parse(text) as TryonAttributes;
    }
    lastErr = `${res.status}:${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
  }
  throw new Error(`Analyzer failed: ${lastErr}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const body = await req.json().catch(() => ({}));
    const styleIds: string[] | null = body.styleIds || null;
    const baseUrl: string = body.baseUrl || "";
    const directImageUrl: string | null = body.imageUrl || null;
    const directStyleName: string | null = body.styleName || null;

    // Direct mode: analyze a single image, no DB write.
    if (directImageUrl) {
      const img = await toBase64(directImageUrl);
      const attrs = await callAnalyzer(GEMINI_API_KEY, img.base64, img.mimeType, directStyleName ?? "reference");
      return new Response(
        JSON.stringify({ attributes: attrs, model: ANALYZER_MODEL }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch mode: loop style_gallery rows.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = admin
      .from("style_gallery")
      .select("id, name, image_url")
      .eq("is_active", true);
    if (styleIds && styleIds.length > 0) query = query.in("id", styleIds);

    const { data: styles, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!styles || styles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No styles to analyze", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const log: string[] = [];
    let updated = 0;
    let failed = 0;

    for (const style of styles) {
      try {
        const imageUrl = style.image_url.startsWith("/")
          ? (baseUrl ? `${baseUrl}${style.image_url}` : "")
          : style.image_url;
        if (!imageUrl) {
          log.push(`SKIP: ${style.name} — image_url relative and no baseUrl provided`);
          failed++;
          continue;
        }

        const img = await toBase64(imageUrl);
        const attrs = await callAnalyzer(GEMINI_API_KEY, img.base64, img.mimeType, style.name);

        const { error: updateErr } = await admin
          .from("style_gallery")
          .update({
            tryon_attributes: attrs,
            tryon_classified_with: ANALYZER_MODEL,
            tryon_classified_at: new Date().toISOString(),
          })
          .eq("id", style.id);

        if (updateErr) {
          log.push(`ERROR: ${style.name} — ${updateErr.message}`);
          failed++;
        } else {
          log.push(`OK: ${style.name} → ${attrs.texture}/${attrs.length}/${attrs.silhouette}`);
          updated++;
        }
      } catch (e) {
        log.push(`ERROR: ${style.name} — ${(e as Error).message}`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ updated, failed, total: styles.length, model: ANALYZER_MODEL, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-style-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
