import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Cancel appointments stuck in "booked" status for more than 30 minutes
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabaseClient
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("status", "booked")
      .lt("created_at", cutoff)
      .select("id");

    if (error) throw error;

    const count = data?.length || 0;
    console.log(`Cleaned up ${count} stale booked appointments`);

    return new Response(JSON.stringify({ cleaned: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
