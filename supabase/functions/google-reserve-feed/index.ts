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
    const url = new URL(req.url);
    const salonId = url.searchParams.get("salon_id");
    if (!salonId) {
      return new Response(JSON.stringify({ error: "salon_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch salon
    const { data: salon, error: salonErr } = await supabase
      .from("salons")
      .select("*")
      .eq("id", salonId)
      .single();

    if (salonErr || !salon) {
      return new Response(JSON.stringify({ error: "Salon not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!salon.google_reserve_enabled) {
      return new Response(JSON.stringify({ error: "Google Reserve not enabled for this salon" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch services
    const { data: services } = await supabase
      .from("services")
      .select("id, name, description, price, duration_minutes, category")
      .eq("salon_id", salonId)
      .eq("is_active", true);

    // Fetch stylists + availability
    const { data: stylistProfiles } = await supabase
      .from("stylist_profiles")
      .select("user_id")
      .eq("salon_id", salonId);

    const stylistIds = (stylistProfiles || []).map((s: any) => s.user_id);

    let availability: any[] = [];
    if (stylistIds.length > 0) {
      const { data: avail } = await supabase
        .from("stylist_availability")
        .select("stylist_id, day_of_week, start_time, end_time")
        .in("stylist_id", stylistIds);
      availability = avail || [];
    }

    const feed = {
      merchant: {
        id: salon.id,
        name: salon.name,
        address: [salon.address, salon.city, salon.state, salon.zip].filter(Boolean).join(", "),
        phone: salon.phone,
        website: salon.website,
      },
      services: (services || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: { amount: s.price, currency: "USD" },
        duration_minutes: s.duration_minutes,
        category: s.category,
      })),
      availability: availability.map((a: any) => ({
        stylist_id: a.stylist_id,
        day_of_week: a.day_of_week,
        start_time: a.start_time,
        end_time: a.end_time,
      })),
    };

    return new Response(JSON.stringify(feed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
