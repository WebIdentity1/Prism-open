import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch image and convert to base64
    let base64: string;
    let mimeType: string;

    if (imageUrl.startsWith("data:")) {
      const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64 = match[2];
      } else {
        throw new Error("Invalid data URL format");
      }
    } else {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) throw new Error("Failed to fetch image");
      const imgBuffer = await imgResponse.arrayBuffer();
      const bytes = new Uint8Array(imgBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      base64 = btoa(binary);
      mimeType = imgResponse.headers.get("content-type") || "image/jpeg";
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    // Use native Gemini API with function calling (OpenAI-compatible endpoint doesn't support image data URLs)
    const model = "gemini-2.5-flash";
    const requestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an expert hair stylist and face shape analyst. Analyze the person's face and hair in the provided photo.

Determine:
1. Face shape: oval, round, square, heart, oblong, diamond, triangle, inverted_triangle
2. Current hair length: short (above ears / buzz / crew cut level), medium (ear to shoulder length), long (past shoulders)
3. Hair type (texture pattern): straight (no bend, falls flat), wavy (S-shaped bends, loose waves), curly (defined spiral curls, springy), coily (tight coils or zigzag pattern, very springy, Afro-textured)
4. Hair thickness: fine (thin individual strands, can see scalp easily), medium (normal strand width), thick (coarse, wide individual strands, very dense)
5. Natural hair color: the person's natural hair color as one of: black, dark_brown, brown, light_brown, red, auburn, blonde, platinum, gray, white, other. Pick the single closest match. Be forgiving of lighting — if roots suggest black but mid-lengths look brown under bright light, call it black.
6. Analysis explanation
7. Recommended hairstyle categories

You MUST call the report_face_shape function with your results.`
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      tools: [
        {
          functionDeclarations: [
            {
              name: "report_face_shape",
              description: "Report the detected face shape and hair analysis results",
              parameters: {
                type: "object",
                properties: {
                  face_shape: {
                    type: "string",
                    enum: ["oval", "round", "square", "heart", "oblong", "diamond", "triangle", "inverted_triangle"],
                  },
                  confidence: { type: "number" },
                  current_hair_length: {
                    type: "string",
                    enum: ["short", "medium", "long"],
                    description: "The person's current hair length: short (above ears), medium (ear to shoulder), long (past shoulders)",
                  },
                  hair_type: {
                    type: "string",
                    enum: ["straight", "wavy", "curly", "coily"],
                    description: "The person's natural hair texture pattern: straight (no bend), wavy (S-shaped), curly (spiral curls), coily (tight coils/zigzag, Afro-textured)",
                  },
                  hair_thickness: {
                    type: "string",
                    enum: ["fine", "medium", "thick"],
                    description: "The thickness/density of the person's hair strands",
                  },
                  natural_hair_color: {
                    type: "string",
                    enum: ["black", "dark_brown", "brown", "light_brown", "red", "auburn", "blonde", "platinum", "gray", "white", "other"],
                    description: "The person's natural hair color as visible in the image. Pick the single closest match.",
                  },
                  analysis: { type: "string" },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["face_shape", "confidence", "current_hair_length", "hair_type", "hair_thickness", "natural_hair_color", "analysis", "recommendations"],
              },
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["report_face_shape"],
        },
      },
    });

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: requestBody,
        }
      );
      if (response.status !== 429 || attempt === 2) break;
      const delay = (attempt + 1) * 2000 + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }

    if (!response!.ok) {
      if (response!.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response!.text();
      console.error("Gemini API error:", response!.status, text);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response!.json();
    const candidates = data.candidates;

    if (!candidates || candidates.length === 0) {
      console.error("No candidates in response:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI analysis failed — no response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts = candidates[0].content?.parts || [];

    // Look for function call in response
    const fnCall = parts.find((p: any) => p.functionCall);
    if (fnCall?.functionCall?.args) {
      return new Response(JSON.stringify(fnCall.functionCall.args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: try to parse JSON from text parts
    const textContent = parts.map((p: any) => p.text || "").join("");
    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {}

    return new Response(JSON.stringify({ error: "Could not parse face shape analysis" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-face-shape error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
