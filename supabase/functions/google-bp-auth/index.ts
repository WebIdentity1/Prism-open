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
    const GOOGLE_BP_CLIENT_ID = Deno.env.get("GOOGLE_BP_CLIENT_ID");
    const GOOGLE_BP_CLIENT_SECRET = Deno.env.get("GOOGLE_BP_CLIENT_SECRET");
    if (!GOOGLE_BP_CLIENT_ID || !GOOGLE_BP_CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Google Business Profile integration is not configured. Set GOOGLE_BP_CLIENT_ID and GOOGLE_BP_CLIENT_SECRET in your project secrets." }), {
        status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action, code, redirect_uri, salon_id } = body;

    // Verify salon ownership
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: salon, error: salonErr } = await adminSupabase
      .from("salons")
      .select("id, owner_id")
      .eq("id", salon_id)
      .single();

    if (salonErr || !salon || salon.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Salon not found or not owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_auth_url") {
      const scopes = [
        "https://www.googleapis.com/auth/business.manage",
      ].join(" ");

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_BP_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${salon_id}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "exchange_code") {
      // Exchange authorization code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_BP_CLIENT_ID,
          client_secret: GOOGLE_BP_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        return new Response(JSON.stringify({ error: "Token exchange failed", details: tokens }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the account and location info
      let accountId = null;
      let locationId = null;

      try {
        const accountsRes = await fetch(
          "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );
        const accountsData = await accountsRes.json();
        if (accountsData.accounts?.length > 0) {
          accountId = accountsData.accounts[0].name; // e.g. "accounts/123"

          // Get locations for this account
          const locationsRes = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`,
            { headers: { Authorization: `Bearer ${tokens.access_token}` } }
          );
          const locationsData = await locationsRes.json();
          if (locationsData.locations?.length > 0) {
            locationId = locationsData.locations[0].name; // e.g. "locations/456"
          }
        }
      } catch (e) {
        console.error("Failed to fetch GBP account/location:", e);
      }

      // Store tokens and account info
      const { error: updateErr } = await adminSupabase
        .from("salons")
        .update({
          google_bp_tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Date.now() + (tokens.expires_in * 1000),
          },
          google_bp_account_id: accountId,
          google_bp_location_id: locationId,
        })
        .eq("id", salon_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: "Failed to store tokens" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        account_id: accountId,
        location_id: locationId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      await adminSupabase
        .from("salons")
        .update({
          google_bp_tokens: null,
          google_bp_account_id: null,
          google_bp_location_id: null,
          google_bp_last_sync: null,
        })
        .eq("id", salon_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("google-bp-auth error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
