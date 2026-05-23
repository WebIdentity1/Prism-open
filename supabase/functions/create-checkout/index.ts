import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const toStripeMetadata = (value: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined && entry !== null)
      .map(([key, entry]) => [key, String(entry)])
  );

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const body = await req.json() as {
      mode?: string;
      line_items?: Stripe.Checkout.SessionCreateParams.LineItem[];
      success_url?: string;
      cancel_url?: string;
      metadata?: Record<string, unknown>;
      save_payment_method?: boolean;
      customer_email?: string;
      customer_name?: string;
      customer_reference_id?: string;
      onboarding_token?: string;
    };
    const {
      mode,
      line_items,
      success_url,
      cancel_url,
      metadata,
      save_payment_method,
      customer_email,
      customer_name,
      customer_reference_id,
      onboarding_token,
    } = body;

    const checkoutMode = mode === "setup" || mode === "subscription" ? mode : "payment";
    if ((checkoutMode === "payment" || checkoutMode === "subscription") && (!line_items || line_items.length === 0)) {
      throw new Error("line_items are required");
    }

    let user: Awaited<ReturnType<typeof supabaseClient.auth.getUser>>["data"]["user"] | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        const { data } = await supabaseClient.auth.getUser(token);
        user = data.user;
      }
    }

    let customerReferenceId = user?.id ?? customer_reference_id;
    if (!user && checkoutMode !== "setup") {
      throw new Error("User not authenticated");
    }

    if (!user) {
      const appointmentId = typeof metadata?.appointment_id === "string" ? metadata.appointment_id : undefined;
      if (metadata?.type !== "card_setup" || !appointmentId || !onboarding_token) {
        throw new Error("Anonymous checkout is only available for validated onboarding links");
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: appointment, error: appointmentError } = await supabaseAdmin
        .from("appointments")
        .select("client_id, onboarding_token")
        .eq("id", appointmentId)
        .maybeSingle();

      if (appointmentError) throw appointmentError;
      if (!appointment || appointment.onboarding_token !== onboarding_token) {
        throw new Error("Invalid onboarding session");
      }

      customerReferenceId = customerReferenceId ?? appointment.client_id;
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    const customerEmail = user?.email ?? customer_email;
    const customerName = (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined) ?? customer_name;
    if (!customerEmail && !customerReferenceId) {
      throw new Error("customer_email or customer_reference_id is required");
    }

    // Find or create Stripe customer
    let customerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(customerEmail ? { email: customerEmail } : {}),
        ...(customerName ? { name: customerName } : {}),
        ...(customerReferenceId ? { metadata: { supabase_user_id: customerReferenceId } } : {}),
      });
      customerId = customer.id;
    }

    const origin = Deno.env.get("PUBLIC_SITE_URL") || req.headers.get("origin") || "http://localhost:8080";

    // Look up salon's Stripe Connect account for transfer
    let transferData: Stripe.Checkout.SessionCreateParams.PaymentIntentData.TransferData | undefined;
    const salonId = metadata?.salon_id;
    if (salonId) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: salon } = await supabaseAdmin.from("salons").select("stripe_account_id").eq("id", salonId).single();
      if (salon?.stripe_account_id) {
        transferData = { destination: salon.stripe_account_id };
      }
    }

    const sessionMetadata = toStripeMetadata({
      ...(metadata || {}),
      ...(customerReferenceId ? { supabase_user_id: customerReferenceId } : {}),
      ...(checkoutMode === "subscription" && customerReferenceId ? { client_id: customerReferenceId } : {}),
    });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      ...(checkoutMode !== "setup" && line_items?.length ? { line_items } : {}),
      mode: checkoutMode,
      success_url: success_url || `${origin}/dashboard/appointments`,
      cancel_url: cancel_url || `${origin}/dashboard/book`,
      metadata: sessionMetadata,
    };

    // Add transfer to salon's Connect account if available
    if (checkoutMode === "payment") {
      sessionParams.payment_intent_data = {
        metadata: sessionMetadata,
        ...(save_payment_method ? { setup_future_usage: "off_session" } : {}),
        ...(transferData ? { transfer_data: transferData } : {}),
      };
    }

    if (checkoutMode === "setup") {
      sessionParams.setup_intent_data = { metadata: sessionMetadata };
    }

    if (checkoutMode === "subscription") {
      sessionParams.subscription_data = { metadata: sessionMetadata };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error.message || "Unknown error";
    let status = 500;
    if (message.includes("STRIPE_SECRET_KEY")) status = 501;
    else if (message.includes("Invalid API Key")) status = 502;
    else if (message.includes("not authenticated") || message.includes("Invalid onboarding")) status = 401;
    else if (message.includes("required") || message.includes("line_items")) status = 400;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
