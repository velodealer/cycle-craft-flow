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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          business_id: string | null
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          business_id?: string | null
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          bike_id: string
          business_id: string
          created_at: string
          detail: Json
          id: string
          kind: string
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          bike_id: string
          business_id: string
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          bike_id?: string
          business_id?: string
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_activity_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_activity_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_collections: {
        Row: {
          address_city: string
          address_country: string
          address_postcode: string
          address_street: string
          bike_id: string
          business_id: string
          completed_at: string | null
          created_at: string
          delivery_instructions: string | null
          direction: string
          error_message: string | null
          id: string
          order_id: string | null
          receiver_city: string | null
          receiver_country: string | null
          receiver_email: string | null
          receiver_name: string | null
          receiver_phone: string | null
          receiver_postcode: string | null
          receiver_street: string | null
          retry_count: number | null
          scheduled_date: string | null
          sender_email: string
          sender_name: string
          sender_phone: string
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          address_city: string
          address_country?: string
          address_postcode: string
          address_street: string
          bike_id: string
          business_id?: string
          completed_at?: string | null
          created_at?: string
          delivery_instructions?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          receiver_city?: string | null
          receiver_country?: string | null
          receiver_email?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          receiver_postcode?: string | null
          receiver_street?: string | null
          retry_count?: number | null
          scheduled_date?: string | null
          sender_email: string
          sender_name: string
          sender_phone: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string
          address_country?: string
          address_postcode?: string
          address_street?: string
          bike_id?: string
          business_id?: string
          completed_at?: string | null
          created_at?: string
          delivery_instructions?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          order_id?: string | null
          receiver_city?: string | null
          receiver_country?: string | null
          receiver_email?: string | null
          receiver_name?: string | null
          receiver_phone?: string | null
          receiver_postcode?: string | null
          receiver_street?: string | null
          retry_count?: number | null
          scheduled_date?: string | null
          sender_email?: string
          sender_name?: string
          sender_phone?: string
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_collections_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_collections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      bike_components: {
        Row: {
          bike_id: string
          business_id: string
          component_id: string
          created_at: string
          id: string
          notes: string | null
          position: string | null
          slot: string
        }
        Insert: {
          bike_id: string
          business_id?: string
          component_id: string
          created_at?: string
          id?: string
          notes?: string | null
          position?: string | null
          slot: string
        }
        Update: {
          bike_id?: string
          business_id?: string
          component_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          position?: string | null
          slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_components_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_components_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bike_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      bikes: {
        Row: {
          accessories_included: string | null
          acquired_via: string
          asking_price: number | null
          barcode: string | null
          bike_type: string | null
          business_id: string
          catalog_data: Json | null
          catalog_size: string | null
          catalog_source: string | null
          catalog_source_id: string | null
          catalog_synced_at: string | null
          collection_cost: number | null
          colour: string | null
          condition: string | null
          condition_notes: string | null
          created_at: string
          delivery_cost: number | null
          delivery_method: string | null
          description: string | null
          external_owner_id: string | null
          finance_scheme: Database["public"]["Enums"]["finance_scheme"]
          frame_material: string | null
          frame_number: string | null
          fulfillment_type: string
          gender: string | null
          has_accessories: boolean
          has_dropper: boolean
          has_rear_shock: boolean
          has_suspension_fork: boolean
          id: string
          intake_date: string
          investor_id: string | null
          is_electric: boolean
          listing_description: string | null
          make: string
          model: string
          mpn: string | null
          owner_id: string | null
          part_exchange_invoice_id: string | null
          photos: string[] | null
          profit_share_pct: number | null
          purchase_cost: number | null
          purchase_date: string | null
          purchase_price: number | null
          purchase_sync_error: string | null
          purchase_sync_status: string
          quickbooks_purchase_journal_id: string | null
          reference: string | null
          sale_price: number | null
          serial_number: string | null
          size: string | null
          sku: string | null
          sold_at: string | null
          source: Database["public"]["Enums"]["bike_source"]
          spec_values: Json
          status: Database["public"]["Enums"]["bike_status"]
          storage_bay_id: string | null
          updated_at: string
          weight_kg: number | null
          year: number | null
        }
        Insert: {
          accessories_included?: string | null
          acquired_via?: string
          asking_price?: number | null
          barcode?: string | null
          bike_type?: string | null
          business_id?: string
          catalog_data?: Json | null
          catalog_size?: string | null
          catalog_source?: string | null
          catalog_source_id?: string | null
          catalog_synced_at?: string | null
          collection_cost?: number | null
          colour?: string | null
          condition?: string | null
          condition_notes?: string | null
          created_at?: string
          delivery_cost?: number | null
          delivery_method?: string | null
          description?: string | null
          external_owner_id?: string | null
          finance_scheme?: Database["public"]["Enums"]["finance_scheme"]
          frame_material?: string | null
          frame_number?: string | null
          fulfillment_type?: string
          gender?: string | null
          has_accessories?: boolean
          has_dropper?: boolean
          has_rear_shock?: boolean
          has_suspension_fork?: boolean
          id?: string
          intake_date?: string
          investor_id?: string | null
          is_electric?: boolean
          listing_description?: string | null
          make: string
          model: string
          mpn?: string | null
          owner_id?: string | null
          part_exchange_invoice_id?: string | null
          photos?: string[] | null
          profit_share_pct?: number | null
          purchase_cost?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_sync_error?: string | null
          purchase_sync_status?: string
          quickbooks_purchase_journal_id?: string | null
          reference?: string | null
          sale_price?: number | null
          serial_number?: string | null
          size?: string | null
          sku?: string | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["bike_source"]
          spec_values?: Json
          status?: Database["public"]["Enums"]["bike_status"]
          storage_bay_id?: string | null
          updated_at?: string
          weight_kg?: number | null
          year?: number | null
        }
        Update: {
          accessories_included?: string | null
          acquired_via?: string
          asking_price?: number | null
          barcode?: string | null
          bike_type?: string | null
          business_id?: string
          catalog_data?: Json | null
          catalog_size?: string | null
          catalog_source?: string | null
          catalog_source_id?: string | null
          catalog_synced_at?: string | null
          collection_cost?: number | null
          colour?: string | null
          condition?: string | null
          condition_notes?: string | null
          created_at?: string
          delivery_cost?: number | null
          delivery_method?: string | null
          description?: string | null
          external_owner_id?: string | null
          finance_scheme?: Database["public"]["Enums"]["finance_scheme"]
          frame_material?: string | null
          frame_number?: string | null
          fulfillment_type?: string
          gender?: string | null
          has_accessories?: boolean
          has_dropper?: boolean
          has_rear_shock?: boolean
          has_suspension_fork?: boolean
          id?: string
          intake_date?: string
          investor_id?: string | null
          is_electric?: boolean
          listing_description?: string | null
          make?: string
          model?: string
          mpn?: string | null
          owner_id?: string | null
          part_exchange_invoice_id?: string | null
          photos?: string[] | null
          profit_share_pct?: number | null
          purchase_cost?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_sync_error?: string | null
          purchase_sync_status?: string
          quickbooks_purchase_journal_id?: string | null
          reference?: string | null
          sale_price?: number | null
          serial_number?: string | null
          size?: string | null
          sku?: string | null
          sold_at?: string | null
          source?: Database["public"]["Enums"]["bike_source"]
          spec_values?: Json
          status?: Database["public"]["Enums"]["bike_status"]
          storage_bay_id?: string | null
          updated_at?: string
          weight_kg?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bikes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_external_owner_id_fkey"
            columns: ["external_owner_id"]
            isOneToOne: false
            referencedRelation: "external_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "bikes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_part_exchange_invoice_id_fkey"
            columns: ["part_exchange_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikes_storage_bay_id_fkey"
            columns: ["storage_bay_id"]
            isOneToOne: false
            referencedRelation: "storage_bays"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string
          body: string
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string
          id: string
          published_at: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          body?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          body?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_subscriptions: {
        Row: {
          billing_period: string
          business_id: string
          created_at: string
          currency: string
          current_period_end: string | null
          id: string
          notes: string | null
          plan_name: string
          price: number
          seats: number
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_period?: string
          business_id: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          price?: number
          seats?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_period?: string
          business_id?: string
          created_at?: string
          currency?: string
          current_period_end?: string | null
          id?: string
          notes?: string | null
          plan_name?: string
          price?: number
          seats?: number
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_bikes: {
        Row: {
          bike_fields: Json
          bike_type: string | null
          brand: string
          category: string | null
          components: Json
          created_at: string
          created_by: string | null
          family: string | null
          id: string
          is_ebike: boolean
          model: string
          raw: Json | null
          sizes: Json
          source: string
          source_id: string
          spec: Json
          subcategory: string | null
          thumbnail_url: string | null
          updated_at: string
          url: string | null
          use_count: number
          year: number | null
        }
        Insert: {
          bike_fields?: Json
          bike_type?: string | null
          brand: string
          category?: string | null
          components?: Json
          created_at?: string
          created_by?: string | null
          family?: string | null
          id?: string
          is_ebike?: boolean
          model: string
          raw?: Json | null
          sizes?: Json
          source?: string
          source_id: string
          spec?: Json
          subcategory?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          url?: string | null
          use_count?: number
          year?: number | null
        }
        Update: {
          bike_fields?: Json
          bike_type?: string | null
          brand?: string
          category?: string | null
          components?: Json
          created_at?: string
          created_by?: string | null
          family?: string | null
          id?: string
          is_ebike?: boolean
          model?: string
          raw?: Json | null
          sizes?: Json
          source?: string
          source_id?: string
          spec?: Json
          subcategory?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          url?: string | null
          use_count?: number
          year?: number | null
        }
        Relationships: []
      }
      component_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      components: {
        Row: {
          attributes: Json
          brand: string
          business_id: string
          category_id: string
          created_at: string
          description: string | null
          id: string
          model: string
          mpn: string | null
          updated_at: string
          weight_g: number | null
        }
        Insert: {
          attributes?: Json
          brand: string
          business_id?: string
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          model: string
          mpn?: string | null
          updated_at?: string
          weight_g?: number | null
        }
        Update: {
          attributes?: Json
          brand?: string
          business_id?: string
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          model?: string
          mpn?: string | null
          updated_at?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "components_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "components_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "component_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_courier_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_name: string | null
          business_id: string
          connected_at: string
          created_at: string
          id: string
          last_error: string | null
          refresh_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_name?: string | null
          business_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          last_error?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_name?: string | null
          business_id?: string
          connected_at?: string
          created_at?: string
          id?: string
          last_error?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_courier_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_courier_oauth_states: {
        Row: {
          business_id: string
          code_verifier: string
          created_at: string
          origin: string | null
          state: string
          user_id: string
        }
        Insert: {
          business_id: string
          code_verifier: string
          created_at?: string
          origin?: string | null
          state: string
          user_id: string
        }
        Update: {
          business_id?: string
          code_verifier?: string
          created_at?: string
          origin?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_courier_oauth_states_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ebay_category_cache: {
        Row: {
          category_id: string
          fetched_at: string
          kind: string
          marketplace_id: string
          payload: Json
        }
        Insert: {
          category_id: string
          fetched_at?: string
          kind: string
          marketplace_id: string
          payload?: Json
        }
        Update: {
          category_id?: string
          fetched_at?: string
          kind?: string
          marketplace_id?: string
          payload?: Json
        }
        Relationships: []
      }
      ebay_listings: {
        Row: {
          ad_id: string | null
          ad_rate: number | null
          aspect_summary: Json | null
          best_offer_enabled: boolean | null
          bike_id: string
          business_id: string
          category_id: string | null
          condition: string | null
          condition_substituted_from: string | null
          condition_substituted_to: string | null
          created_at: string
          environment: string
          gallery_photo_index: number | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          listing_id: string | null
          listing_url: string | null
          offer_id: string | null
          quantity: number
          sku: string | null
          status: string
          title_override: string | null
          unmapped_aspects: Json | null
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          ad_rate?: number | null
          aspect_summary?: Json | null
          best_offer_enabled?: boolean | null
          bike_id: string
          business_id?: string
          category_id?: string | null
          condition?: string | null
          condition_substituted_from?: string | null
          condition_substituted_to?: string | null
          created_at?: string
          environment?: string
          gallery_photo_index?: number | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          listing_id?: string | null
          listing_url?: string | null
          offer_id?: string | null
          quantity?: number
          sku?: string | null
          status?: string
          title_override?: string | null
          unmapped_aspects?: Json | null
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          ad_rate?: number | null
          aspect_summary?: Json | null
          best_offer_enabled?: boolean | null
          bike_id?: string
          business_id?: string
          category_id?: string | null
          condition?: string | null
          condition_substituted_from?: string | null
          condition_substituted_to?: string | null
          created_at?: string
          environment?: string
          gallery_photo_index?: number | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          listing_id?: string | null
          listing_url?: string | null
          offer_id?: string | null
          quantity?: number
          sku?: string | null
          status?: string
          title_override?: string | null
          unmapped_aspects?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebay_listings_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: true
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebay_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ebay_oauth_states: {
        Row: {
          business_id: string
          created_at: string
          environment: string
          origin: string | null
          state: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          environment?: string
          origin?: string | null
          state: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          environment?: string
          origin?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebay_oauth_states_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      ebay_orders: {
        Row: {
          bike_id: string | null
          business_id: string
          buyer_username: string | null
          carrier: string | null
          created_at: string
          currency: string | null
          despatched_at: string | null
          id: string
          line_item_id: string | null
          order_id: string
          raw: Json
          status: string
          total: number | null
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          bike_id?: string | null
          business_id: string
          buyer_username?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string | null
          despatched_at?: string | null
          id?: string
          line_item_id?: string | null
          order_id: string
          raw?: Json
          status?: string
          total?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          bike_id?: string | null
          business_id?: string
          buyer_username?: string | null
          carrier?: string | null
          created_at?: string
          currency?: string | null
          despatched_at?: string | null
          id?: string
          line_item_id?: string | null
          order_id?: string
          raw?: Json
          status?: string
          total?: number | null
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebay_orders_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebay_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      external_owners: {
        Row: {
          address: string | null
          business_id: string
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
          business_id?: string
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
          business_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          preferred_contact?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_owners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfilment_events: {
        Row: {
          bike_id: string
          business_id: string
          created_at: string
          id: string
          notes: string | null
          performed_by: string
          stage: Database["public"]["Enums"]["fulfilment_stage"]
          timestamp: string
        }
        Insert: {
          bike_id: string
          business_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          performed_by: string
          stage: Database["public"]["Enums"]["fulfilment_stage"]
          timestamp?: string
        }
        Update: {
          bike_id?: string
          business_id?: string
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
            foreignKeyName: "fulfilment_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      inspectabike_connections: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_name: string | null
          business_id: string
          connected_at: string
          created_at: string
          external_account_id: string | null
          id: string
          last_error: string | null
          refresh_token: string | null
          status: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_name?: string | null
          business_id: string
          connected_at?: string
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_name?: string | null
          business_id?: string
          connected_at?: string
          created_at?: string
          external_account_id?: string | null
          id?: string
          last_error?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspectabike_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inspectabike_oauth_states: {
        Row: {
          business_id: string
          code_verifier: string
          created_at: string
          origin: string | null
          state: string
          user_id: string
        }
        Insert: {
          business_id: string
          code_verifier: string
          created_at?: string
          origin?: string | null
          state: string
          user_id: string
        }
        Update: {
          business_id?: string
          code_verifier?: string
          created_at?: string
          origin?: string | null
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspectabike_oauth_states_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_faults: {
        Row: {
          bike_id: string
          business_id: string
          component: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          external_fault_id: string
          id: string
          inspection_id: string
          job_id: string | null
          labour_cost: number
          part_id: string | null
          parts_cost: number
          raw: Json
          repaired_at: string | null
          severity: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          bike_id: string
          business_id?: string
          component?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          external_fault_id: string
          id?: string
          inspection_id: string
          job_id?: string | null
          labour_cost?: number
          part_id?: string | null
          parts_cost?: number
          raw?: Json
          repaired_at?: string | null
          severity?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          bike_id?: string
          business_id?: string
          component?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          external_fault_id?: string
          id?: string
          inspection_id?: string
          job_id?: string | null
          labour_cost?: number
          part_id?: string | null
          parts_cost?: number
          raw?: Json
          repaired_at?: string | null
          severity?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_faults_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_faults_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_faults_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_faults_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_faults_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          bike_id: string
          business_id: string
          completed_at: string | null
          created_at: string
          external_inspection_id: string | null
          external_reference: string | null
          has_issues: boolean
          id: string
          inspected_by: string | null
          inspector_name: string | null
          notes: string | null
          overall_grade: number | null
          report_url: string | null
          started_at: string
          status: string
          stolen_status: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          bike_id: string
          business_id?: string
          completed_at?: string | null
          created_at?: string
          external_inspection_id?: string | null
          external_reference?: string | null
          has_issues?: boolean
          id?: string
          inspected_by?: string | null
          inspector_name?: string | null
          notes?: string | null
          overall_grade?: number | null
          report_url?: string | null
          started_at?: string
          status?: string
          stolen_status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          bike_id?: string
          business_id?: string
          completed_at?: string | null
          created_at?: string
          external_inspection_id?: string | null
          external_reference?: string | null
          has_issues?: boolean
          id?: string
          inspected_by?: string | null
          inspector_name?: string | null
          notes?: string | null
          overall_grade?: number | null
          report_url?: string | null
          started_at?: string
          status?: string
          stolen_status?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspected_by_fkey"
            columns: ["inspected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_error_log: {
        Row: {
          created_at: string
          detail: Json | null
          entity_ref: string | null
          id: string
          integration: string
          intuit_tid: string | null
          message: string
          operation: string
          status: number | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          entity_ref?: string | null
          id?: string
          integration: string
          intuit_tid?: string | null
          message: string
          operation: string
          status?: number | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          entity_ref?: string | null
          id?: string
          integration?: string
          intuit_tid?: string | null
          message?: string
          operation?: string
          status?: number | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_key: string | null
          business_id: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          name: string
          settings: Json | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key?: string | null
          business_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          name: string
          settings?: Json | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string | null
          business_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          name?: string
          settings?: Json | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bike_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          delivery_charge: number
          delivery_charged_to_customer: boolean
          due_date: string | null
          external_customer_id: string | null
          gross: number
          id: string
          invoice_number: string
          issued_at: string | null
          job_id: string | null
          net: number
          paid_at: string | null
          part_exchange_bike_id: string | null
          part_exchange_value: number | null
          quickbooks_invoice_id: string | null
          quickbooks_journal_id: string | null
          sale_gross: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          sync_error: string | null
          sync_status: string
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
          vat_rate: number
        }
        Insert: {
          bike_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          delivery_charge?: number
          delivery_charged_to_customer?: boolean
          due_date?: string | null
          external_customer_id?: string | null
          gross: number
          id?: string
          invoice_number: string
          issued_at?: string | null
          job_id?: string | null
          net: number
          paid_at?: string | null
          part_exchange_bike_id?: string | null
          part_exchange_value?: number | null
          quickbooks_invoice_id?: string | null
          quickbooks_journal_id?: string | null
          sale_gross?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          sync_error?: string | null
          sync_status?: string
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          bike_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          delivery_charge?: number
          delivery_charged_to_customer?: boolean
          due_date?: string | null
          external_customer_id?: string | null
          gross?: number
          id?: string
          invoice_number?: string
          issued_at?: string | null
          job_id?: string | null
          net?: number
          paid_at?: string | null
          part_exchange_bike_id?: string | null
          part_exchange_value?: number | null
          quickbooks_invoice_id?: string | null
          quickbooks_journal_id?: string | null
          sale_gross?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          sync_error?: string | null
          sync_status?: string
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
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
          {
            foreignKeyName: "invoices_part_exchange_bike_id_fkey"
            columns: ["part_exchange_bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          cover_note: string | null
          created_at: string
          cv_path: string | null
          email: string
          id: string
          links: string | null
          name: string
          notes: string | null
          opening_id: string | null
          phone: string | null
          role_title: string
          status: string
          updated_at: string
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          cv_path?: string | null
          email: string
          id?: string
          links?: string | null
          name: string
          notes?: string | null
          opening_id?: string | null
          phone?: string | null
          role_title: string
          status?: string
          updated_at?: string
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          cv_path?: string | null
          email?: string
          id?: string
          links?: string | null
          name?: string
          notes?: string | null
          opening_id?: string | null
          phone?: string | null
          role_title?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_opening_id_fkey"
            columns: ["opening_id"]
            isOneToOne: false
            referencedRelation: "job_openings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_openings: {
        Row: {
          created_at: string
          description: string
          employment_type: string
          id: string
          is_open: boolean
          location: string
          slug: string
          sort_order: number
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          employment_type?: string
          id?: string
          is_open?: boolean
          location?: string
          slug: string
          sort_order?: number
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          employment_type?: string
          id?: string
          is_open?: boolean
          location?: string
          slug?: string
          sort_order?: number
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          actual_cost: number | null
          assigned_to: string | null
          bike_id: string
          business_id: string
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
          business_id?: string
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
          business_id?: string
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
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_templates: {
        Row: {
          body: string
          business_id: string
          field_map: Json
          format: string
          id: string
          platform: string
          title_format: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          business_id?: string
          field_map?: Json
          format?: string
          id?: string
          platform: string
          title_format?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          business_id?: string
          field_map?: Json
          format?: string
          id?: string
          platform?: string
          title_format?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          bike_id: string | null
          brand: string | null
          business_id: string
          cost_price: number | null
          created_at: string
          description: string
          id: string
          part_number: string | null
          quantity: number
          sale_price: number | null
          stock_status: Database["public"]["Enums"]["stock_status"]
          storage_bay_id: string | null
          stripped_from_bike_id: string | null
          type: Database["public"]["Enums"]["part_type"]
          updated_at: string
        }
        Insert: {
          bike_id?: string | null
          brand?: string | null
          business_id?: string
          cost_price?: number | null
          created_at?: string
          description: string
          id?: string
          part_number?: string | null
          quantity?: number
          sale_price?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status"]
          storage_bay_id?: string | null
          stripped_from_bike_id?: string | null
          type: Database["public"]["Enums"]["part_type"]
          updated_at?: string
        }
        Update: {
          bike_id?: string | null
          brand?: string | null
          business_id?: string
          cost_price?: number | null
          created_at?: string
          description?: string
          id?: string
          part_number?: string | null
          quantity?: number
          sale_price?: number | null
          stock_status?: Database["public"]["Enums"]["stock_status"]
          storage_bay_id?: string | null
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
            foreignKeyName: "parts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_storage_bay_id_fkey"
            columns: ["storage_bay_id"]
            isOneToOne: false
            referencedRelation: "storage_bays"
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
          business_id: string
          created_at: string
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          email: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          business_id: string
          id: string
          name: string
          notes: string | null
          quote_id: string
          rows: Json
          sale_price: number
          saved_at: string
          saved_by: string | null
          total_cost: number
          vat_scheme: string
          version: number
        }
        Insert: {
          business_id?: string
          id?: string
          name: string
          notes?: string | null
          quote_id: string
          rows?: Json
          sale_price?: number
          saved_at?: string
          saved_by?: string | null
          total_cost?: number
          vat_scheme?: string
          version: number
        }
        Update: {
          business_id?: string
          id?: string
          name?: string
          notes?: string | null
          quote_id?: string
          rows?: Json
          sale_price?: number
          saved_at?: string
          saved_by?: string | null
          total_cost?: number
          vat_scheme?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          current_version: number
          id: string
          name: string
          notes: string | null
          rows: Json
          sale_price: number
          total_cost: number
          updated_at: string
          vat_scheme: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          id?: string
          name: string
          notes?: string | null
          rows?: Json
          sale_price?: number
          total_cost?: number
          updated_at?: string
          vat_scheme?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          id?: string
          name?: string
          notes?: string | null
          rows?: Json
          sale_price?: number
          total_cost?: number
          updated_at?: string
          vat_scheme?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_drafts: {
        Row: {
          bike_id: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          bike_id: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          bike_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_drafts_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: true
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_compliance_events: {
        Row: {
          created_at: string
          handled_at: string
          id: string
          outcome: string | null
          payload_summary: Json
          shop_domain: string | null
          topic: string
        }
        Insert: {
          created_at?: string
          handled_at?: string
          id?: string
          outcome?: string | null
          payload_summary?: Json
          shop_domain?: string | null
          topic: string
        }
        Update: {
          created_at?: string
          handled_at?: string
          id?: string
          outcome?: string | null
          payload_summary?: Json
          shop_domain?: string | null
          topic?: string
        }
        Relationships: []
      }
      shopify_listings: {
        Row: {
          bike_id: string
          business_id: string
          created_at: string
          id: string
          inventory_item_id: string | null
          last_error: string | null
          last_synced_at: string | null
          location_id: string | null
          product_id: string | null
          product_url: string | null
          quantity: number
          shop_domain: string | null
          status: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          bike_id: string
          business_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          location_id?: string | null
          product_id?: string | null
          product_url?: string | null
          quantity?: number
          shop_domain?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          bike_id?: string
          business_id?: string
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          location_id?: string | null
          product_id?: string | null
          product_url?: string | null
          quantity?: number
          shop_domain?: string | null
          status?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_listings_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: true
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_oauth_states: {
        Row: {
          created_at: string
          shop: string
          state: string
        }
        Insert: {
          created_at?: string
          shop: string
          state: string
        }
        Update: {
          created_at?: string
          shop?: string
          state?: string
        }
        Relationships: []
      }
      social_post_checklist: {
        Row: {
          business_id: string
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          item: string
          post_id: string
        }
        Insert: {
          business_id?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          item: string
          post_id: string
        }
        Update: {
          business_id?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          item?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_post_checklist_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_checklist_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_metrics: {
        Row: {
          business_id: string
          comments: number
          id: string
          likes: number
          platform: string
          post_id: string
          recorded_at: string
          recorded_by: string | null
          saves: number
          shares: number
          views: number
        }
        Insert: {
          business_id?: string
          comments?: number
          id?: string
          likes?: number
          platform: string
          post_id: string
          recorded_at?: string
          recorded_by?: string | null
          saves?: number
          shares?: number
          views?: number
        }
        Update: {
          business_id?: string
          comments?: number
          id?: string
          likes?: number
          platform?: string
          post_id?: string
          recorded_at?: string
          recorded_by?: string | null
          saves?: number
          shares?: number
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_post_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_post_scores: {
        Row: {
          business_id: string
          cta_score: number | null
          hook_score: number | null
          id: string
          notes: string | null
          overall_score: number | null
          post_id: string
          production_score: number | null
          retention_score: number | null
          scored_at: string
          scored_by: string | null
        }
        Insert: {
          business_id?: string
          cta_score?: number | null
          hook_score?: number | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          post_id: string
          production_score?: number | null
          retention_score?: number | null
          scored_at?: string
          scored_by?: string | null
        }
        Update: {
          business_id?: string
          cta_score?: number | null
          hook_score?: number | null
          id?: string
          notes?: string | null
          overall_score?: number | null
          post_id?: string
          production_score?: number | null
          retention_score?: number | null
          scored_at?: string
          scored_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_post_scores_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          assigned_to: string | null
          business_id: string
          caption: string
          created_at: string
          created_by: string | null
          hashtags: string[]
          hook: string | null
          id: string
          platforms: string[]
          posted_at: string | null
          scheduled_at: string | null
          script_id: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          vehicle_id: string | null
          video_url: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_id?: string
          caption?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          hook?: string | null
          id?: string
          platforms?: string[]
          posted_at?: string | null
          scheduled_at?: string | null
          script_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          vehicle_id?: string | null
          video_url?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string
          caption?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          hook?: string | null
          id?: string
          platforms?: string[]
          posted_at?: string | null
          scheduled_at?: string | null
          script_id?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          vehicle_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "social_scripts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      social_scripts: {
        Row: {
          body: string
          business_id: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_template: boolean
          name: string
          updated_at: string
          variables: Json
        }
        Insert: {
          body?: string
          business_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          name: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          business_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          name?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "social_scripts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      squarespace_listings: {
        Row: {
          bike_id: string
          business_id: string
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          product_id: string | null
          status: string
          updated_at: string
          url: string | null
          variant_id: string | null
          website_id: string | null
        }
        Insert: {
          bike_id: string
          business_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          product_id?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          variant_id?: string | null
          website_id?: string | null
        }
        Update: {
          bike_id?: string
          business_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          product_id?: string | null
          status?: string
          updated_at?: string
          url?: string | null
          variant_id?: string | null
          website_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "squarespace_listings_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: true
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
        ]
      }
      squarespace_oauth_states: {
        Row: {
          business_id: string
          created_at: string
          return_origin: string | null
          state: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          return_origin?: string | null
          state: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          return_origin?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      storage_bays: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
          zone: string | null
        }
        Insert: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          zone?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storage_bays_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_replies: {
        Row: {
          body: string
          id: string
          sent_at: string
          sent_by: string | null
          sent_by_name: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          sent_by_name?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          id?: string
          sent_at?: string
          sent_by?: string | null
          sent_by_name?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          source: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          source?: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          source?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      typeform_forms: {
        Row: {
          business_id: string
          created_at: string
          enabled: boolean
          field_map: Json
          form_id: string
          id: string
          title: string
          updated_at: string
          webhook_tag: string
        }
        Insert: {
          business_id?: string
          created_at?: string
          enabled?: boolean
          field_map?: Json
          form_id: string
          id?: string
          title: string
          updated_at?: string
          webhook_tag?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          enabled?: boolean
          field_map?: Json
          form_id?: string
          id?: string
          title?: string
          updated_at?: string
          webhook_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "typeform_forms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      typeform_submissions: {
        Row: {
          asking_price: number | null
          bike_id: string | null
          bike_make: string | null
          bike_model: string | null
          bike_year: number | null
          business_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          form_id: string
          frame_number: string | null
          id: string
          notes: string | null
          photo_urls: string[]
          postcode: string | null
          raw_payload: Json
          response_id: string
          reviewed_by: string | null
          status: string
          submission_type: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          asking_price?: number | null
          bike_id?: string | null
          bike_make?: string | null
          bike_model?: string | null
          bike_year?: number | null
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_id: string
          frame_number?: string | null
          id?: string
          notes?: string | null
          photo_urls?: string[]
          postcode?: string | null
          raw_payload: Json
          response_id: string
          reviewed_by?: string | null
          status?: string
          submission_type?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          asking_price?: number | null
          bike_id?: string | null
          bike_make?: string | null
          bike_model?: string | null
          bike_year?: number | null
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          form_id?: string
          frame_number?: string | null
          id?: string
          notes?: string | null
          photo_urls?: string[]
          postcode?: string | null
          raw_payload?: Json
          response_id?: string
          reviewed_by?: string | null
          status?: string
          submission_type?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "typeform_submissions_bike_id_fkey"
            columns: ["bike_id"]
            isOneToOne: false
            referencedRelation: "bikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typeform_submissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typeform_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
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
      admin_dealership_stats: {
        Args: { _from?: string; _to?: string }
        Returns: {
          bikes_added: number
          bikes_in_stock: number
          bikes_sold: number
          bikes_total: number
          billing_period: string
          business_id: string
          business_name: string
          contact_email: string
          created_at: string
          jobs_completed: number
          last_activity: string
          plan_name: string
          price: number
          sale_value: number
          status: string
          subscription_status: string
          users_count: number
        }[]
      }
      admin_integration_health: {
        Args: never
        Returns: {
          business_id: string
          business_name: string
          connected: boolean
          integration: string
          last_error: string
          status: string
        }[]
      }
      admin_platform_overview: { Args: never; Returns: Json }
      current_business_id: { Args: never; Returns: string }
      current_business_status: { Args: never; Returns: string }
      generate_bike_reference: {
        Args: { _bike_id: string; _make: string; _serial: string }
        Returns: string
      }
      get_current_user_role: { Args: never; Returns: string }
      has_any_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: { required_role: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      is_investor_for_bike: { Args: { _bike_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      next_invoice_number: { Args: never; Returns: string }
    }
    Enums: {
      bike_source: "owned" | "customer_consignment" | "investor"
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
        | "awaiting_collection"
        | "collection_in_progress"
        | "in_transit"
        | "split_for_parts"
        | "collected"
        | "delivered"
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
      user_role:
        | "admin"
        | "mechanic"
        | "detailer"
        | "owner"
        | "accountant"
        | "social_manager"
        | "investor"
        | "customer_service"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      bike_source: ["owned", "customer_consignment", "investor"],
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
        "awaiting_collection",
        "collection_in_progress",
        "in_transit",
        "split_for_parts",
        "collected",
        "delivered",
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
      user_role: [
        "admin",
        "mechanic",
        "detailer",
        "owner",
        "accountant",
        "social_manager",
        "investor",
        "customer_service",
      ],
    },
  },
} as const
