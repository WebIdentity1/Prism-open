import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Verify caller is authenticated staff
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    if (!data.user) throw new Error("Not authenticated");

    const { appointment_id, phone, site_url } = await req.json();
    if (!appointment_id) throw new Error("appointment_id is required");
    if (!phone) throw new Error("phone is required");

    // Fetch appointment with service role to get the onboarding_token
    const { data: appointment, error: apptError } = await adminClient
      .from("appointments")
      .select("id, onboarding_token, salon_id")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appointment) throw new Error("Appointment not found");

    const onboardingToken = appointment.onboarding_token;
    const baseUrl = site_url || Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("SITE_URL") || "http://localhost:8080";
    const onboardingUrl = `${baseUrl}/onboard/${appointment_id}?token=${onboardingToken}`;

    // Try to send SMS via Twilio
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (twilioSid && twilioAuth && twilioPhone) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const body = new URLSearchParams({
        To: phone,
        From: twilioPhone,
        Body: `Your appointment has been booked! Please complete your check-in here: ${onboardingUrl}`,
      });

      const twilioRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!twilioRes.ok) {
        const err = await twilioRes.text();
        console.error("Twilio error:", err);
        return new Response(JSON.stringify({
          success: false,
          fallback: true,
          onboarding_url: onboardingUrl,
          error: "SMS delivery failed"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ success: true, onboarding_url: onboardingUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // No Twilio configured — return the URL for manual sharing
    return new Response(JSON.stringify({
      success: false,
      fallback: true,
      onboarding_url: onboardingUrl,
      error: "SMS not configured"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Send onboarding SMS error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
