import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildStylePrompt, buildEditPrompt, SYSTEM_INSTRUCTION } from "./lib/prompt.ts";
import {
  resolveModelChain,
  buildGenerationConfig,
  MODEL_NB_LEGACY,
  type Tier,
} from "./lib/models.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch an image URL and return raw base64 + mimeType
async function toBase64(url: string): Promise<{ base64: string; mimeType: string }> {
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
  const base64 = btoa(binary);
  const mimeType = res.headers.get("content-type") || "image/png";
  return { base64, mimeType };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { selfieUrl, styleImageUrl, styleName, styleDescription, editInstruction, tier, styleId, consultationId, userAttributesOverride } = await req.json();

    const normalizedTier: Tier | undefined =
      tier === "pro" ? "pro" : tier === "default" ? "default" : undefined;

    // styleId is accepted in the request body but currently unused — the attribute
    // injection experiment (v2) showed mixed results in eval (coily color regressed,
    // latency doubled on some cases), so injection is disabled. The plumbing is kept
    // so re-enabling is a one-line change: restore the tryon_attributes load here
    // and pass `attributes` into buildStylePrompt below.
    void styleId;

    // Resolve user attributes (v3). Override takes precedence; else look up by
    // consultationId. All-or-nothing: both hairType and hairColor must be
    // non-empty to apply; otherwise fall through to v1 prompt line.
    let userAttributes: { hairType: string; hairColor: string } | null = null;
    if (
      userAttributesOverride &&
      typeof userAttributesOverride.hairType === "string" &&
      typeof userAttributesOverride.hairColor === "string" &&
      userAttributesOverride.hairType.length > 0 &&
      userAttributesOverride.hairColor.length > 0
    ) {
      userAttributes = {
        hairType: userAttributesOverride.hairType,
        hairColor: userAttributesOverride.hairColor,
      };
    } else if (consultationId && typeof consultationId === "string") {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(supabaseUrl, supabaseKey);
        const { data } = await admin
          .from("consultations")
          .select("detected_hair_type, detected_natural_hair_color")
          .eq("id", consultationId)
          .maybeSingle();
        if (data?.detected_hair_type && data?.detected_natural_hair_color) {
          userAttributes = {
            hairType: data.detected_hair_type,
            hairColor: data.detected_natural_hair_color,
          };
        }
      } catch (e) {
        console.warn("Failed to load consultation user attributes:", (e as Error).message);
      }
    }

    if (!selfieUrl) {
      return new Response(JSON.stringify({ error: "selfieUrl is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const selfie = await toBase64(selfieUrl);

    // Build Gemini native API request parts
    let parts: any[];

    if (editInstruction) {
      parts = [
        { text: buildEditPrompt(editInstruction) },
        { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
      ];
    } else {
      if (styleImageUrl) {
        const style = await toBase64(styleImageUrl);
        parts = [
          {
            text: buildStylePrompt({
              styleName: styleName || "selected",
              styleDescription: styleDescription ?? null,
              hasStyleImage: true,
              userAttributes,
            }),
          },
          { inlineData: { mimeType: style.mimeType, data: style.base64 } },
          { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
        ];
      } else {
        parts = [
          {
            text: buildStylePrompt({
              styleName: styleName || "selected",
              styleDescription: styleDescription ?? null,
              hasStyleImage: false,
              userAttributes,
            }),
          },
          { inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } },
        ];
      }
    }

    // Try multiple model names — availability varies by API key/region
    let response: Response | null = null;
    const modelsToTry = resolveModelChain(normalizedTier);
    const fullConfig = buildGenerationConfig();
    // Legacy gemini-2.5-flash-image does not accept imageConfig. Strip it so the
    // availability fallback still works when NB2 and Pro are both unreachable.
    const legacyConfig = { responseModalities: fullConfig.responseModalities };
    const buildRequestBody = (model: string): string =>
      JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: model === MODEL_NB_LEGACY ? legacyConfig : fullConfig,
      });

    const errors: string[] = [];
    for (const model of modelsToTry) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: buildRequestBody(model),
      });
      if (response.ok) break;
      const errText = await response.text();
      errors.push(`${model}:${response.status}:${errText.slice(0, 200)}`);
      console.error(`Model ${model} failed (${response.status}):`, errText.slice(0, 300));
      // If 404/400 (model not found or unsupported), try next model
      if (response.status === 404 || response.status === 400) continue;
      // For 429 (rate limit), retry with backoff then try next model
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: buildRequestBody(model),
        });
        if (response.ok) break;
        const retryErr = await response.text();
        errors.push(`${model}-retry:${response.status}:${retryErr.slice(0, 200)}`);
      }
      // For other errors (403, 500, etc.), also try next model
      continue;
    }

    if (!response || !response.ok) {
      const status = response?.status || 0;
      console.error("All models failed:", errors.join(" | "));
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "All AI models failed", details: errors.join(" | ") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response!.json();

    // Extract image from Gemini native response format
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      console.error("No candidates in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Could not generate try-on image. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseParts = candidates[0].content?.parts || [];
    const imagePart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart) {
      const textContent = responseParts.map((p: any) => p.text || "").join("");
      console.error("No image in response. Text:", textContent);
      return new Response(JSON.stringify({ error: "Could not generate try-on image. The AI returned text instead. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBase64 = imagePart.inlineData.data;
    const imageMimeType = imagePart.inlineData.mimeType;

    // Upload the generated image to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const binaryData = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
    const fileName = `tryon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    // Extract user ID from auth header
    const authHeader = req.headers.get("authorization");
    let userId = "anonymous";
    if (authHeader) {
      try {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: userData } = await userClient.auth.getUser();
        if (userData?.user) userId = userData.user.id;
      } catch {}
    }

    const storagePath = `${userId}/${fileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("consultation-photos")
      .upload(storagePath, binaryData, { contentType: imageMimeType });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ imageUrl: `data:${imageMimeType};base64,${imageBase64}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("consultation-photos")
      .getPublicUrl(storagePath);

    return new Response(JSON.stringify({ imageUrl: publicUrlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-tryon error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    let status = 500;
    // Propagate upstream rate limit or fetch errors
    const statusMatch = message.match(/\((\d{3})\)$/);
    if (statusMatch) {
      const upstreamStatus = parseInt(statusMatch[1]);
      if (upstreamStatus === 429) status = 429;
      else if (upstreamStatus >= 400 && upstreamStatus < 500) status = 400;
    }
    if (message.includes("not configured")) status = 501;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
