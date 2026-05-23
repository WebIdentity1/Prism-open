import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: number } | null> {
  const clientId = Deno.env.get("GOOGLE_BP_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_BP_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000),
  };
}

async function getValidToken(salon: any, adminSupabase: any): Promise<string | null> {
  const tokens = salon.google_bp_tokens;
  if (!tokens?.refresh_token) return null;

  // If token still valid (with 5min buffer)
  if (tokens.access_token && tokens.expires_at && tokens.expires_at > Date.now() + 300000) {
    return tokens.access_token;
  }

  // Refresh
  const refreshed = await refreshAccessToken(tokens.refresh_token);
  if (!refreshed) return null;

  // Update stored tokens
  await adminSupabase
    .from("salons")
    .update({
      google_bp_tokens: {
        ...tokens,
        access_token: refreshed.access_token,
        expires_at: refreshed.expires_at,
      },
    })
    .eq("id", salon.id);

  return refreshed.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { salon_id, actions } = body; // actions: ["reviews", "reply", "hours", "booking_link", "photos"]

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: salon, error: salonErr } = await adminSupabase
      .from("salons")
      .select("*")
      .eq("id", salon_id)
      .single();

    if (salonErr || !salon || salon.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Salon not found or not owner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidToken(salon, adminSupabase);
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Google account not connected or token expired. Please reconnect." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountId = salon.google_bp_account_id;
    const locationId = salon.google_bp_location_id;
    if (!accountId || !locationId) {
      return new Response(JSON.stringify({ error: "No Google Business location found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, any> = {};
    const syncActions = actions || ["reviews"];

    // ── Sync Reviews ──
    if (syncActions.includes("reviews")) {
      try {
        const reviewsRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const reviewsData = await reviewsRes.json();

        if (reviewsData.reviews) {
          const upsertRows = reviewsData.reviews.map((r: any) => ({
            salon_id,
            google_review_id: r.reviewId,
            reviewer_name: r.reviewer?.displayName || "Anonymous",
            reviewer_photo_url: r.reviewer?.profilePhotoUrl || null,
            rating: { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }[r.starRating as string] || 0,
            comment: r.comment || null,
            reply: r.reviewReply?.comment || null,
            reply_updated_at: r.reviewReply?.updateTime || null,
            review_time: r.createTime,
            synced_at: new Date().toISOString(),
          }));

          const { error: upsertErr } = await adminSupabase
            .from("google_reviews")
            .upsert(upsertRows, { onConflict: "salon_id,google_review_id" });

          results.reviews = {
            synced: upsertRows.length,
            error: upsertErr?.message || null,
          };
        } else {
          results.reviews = { synced: 0, message: reviewsData.error?.message || "No reviews found" };
        }
      } catch (e: any) {
        results.reviews = { error: e.message };
      }
    }

    // ── Reply to Review ──
    if (syncActions.includes("reply") && body.review_google_id && body.reply_text) {
      try {
        const replyRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${accountId}/${locationId}/reviews/${body.review_google_id}/reply`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ comment: body.reply_text }),
          }
        );
        const replyData = await replyRes.json();
        if (replyRes.ok) {
          // Update local record
          await adminSupabase
            .from("google_reviews")
            .update({
              reply: body.reply_text,
              reply_updated_at: new Date().toISOString(),
            })
            .eq("salon_id", salon_id)
            .eq("google_review_id", body.review_google_id);

          results.reply = { success: true };
        } else {
          results.reply = { error: replyData.error?.message || "Failed to reply" };
        }
      } catch (e: any) {
        results.reply = { error: e.message };
      }
    }

    // ── Update Booking Link ──
    if (syncActions.includes("booking_link")) {
      try {
        // Use Place Actions API to set booking link
        const bookingUrl = `${body.booking_base_url || "https://prism.app"}/join/${salon_id}`;

        // List existing place action links
        const listRes = await fetch(
          `https://mybusinessplaceactions.googleapis.com/v1/${locationId}/placeActionLinks`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const listData = await listRes.json();

        // Find existing APPOINTMENT link or create new
        const existing = listData.placeActionLinks?.find(
          (l: any) => l.placeActionType === "APPOINTMENT"
        );

        if (existing) {
          await fetch(
            `https://mybusinessplaceactions.googleapis.com/v1/${existing.name}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ uri: bookingUrl }),
            }
          );
        } else {
          await fetch(
            `https://mybusinessplaceactions.googleapis.com/v1/${locationId}/placeActionLinks`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                uri: bookingUrl,
                placeActionType: "APPOINTMENT",
              }),
            }
          );
        }
        results.booking_link = { success: true, url: bookingUrl };
      } catch (e: any) {
        results.booking_link = { error: e.message };
      }
    }

    // ── Sync Hours ──
    if (syncActions.includes("hours") && salon.hours) {
      try {
        const dayMap: Record<string, string> = {
          mon: "MONDAY", tue: "TUESDAY", wed: "WEDNESDAY",
          thu: "THURSDAY", fri: "FRIDAY", sat: "SATURDAY", sun: "SUNDAY",
        };
        const periods: any[] = [];
        const salonHours = salon.hours as Record<string, any>;

        for (const [day, hours] of Object.entries(salonHours)) {
          if (hours && dayMap[day]) {
            periods.push({
              openDay: dayMap[day],
              openTime: { hours: parseInt(hours.open?.split(":")[0]), minutes: parseInt(hours.open?.split(":")[1]) || 0 },
              closeDay: dayMap[day],
              closeTime: { hours: parseInt(hours.close?.split(":")[0]), minutes: parseInt(hours.close?.split(":")[1]) || 0 },
            });
          }
        }

        const patchRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=regularHours`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ regularHours: { periods } }),
          }
        );
        results.hours = { success: patchRes.ok };
      } catch (e: any) {
        results.hours = { error: e.message };
      }
    }

    // Update last sync time
    await adminSupabase
      .from("salons")
      .update({ google_bp_last_sync: new Date().toISOString() })
      .eq("id", salon_id);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("google-bp-sync error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
