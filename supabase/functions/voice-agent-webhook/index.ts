import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-voice-agent-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate via shared secret
    const secret = req.headers.get("x-voice-agent-secret");
    const expectedSecret = Deno.env.get("VOICE_AGENT_SECRET");
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      agent_id,
      conversation_id,
      caller_phone,
      duration_seconds,
      transcript,
      status,
      tool_calls,
    } = body;

    console.log(`Voice webhook: conversation ${conversation_id} for agent ${agent_id}`);

    // Find the voice agent by ElevenLabs agent ID
    const { data: voiceAgent } = await supabase
      .from("salon_voice_agents")
      .select("id, salon_id")
      .eq("elevenlabs_agent_id", agent_id)
      .single();

    if (!voiceAgent) {
      console.error(`No voice agent found for ElevenLabs agent: ${agent_id}`);
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to identify the caller
    let clientId: string | null = null;
    let callerName: string | null = null;

    if (caller_phone) {
      const digits = caller_phone.replace(/\D/g, "");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone");

      const match = (profiles || []).find((p: any) => {
        if (!p.phone) return false;
        return p.phone.replace(/\D/g, "") === digits;
      });

      if (match) {
        clientId = match.user_id;
        callerName = match.full_name;
      }
    }

    // Extract actions taken from tool calls
    const actionsTaken = (tool_calls || []).map((tc: any) => ({
      tool: tc.name || tc.tool_name,
      result: tc.result ? (typeof tc.result === "string" ? tc.result.substring(0, 200) : JSON.stringify(tc.result).substring(0, 200)) : null,
    }));

    // Store call log
    const { data: callLog, error: insertErr } = await supabase
      .from("voice_call_logs")
      .insert({
        salon_id: voiceAgent.salon_id,
        voice_agent_id: voiceAgent.id,
        elevenlabs_conversation_id: conversation_id,
        caller_phone: caller_phone || null,
        caller_name: callerName,
        client_id: clientId,
        duration_seconds: duration_seconds || null,
        transcript: transcript || null,
        actions_taken: actionsTaken,
        status: status || "completed",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Failed to insert call log:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if any appointments were booked during the call — send notification
    const appointmentActions = actionsTaken.filter((a: any) => a.tool === "create_appointment");
    if (appointmentActions.length > 0) {
      // Create a notification for the salon owner
      const { data: salon } = await supabase
        .from("salons")
        .select("owner_id")
        .eq("id", voiceAgent.salon_id)
        .single();

      if (salon?.owner_id) {
        await supabase.from("notifications").insert({
          user_id: salon.owner_id,
          title: "New Phone Booking",
          message: `${callerName || caller_phone || "A caller"} booked an appointment via the voice agent.`,
          type: "appointment",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, call_log_id: callLog?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Voice webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
