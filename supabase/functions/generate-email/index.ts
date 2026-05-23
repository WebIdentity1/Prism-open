import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { salon_id, prompt, conversation_history, current_html } = await req.json();
    if (!salon_id || !prompt) throw new Error("salon_id and prompt are required");

    // Fetch salon branding
    const { data: salon, error: salonErr } = await supabase
      .from("salons")
      .select("name, logo_url, brand_primary_color, brand_secondary_color, brand_font, phone, email, website, address, city, state")
      .eq("id", salon_id)
      .single();
    if (salonErr) throw new Error("Failed to fetch salon: " + salonErr.message);

    // Fetch brand assets (photos)
    const { data: assets } = await supabase
      .from("brand_assets")
      .select("url, label, type")
      .eq("salon_id", salon_id)
      .order("created_at", { ascending: false })
      .limit(20);

    const logoUrl = salon.logo_url || "";
    const photos = (assets || []).filter((a: any) => a.type === "photo").map((a: any) => a.url);

    const systemPrompt = `You are an expert email designer for salons. Generate responsive HTML emails that look stunning on all devices and email clients.

SALON BRANDING:
- Salon Name: ${salon.name}
- Primary Color: ${salon.brand_primary_color}
- Secondary Color: ${salon.brand_secondary_color}
- Font Family: ${salon.brand_font}
- Logo URL: ${logoUrl}
- Phone: ${salon.phone || "N/A"}
- Email: ${salon.email || "N/A"}
- Website: ${salon.website || "N/A"}
- Address: ${[salon.address, salon.city, salon.state].filter(Boolean).join(", ") || "N/A"}

AVAILABLE SALON PHOTOS (use these as images in the email when appropriate):
${photos.length > 0 ? photos.map((url: string, i: number) => `${i + 1}. ${url}`).join("\n") : "No photos available — use solid color blocks and typography instead."}

DESIGN RULES:
1. Use ONLY inline CSS (no <style> blocks, no external CSS) for maximum email client compatibility
2. Use table-based layout for email compatibility
3. The primary color should be used for CTAs, headers, and accents
4. The secondary color for backgrounds and subtle highlights
5. Include the salon logo at the top if a URL is provided
6. Include a footer with salon contact info and an unsubscribe placeholder
7. Make the design feel premium and professional — this is a salon brand
8. All images should have alt text
9. Use the brand font in font-family with web-safe fallbacks
10. Keep the email width at 600px max

${current_html ? `CURRENT EMAIL HTML (the user wants to edit this):\n${current_html}\n\nModify the existing email based on the user's new instructions.` : "Generate a new email from scratch."}`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: prompt });

    const body: any = {
      model: "gemini-2.5-flash",
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "generate_email",
            description: "Return a responsive HTML email with subject line and summary",
            parameters: {
              type: "object",
              properties: {
                subject: {
                  type: "string",
                  description: "Email subject line, compelling and concise",
                },
                html: {
                  type: "string",
                  description: "Complete responsive HTML email with inline styles, table layout, 600px max width",
                },
                summary: {
                  type: "string",
                  description: "Brief 1-2 sentence summary of what was generated or changed",
                },
              },
              required: ["subject", "html", "summary"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_email" } },
    };

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text();
      console.error("Gemini API error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const result = await aiResponse.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured output");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      subject: parsed.subject,
      html: parsed.html,
      summary: parsed.summary,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
