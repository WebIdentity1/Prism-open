import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tool definitions for the AI model
const tools = [
  // ── READ TOOLS ──────────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_revenue_summary",
      description:
        "Get revenue summary for a salon over a date range. Returns total revenue, appointment count, and average per appointment.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          start_date: { type: "string", description: "ISO date e.g. 2026-03-01" },
          end_date: { type: "string", description: "ISO date e.g. 2026-03-08" },
        },
        required: ["salon_id", "start_date", "end_date"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_upcoming_appointments",
      description:
        "Get upcoming appointments for a salon. Returns list with client name, stylist name, service, and time.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          limit: { type: "number", description: "Max results (default 10)" },
        },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_clients",
      description:
        "Search clients by name or find clients inactive for X days. Returns client list with contact info and last visit date.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          name_query: { type: "string", description: "Partial name match" },
          inactive_days: { type: "number", description: "Clients with no visit in this many days" },
        },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_todays_schedule",
      description: "Get today's full schedule for the salon or a specific stylist.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          stylist_id: { type: "string", description: "Optional stylist UUID to filter" },
        },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reviews_summary",
      description: "Get recent reviews summary: average rating and recent comments.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          days: { type: "number", description: "Look back this many days (default 30)" },
        },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_no_show_stats",
      description: "Get no-show and cancellation statistics for a salon.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          days: { type: "number", description: "Look back this many days (default 30)" },
        },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_staff_list",
      description: "Get list of stylists at the salon with their specialties and levels.",
      parameters: {
        type: "object",
        properties: { salon_id: { type: "string" } },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_services_list",
      description: "Get all active services for a salon with prices and durations.",
      parameters: {
        type: "object",
        properties: { salon_id: { type: "string" } },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_loyalty_stats",
      description: "Get loyalty program statistics: total points awarded, top earners, redemption rate.",
      parameters: {
        type: "object",
        properties: { salon_id: { type: "string" } },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },

  // ── WRITE / ACTION TOOLS ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "create_appointment",
      description:
        "Book an appointment directly when you have all required details. Use show_widget('quick_book') if any details are missing.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          client_id: { type: "string", description: "UUID of the client" },
          stylist_id: { type: "string", description: "UUID of the stylist" },
          service_id: { type: "string", description: "UUID of the service" },
          start_time: { type: "string", description: "ISO datetime e.g. 2026-03-10T14:00:00Z" },
          notes: { type: "string", description: "Optional booking notes" },
        },
        required: ["salon_id", "client_id", "stylist_id", "start_time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_appointment",
      description: "Cancel a specific appointment by ID. Only after user confirmed.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
        },
        required: ["appointment_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "block_stylist_time",
      description: "Block off time for a stylist (creates a blocked appointment). Use when user says 'block off' or 'mark as unavailable'.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          stylist_id: { type: "string" },
          start_time: { type: "string", description: "ISO datetime" },
          end_time: { type: "string", description: "ISO datetime" },
          notes: { type: "string", description: "Reason for block e.g. 'Lunch break'" },
        },
        required: ["salon_id", "stylist_id", "start_time", "end_time"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message_to_client",
      description: "Send a direct message to a client by their user_id.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          recipient_id: { type: "string", description: "Client user UUID" },
          message: { type: "string", description: "Message body text" },
        },
        required: ["salon_id", "recipient_id", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_service",
      description: "Add a new service to the salon menu.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          duration_minutes: { type: "number", description: "Default 60" },
          category: { type: "string", description: "e.g. 'Cuts', 'Color', 'Treatment'" },
          description: { type: "string" },
        },
        required: ["salon_id", "name", "price"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_service",
      description: "Update an existing service's details.",
      parameters: {
        type: "object",
        properties: {
          service_id: { type: "string" },
          name: { type: "string" },
          price: { type: "number" },
          duration_minutes: { type: "number" },
          category: { type: "string" },
          description: { type: "string" },
          is_active: { type: "boolean" },
        },
        required: ["service_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_salon_settings",
      description: "Update salon settings like deposit percentage, cancellation window hours, etc.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          deposit_percentage: { type: "number", description: "Booking deposit % (0-100)" },
          cancellation_window_hours: { type: "number", description: "Hours before appointment for free cancellation" },
          loyalty_enabled: { type: "boolean" },
          loyalty_points_per_dollar: { type: "number" },
          loyalty_points_per_service: { type: "number" },
        },
        required: ["salon_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "award_loyalty_points",
      description: "Manually award loyalty points to a client.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          client_id: { type: "string" },
          points: { type: "number", description: "Number of points to award (positive integer)" },
          reason: { type: "string", description: "Reason for the award" },
        },
        required: ["salon_id", "client_id", "points", "reason"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_client_note",
      description: "Add a note to a client's profile visible to salon staff.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          client_id: { type: "string" },
          author_id: { type: "string", description: "The current user's UUID" },
          note: { type: "string" },
        },
        required: ["salon_id", "client_id", "author_id", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_campaign_email",
      description:
        "Generate a branded HTML marketing email using AI. Returns subject, html, and summary. Call this BEFORE create_campaign when the user wants an email campaign.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          prompt: { type: "string", description: "Describe what the email should be about" },
        },
        required: ["salon_id", "prompt"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_campaign",
      description:
        "Create a marketing campaign (email or SMS) draft in the database. For email campaigns, first call generate_campaign_email to build the HTML content.",
      parameters: {
        type: "object",
        properties: {
          salon_id: { type: "string" },
          name: { type: "string", description: "Campaign name" },
          channel: { type: "string", enum: ["email", "sms"], description: "Delivery channel" },
          segment: { type: "string", description: "Target segment: 'all', 'inactive_60', 'inactive_90', 'new_clients'" },
          subject: { type: "string", description: "Email subject line (email only)" },
          body: { type: "string", description: "Campaign body — HTML for email, plain text for SMS" },
          status: { type: "string", enum: ["draft", "sent"], description: "Use 'draft' unless user explicitly said to send now" },
        },
        required: ["salon_id", "name", "channel", "body"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_campaign",
      description: "Mark a draft campaign as sent and dispatch it to recipients.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          salon_id: { type: "string" },
        },
        required: ["campaign_id", "salon_id"],
        additionalProperties: false,
      },
    },
  },

  // ── WIDGET TOOL ───────────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "show_widget",
      description:
        "Show an interactive UI widget inline in the chat. Use when you need user input to complete an action (missing client, service, or date details). For email campaigns already created, use type='email_preview' with the campaign_id.",
      parameters: {
        type: "object",
        properties: {
          widget_type: {
            type: "string",
            enum: [
              "quick_book",
              "cancel_appointment",
              "send_message",
              "send_campaign",
              "client_lookup",
              "block_time",
              "email_preview",
            ],
          },
          context: {
            type: "object",
            description:
              "Pre-populated data. For quick_book: {client_name?, client_id?, service_hint?, stylist_name?, date_hint?}. For email_preview: {campaign_id, subject?}. For send_campaign: {segment_hint?, message_hint?}. For client_lookup: {client_name?, client_id?}. For block_time: {date_hint?, start_time?, end_time?}.",
          },
        },
        required: ["widget_type"],
        additionalProperties: false,
      },
    },
  },
];

// ── Tool execution ──────────────────────────────────────────────────────────
async function executeTool(
  supabase: any,
  toolName: string,
  args: any,
  currentUserId: string,
  supabaseUrl: string,
  geminiApiKey: string
): Promise<string> {
  try {
    switch (toolName) {
      case "get_revenue_summary":
        return await getRevenueSummary(supabase, args.salon_id, args.start_date, args.end_date);
      case "get_upcoming_appointments":
        return await getUpcomingAppointments(supabase, args.salon_id, args.limit || 10);
      case "search_clients":
        return await searchClients(supabase, args.salon_id, args.name_query, args.inactive_days);
      case "get_todays_schedule":
        return await getTodaysSchedule(supabase, args.salon_id, args.stylist_id);
      case "get_reviews_summary":
        return await getReviewsSummary(supabase, args.salon_id, args.days || 30);
      case "get_no_show_stats":
        return await getNoShowStats(supabase, args.salon_id, args.days || 30);
      case "get_staff_list":
        return await getStaffList(supabase, args.salon_id);
      case "get_services_list":
        return await getServicesList(supabase, args.salon_id);
      case "get_loyalty_stats":
        return await getLoyaltyStats(supabase, args.salon_id);
      case "cancel_appointment":
        return await cancelAppointment(supabase, args.appointment_id);
      case "create_appointment":
        return await createAppointment(supabase, args);
      case "block_stylist_time":
        return await blockStylistTime(supabase, args, currentUserId);
      case "send_message_to_client":
        return await sendMessageToClient(supabase, args, supabaseUrl);
      case "create_service":
        return await createService(supabase, args);
      case "update_service":
        return await updateService(supabase, args);
      case "update_salon_settings":
        return await updateSalonSettings(supabase, args);
      case "award_loyalty_points":
        return await awardLoyaltyPoints(supabase, args);
      case "add_client_note":
        return await addClientNote(supabase, args, currentUserId);
      case "generate_campaign_email":
        return await generateCampaignEmail(supabase, args, supabaseUrl, geminiApiKey);
      case "create_campaign":
        return await createCampaign(supabase, args);
      case "send_campaign":
        return await sendCampaign(supabase, args);
      case "show_widget":
        return JSON.stringify({ widget_rendered: true, type: args.widget_type, context: args.context || {} });
      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (e: any) {
    console.error(`Tool ${toolName} error:`, e);
    return JSON.stringify({ error: e.message });
  }
}

// ── READ TOOL IMPLEMENTATIONS ───────────────────────────────────────────────

async function getRevenueSummary(supabase: any, salonId: string, startDate: string, endDate: string): Promise<string> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, start_time, service_id, status, services(name, price)")
    .eq("salon_id", salonId)
    .in("status", ["completed", "confirmed", "booked"])
    .gte("start_time", startDate)
    .lte("start_time", endDate);

  const completed = (appointments || []).filter((a: any) => a.status === "completed");
  const totalRevenue = completed.reduce((sum: number, a: any) => sum + (a.services?.price || 0), 0);

  return JSON.stringify({
    total_revenue: totalRevenue,
    completed_appointments: completed.length,
    total_appointments: (appointments || []).length,
    average_per_appointment: completed.length > 0 ? Math.round((totalRevenue / completed.length) * 100) / 100 : 0,
    period: `${startDate} to ${endDate}`,
  });
}

async function getUpcomingAppointments(supabase: any, salonId: string, limit: number): Promise<string> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("appointments")
    .select("id, start_time, end_time, status, client_id, stylist_id, notes, services(name, price, duration_minutes)")
    .eq("salon_id", salonId)
    .gte("start_time", now)
    .in("status", ["booked", "confirmed"])
    .order("start_time", { ascending: true })
    .limit(limit);

  const enriched = [];
  for (const appt of data || []) {
    const [{ data: cp }, { data: sp }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", appt.client_id).single(),
      supabase.from("profiles").select("full_name").eq("user_id", appt.stylist_id).single(),
    ]);
    enriched.push({
      id: appt.id,
      client: cp?.full_name || "Unknown",
      stylist: sp?.full_name || "Unknown",
      service: appt.services?.name || "N/A",
      price: appt.services?.price || 0,
      start_time: appt.start_time,
      end_time: appt.end_time,
      status: appt.status,
    });
  }
  return JSON.stringify({ upcoming_appointments: enriched });
}

async function searchClients(supabase: any, salonId: string, nameQuery?: string, inactiveDays?: number): Promise<string> {
  const { data: appts } = await supabase
    .from("appointments")
    .select("client_id, start_time, status")
    .eq("salon_id", salonId)
    .order("start_time", { ascending: false });

  const clientMap: Record<string, { lastVisit: string; totalVisits: number }> = {};
  for (const a of appts || []) {
    if (!clientMap[a.client_id]) clientMap[a.client_id] = { lastVisit: a.start_time, totalVisits: 0 };
    if (a.status === "completed") clientMap[a.client_id].totalVisits++;
  }

  const clientIds = Object.keys(clientMap);
  if (clientIds.length === 0) return JSON.stringify({ clients: [], total: 0 });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone")
    .in("user_id", clientIds.slice(0, 100));

  let results = (profiles || []).map((p: any) => ({
    id: p.user_id,
    name: p.full_name || "Unknown",
    phone: p.phone,
    last_visit: clientMap[p.user_id]?.lastVisit,
    total_visits: clientMap[p.user_id]?.totalVisits || 0,
    days_since_last_visit: Math.floor((Date.now() - new Date(clientMap[p.user_id]?.lastVisit).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  if (nameQuery) {
    const q = nameQuery.toLowerCase();
    results = results.filter((c: any) => c.name.toLowerCase().includes(q));
  }
  if (inactiveDays) results = results.filter((c: any) => c.days_since_last_visit >= inactiveDays);
  results.sort((a: any, b: any) => b.days_since_last_visit - a.days_since_last_visit);
  return JSON.stringify({ clients: results.slice(0, 20), total: results.length });
}

async function getTodaysSchedule(supabase: any, salonId: string, stylistId?: string): Promise<string> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  let query = supabase
    .from("appointments")
    .select("id, start_time, end_time, status, client_id, stylist_id, services(name, price)")
    .eq("salon_id", salonId)
    .gte("start_time", startOfDay)
    .lt("start_time", endOfDay)
    .order("start_time", { ascending: true });

  if (stylistId) query = query.eq("stylist_id", stylistId);
  const { data } = await query;

  const enriched = [];
  for (const appt of data || []) {
    const [{ data: cp }, { data: sp }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", appt.client_id).single(),
      supabase.from("profiles").select("full_name").eq("user_id", appt.stylist_id).single(),
    ]);
    enriched.push({
      id: appt.id,
      client: cp?.full_name || "Unknown",
      stylist: sp?.full_name || "Unknown",
      service: appt.services?.name || "N/A",
      start_time: appt.start_time,
      end_time: appt.end_time,
      status: appt.status,
    });
  }
  return JSON.stringify({ date: startOfDay.split("T")[0], schedule: enriched, total_appointments: enriched.length });
}

async function getReviewsSummary(supabase: any, salonId: string, days: number): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("reviews")
    .select("rating, comment, created_at")
    .eq("salon_id", salonId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const reviews = data || [];
  const avgRating = reviews.length > 0 ? Math.round((reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  return JSON.stringify({
    total_reviews: reviews.length,
    average_rating: avgRating,
    recent_reviews: reviews.slice(0, 5).map((r: any) => ({ rating: r.rating, comment: r.comment, date: r.created_at })),
    period_days: days,
  });
}

async function getNoShowStats(supabase: any, salonId: string, days: number): Promise<string> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase.from("appointments").select("status").eq("salon_id", salonId).gte("start_time", since);
  const all = data || [];
  const noShows = all.filter((a: any) => a.status === "no_show").length;
  const cancelled = all.filter((a: any) => a.status === "cancelled").length;
  return JSON.stringify({
    total_appointments: all.length,
    no_shows: noShows,
    cancellations: cancelled,
    no_show_rate: all.length > 0 ? Math.round((noShows / all.length) * 1000) / 10 + "%" : "0%",
    cancellation_rate: all.length > 0 ? Math.round((cancelled / all.length) * 1000) / 10 + "%" : "0%",
    period_days: days,
  });
}

async function getStaffList(supabase: any, salonId: string): Promise<string> {
  const { data } = await supabase
    .from("stylist_profiles")
    .select("user_id, specialties, years_experience, bio, stylist_levels(name)")
    .eq("salon_id", salonId);

  const enriched = [];
  for (const sp of data || []) {
    const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("user_id", sp.user_id).single();
    enriched.push({
      id: sp.user_id,
      name: profile?.full_name || "Unknown",
      phone: profile?.phone,
      level: sp.stylist_levels?.name || "N/A",
      specialties: sp.specialties || [],
      years_experience: sp.years_experience,
    });
  }
  return JSON.stringify({ staff: enriched });
}

async function getServicesList(supabase: any, salonId: string): Promise<string> {
  const { data } = await supabase
    .from("services")
    .select("id, name, price, duration_minutes, category, member_price")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("category", { ascending: true });
  return JSON.stringify({ services: data || [] });
}

async function getLoyaltyStats(supabase: any, salonId: string): Promise<string> {
  const { data: points } = await supabase.from("loyalty_points").select("client_id, points").eq("salon_id", salonId);
  const allPoints = points || [];
  const totalAwarded = allPoints.reduce((s: number, p: any) => s + (p.points > 0 ? p.points : 0), 0);
  const totalRedeemed = allPoints.reduce((s: number, p: any) => s + (p.points < 0 ? Math.abs(p.points) : 0), 0);
  const clientPoints: Record<string, number> = {};
  for (const p of allPoints) clientPoints[p.client_id] = (clientPoints[p.client_id] || 0) + p.points;
  return JSON.stringify({
    total_points_awarded: totalAwarded,
    total_points_redeemed: totalRedeemed,
    net_outstanding: totalAwarded - totalRedeemed,
    unique_clients: Object.keys(clientPoints).length,
  });
}

// ── WRITE TOOL IMPLEMENTATIONS ───────────────────────────────────────────────

async function cancelAppointment(supabase: any, appointmentId: string): Promise<string> {
  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .select("id, start_time, status")
    .single();
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, appointment: data, message: "Appointment has been cancelled." });
}

async function createAppointment(supabase: any, args: any): Promise<string> {
  // Determine end_time from service duration or default 60 min
  let durationMinutes = 60;
  if (args.service_id) {
    const { data: svc } = await supabase.from("services").select("duration_minutes").eq("id", args.service_id).single();
    if (svc?.duration_minutes) durationMinutes = svc.duration_minutes;
  }
  const startTime = new Date(args.start_time);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  // Check for conflicting appointments
  const { data: conflicts } = await supabase
    .from("appointments")
    .select("id")
    .eq("stylist_id", args.stylist_id)
    .in("status", ["booked", "confirmed"])
    .lt("start_time", endTime.toISOString())
    .gt("end_time", args.start_time)
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return JSON.stringify({ error: "Time slot conflicts with an existing appointment for this stylist." });
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: args.salon_id,
      client_id: args.client_id,
      stylist_id: args.stylist_id,
      service_id: args.service_id || null,
      start_time: args.start_time,
      end_time: endTime.toISOString(),
      notes: args.notes || null,
      status: "booked",
      payment_status: "pending",
    })
    .select("id, start_time, end_time, status")
    .single();

  if (error) return JSON.stringify({ error: error.message });

  // Get names for confirmation
  const [{ data: cp }, { data: sp }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", args.client_id).single(),
    supabase.from("profiles").select("full_name").eq("user_id", args.stylist_id).single(),
  ]);

  return JSON.stringify({
    success: true,
    appointment_id: data.id,
    client: cp?.full_name || args.client_id,
    stylist: sp?.full_name || args.stylist_id,
    start_time: data.start_time,
    end_time: data.end_time,
    status: data.status,
    message: `Appointment booked successfully for ${cp?.full_name || "client"} with ${sp?.full_name || "stylist"}.`,
  });
}

async function blockStylistTime(supabase: any, args: any, currentUserId: string): Promise<string> {
  // Find a placeholder client (use the stylist themselves as client for blocked time)
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      salon_id: args.salon_id,
      client_id: args.stylist_id, // blocked time — stylist is "client"
      stylist_id: args.stylist_id,
      start_time: args.start_time,
      end_time: args.end_time,
      notes: args.notes || "Blocked time",
      status: "booked",
      payment_status: "pending",
    })
    .select("id, start_time, end_time")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    success: true,
    blocked: data,
    message: `Time blocked from ${args.start_time} to ${args.end_time}.`,
  });
}

async function sendMessageToClient(supabase: any, args: any, supabaseUrl: string): Promise<string> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const fnUrl = `${supabaseUrl}/functions/v1/send-message`;

  const resp = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      recipient_id: args.recipient_id,
      body: args.message,
      salon_id: args.salon_id,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return JSON.stringify({ error: `Failed to send message: ${text}` });
  }
  return JSON.stringify({ success: true, message: "Message sent to client." });
}

async function createService(supabase: any, args: any): Promise<string> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      salon_id: args.salon_id,
      name: args.name,
      price: args.price,
      duration_minutes: args.duration_minutes || 60,
      category: args.category || null,
      description: args.description || null,
      is_active: true,
    })
    .select("id, name, price, duration_minutes")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, service: data, message: `Service "${args.name}" created at $${args.price}.` });
}

async function updateService(supabase: any, args: any): Promise<string> {
  const updates: Record<string, any> = {};
  if (args.name !== undefined) updates.name = args.name;
  if (args.price !== undefined) updates.price = args.price;
  if (args.duration_minutes !== undefined) updates.duration_minutes = args.duration_minutes;
  if (args.category !== undefined) updates.category = args.category;
  if (args.description !== undefined) updates.description = args.description;
  if (args.is_active !== undefined) updates.is_active = args.is_active;

  const { data, error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", args.service_id)
    .select("id, name, price, duration_minutes, is_active")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, service: data, message: `Service updated successfully.` });
}

async function updateSalonSettings(supabase: any, args: any): Promise<string> {
  const updates: Record<string, any> = {};
  if (args.deposit_percentage !== undefined) updates.deposit_percentage = args.deposit_percentage;
  if (args.cancellation_window_hours !== undefined) updates.cancellation_window_hours = args.cancellation_window_hours;
  if (args.loyalty_enabled !== undefined) updates.loyalty_enabled = args.loyalty_enabled;
  if (args.loyalty_points_per_dollar !== undefined) updates.loyalty_points_per_dollar = args.loyalty_points_per_dollar;
  if (args.loyalty_points_per_service !== undefined) updates.loyalty_points_per_service = args.loyalty_points_per_service;

  if (Object.keys(updates).length === 0) return JSON.stringify({ error: "No settings to update provided." });

  const { error } = await supabase.from("salons").update(updates).eq("id", args.salon_id);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, updated: updates, message: "Salon settings updated." });
}

async function awardLoyaltyPoints(supabase: any, args: any): Promise<string> {
  const { data, error } = await supabase
    .from("loyalty_points")
    .insert({
      salon_id: args.salon_id,
      client_id: args.client_id,
      points: args.points,
      reason: args.reason,
    })
    .select("id, points, reason")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, record: data, message: `Awarded ${args.points} loyalty points.` });
}

async function addClientNote(supabase: any, args: any, currentUserId: string): Promise<string> {
  const { data, error } = await supabase
    .from("client_notes")
    .insert({
      salon_id: args.salon_id,
      client_id: args.client_id,
      author_id: args.author_id || currentUserId,
      note: args.note,
    })
    .select("id, note, created_at")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, note: data, message: "Note added to client profile." });
}

async function generateCampaignEmail(supabase: any, args: any, supabaseUrl: string, geminiApiKey: string): Promise<string> {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const fnUrl = `${supabaseUrl}/functions/v1/generate-email`;

  const resp = await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
    body: JSON.stringify({
      salon_id: args.salon_id,
      prompt: args.prompt,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("generate-email fn error:", resp.status, text);
    return JSON.stringify({ error: `Email generation failed: ${resp.status}` });
  }

  const result = await resp.json();
  if (result.error) return JSON.stringify({ error: result.error });

  return JSON.stringify({
    success: true,
    subject: result.subject,
    html: result.html,
    summary: result.summary,
  });
}

async function createCampaign(supabase: any, args: any): Promise<string> {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      salon_id: args.salon_id,
      name: args.name,
      channel: args.channel || "email",
      segment: args.segment || "all",
      subject: args.subject || null,
      body: args.body,
      status: args.status || "draft",
      sent_at: args.status === "sent" ? new Date().toISOString() : null,
    })
    .select("id, name, channel, segment, status, subject")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    success: true,
    campaign_id: data.id,
    campaign: data,
    message: `Campaign "${args.name}" created as ${data.status}.`,
  });
}

async function sendCampaign(supabase: any, args: any): Promise<string> {
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", args.campaign_id)
    .eq("salon_id", args.salon_id)
    .select("id, name, status")
    .single();

  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ success: true, campaign: data, message: `Campaign "${data.name}" has been sent.` });
}

// ── Main server ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabaseUser = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for all DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { messages, salon_id } = await req.json();
    if (!salon_id) {
      return new Response(JSON.stringify({ error: "salon_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: salon } = await supabase.from("salons").select("id, name").eq("id", salon_id).single();
    if (!salon) {
      return new Response(JSON.stringify({ error: "Salon not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();

    const systemPrompt = `You are an agentic AI business assistant for "${salon.name}", a hair salon. You help salon owners and stylists manage their business by answering questions AND directly executing admin actions.

The current user is ${profile?.full_name || user.email} (user_id: ${user.id}). The salon ID is ${salon_id}. Today's date is ${new Date().toISOString().split("T")[0]}.

## Core Behavior

**AGENTIC FIRST**: When the user asks you to perform an action, execute it directly using your action tools whenever you have enough information. Do NOT ask unnecessary follow-up questions.

**Action tools you can execute directly:**
- create_appointment — book appointments (search clients + get services first if needed)
- cancel_appointment — cancel bookings
- block_stylist_time — block off unavailable time
- send_message_to_client — send messages to clients
- create_service / update_service — manage the service menu
- update_salon_settings — change deposit %, cancellation window, loyalty settings
- award_loyalty_points — give points to a client
- add_client_note — add a note to a client record
- generate_campaign_email → create_campaign — build and save email campaigns
- send_campaign — dispatch a campaign

**When to use show_widget instead of direct execution:**
- You're missing a critical detail that can't be inferred (e.g., no client name given at all)
- The action is high-stakes (sending campaigns to everyone) and the user didn't explicitly say to proceed — show email_preview widget first
- Use email_preview widget after create_campaign so the user can review before sending

**Email campaign workflow:**
1. Call generate_campaign_email with a prompt describing the email
2. Call create_campaign with the HTML, subject, segment (default "all"), status="draft"
3. Call show_widget with type="email_preview" and context={campaign_id: "<id>", subject: "<subject>"}
4. Do NOT auto-send unless user explicitly said "send it now"

## Data & Formatting
- Always use tools to fetch real data before answering data questions. Never fabricate numbers.
- Format currency as USD (e.g. $125.00).
- Format dates in a friendly way (e.g. "Thursday March 12 at 2:00 PM").
- Use markdown (bold, lists, tables) for readability.
- If a question is ambiguous, use your best judgment and explain what you did.
- For date ranges, default to the current week or last 30 days depending on context.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Initial AI call
    let response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: aiMessages,
        tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("Gemini API error:", status, t);
      throw new Error(`Gemini API error: ${status}`);
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    // Tool-calling loop (up to 8 iterations for chained actions)
    let iterations = 0;
    let lastWidgetData: any = null;

    while (assistantMessage?.tool_calls && iterations < 8) {
      iterations++;
      const toolResults = [];

      for (const tc of assistantMessage.tool_calls) {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        console.log(`[iter ${iterations}] Executing tool: ${tc.function.name}`, JSON.stringify(args).slice(0, 200));

        if (tc.function.name === "show_widget") {
          lastWidgetData = { type: args.widget_type, context: args.context || {} };
        }

        const toolResult = await executeTool(supabase, tc.function.name, args, user.id, SUPABASE_URL, GEMINI_API_KEY);
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
      }

      // Save current assistant message (with tool_calls) before it gets overwritten
      const previousAssistantMsg = assistantMessage;

      const continueMessages = [...aiMessages, assistantMessage, ...toolResults];

      response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: continueMessages,
          tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("Gemini API error on tool loop:", response.status, t);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;

      // Update aiMessages with the OLD assistant message (that had tool_calls) and its results
      aiMessages.push(previousAssistantMsg, ...toolResults);
    }

    // Capture any widget in final message tool_calls
    if (!lastWidgetData && assistantMessage?.tool_calls) {
      const widgetCall = assistantMessage.tool_calls.find((tc: any) => tc.function.name === "show_widget");
      if (widgetCall) {
        const wArgs = typeof widgetCall.function.arguments === "string" ? JSON.parse(widgetCall.function.arguments) : widgetCall.function.arguments;
        lastWidgetData = { type: wArgs.widget_type, context: wArgs.context || {} };
      }
    }

    const finalContent = assistantMessage?.content || "";
    const responseBody: any = { content: finalContent };
    if (lastWidgetData) responseBody.widget = lastWidgetData;

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
