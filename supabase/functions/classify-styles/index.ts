import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch an image URL and return raw base64 + mimeType
async function toBase64(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) return { mimeType: match[1], base64: match[2] };
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return { base64: btoa(binary), mimeType: res.headers.get("content-type") || "image/png" };
}

// Classify a single style image using Gemini function calling
async function classifyStyle(
  imageBase64: string,
  imageMimeType: string,
  styleName: string,
  apiKey: string
): Promise<Record<string, any> | null> {
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert hair stylist. Analyze this hairstyle image and classify it.

The image shows a mannequin head wearing the "${styleName}" hairstyle.

Determine ALL of the following by examining the image carefully:

1. **Gender**: Who is this style primarily for? Look at the mannequin and the style itself.
   - "male" = short/structured cuts, fades, traditionally masculine styles
   - "female" = longer styles, bobs, pixies, traditionally feminine styles
   - "unisex" = ONLY if the style is genuinely worn equally by all genders (e.g., buzz cut, wet look). Most styles are NOT unisex.

2. **Hair length**: How long is the hair in the style?
   - "short" = above ears, buzz, crew cut, fades
   - "medium" = ear to shoulder length
   - "long" = past shoulders

3. **Compatible hair types**: Which natural hair textures can achieve this style?
   - "straight" = no bend, falls flat
   - "wavy" = S-shaped bends
   - "curly" = defined spiral curls
   - "coily" = tight coils, zigzag, Afro-textured
   Be realistic. Braids/locs/cornrows require coily or very curly hair. Sleek bobs require straight or wavy hair. Fades work for all types.

4. **Compatible face shapes**: Which face shapes does this style complement?
   Consider how the style's volume, length, and framing interact with facial proportions.

5. **Compatible hair thicknesses**: Which hair densities/thicknesses can achieve this style?
   - "fine" = lightweight styles that don't rely on volume — pixie cuts, sleek bobs, close crops, styles that lay flat
   - "medium" = most styles work for medium thickness — it's the most versatile
   - "thick" = styles that need body, volume, or weight — heavy layers, voluminous blowouts, big curls, thick braids
   Most styles work for 2-3 thicknesses. Only restrict to one if the style truly requires it (e.g., a voluminous layered blowout genuinely needs thick hair).

6. **Description**: A 1-2 sentence description of the style's defining characteristics, suitable for showing to a salon client.

You MUST call the classify_style function with your results.`,
          },
          { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
        ],
      },
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: "classify_style",
            description: "Report the classification results for this hairstyle",
            parameters: {
              type: "object",
              properties: {
                gender: {
                  type: "string",
                  enum: ["male", "female", "unisex"],
                  description: "Primary target gender for this style",
                },
                hair_length: {
                  type: "string",
                  enum: ["short", "medium", "long"],
                },
                compatible_hair_types: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["straight", "wavy", "curly", "coily"],
                  },
                  description: "Hair textures that can achieve this style",
                },
                compatible_face_shapes: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: [
                      "oval",
                      "round",
                      "square",
                      "heart",
                      "oblong",
                      "diamond",
                      "triangle",
                      "inverted_triangle",
                    ],
                  },
                  description: "Face shapes this style complements",
                },
                compatible_hair_thicknesses: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["fine", "medium", "thick"],
                  },
                  description: "Hair thicknesses/densities that can achieve this style",
                },
                description: {
                  type: "string",
                  description:
                    "1-2 sentence description of the style for a salon client",
                },
              },
              required: [
                "gender",
                "hair_length",
                "compatible_hair_types",
                "compatible_face_shapes",
                "compatible_hair_thicknesses",
                "description",
              ],
            },
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: ["classify_style"],
      },
    },
  });

  const model = "gemini-2.5-flash";
  let response: Response | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: requestBody,
      }
    );
    if (response.status !== 429 || attempt === 2) break;
    const delay = (attempt + 1) * 2000 + Math.random() * 500;
    await new Promise((r) => setTimeout(r, delay));
  }

  if (!response || !response.ok) return null;

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fnCall = parts.find((p: any) => p.functionCall);
  if (fnCall?.functionCall?.args) return fnCall.functionCall.args;

  return null;
}

// Classify a style using only its name (fallback when image is unavailable)
async function classifyStyleByName(
  styleName: string,
  apiKey: string
): Promise<Record<string, any> | null> {
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert hair stylist. Classify the hairstyle called "${styleName}" based on your professional knowledge.

Determine ALL of the following:

1. **Gender**: "male", "female", or "unisex" (most styles are NOT unisex — only use it for styles genuinely worn equally by all genders like buzz cuts or wet looks)

2. **Hair length**: "short" (above ears, buzz, fades), "medium" (ear to shoulder), "long" (past shoulders)

3. **Compatible hair types**: Which natural textures can achieve this style?
   - "straight", "wavy", "curly", "coily"
   - Be realistic: braids/locs/cornrows/twists/afros require coily or curly hair. Sleek bobs need straight/wavy. Fades work for all.

4. **Compatible face shapes**: Which face shapes does this style complement?
   - "oval", "round", "square", "heart", "oblong", "diamond", "triangle", "inverted_triangle"

5. **Compatible hair thicknesses**: Which densities can achieve this style?
   - "fine" = lightweight, low-volume styles
   - "medium" = most styles work for medium
   - "thick" = styles needing body, volume, or weight
   Most styles work for 2-3 thicknesses.

6. **Description**: 1-2 sentence description for a salon client.

You MUST call the classify_style function with your results.`,
          },
        ],
      },
    ],
    tools: [
      {
        functionDeclarations: [
          {
            name: "classify_style",
            description: "Report the classification results for this hairstyle",
            parameters: {
              type: "object",
              properties: {
                gender: { type: "string", enum: ["male", "female", "unisex"] },
                hair_length: { type: "string", enum: ["short", "medium", "long"] },
                compatible_hair_types: {
                  type: "array",
                  items: { type: "string", enum: ["straight", "wavy", "curly", "coily"] },
                },
                compatible_face_shapes: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["oval", "round", "square", "heart", "oblong", "diamond", "triangle", "inverted_triangle"],
                  },
                },
                compatible_hair_thicknesses: {
                  type: "array",
                  items: { type: "string", enum: ["fine", "medium", "thick"] },
                },
                description: { type: "string" },
              },
              required: ["gender", "hair_length", "compatible_hair_types", "compatible_face_shapes", "compatible_hair_thicknesses", "description"],
            },
          },
        ],
      },
    ],
    toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["classify_style"] } },
  });

  const model = "gemini-2.5-flash";
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: requestBody }
    );
    if (response.status !== 429 || attempt === 2) break;
    await new Promise((r) => setTimeout(r, (attempt + 1) * 2000 + Math.random() * 500));
  }

  if (!response || !response.ok) return null;
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const fnCall = parts.find((p: any) => p.functionCall);
  return fnCall?.functionCall?.args || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseKey);

    // Optional: pass specific style IDs and/or a baseUrl for resolving relative image paths
    const body = await req.json().catch(() => ({}));
    const styleIds: string[] | null = body.styleIds || null;
    const baseUrl: string = body.baseUrl || "";

    let query = admin
      .from("style_gallery")
      .select("id, name, image_url, category")
      .eq("is_active", true);
    if (styleIds && styleIds.length > 0) {
      query = query.in("id", styleIds);
    }
    const { data: styles, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!styles || styles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No styles to classify", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const log: string[] = [];
    let updated = 0;
    let failed = 0;

    // Process styles sequentially to avoid rate limits
    for (const style of styles) {
      try {
        // Try to fetch the image; if it fails (relative URL, auth-protected, etc.), classify by name only
        let img: { base64: string; mimeType: string } | null = null;
        const imageUrl = style.image_url.startsWith("/") ? (baseUrl ? `${baseUrl}${style.image_url}` : "") : style.image_url;
        if (imageUrl) {
          try {
            img = await toBase64(imageUrl);
          } catch {
            // Image fetch failed — will classify by name only
          }
        }

        const result = img
          ? await classifyStyle(img.base64, img.mimeType, style.name, GEMINI_API_KEY)
          : await classifyStyleByName(style.name, GEMINI_API_KEY);

        if (!result) {
          log.push(`SKIP: ${style.name} — classification returned null`);
          failed++;
          continue;
        }

        // NOT NULL column — fallback to universal if Gemini omits the field
        const thicknesses = result.compatible_hair_thicknesses || ["fine", "medium", "thick"];

        const { error: updateErr } = await admin
          .from("style_gallery")
          .update({
            gender: result.gender,
            hair_length: result.hair_length,
            compatible_hair_types: result.compatible_hair_types,
            compatible_face_shapes: result.compatible_face_shapes,
            compatible_hair_thicknesses: thicknesses,
            description: result.description,
          })
          .eq("id", style.id);

        if (updateErr) {
          log.push(`ERROR: ${style.name} — ${updateErr.message}`);
          failed++;
        } else {
          const prefix = thicknesses.length <= 1 ? "REVIEW" : "OK";
          log.push(
            `${prefix}: ${style.name} → ${result.gender}, ${result.hair_length}, hair=[${result.compatible_hair_types}], thickness=[${thicknesses}], faces=[${result.compatible_face_shapes}]`
          );
          updated++;
        }
      } catch (e: any) {
        log.push(`ERROR: ${style.name} — ${e.message}`);
        failed++;
      }

      // Small delay between requests to avoid rate limits
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ updated, failed, total: styles.length, log }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify-styles error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
