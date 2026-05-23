import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // Repurposed: list available Gemini models that support image generation
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
  const data = await resp.json();
  const imageModels = (data.models || [])
    .filter((m: any) =>
      m.supportedGenerationMethods?.includes("generateContent") &&
      (m.name?.toLowerCase().includes("image") || m.name?.toLowerCase().includes("imagen"))
    )
    .map((m: any) => ({ name: m.name, displayName: m.displayName, methods: m.supportedGenerationMethods }));

  return new Response(JSON.stringify({ imageModels, allModels: (data.models || []).map((m: any) => m.name) }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
