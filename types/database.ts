export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'client' | 'stylist' | 'admin'

export type ServiceCategory = 'cut' | 'color' | 'treatment' | 'styling'

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          client_id: string
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          salon_id: string
          scheduled_at: string
          service_id: string
          status: AppointmentStatus
          stylist_profile_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          notes?: string | null
          salon_id: string
          scheduled_at: string
          service_id: string
          status?: AppointmentStatus
          stylist_profile_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          salon_id?: string
          scheduled_at?: string
          service_id?: string
          status?: AppointmentStatus
          stylist_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "appointments_stylist_profile_id_fkey"
            columns: ["stylist_profile_id"]
            isOneToOne: false
            referencedRelation: "stylist_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_profiles: {
        Row: {
          allergies: string[] | null
          created_at: string
          hair_texture: string | null
          hair_type: string | null
          id: string
          photo_url: string | null
          preferences: Json | null
          preferred_salon_id: string | null
          scalp_sensitivity: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string[] | null
          created_at?: string
          hair_texture?: string | null
          hair_type?: string | null
          id?: string
          photo_url?: string | null
          preferences?: Json | null
          preferred_salon_id?: string | null
          scalp_sensitivity?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string[] | null
          created_at?: string
          hair_texture?: string | null
          hair_type?: string | null
          id?: string
          photo_url?: string | null
          preferences?: Json | null
          preferred_salon_id?: string | null
          scalp_sensitivity?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_preferred_salon_id_fkey"
            columns: ["preferred_salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: UserRole
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          role: UserRole
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: UserRole
          updated_at?: string
        }
        Relationships: []
      }
      salons: {
        Row: {
          address: Json | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string | null
          hours: Json | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string
          stripe_account_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: Json | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug: string
          stripe_account_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: Json | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          hours?: Json | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string
          stripe_account_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          base_price: number
          category: ServiceCategory
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          image_url: string | null
          name: string
          salon_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price: number
          category: ServiceCategory
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          image_url?: string | null
          name: string
          salon_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          category?: ServiceCategory
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          image_url?: string | null
          name?: string
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
      stylist_profiles: {
        Row: {
          bio: string | null
          booking_enabled: boolean
          certifications: Json | null
          created_at: string
          hourly_rate: number | null
          id: string
          portfolio_images: string[] | null
          salon_id: string
          specialties: string[] | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          booking_enabled?: boolean
          certifications?: Json | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          portfolio_images?: string[] | null
          salon_id: string
          specialties?: string[] | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          booking_enabled?: boolean
          certifications?: Json | null
          created_at?: string
          hourly_rate?: number | null
          id?: string
          portfolio_images?: string[] | null
          salon_id?: string
          specialties?: string[] | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stylist_profiles_salon_id_fkey"
            columns: ["salon_id"]
            isOneToOne: false
            referencedRelation: "salons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stylist_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// ---------------------------------------------------------------------------
// Helper type aliases
// ---------------------------------------------------------------------------

// Row types (full row as stored in DB)
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Salon = Database['public']['Tables']['salons']['Row']
export type StylistProfile = Database['public']['Tables']['stylist_profiles']['Row']
export type ClientProfile = Database['public']['Tables']['client_profiles']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']

// Insert types (for creating new rows — columns with defaults are optional)
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type SalonInsert = Database['public']['Tables']['salons']['Insert']
export type StylistProfileInsert = Database['public']['Tables']['stylist_profiles']['Insert']
export type ClientProfileInsert = Database['public']['Tables']['client_profiles']['Insert']
export type ServiceInsert = Database['public']['Tables']['services']['Insert']
export type AppointmentInsert = Database['public']['Tables']['appointments']['Insert']

// Update types (for partial updates — all columns optional)
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
export type SalonUpdate = Database['public']['Tables']['salons']['Update']
export type StylistProfileUpdate = Database['public']['Tables']['stylist_profiles']['Update']
export type ClientProfileUpdate = Database['public']['Tables']['client_profiles']['Update']
export type ServiceUpdate = Database['public']['Tables']['services']['Update']
export type AppointmentUpdate = Database['public']['Tables']['appointments']['Update']
