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

  try {
    const { salon_id, event_name, event_data, event_id } = await req.json();

    if (!salon_id || !event_name) {
      return new Response(JSON.stringify({ error: "salon_id and event_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: salon } = await supabase
      .from("salons")
      .select("meta_pixel_id, meta_conversions_api_key")
      .eq("id", salon_id)
      .single();

    if (!salon?.meta_pixel_id || !salon?.meta_conversions_api_key) {
      return new Response(JSON.stringify({ error: "Meta Pixel not configured for this salon" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      data: [
        {
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event_id || crypto.randomUUID(),
          action_source: "website",
          ...(event_data || {}),
        },
      ],
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${salon.meta_pixel_id}/events?access_token=${salon.meta_conversions_api_key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const metaData = await metaRes.json();

    return new Response(JSON.stringify({ success: metaRes.ok, meta_response: metaData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Meta event error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
