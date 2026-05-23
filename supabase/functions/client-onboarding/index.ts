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

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json();
    const { action, appointment_id, token } = body;

    if (!appointment_id || !token) {
      throw new Error("appointment_id and token are required");
    }

    // Validate token
    const { data: appointment, error: apptError } = await adminClient
      .from("appointments")
      .select("id, client_id, salon_id, service_id, stylist_id, start_time, end_time, status, onboarding_token, onboarding_completed, notes")
      .eq("id", appointment_id)
      .single();

    if (apptError || !appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.onboarding_token !== token) {
      throw new Error("Invalid token");
    }

    if (action === "validate") {
      // Fetch salon details
      const { data: salon } = await adminClient
        .from("salons")
        .select("id, name, cancellation_window_hours, phone, address, city, logo_url")
        .eq("id", appointment.salon_id)
        .single();

      // Fetch service name
      const { data: service } = await adminClient
        .from("services")
        .select("name, price, duration_minutes")
        .eq("id", appointment.service_id)
        .single();

      // Fetch stylist name
      const { data: stylistProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", appointment.stylist_id)
        .single();

      // Fetch client profile
      const { data: clientProfile } = await adminClient
        .from("profiles")
        .select("full_name, phone, user_id")
        .eq("user_id", appointment.client_id)
        .single();

      // Fetch client email via admin auth
      let clientEmail = null;
      try {
        const { data: userData } = await adminClient.auth.admin.getUserById(appointment.client_id);
        clientEmail = userData?.user?.email || null;
      } catch {}

      return new Response(JSON.stringify({
        appointment: {
          id: appointment.id,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: appointment.status,
          onboarding_completed: appointment.onboarding_completed,
        },
        salon,
        service,
        stylist_name: stylistProfile?.full_name || "Your Stylist",
        client: {
          user_id: clientProfile?.user_id,
          full_name: clientProfile?.full_name,
          phone: clientProfile?.phone,
          email: clientEmail,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "update_profile") {
      const { full_name, phone: clientPhone, email, sms_consent, sms_consent_text } = body;
      const update: Record<string, unknown> = { full_name, phone: clientPhone };
      // Only stamp consent when the box was affirmatively checked AND a phone is on file.
      if (sms_consent === true && clientPhone && typeof sms_consent_text === "string" && sms_consent_text.length > 0) {
        update.sms_consent_at = new Date().toISOString();
        update.sms_consent_text = sms_consent_text;
      }
      await adminClient
        .from("profiles")
        .update(update)
        .eq("user_id", appointment.client_id);

      // Update email if changed
      if (email) {
        try {
          await adminClient.auth.admin.updateUserById(appointment.client_id, { email });
        } catch (e) {
          console.error("Email update error:", e);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === "accept_policy") {
      // Mark onboarding as completed and confirm appointment
      await adminClient
        .from("appointments")
        .update({ onboarding_completed: true, status: "confirmed" })
        .eq("id", appointment_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Unknown action: " + action);
  } catch (error) {
    console.error("Client onboarding error:", error);
    const message = error.message || "Unknown error";
    let status = 500;
    if (message === "Appointment not found") status = 404;
    else if (message === "Invalid token") status = 403;
    else if (message.includes("required") || message.startsWith("Unknown action")) status = 400;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
