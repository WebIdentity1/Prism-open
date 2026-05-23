import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Formatting helpers ────────────────────────────────────────────────────────

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

const DAY_OF_WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHours(hours: any): string {
  if (!hours || typeof hours !== "object") return "Contact us for current hours.";
  const lines: string[] = [];
  for (const [key, label] of Object.entries(DAY_NAMES)) {
    const day = (hours as any)[key];
    if (!day || (day as any).closed) {
      lines.push(`  ${label}: Closed`);
    } else {
      lines.push(`  ${label}: ${(day as any).open} - ${(day as any).close}`);
    }
  }
  return lines.join("\n");
}

function formatLocation(salon: any): string {
  const parts = [salon.address, salon.city, salon.state, salon.zip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "";
}

function formatContact(salon: any): string {
  const parts: string[] = [];
  if (salon.phone) parts.push(`  Phone: ${salon.phone}`);
  if (salon.email) parts.push(`  Email: ${salon.email}`);
  if (salon.website) parts.push(`  Website: ${salon.website}`);
  return parts.join("\n");
}

function formatStaffAvailability(avail: any[]): string {
  if (!avail || avail.length === 0) return "Schedule not set";
  return avail
    .map((a: any) => `${DAY_OF_WEEK_NAMES[a.day_of_week]} ${a.start_time}-${a.end_time}`)
    .join(", ");
}

// ── Build comprehensive system prompt from all salon data ─────────────────────

async function buildSystemPrompt(supabase: any, salonId: string): Promise<string> {
  // 1. Fetch full salon details
  const { data: salon } = await supabase
    .from("salons")
    .select(`
      name, description,
      address, city, state, zip,
      phone, email, website,
      hours,
      cancellation_window_hours, deposit_percentage,
      loyalty_enabled, loyalty_points_per_dollar, loyalty_points_per_service,
      loyalty_point_value_cents, loyalty_referral_points,
      offpeak_discounts_enabled, surge_pricing_enabled
    `)
    .eq("id", salonId)
    .single();

  if (!salon) return "You are a salon receptionist. Please help the caller.";

  // 2. Fetch services with descriptions and member pricing
  const { data: services } = await supabase
    .from("services")
    .select("name, description, price, member_price, duration_minutes, category")
    .eq("salon_id", salonId)
    .eq("is_active", true)
    .order("category", { ascending: true });

  // Group services by category
  const servicesByCategory = new Map<string, any[]>();
  for (const s of services || []) {
    const cat = s.category || "General";
    if (!servicesByCategory.has(cat)) servicesByCategory.set(cat, []);
    servicesByCategory.get(cat)!.push(s);
  }

  let serviceMenu = "";
  for (const [category, svcs] of servicesByCategory) {
    serviceMenu += `\n  ${category}:\n`;
    for (const s of svcs) {
      let line = `    - ${s.name}: $${s.price}, ${s.duration_minutes} min`;
      if (s.member_price && s.member_price !== s.price) {
        line += ` (member price: $${s.member_price})`;
      }
      if (s.description) {
        line += ` — ${s.description}`;
      }
      serviceMenu += line + "\n";
    }
  }
  serviceMenu = serviceMenu.trim();

  // 3. Fetch staff with bio, specialties, experience + batch profile names
  const { data: staff } = await supabase
    .from("stylist_profiles")
    .select("user_id, bio, specialties, years_experience, stylist_levels(name)")
    .eq("salon_id", salonId);

  const staffUserIds = (staff || []).map((sp: any) => sp.user_id);
  const { data: staffProfiles } = staffUserIds.length > 0
    ? await supabase.from("profiles").select("user_id, full_name").in("user_id", staffUserIds)
    : { data: [] };
  const profileMap = new Map((staffProfiles || []).map((p: any) => [p.user_id, p.full_name]));

  // 4. Fetch stylist availability
  const { data: availability } = await supabase
    .from("stylist_availability")
    .select("stylist_id, day_of_week, start_time, end_time")
    .eq("salon_id", salonId)
    .order("day_of_week", { ascending: true });

  const availByStylst = new Map<string, any[]>();
  for (const a of availability || []) {
    if (!availByStylst.has(a.stylist_id)) availByStylst.set(a.stylist_id, []);
    availByStylst.get(a.stylist_id)!.push(a);
  }

  // Build staff section
  const staffLines: string[] = [];
  for (const sp of staff || []) {
    const name = profileMap.get(sp.user_id) || "Unknown";
    const level = sp.stylist_levels?.name || "Stylist";
    let line = `  - ${name} (${level})`;
    if (sp.years_experience) line += `, ${sp.years_experience} years experience`;
    if (sp.specialties && sp.specialties.length > 0) {
      line += `\n    Specialties: ${sp.specialties.join(", ")}`;
    }
    if (sp.bio) {
      line += `\n    About: ${sp.bio}`;
    }
    const avail = availByStylst.get(sp.user_id);
    if (avail && avail.length > 0) {
      line += `\n    Available: ${formatStaffAvailability(avail)}`;
    }
    staffLines.push(line);
  }

  // 5. Fetch review stats
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("salon_id", salonId);

  const reviewCount = (reviews || []).length;
  const avgRating = reviewCount > 0
    ? ((reviews || []).reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount).toFixed(1)
    : null;

  // 6. Assemble the prompt with conditional sections
  const location = formatLocation(salon);
  const contact = formatContact(salon);

  let prompt = `You are a friendly, professional AI receptionist for ${salon.name}. You answer phone calls, help with bookings, answer questions about services, and take messages.

IMPORTANT RULES:
- Always be warm, professional, and concise (this is a phone call, not a chat)
- When a caller asks about services, you can reference the service menu below or use the get_services_list tool for the latest info
- When booking, always confirm: service, stylist preference (or any available), date, and time
- If the caller is new, collect their full name and phone number, then use create_client_profile
- If you can't help with something, offer to transfer to a staff member
- Keep responses brief — this is a voice conversation, not text
- When quoting prices, say "dollars" not "dollar sign"`;

  if (salon.description) {
    prompt += `\n\nABOUT US:\n${salon.description}`;
  }

  if (location) {
    prompt += `\n\nLOCATION:\n  ${location}`;
  }

  if (contact) {
    prompt += `\n\nCONTACT INFO:\n${contact}`;
  }

  if (salon.hours) {
    prompt += `\n\nBUSINESS HOURS:\n${formatHours(salon.hours)}`;
  }

  prompt += `\n\nSERVICE MENU:\n${serviceMenu || "No services configured yet."}`;

  prompt += `\n\nSTAFF:\n${staffLines.join("\n\n") || "No staff configured yet."}`;

  if (avgRating) {
    prompt += `\n\nREPUTATION:\n  Average rating: ${avgRating}/5 from ${reviewCount} review${reviewCount !== 1 ? "s" : ""}`;
  }

  prompt += `\n\nPOLICIES:`;
  prompt += `\n  - Cancellation: Appointments must be cancelled at least ${salon.cancellation_window_hours ?? 24} hours in advance`;
  prompt += `\n  - Deposit: A ${salon.deposit_percentage ?? 20}% deposit is required when booking`;

  if (salon.loyalty_enabled) {
    prompt += `\n\nLOYALTY PROGRAM:`;
    prompt += `\n  - Earn ${salon.loyalty_points_per_dollar || 1} point(s) per dollar spent`;
    if (salon.loyalty_points_per_service) {
      prompt += ` and ${salon.loyalty_points_per_service} points per service visit`;
    }
    const pointValue = ((salon.loyalty_point_value_cents || 1) / 100).toFixed(2);
    prompt += `\n  - Points are worth $${pointValue} each when redeemed`;
    if (salon.loyalty_referral_points) {
      prompt += `\n  - Refer a friend and earn ${salon.loyalty_referral_points} bonus points`;
    }
  }

  if (salon.offpeak_discounts_enabled) {
    prompt += `\n\nOFF-PEAK DISCOUNTS:\n  We offer discounts during off-peak hours. If a caller asks, mention that discounted time slots may be available and offer to check.`;
  }

  if (salon.surge_pricing_enabled) {
    prompt += `\n\nPEAK PRICING:\n  Prices may be slightly higher during peak demand times.`;
  }

  return prompt;
}

// ── Main server ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const VOICE_AGENT_SECRET = Deno.env.get("VOICE_AGENT_SECRET");

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
    if (!VOICE_AGENT_SECRET) throw new Error("VOICE_AGENT_SECRET is not configured");

    // Auth: require a valid Supabase JWT (salon admin)
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, salon_id, voice_id, greeting, transfer_phone, phone_number, phone_type, speed } = body;

    // Verify user owns this salon
    const { data: salon } = await supabase
      .from("salons")
      .select("id, name")
      .eq("id", salon_id)
      .eq("owner_id", user.id)
      .single();

    if (!salon) {
      return new Response(JSON.stringify({ error: "Salon not found or unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      // Build comprehensive system prompt from all salon data
      const systemPrompt = await buildSystemPrompt(supabase, salon_id);

      // Define server tools (webhooks back to our edge function)
      const toolsWebhookUrl = `${SUPABASE_URL}/functions/v1/voice-agent-tools`;

      const serverTools = [
        {
          type: "webhook",
          name: "get_services_list",
          description: "Get the list of services offered by the salon with prices and durations",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: { type: "object", properties: {}, required: [] },
        },
        {
          type: "webhook",
          name: "get_staff_list",
          description: "Get the list of stylists/staff with their specialties",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: { type: "object", properties: {}, required: [] },
        },
        {
          type: "webhook",
          name: "get_todays_schedule",
          description: "Check the appointment schedule for a given date to find available time slots. Defaults to today if no date provided.",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: {
            type: "object",
            properties: {
              stylist_id: { type: "string", description: "Optional stylist ID to check schedule for" },
              date: { type: "string", description: "Date to check in YYYY-MM-DD format. Defaults to today if not provided." },
            },
            required: [],
          },
        },
        {
          type: "webhook",
          name: "search_clients",
          description: "Search for a client by name",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: {
            type: "object",
            properties: {
              name_query: { type: "string", description: "Client name to search for" },
            },
            required: ["name_query"],
          },
        },
        {
          type: "webhook",
          name: "lookup_caller",
          description: "Look up a caller by their phone number to identify returning clients",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: {
            type: "object",
            properties: {
              phone_number: { type: "string", description: "Caller's phone number" },
            },
            required: ["phone_number"],
          },
        },
        {
          type: "webhook",
          name: "create_appointment",
          description: "Book a new appointment for a client",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: {
            type: "object",
            properties: {
              client_id: { type: "string", description: "Client's user ID" },
              stylist_id: { type: "string", description: "Stylist's user ID" },
              service_id: { type: "string", description: "Service ID" },
              start_time: { type: "string", description: "Appointment start time in ISO 8601 format" },
              notes: { type: "string", description: "Optional notes" },
            },
            required: ["client_id", "stylist_id", "start_time"],
          },
        },
        {
          type: "webhook",
          name: "cancel_appointment",
          description: "Cancel an existing appointment",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: {
            type: "object",
            properties: {
              appointment_id: { type: "string", description: "The appointment ID to cancel" },
            },
            required: ["appointment_id"],
          },
        },
        {
          type: "webhook",
          name: "create_client_profile",
          description: "Create a new client profile for a first-time caller",
          webhook: {
            url: toolsWebhookUrl,
            method: "POST",
            headers: { "x-voice-agent-secret": VOICE_AGENT_SECRET, "Content-Type": "application/json" },
          },
          parameters: {
            type: "object",
            properties: {
              full_name: { type: "string", description: "Client's full name" },
              phone: { type: "string", description: "Client's phone number" },
            },
            required: ["full_name", "phone"],
          },
        },
      ];

      // Build inline tool definitions for the current ElevenLabs API format
      // Headers: plain strings. Body properties: constant_value for static, description for dynamic.
      const inlineTools = serverTools.map((t) => {
        const bodyProps: Record<string, any> = {
          tool_name: { type: "string", constant_value: t.name },
          salon_id: { type: "string", constant_value: salon_id },
        };
        const props = t.parameters?.properties;
        if (props && typeof props === "object") {
          for (const [paramName, paramDef] of Object.entries(props as Record<string, any>)) {
            bodyProps[paramName] = { type: paramDef.type || "string", description: paramDef.description || paramName };
          }
        }
        return {
          type: "webhook",
          name: t.name,
          description: t.description,
          api_schema: {
            url: t.webhook.url,
            method: t.webhook.method,
            request_headers: t.webhook.headers,
            request_body_schema: {
              type: "object",
              properties: bodyProps,
              required: [...(t.parameters?.required || []), "tool_name", "salon_id"],
            },
          },
        };
      });

      // Create ElevenLabs conversational agent
      const agentPayload: any = {
        name: `${salon.name} Receptionist`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt,
              tools: inlineTools,
            },
            first_message: greeting || "Hello! Thank you for calling. How can I help you today?",
            language: "en",
          },
          tts: {
            voice_id: voice_id || "pNInz6obpgDQGcFmaJgB", // Default: Adam
            speed: speed ?? 1.0,
          },
        },
      };

      const elResp = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agentPayload),
      });

      if (!elResp.ok) {
        const errText = await elResp.text();
        console.error("ElevenLabs create agent error:", elResp.status, errText);
        return new Response(
          JSON.stringify({ error: `ElevenLabs API error: ${elResp.status}`, details: errText }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const agentData = await elResp.json();
      const elevenlabsAgentId = agentData.agent_id;

      // Store in database
      const { data: voiceAgent, error: dbError } = await supabase
        .from("salon_voice_agents")
        .upsert({
          salon_id,
          elevenlabs_agent_id: elevenlabsAgentId,
          phone_number: phone_number || null,
          phone_type: phone_type || "twilio",
          voice_id: voice_id || "pNInz6obpgDQGcFmaJgB",
          is_active: true,
          transfer_phone: transfer_phone || null,
          greeting: greeting || "Hello! Thank you for calling. How can I help you today?",
          speed: speed ?? 1.0,
        }, { onConflict: "salon_id" })
        .select()
        .single();

      if (dbError) {
        return new Response(
          JSON.stringify({ error: `Database error: ${dbError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // If phone_number provided, connect via Twilio
      if (phone_number) {
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
          // Register phone number with ElevenLabs for Twilio
          const phoneResp = await fetch(
            `https://api.elevenlabs.io/v1/convai/agents/${elevenlabsAgentId}/phone-numbers`,
            {
              method: "POST",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                phone_number,
                provider: "twilio",
                twilio_account_sid: TWILIO_ACCOUNT_SID,
                twilio_auth_token: TWILIO_AUTH_TOKEN,
              }),
            },
          );

          if (!phoneResp.ok) {
            const phoneErr = await phoneResp.text();
            console.error("ElevenLabs phone registration error:", phoneErr);
            // Non-fatal — agent is created, phone just isn't connected yet
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          voice_agent: voiceAgent,
          elevenlabs_agent_id: elevenlabsAgentId,
          message: "Voice agent created and configured.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "update") {
      // Update existing agent config
      const { data: existing } = await supabase
        .from("salon_voice_agents")
        .select("*")
        .eq("salon_id", salon_id)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "No voice agent found for this salon" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (greeting !== undefined) updates.greeting = greeting;
      if (voice_id !== undefined) updates.voice_id = voice_id;
      if (transfer_phone !== undefined) updates.transfer_phone = transfer_phone;
      if (phone_number !== undefined) updates.phone_number = phone_number;
      if (phone_type !== undefined) updates.phone_type = phone_type;
      if (body.is_active !== undefined) updates.is_active = body.is_active;
      if (speed !== undefined) updates.speed = speed;

      const { data: updated, error: updateErr } = await supabase
        .from("salon_voice_agents")
        .update(updates)
        .eq("salon_id", salon_id)
        .select()
        .single();

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Push refreshed prompt + settings to ElevenLabs so changes take effect immediately
      if ((existing as any).elevenlabs_agent_id) {
        try {
          const freshPrompt = await buildSystemPrompt(supabase, salon_id);

          const patchBody: any = {
            conversation_config: {
              agent: {
                prompt: { prompt: freshPrompt },
              },
            },
          };

          if (greeting !== undefined) {
            patchBody.conversation_config.agent.first_message = greeting;
          }
          if (voice_id !== undefined || speed !== undefined) {
            patchBody.conversation_config.tts = {
              ...(voice_id !== undefined && { voice_id }),
              ...(speed !== undefined && { speed }),
            };
          }

          const patchResp = await fetch(
            `https://api.elevenlabs.io/v1/convai/agents/${(existing as any).elevenlabs_agent_id}`,
            {
              method: "PATCH",
              headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(patchBody),
            },
          );

          if (!patchResp.ok) {
            console.error("ElevenLabs patch error:", await patchResp.text());
            // Non-fatal — local DB is updated regardless
          }
        } catch (patchErr) {
          console.error("Failed to sync with ElevenLabs:", patchErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, voice_agent: updated, message: "Voice agent updated." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "delete") {
      const { data: existing } = await supabase
        .from("salon_voice_agents")
        .select("elevenlabs_agent_id")
        .eq("salon_id", salon_id)
        .single();

      if (existing?.elevenlabs_agent_id) {
        // Delete from ElevenLabs
        await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existing.elevenlabs_agent_id}`, {
          method: "DELETE",
          headers: { "xi-api-key": ELEVENLABS_API_KEY },
        });
      }

      await supabase.from("salon_voice_agents").delete().eq("salon_id", salon_id);

      return new Response(
        JSON.stringify({ success: true, message: "Voice agent deleted." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: create, update, delete" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Setup voice agent error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
