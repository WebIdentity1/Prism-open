export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointment_photos: {
        Row: {
          appointment_id: string
          client_id: string
          created_at: string
          id: string
          notes: string | null
          photo_url: string
          salon_id: string
          stylist_id: string
        }
        Insert: {
          appointment_id: string
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url: string
          salon_id: string
          stylist_id: string
        }
        Update: {
          appointment_id?: string
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string
          salon_id?: string
          stylist_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          client_id: string
          consultation_id: string | null
          created_at: string
          end_time: string
          id: string
          notes: string | null
          onboarding_completed: boolean
          onboarding_token: string | null
          payment_status: string
          salon_id: string
          service_id: string | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          stylist_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          consultation_id?: string | null
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          onboarding_completed?: boolean
          onboarding_token?: string | null
          payment_status?: string
          salon_id: string
          service_id?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          stylist_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          consultation_id?: string | null
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          onboarding_completed?: boolean
          onboarding_token?: string | null
          payment_status?: string
          salon_id?: string
          service_id?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          stylist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_profiles_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "appointments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_stylist_id_profiles_fkey"
            columns: ["stylist_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          created_at: string
          id: string
          label: string | null
          salon_id: string
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          salon_id: string
          type?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          salon_id?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          channel: string
          client_id: string
          created_at: string
          id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          channel: string
          client_id: string
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          client_id?: string
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ai_conversation: Json
          body: string
          channel: string
          created_at: string
          id: string
          name: string
          salon_id: string
          segment: string
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          ai_conversation?: Json
          body: string
          channel?: string
          created_at?: string
          id?: string
          name: string
          salon_id: string
          segment?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          ai_conversation?: Json
          body?: string
          channel?: string
          created_at?: string
          id?: string
          name?: string
          salon_id?: string
          segment?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      client_favorites: {
        Row: {
          created_at: string
          id: string
          salon_id: string
          service_id: string
          stylist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          salon_id: string
          service_id: string
          stylist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          salon_id?: string
          service_id?: string
          stylist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_favorites_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_favorites_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_memberships: {
        Row: {
          client_id: string
          created_at: string
          credits_remaining: number | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          salon_id: string
          started_at: string
          status: string
          tier_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          credits_remaining?: number | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          salon_id: string
          started_at?: string
          status?: string
          tier_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          credits_remaining?: number | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          salon_id?: string
          started_at?: string
          status?: string
          tier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_memberships_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_memberships_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          author_id: string
          client_id: string
          created_at: string
          id: string
          note: string
          salon_id: string
        }
        Insert: {
          author_id: string
          client_id: string
          created_at?: string
          id?: string
          note: string
          salon_id: string
        }
        Update: {
          author_id?: string
          client_id?: string
          created_at?: string
          id?: string
          note?: string
          salon_id?: string
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          allergies: string[] | null
          created_at: string
          hair_length: string | null
          hair_texture: string | null
          hair_type: string | null
          id: string
          product_preferences: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[] | null
          created_at?: string
          hair_length?: string | null
          hair_texture?: string | null
          hair_type?: string | null
          id?: string
          product_preferences?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string[] | null
          created_at?: string
          hair_length?: string | null
          hair_texture?: string | null
          hair_type?: string | null
          id?: string
          product_preferences?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          client_id: string
          client_notes: string | null
          created_at: string
          face_analysis_notes: string | null
          face_shape: Database["public"]["Enums"]["face_shape"] | null
          face_shape_confidence: number | null
          id: string
          salon_id: string | null
          selfie_url: string | null
          status: string
          stylist_id: string | null
          stylist_notes: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          client_notes?: string | null
          created_at?: string
          face_analysis_notes?: string | null
          face_shape?: Database["public"]["Enums"]["face_shape"] | null
          face_shape_confidence?: number | null
          id?: string
          salon_id?: string | null
          selfie_url?: string | null
          status?: string
          stylist_id?: string | null
          stylist_notes?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          client_notes?: string | null
          created_at?: string
          face_analysis_notes?: string | null
          face_shape?: Database["public"]["Enums"]["face_shape"] | null
          face_shape_confidence?: number | null
          id?: string
          salon_id?: string | null
          selfie_url?: string | null
          status?: string
          stylist_id?: string | null
          stylist_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_client_id_profiles_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "consultations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          salon_id: string | null
          subject: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          salon_id?: string | null
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          salon_id?: string | null
          subject?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          form_id: string
          id: string
          responses: Json
          salon_id: string
          submitted_at: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          form_id: string
          id?: string
          responses?: Json
          salon_id: string
          submitted_at?: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          form_id?: string
          id?: string
          responses?: Json
          salon_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          is_public: boolean
          salon_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          salon_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          salon_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      google_reviews: {
        Row: {
          comment: string | null
          google_review_id: string
          id: string
          rating: number
          reply: string | null
          reply_updated_at: string | null
          review_time: string
          reviewer_name: string
          reviewer_photo_url: string | null
          salon_id: string
          synced_at: string
        }
        Insert: {
          comment?: string | null
          google_review_id: string
          id?: string
          rating: number
          reply?: string | null
          reply_updated_at?: string | null
          review_time?: string
          reviewer_name?: string
          reviewer_photo_url?: string | null
          salon_id: string
          synced_at?: string
        }
        Update: {
          comment?: string | null
          google_review_id?: string
          id?: string
          rating?: number
          reply?: string | null
          reply_updated_at?: string | null
          review_time?: string
          reviewer_name?: string
          reviewer_photo_url?: string | null
          salon_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_reviews_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          errors: Json | null
          file_url: string | null
          id: string
          processed_rows: number | null
          salon_id: string
          status: string
          total_rows: number | null
          type: string
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          file_url?: string | null
          id?: string
          processed_rows?: number | null
          salon_id: string
          status?: string
          total_rows?: number | null
          type: string
        }
        Update: {
          created_at?: string
          errors?: Json | null
          file_url?: string | null
          id?: string
          processed_rows?: number | null
          salon_id?: string
          status?: string
          total_rows?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          id: string
          points: number
          reason: string
          salon_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          points?: number
          reason: string
          salon_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          points?: number
          reason?: string
          salon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tiers: {
        Row: {
          billing_interval: string
          cleanup_window_end: number | null
          cleanup_window_start: number | null
          created_at: string
          id: string
          included_services: string[] | null
          is_active: boolean | null
          max_credits: number | null
          name: string
          price: number
          salon_id: string
          updated_at: string
        }
        Insert: {
          billing_interval?: string
          cleanup_window_end?: number | null
          cleanup_window_start?: number | null
          created_at?: string
          id?: string
          included_services?: string[] | null
          is_active?: boolean | null
          max_credits?: number | null
          name: string
          price: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          cleanup_window_end?: number | null
          cleanup_window_start?: number | null
          created_at?: string
          id?: string
          included_services?: string[] | null
          is_active?: boolean | null
          max_credits?: number | null
          name?: string
          price?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_tiers_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivery_channel: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          delivery_channel?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivery_channel?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          points_awarded: number | null
          referred_id: string
          referrer_id: string
          salon_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number | null
          referred_id: string
          referrer_id: string
          salon_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number | null
          referred_id?: string
          referrer_id?: string
          salon_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: string
          client_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          salon_id: string
          stylist_id: string
        }
        Insert: {
          appointment_id: string
          client_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          salon_id: string
          stylist_id: string
        }
        Update: {
          appointment_id?: string
          client_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          salon_id?: string
          stylist_id?: string
        }
        Relationships: []
      }
      salons: {
        Row: {
          address: string | null
          brand_font: string
          brand_primary_color: string
          brand_secondary_color: string
          cancellation_window_hours: number | null
          city: string | null
          created_at: string
          default_commission_rate: number | null
          deposit_percentage: number | null
          description: string | null
          email: string | null
          google_analytics_id: string | null
          google_bp_account_id: string | null
          google_bp_last_sync: string | null
          google_bp_location_id: string | null
          google_bp_tokens: Json | null
          google_reserve_enabled: boolean
          hours: Json | null
          id: string
          logo_url: string | null
          loyalty_enabled: boolean
          loyalty_point_value_cents: number
          loyalty_points_per_dollar: number
          loyalty_points_per_service: number
          loyalty_referral_points: number
          meta_conversions_api_key: string | null
          meta_pixel_id: string | null
          name: string
          notification_preferences: Json | null
          offpeak_discount_rules: Json
          offpeak_discounts_enabled: boolean
          onboarding_status: string
          owner_id: string
          payment_collection_mode: string
          phone: string | null
          require_booking_forms: boolean
          state: string | null
          stripe_account_id: string | null
          surge_pricing_enabled: boolean
          surge_pricing_rules: Json
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          brand_font?: string
          brand_primary_color?: string
          brand_secondary_color?: string
          cancellation_window_hours?: number | null
          city?: string | null
          created_at?: string
          default_commission_rate?: number | null
          deposit_percentage?: number | null
          description?: string | null
          email?: string | null
          google_analytics_id?: string | null
          google_bp_account_id?: string | null
          google_bp_last_sync?: string | null
          google_bp_location_id?: string | null
          google_bp_tokens?: Json | null
          google_reserve_enabled?: boolean
          hours?: Json | null
          id?: string
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_point_value_cents?: number
          loyalty_points_per_dollar?: number
          loyalty_points_per_service?: number
          loyalty_referral_points?: number
          meta_conversions_api_key?: string | null
          meta_pixel_id?: string | null
          name: string
          notification_preferences?: Json | null
          offpeak_discount_rules?: Json
          offpeak_discounts_enabled?: boolean
          onboarding_status?: string
          owner_id: string
          payment_collection_mode?: string
          phone?: string | null
          require_booking_forms?: boolean
          state?: string | null
          stripe_account_id?: string | null
          surge_pricing_enabled?: boolean
          surge_pricing_rules?: Json
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          brand_font?: string
          brand_primary_color?: string
          brand_secondary_color?: string
          cancellation_window_hours?: number | null
          city?: string | null
          created_at?: string
          default_commission_rate?: number | null
          deposit_percentage?: number | null
          description?: string | null
          email?: string | null
          google_analytics_id?: string | null
          google_bp_account_id?: string | null
          google_bp_last_sync?: string | null
          google_bp_location_id?: string | null
          google_bp_tokens?: Json | null
          google_reserve_enabled?: boolean
          hours?: Json | null
          id?: string
          logo_url?: string | null
          loyalty_enabled?: boolean
          loyalty_point_value_cents?: number
          loyalty_points_per_dollar?: number
          loyalty_points_per_service?: number
          loyalty_referral_points?: number
          meta_conversions_api_key?: string | null
          meta_pixel_id?: string | null
          name?: string
          notification_preferences?: Json | null
          offpeak_discount_rules?: Json
          offpeak_discounts_enabled?: boolean
          onboarding_status?: string
          owner_id?: string
          payment_collection_mode?: string
          phone?: string | null
          require_booking_forms?: boolean
          state?: string | null
          stripe_account_id?: string | null
          surge_pricing_enabled?: boolean
          surge_pricing_rules?: Json
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      service_forms: {
        Row: {
          created_at: string
          form_id: string
          id: string
          is_required: boolean
          service_id: string
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          is_required?: boolean
          service_id: string
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          is_required?: boolean
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_forms_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_forms_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_level_prices: {
        Row: {
          created_at: string
          id: string
          level_id: string
          price: number
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level_id: string
          price: number
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level_id?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_level_prices_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "stylist_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_level_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          member_price: number | null
          name: string
          price: number
          salon_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          member_price?: number | null
          name: string
          price: number
          salon_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          member_price?: number | null
          name?: string
          price?: number
          salon_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      style_board_items: {
        Row: {
          consultation_id: string
          created_at: string
          id: string
          inspiration_url: string | null
          is_selected: boolean | null
          notes: string | null
          style_id: string | null
          try_on_result_url: string | null
          user_id: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          id?: string
          inspiration_url?: string | null
          is_selected?: boolean | null
          notes?: string | null
          style_id?: string | null
          try_on_result_url?: string | null
          user_id: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          id?: string
          inspiration_url?: string | null
          is_selected?: boolean | null
          notes?: string | null
          style_id?: string | null
          try_on_result_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_board_items_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "style_board_items_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "style_gallery"
            referencedColumns: ["id"]
          },
        ]
      }
      style_gallery: {
        Row: {
          category: string
          compatible_face_shapes: Database["public"]["Enums"]["face_shape"][]
          created_at: string
          description: string | null
          gender: string | null
          hair_length: string | null
          id: string
          image_url: string
          is_active: boolean | null
          name: string
          tags: string[] | null
        }
        Insert: {
          category: string
          compatible_face_shapes?: Database["public"]["Enums"]["face_shape"][]
          created_at?: string
          description?: string | null
          gender?: string | null
          hair_length?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          name: string
          tags?: string[] | null
        }
        Update: {
          category?: string
          compatible_face_shapes?: Database["public"]["Enums"]["face_shape"][]
          created_at?: string
          description?: string | null
          gender?: string | null
          hair_length?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          name?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      stylist_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          salon_id: string | null
          start_time: string
          stylist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          salon_id?: string | null
          start_time: string
          stylist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          salon_id?: string | null
          start_time?: string
          stylist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_availability_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_levels: {
        Row: {
          created_at: string
          id: string
          name: string
          salon_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          salon_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          salon_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stylist_levels_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      stylist_profiles: {
        Row: {
          bio: string | null
          calendar_feed_token: string | null
          commission_rate: number | null
          commission_type: string
          created_at: string
          enable_greater_of: boolean
          hourly_rate: number | null
          id: string
          level_id: string | null
          product_commission_rate: number | null
          salon_id: string | null
          sliding_scale_tiers: Json | null
          specialties: string[] | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          calendar_feed_token?: string | null
          commission_rate?: number | null
          commission_type?: string
          created_at?: string
          enable_greater_of?: boolean
          hourly_rate?: number | null
          id?: string
          level_id?: string | null
          product_commission_rate?: number | null
          salon_id?: string | null
          sliding_scale_tiers?: Json | null
          specialties?: string[] | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          calendar_feed_token?: string | null
          commission_rate?: number | null
          commission_type?: string
          created_at?: string
          enable_greater_of?: boolean
          hourly_rate?: number | null
          id?: string
          level_id?: string | null
          product_commission_rate?: number | null
          salon_id?: string | null
          sliding_scale_tiers?: Json | null
          specialties?: string[] | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stylist_profiles_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "stylist_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_profiles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_conversation_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "client" | "stylist" | "salon_admin"
      appointment_status:
        | "booked"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      face_shape:
        | "oval"
        | "round"
        | "square"
        | "heart"
        | "oblong"
        | "diamond"
        | "triangle"
        | "inverted_triangle"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["client", "stylist", "salon_admin"],
      appointment_status: [
        "booked",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      face_shape: [
        "oval",
        "round",
        "square",
        "heart",
        "oblong",
        "diamond",
        "triangle",
        "inverted_triangle",
      ],
    },
  },
} as const
