// Types de la base OhO, au format de `supabase gen types typescript`.
// Générés par `npm run db:types` (scripts/gen-types.mjs) depuis le catalogue du
// Postgres de test après application des migrations : ne pas modifier à la main.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_label: string | null
          entity_type: string
          household_id: string
          id: string
          payload: Json
          tool_key: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_label?: string | null
          entity_type: string
          household_id: string
          id?: string
          payload?: Json
          tool_key: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_label?: string | null
          entity_type?: string
          household_id?: string
          id?: string
          payload?: Json
          tool_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
      }
      attachment: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          entity_id: string
          entity_type: string
          file_name: string
          household_id: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id: string
          entity_type: string
          file_name: string
          household_id: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          entity_id?: string
          entity_type?: string
          file_name?: string
          household_id?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachment_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachment_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      booking: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          deleted_at: string | null
          ends_at: string | null
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["booking_kind"]
          note: string | null
          reference: string | null
          starts_at: string | null
          title: string
          trip_id: string
          tz: string | null
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          household_id: string
          id?: string
          kind: Database["public"]["Enums"]["booking_kind"]
          note?: string | null
          reference?: string | null
          starts_at?: string | null
          title: string
          trip_id: string
          tz?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deleted_at?: string | null
          ends_at?: string | null
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["booking_kind"]
          note?: string | null
          reference?: string | null
          starts_at?: string | null
          title?: string
          trip_id?: string
          tz?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_household_id_trip_id_fkey"
            columns: ["household_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "booking_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_item: {
        Row: {
          created_at: string
          created_by: string | null
          default_category_id: string | null
          deleted_at: string | null
          hidden_at: string | null
          household_id: string
          id: string
          label: string
          label_key: string
          last_used_at: string | null
          updated_at: string
          updated_by: string | null
          usage_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_category_id?: string | null
          deleted_at?: string | null
          hidden_at?: string | null
          household_id: string
          id?: string
          label: string
          label_key?: never
          last_used_at?: string | null
          updated_at?: string
          updated_by?: string | null
          usage_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_category_id?: string | null
          deleted_at?: string | null
          hidden_at?: string | null
          household_id?: string
          id?: string
          label?: string
          label_key?: never
          last_used_at?: string | null
          updated_at?: string
          updated_by?: string | null
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_item_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_household_id_default_category_id_fkey"
            columns: ["household_id", "default_category_id"]
            isOneToOne: false
            referencedRelation: "shopping_category"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "catalog_item_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_item_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["checklist_kind"]
          name: string
          sort_order: number
          trip_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["checklist_kind"]
          name: string
          sort_order: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["checklist_kind"]
          name?: string
          sort_order?: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_trip_fkey"
            columns: ["household_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "checklist_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item: {
        Row: {
          catalog_item_id: string | null
          category_id: string | null
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          checklist_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          label: string
          note: string | null
          quantity: string | null
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_item_id?: string | null
          category_id?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          checklist_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          label: string
          note?: string | null
          quantity?: string | null
          sort_order: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_item_id?: string | null
          category_id?: string | null
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          checklist_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          label?: string
          note?: string | null
          quantity?: string | null
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_household_id_catalog_item_id_fkey"
            columns: ["household_id", "catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_item"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "checklist_item_household_id_category_id_fkey"
            columns: ["household_id", "category_id"]
            isOneToOne: false
            referencedRelation: "shopping_category"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "checklist_item_household_id_checklist_id_fkey"
            columns: ["household_id", "checklist_id"]
            isOneToOne: false
            referencedRelation: "checklist"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "checklist_item_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      client_error: {
        Row: {
          created_at: string
          household_id: string
          id: string
          message: string
          path: string | null
          release: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          message: string
          path?: string | null
          release?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          message?: string
          path?: string | null
          release?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_error_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_error_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          amount_cents: number
          book_amount_cents: number | null
          book_id: string
          booking_id: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          fx_rate: number
          household_id: string
          id: string
          label: string
          note: string | null
          paid_by: string
          spent_on: string
          split_mode: Database["public"]["Enums"]["expense_split_mode"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents: number
          book_amount_cents?: never
          book_id: string
          booking_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          fx_rate?: number
          household_id: string
          id?: string
          label: string
          note?: string | null
          paid_by: string
          spent_on?: string
          split_mode?: Database["public"]["Enums"]["expense_split_mode"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          book_amount_cents?: never
          book_id?: string
          booking_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          fx_rate?: number
          household_id?: string
          id?: string
          label?: string
          note?: string | null
          paid_by?: string
          spent_on?: string
          split_mode?: Database["public"]["Enums"]["expense_split_mode"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_booking_fkey"
            columns: ["household_id", "booking_id"]
            isOneToOne: false
            referencedRelation: "booking"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "expense_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_household_id_book_id_fkey"
            columns: ["household_id", "book_id"]
            isOneToOne: false
            referencedRelation: "expense_book"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "expense_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_paid_by_fkey"
            columns: ["household_id", "paid_by"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["household_id", "user_id"]
          },
          {
            foreignKeyName: "expense_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_book: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          household_id: string
          id: string
          name: string
          sort_order: number
          trip_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          name: string
          sort_order: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_book_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_book_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_book_trip_fkey"
            columns: ["household_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "expense_book_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_share: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          expense_id: string
          household_id: string
          id: string
          share_cents: number
          updated_at: string
          updated_by: string | null
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expense_id: string
          household_id: string
          id?: string
          share_cents: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          expense_id?: string
          household_id?: string
          id?: string
          share_cents?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_share_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_share_household_id_expense_id_fkey"
            columns: ["household_id", "expense_id"]
            isOneToOne: false
            referencedRelation: "expense"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "expense_share_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_share_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_share_user_fkey"
            columns: ["household_id", "user_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["household_id", "user_id"]
          },
        ]
      }
      external_media: {
        Row: {
          created_at: string
          external_id: string
          fetched_at: string
          genres: Json | null
          id: string
          media_type: string
          number_of_seasons: number | null
          original_title: string | null
          overview: string | null
          poster_path: string | null
          providers: Json | null
          runtime_min: number | null
          source: string
          title: string
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          external_id: string
          fetched_at?: string
          genres?: Json | null
          id?: string
          media_type: string
          number_of_seasons?: number | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          providers?: Json | null
          runtime_min?: number | null
          source?: string
          title: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          external_id?: string
          fetched_at?: string
          genres?: Json | null
          id?: string
          media_type?: string
          number_of_seasons?: number | null
          original_title?: string | null
          overview?: string | null
          poster_path?: string | null
          providers?: Json | null
          runtime_min?: number | null
          source?: string
          title?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      household: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          timezone: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["membership_role"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_pref: {
        Row: {
          created_at: string
          digest_minutes: number
          enabled: boolean
          household_id: string
          tool_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_minutes?: number
          enabled?: boolean
          household_id: string
          tool_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_minutes?: number
          enabled?: boolean
          household_id?: string
          tool_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_pref_household_id_user_id_fkey"
            columns: ["household_id", "user_id"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["household_id", "user_id"]
          },
        ]
      }
      profile: {
        Row: {
          avatar_color: string | null
          avatar_emoji: string | null
          created_at: string
          display_name: string
          id: string
          initials: string | null
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string | null
          avatar_emoji?: string | null
          created_at?: string
          display_name: string
          id: string
          initials?: string | null
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string | null
          avatar_emoji?: string | null
          created_at?: string
          display_name?: string
          id?: string
          initials?: string | null
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_digest: {
        Row: {
          actor_ids: unknown[]
          created_at: string
          due_at: string
          entity_types: unknown[]
          household_id: string
          id: string
          item_count: number
          labels: unknown[]
          sent_at: string | null
          tool_key: string
          user_id: string
        }
        Insert: {
          actor_ids?: unknown[]
          created_at?: string
          due_at: string
          entity_types?: unknown[]
          household_id: string
          id?: string
          item_count?: number
          labels?: unknown[]
          sent_at?: string | null
          tool_key: string
          user_id: string
        }
        Update: {
          actor_ids?: unknown[]
          created_at?: string
          due_at?: string
          entity_types?: unknown[]
          household_id?: string
          id?: string
          item_count?: number
          labels?: unknown[]
          sent_at?: string | null
          tool_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_digest_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_digest_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscription: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failure_count: number
          id: string
          last_seen_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failure_count?: number
          id?: string
          last_seen_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failure_count?: number
          id?: string
          last_seen_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscription_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement: {
        Row: {
          amount_cents: number
          book_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          from_user: string
          household_id: string
          id: string
          note: string | null
          settled_on: string
          to_user: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents: number
          book_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_user: string
          household_id: string
          id?: string
          note?: string | null
          settled_on?: string
          to_user: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          book_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          from_user?: string
          household_id?: string
          id?: string
          note?: string | null
          settled_on?: string
          to_user?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_from_fkey"
            columns: ["household_id", "from_user"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["household_id", "user_id"]
          },
          {
            foreignKeyName: "settlement_household_id_book_id_fkey"
            columns: ["household_id", "book_id"]
            isOneToOne: false
            referencedRelation: "expense_book"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "settlement_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_to_fkey"
            columns: ["household_id", "to_user"]
            isOneToOne: false
            referencedRelation: "membership"
            referencedColumns: ["household_id", "user_id"]
          },
          {
            foreignKeyName: "settlement_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_category: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          emoji: string | null
          household_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emoji?: string | null
          household_id: string
          id?: string
          name: string
          sort_order: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          emoji?: string | null
          household_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_category_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_category_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_category_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_activation: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          enabled: boolean
          household_id: string
          id: string
          settings: Json
          sort_order: number
          tool_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          household_id: string
          id?: string
          settings?: Json
          sort_order?: number
          tool_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          enabled?: boolean
          household_id?: string
          id?: string
          settings?: Json
          sort_order?: number
          tool_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_activation_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_activation_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_activation_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      trip: {
        Row: {
          archived_at: string | null
          cover_emoji: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          destination: string | null
          end_date: string | null
          household_id: string
          id: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          cover_emoji?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination?: string | null
          end_date?: string | null
          household_id: string
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          cover_emoji?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          destination?: string | null
          end_date?: string | null
          household_id?: string
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_activity: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          done: boolean
          household_id: string
          id: string
          note: string | null
          planned_date: string | null
          sort_order: number
          title: string
          trip_id: string
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done?: boolean
          household_id: string
          id?: string
          note?: string | null
          planned_date?: string | null
          sort_order: number
          title: string
          trip_id: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          done?: boolean
          household_id?: string
          id?: string
          note?: string | null
          planned_date?: string | null
          sort_order?: number
          title?: string
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_activity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activity_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activity_household_id_trip_id_fkey"
            columns: ["household_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "trip_activity_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_budget_line: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          household_id: string
          id: string
          planned_amount: number | null
          sort_order: number
          trip_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          household_id: string
          id?: string
          planned_amount?: number | null
          sort_order: number
          trip_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          planned_amount?: number | null
          sort_order?: number
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_line_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_budget_line_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_budget_line_household_id_trip_id_fkey"
            columns: ["household_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "trip_budget_line_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_item: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          episode_current: number | null
          household_id: string
          id: string
          kind: Database["public"]["Enums"]["watch_kind"]
          media_id: string | null
          platform_id: string | null
          runtime_min: number | null
          season_current: number | null
          status: Database["public"]["Enums"]["watch_status"]
          suggested_by: string | null
          title: string
          updated_at: string
          updated_by: string | null
          watched_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          episode_current?: number | null
          household_id: string
          id?: string
          kind: Database["public"]["Enums"]["watch_kind"]
          media_id?: string | null
          platform_id?: string | null
          runtime_min?: number | null
          season_current?: number | null
          status?: Database["public"]["Enums"]["watch_status"]
          suggested_by?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          watched_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          episode_current?: number | null
          household_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["watch_kind"]
          media_id?: string | null
          platform_id?: string | null
          runtime_min?: number | null
          season_current?: number | null
          status?: Database["public"]["Enums"]["watch_status"]
          suggested_by?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          watched_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_item_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_item_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_item_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "external_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_item_platform_fkey"
            columns: ["household_id", "platform_id"]
            isOneToOne: false
            referencedRelation: "watch_platform"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "watch_item_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_item_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_platform: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          is_subscribed: boolean
          name: string
          sort_order: number
          tmdb_provider_id: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          is_subscribed?: boolean
          name: string
          sort_order: number
          tmdb_provider_id?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          is_subscribed?: boolean
          name?: string
          sort_order?: number
          tmdb_provider_id?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_platform_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_platform_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_platform_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_rating: {
        Row: {
          comment: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          household_id: string
          id: string
          rating: number
          updated_at: string
          updated_by: string | null
          user_id: string
          watch_item_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          rating: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          watch_item_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          rating?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          watch_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_rating_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_rating_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_rating_household_id_watch_item_id_fkey"
            columns: ["household_id", "watch_item_id"]
            isOneToOne: false
            referencedRelation: "watch_item"
            referencedColumns: ["household_id", "id"]
          },
          {
            foreignKeyName: "watch_rating_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_rating_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      expense_balance: {
        Row: {
          balance_cents: number | null
          book_id: string | null
          household_id: string | null
          user_id: string | null
        }
        Relationships: []
      }
      trip_budget_view: {
        Row: {
          book_id: string | null
          category: Database["public"]["Enums"]["expense_category"] | null
          currency: string | null
          household_id: string | null
          spent_cents: number | null
          trip_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_push_digests: { Args: { p_limit?: number }; Returns: unknown[] }
      clear_checked: { Args: { p_checklist_id: string }; Returns: number }
      create_household: { Args: { p_name: string; p_timezone?: string }; Returns: string }
      export_household: { Args: { p_household: string }; Returns: Json }
      import_household: { Args: { p_data: Json }; Returns: Json }
      ping: { Args: never; Returns: Json }
      register_push: { Args: { p_endpoint: string; p_p256dh: string; p_auth: string; p_user_agent?: string }; Returns: string }
      report_push: { Args: { p_ok: unknown; p_gone: unknown; p_failed: unknown }; Returns: undefined }
      save_expense: { Args: { p_expense: Json; p_shares: Json }; Returns: string }
    }
    Enums: {
      booking_kind: "flight" | "train" | "lodging" | "car" | "activity" | "other"
      checklist_kind: "shopping" | "trip_prep" | "generic"
      expense_category: "transport" | "lodging" | "food" | "activity" | "shopping" | "other"
      expense_split_mode: "equal" | "amounts" | "weights"
      membership_role: "owner" | "member"
      trip_status: "idea" | "planned" | "ongoing" | "done"
      watch_kind: "movie" | "series"
      watch_status: "to_watch" | "watching" | "watched" | "dropped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_kind: ["flight", "train", "lodging", "car", "activity", "other"],
      checklist_kind: ["shopping", "trip_prep", "generic"],
      expense_category: ["transport", "lodging", "food", "activity", "shopping", "other"],
      expense_split_mode: ["equal", "amounts", "weights"],
      membership_role: ["owner", "member"],
      trip_status: ["idea", "planned", "ongoing", "done"],
      watch_kind: ["movie", "series"],
      watch_status: ["to_watch", "watching", "watched", "dropped"],
    },
  },
} as const
