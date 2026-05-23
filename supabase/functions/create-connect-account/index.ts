import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { salon_id } = await req.json();
    if (!salon_id) throw new Error("salon_id required");

    // Verify ownership
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: salon } = await supabaseAdmin.from("salons").select("id, owner_id, stripe_account_id, name, email").eq("id", salon_id).single();
    if (!salon || salon.owner_id !== user.id) throw new Error("Not authorized");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");

    // If already has a Connect account, return the dashboard link
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let accountId = salon.stripe_account_id;

    if (!accountId) {
      // Standard account: salon gets full Stripe dashboard, pays its own processing fees,
      // and covers its own chargebacks/negative balances. Prism is not on the hook for losses.
      const account = await stripe.accounts.create({
        type: "standard",
        email: salon.email || user.email,
        metadata: { salon_id, supabase_user_id: user.id },
        business_profile: { name: salon.name },
      });
      accountId = account.id;

      // Save to salon
      await supabaseAdmin.from("salons").update({ stripe_account_id: accountId }).eq("id", salon_id);
    }

    // Create onboarding link
    const origin = Deno.env.get("PUBLIC_SITE_URL") || req.headers.get("origin") || "http://localhost:8080";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/dashboard/onboarding`,
      return_url: `${origin}/dashboard/onboarding`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url, account_id: accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Connect account error:", error);
    const message = error.message || "Unknown error";
    let status = 400;
    if (message.includes("STRIPE_SECRET_KEY")) status = 501;
    else if (message.includes("Invalid API Key")) status = 502;
    else if (message.includes("Unauthorized")) status = 401;
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
