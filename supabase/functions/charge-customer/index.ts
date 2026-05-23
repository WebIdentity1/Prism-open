import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.json();
    const { customer_email, amount, description, appointment_id, salon_id } = body;

    if (!customer_email || !amount) {
      throw new Error("customer_email and amount are required");
    }
    if (!salon_id) {
      throw new Error("salon_id is required");
    }

    // Verify caller is salon owner or stylist of this salon
    const { data: salon } = await adminClient
      .from("salons")
      .select("id, owner_id, stripe_account_id")
      .eq("id", salon_id)
      .single();
    if (!salon) throw new Error("Salon not found");

    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["salon_admin", "stylist"]);

    const isSalonAdmin = (roleRows || []).some(({ role }) => role === "salon_admin");
    const isStylist = (roleRows || []).some(({ role }) => role === "stylist");
    if (!isSalonAdmin && !isStylist) throw new Error("Not authorized");

    let authorized = false;
    if (isSalonAdmin && salon.owner_id === user.id) {
      authorized = true;
    }
    if (!authorized && isStylist) {
      const { data: stylistProfile } = await adminClient
        .from("stylist_profiles")
        .select("salon_id")
        .eq("user_id", user.id)
        .maybeSingle();
      authorized = stylistProfile?.salon_id === salon_id;
    }
    if (!authorized) throw new Error("Not authorized");

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: customer_email, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error("No saved payment method found for this customer");
    }
    const customer = customers.data[0];

    // Get default payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      throw new Error("Customer has no saved payment methods");
    }

    const paymentMethod = paymentMethods.data[0];

    // Build PaymentIntent params; route funds to salon's connected account if linked
    const piParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount), // amount in cents
      currency: "usd",
      customer: customer.id,
      payment_method: paymentMethod.id,
      off_session: true,
      confirm: true,
      description: description || "In-salon charge",
      metadata: {
        appointment_id: appointment_id || "",
        salon_id,
        charged_by: user.id,
      },
    };

    if (salon.stripe_account_id) {
      piParams.transfer_data = { destination: salon.stripe_account_id };
    }

    const paymentIntent = await stripe.paymentIntents.create(piParams);

    return new Response(JSON.stringify({
      success: true,
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Charge error:", error);
    const message = error.message || "Unknown error";
    let status = 500;
    if (message.includes("STRIPE_SECRET_KEY")) status = 501;
    else if (message.includes("Invalid API Key")) status = 502;
    else if (message.includes("Not authenticated") || message.includes("Not authorized")) status = 401;
    else if (message.includes("required")) status = 400;
    else if (message.includes("No saved payment method") || message.includes("no saved payment") || message.includes("not found")) status = 404;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
