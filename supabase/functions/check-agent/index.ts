import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
  const VOICE_AGENT_SECRET = Deno.env.get("VOICE_AGENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

  const testTool = {
    type: "webhook",
    name: "get_services_list",
    description: "Get the list of services offered by the salon with prices and durations",
    api_schema: {
      url: `${SUPABASE_URL}/functions/v1/voice-agent-tools`,
      method: "POST",
      request_headers: {
        "x-voice-agent-secret": VOICE_AGENT_SECRET,
        "Content-Type": "application/json",
      },
      request_body_schema: {
        type: "object",
        properties: {
          tool_name: { type: "string", constant_value: "get_services_list" },
          salon_id: { type: "string", constant_value: "test-salon-id" },
        },
        required: ["tool_name", "salon_id"],
      },
    },
  };

  const payload = {
    name: "Test Agent (delete me)",
    conversation_config: {
      agent: {
        prompt: { prompt: "Test agent.", tools: [testTool] },
        first_message: "Hi",
        language: "en",
      },
      tts: { voice_id: "pNInz6obpgDQGcFmaJgB" },
    },
  };

  const resp = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();

  let toolsOnAgent = 0;
  let toolDetail = null;
  if (resp.ok && data.agent_id) {
    const getResp = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${data.agent_id}`, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });
    const agentData = await getResp.json();
    const tools = agentData?.conversation_config?.agent?.prompt?.tools || [];
    toolsOnAgent = tools.length;
    toolDetail = tools[0] || null;
    await fetch(`https://api.elevenlabs.io/v1/convai/agents/${data.agent_id}`, {
      method: "DELETE", headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });
  }

  return new Response(JSON.stringify({
    status: resp.status,
    ok: resp.ok,
    error: data.detail || null,
    tools_on_agent: toolsOnAgent,
    tool_detail: toolDetail,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
