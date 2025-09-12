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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bikes: {
        Row: {
          accessories_included: string | null
          asking_price: number | null
          colour: string | null
          condition: string | null
          condition_notes: string | null
          created_at: string
          description: string | null
          external_owner_id: string | null
          finance_scheme: Database["public"]["Enums"]["finance_scheme"]
          frame_number: string | null
          fulfillment_type: string
          id: string
          intake_date: string
          listing_description: string | null
          make: string
          model: string
          owner_id: string | null
          photos: string[] | null
          purchase_price: number | null
          sale_price: number | null
          size: string | null
          source: Database["public"]["Enums"]["bike_source"]
          status: Database["public"]["Enums"]["bike_status"]
          updated_at: string
          year: number | null
        }
        Insert: {
          accessories_included?: string | null
          asking_price?: number | null
          colour?: string | null
          condition?: string | null
          condition_notes?: string | null
          created_at?: string
          description?: string | null
          external_owner_id?: string | null
          finance_scheme?: Database["public"]["Enums"]["finance_scheme"]
          frame_number?: string | null
          fulfillment_type?: string
          id?: string
          intake_date?: string
          listing_description?: string | null
          make: string
          model: string
          owner_id?: string | null
          photos?: string[] | null
          purchase_price?: number | null
          sale_price?: number | null
          size?: string | null
          source?: Database["public"]["Enums"]["bike_source"]
          status?: Database["public"]["Enums"]["bike_status"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          accessories_included?: string | null
          asking_price?: number | null
          colour?: string | null
          condition?: string | null
          condition_notes?: string | null
          created_at?: string
          description?: string | null
          external_owner_id?: string | null
          finance_scheme?: Database["public"]["Enums"]["finance_scheme"]
          frame_number?: string | null
          fulfillment_type?: string
          id?: string
          intake_date?: string
          listing_description?: string | null
          make?: string
          model?: string
          owner_id?: string | null
          photos?: string[] | null
          purchase_price?: number | null
          sale_price?: number | null
          size?: string | null
          source?: Database["public"]["Enums"]["bike_source"]
          status?: Database["public"]["Enums"]["bike_status"]
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bikes_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "external_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_owners: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          preferred_contact: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          preferred_contact?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          preferred_contact?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fulfilment_events: {
        Row: {
          bike_id: string
          created_at: string
          id: string
          notes: string | null
          performed_by: string
          stage: Database["public"]["Enums"]["fulfilment_stage"]
          timestamp: string
        }
        Insert: {
          bike_id: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by: string
          stage: Database["public"]["Enums"]["fulfilment_stage"]
          timestamp?: string
        }
        Update: {
          bike_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by?: string
          stage?: Database["public"]["Enums"]["fulfilment_stage"]
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfilment_events_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fulfilment_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bike_id: string | null
          created_at: string
          customer_id: string | null
          due_date: string | null
          external_customer_id: string | null
          gross: number
          id: string
          invoice_number: string
          issued_at: string | null
          job_id: string | null
          net: number
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          vat_rate: number
        }
        Insert: {
          bike_id?: string | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          external_customer_id?: string | null
          gross: number
          id?: string
          invoice_number: string
          issued_at?: string | null
          job_id?: string | null
          net: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          bike_id?: string | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          external_customer_id?: string | null
          gross?: number
          id?: string
          invoice_number?: string
          issued_at?: string | null
          job_id?: string | null
          net?: number
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_external_customer_id_fkey"
            columns: ["external_customer_id"]
            isOneToOne: false
            referencedRelation: "external_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          bike_id: string
          checklist: Json | null
          completed_at: string | null
          created_at: string
          description: string | null
          estimated_cost: number | null
          id: string
          photos_after: string[] | null
          photos_before: string[] | null
          started_at: string | null
          status: string
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          assigned_to?: string | null
          bike_id: string
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          photos_after?: string[] | null
          photos_before?: string[] | null
          started_at?: string | null
          status?: string
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          assigned_to?: string | null
          bike_id?: string
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          estimated_cost?: number | null
          id?: string
          photos_after?: string[] | null
          photos_before?: string[] | null
          started_at?: string | null
          status?: string
          title?: string
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          bike_id: string | null
          brand: string | null
          cost_price: number | null
          created_at: string
          description: string
          id: string
          part_number: string | null
          quantity: number
          sale_price: number | null
          stock_status: Database["public"]["Enums"]["stock_status"]
          stripped_from_bike_id: string | null
          type: Database["public"]["Enums"]["part_type"]
          updated_at: string
        }
        Insert: {
          bike_id?: string | null
          brand?: string | null
          cost_price?: number | null
          created_at?: string
          description: string
          id?: string
          part_number?: string | null
          quantity?: number
          sale_price?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status"]
          stripped_from_bike_id?: string | null
          type: Database["public"]["Enums"]["part_type"]
          updated_at?: string
        }
        Update: {
          bike_id?: string | null
          brand?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          part_number?: string | null
          quantity?: number
          sale_price?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status"]
          stripped_from_bike_id?: string | null
          type?: Database["public"]["Enums"]["part_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_stripped_from_bike_id_fkey"
            columns: ["stripped_from_bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_any_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
    }
    Enums: {
      bike_source: "owned" | "customer_consignment"
      bike_status:
        | "intake"
        | "cleaning"
        | "inspection"
        | "pending_approval"
        | "repair"
        | "ready"
        | "listed"
        | "sold"
        | "pending_intake"
        | "in_stock"
      finance_scheme: "vat_qualifying" | "margin_scheme" | "commercial_vat"
      fulfilment_stage:
        | "intake"
        | "cleaning"
        | "inspection"
        | "repair"
        | "ready"
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "cancelled"
      invoice_type: "sale" | "service" | "detailing"
      job_type: "workshop" | "detailing"
      part_type:
        | "secondhand_bought"
        | "secondhand_stripped"
        | "new_resale"
        | "new_fitted"
      stock_status: "in_stock" | "reserved" | "sold" | "damaged"
      user_role: "admin" | "mechanic" | "detailer" | "owner" | "accountant"
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
      bike_source: ["owned", "customer_consignment"],
      bike_status: [
        "intake",
        "cleaning",
        "inspection",
        "pending_approval",
        "repair",
        "ready",
        "listed",
        "sold",
        "pending_intake",
        "in_stock",
      ],
      finance_scheme: ["vat_qualifying", "margin_scheme", "commercial_vat"],
      fulfilment_stage: ["intake", "cleaning", "inspection", "repair", "ready"],
      invoice_status: ["draft", "issued", "paid", "overdue", "cancelled"],
      invoice_type: ["sale", "service", "detailing"],
      job_type: ["workshop", "detailing"],
      part_type: [
        "secondhand_bought",
        "secondhand_stripped",
        "new_resale",
        "new_fitted",
      ],
      stock_status: ["in_stock", "reserved", "sold", "damaged"],
      user_role: ["admin", "mechanic", "detailer", "owner", "accountant"],
    },
  },
} as const
