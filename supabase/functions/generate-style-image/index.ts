import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { referenceImageUrl, styleName } = await req.json();

    if (!referenceImageUrl) {
      return new Response(
        JSON.stringify({ error: "referenceImageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Mannequin is stored in Supabase storage (publicly accessible, no auth needed)
    const mannequinUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/consultation-photos/mannequin-head.png`;

    // Convert both images to base64
    const mannequin = await toBase64(mannequinUrl);
    const reference = await toBase64(referenceImageUrl);

    const parts = [
      {
        text: `I have two images below. The FIRST image is a bald mannequin head on a plain white background. The SECOND image is a reference photo showing a "${styleName || "hairstyle"}" hairstyle.

YOUR TASK: Apply the hairstyle from the SECOND image (reference) onto the bald mannequin head in the FIRST image.

RULES:
- Keep the mannequin head's shape, skin tone, facial features, pose, and plain white background EXACTLY the same.
- ONLY add hair to the mannequin head, matching the cut, shape, length, volume, texture, color, and styling of the reference hairstyle as closely as possible.
- The hair should look natural on the mannequin head, blending seamlessly with the head and hairline.
- Keep the same camera angle, lighting, and framing as the original mannequin image.
- The output must look like a professional product/catalog photo of a mannequin head wearing this hairstyle.`,
      },
      { inlineData: { mimeType: mannequin.mimeType, data: mannequin.base64 } },
      { inlineData: { mimeType: reference.mimeType, data: reference.base64 } },
    ];

    // Retry with exponential backoff for transient 429s
    let response: Response | null = null;
    // Try multiple model names — availability varies by API key/region
    const modelsToTry = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
    ];
    const requestBody = JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    let lastError = "";
    for (const model of modelsToTry) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: requestBody,
      });
      if (response.ok) break;
      // If 404 (model not found) or 400 (unsupported), try next model
      if (response.status === 404 || response.status === 400) {
        lastError = await response.clone().text();
        console.error(`Model ${model} failed (${response.status}), trying next...`);
        continue;
      }
      // For 429 (rate limit), retry with backoff
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 3000));
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: requestBody,
        });
        if (response.ok) break;
      }
      break;
    }

    if (!response!.ok) {
      if (response!.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response!.text();
      console.error("Gemini API error:", response!.status, text);
      return new Response(
        JSON.stringify({ error: `AI generation failed (${response!.status})`, details: text.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response!.json();
    const candidates = data.candidates;

    if (!candidates || candidates.length === 0) {
      console.error("No candidates in response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Could not generate style image. Please try again with a different reference photo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseParts = candidates[0].content?.parts || [];
    const imagePart = responseParts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));

    if (!imagePart) {
      const textContent = responseParts.map((p: any) => p.text || "").join("");
      console.error("No image in response. Text:", textContent);
      return new Response(
        JSON.stringify({ error: "Could not generate style image. Please try again with a different reference photo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageBase64 = imagePart.inlineData.data;
    const imageMimeType = imagePart.inlineData.mimeType;

    // Upload the generated image to storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const binaryData = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const fileName = `style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const storagePath = `style-gallery/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("consultation-photos")
      .upload(storagePath, binaryData, { contentType: imageMimeType });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ imageUrl: `data:${imageMimeType};base64,${imageBase64}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("consultation-photos")
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({ imageUrl: publicUrlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-style-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
