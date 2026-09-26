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
      admin_condominiums: {
        Row: {
          address: string | null
          city: string | null
          concierge_phone: string | null
          cover_external_allowed: boolean
          cover_image: string | null
          created_at: string
          created_by: string | null
          has_concierge: boolean
          id: string
          name: string
          neighborhood: string | null
          postal_code: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          concierge_phone?: string | null
          cover_external_allowed?: boolean
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          has_concierge?: boolean
          id?: string
          name: string
          neighborhood?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          concierge_phone?: string | null
          cover_external_allowed?: boolean
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          has_concierge?: boolean
          id?: string
          name?: string
          neighborhood?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          category: string
          created_at: string
          filename: string
          id: string
          implementation_id: string | null
          inspection_id: string | null
          mime_type: string
          owner_id: string
          owner_task_id: string | null
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          filename: string
          id?: string
          implementation_id?: string | null
          inspection_id?: string | null
          mime_type: string
          owner_id: string
          owner_task_id?: string | null
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          filename?: string
          id?: string
          implementation_id?: string | null
          inspection_id?: string | null
          mime_type?: string
          owner_id?: string
          owner_task_id?: string | null
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "implementation_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_owner_task_id_fkey"
            columns: ["owner_task_id"]
            isOneToOne: false
            referencedRelation: "owner_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event: string
          id: string
          metadata: Json
          request_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event: string
          id?: string
          metadata?: Json
          request_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event?: string
          id?: string
          metadata?: Json
          request_id?: string | null
        }
        Relationships: []
      }
      checklist_templates: {
        Row: {
          blocker: boolean
          category: string
          description: string | null
          display_order: number
          id: string
          mandatory: boolean
          owner_visible: boolean
          phase: string
          title: string
        }
        Insert: {
          blocker?: boolean
          category: string
          description?: string | null
          display_order?: number
          id?: string
          mandatory?: boolean
          owner_visible?: boolean
          phase: string
          title: string
        }
        Update: {
          blocker?: boolean
          category?: string
          description?: string | null
          display_order?: number
          id?: string
          mandatory?: boolean
          owner_visible?: boolean
          phase?: string
          title?: string
        }
        Relationships: []
      }
      commercial_term_defaults: {
        Row: {
          charge_type: Database["public"]["Enums"]["charge_type"]
          display_order: number
          id: string
          label: string
          notes: string | null
          optional: boolean
          value: number
        }
        Insert: {
          charge_type: Database["public"]["Enums"]["charge_type"]
          display_order?: number
          id?: string
          label: string
          notes?: string | null
          optional?: boolean
          value?: number
        }
        Update: {
          charge_type?: Database["public"]["Enums"]["charge_type"]
          display_order?: number
          id?: string
          label?: string
          notes?: string | null
          optional?: boolean
          value?: number
        }
        Relationships: []
      }
      commercial_terms: {
        Row: {
          charge_type: Database["public"]["Enums"]["charge_type"]
          display_order: number
          id: string
          implementation_id: string
          label: string
          notes: string | null
          optional: boolean
          value: number
        }
        Insert: {
          charge_type: Database["public"]["Enums"]["charge_type"]
          display_order?: number
          id?: string
          implementation_id: string
          label: string
          notes?: string | null
          optional?: boolean
          value?: number
        }
        Update: {
          charge_type?: Database["public"]["Enums"]["charge_type"]
          display_order?: number
          id?: string
          implementation_id?: string
          label?: string
          notes?: string | null
          optional?: boolean
          value?: number
        }
        Relationships: []
      }
      implementation_commercial_meeting_events: {
        Row: {
          actor_id: string
          command_id: string
          created_at: string
          ends_at: string | null
          event_type: string
          from_status: string | null
          id: string
          implementation_id: string
          meeting_id: string
          mode: string
          replacement_meeting_id: string | null
          responsible_user_id: string
          starts_at: string
          time_zone: string
          to_status: string
        }
        Insert: {
          actor_id: string
          command_id: string
          created_at?: string
          ends_at?: string | null
          event_type: string
          from_status?: string | null
          id?: string
          implementation_id: string
          meeting_id: string
          mode: string
          replacement_meeting_id?: string | null
          responsible_user_id: string
          starts_at: string
          time_zone: string
          to_status: string
        }
        Update: {
          actor_id?: string
          command_id?: string
          created_at?: string
          ends_at?: string | null
          event_type?: string
          from_status?: string | null
          id?: string
          implementation_id?: string
          meeting_id?: string
          mode?: string
          replacement_meeting_id?: string | null
          responsible_user_id?: string
          starts_at?: string
          time_zone?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_commercial_meeting_e_replacement_meeting_id_fkey"
            columns: ["replacement_meeting_id"]
            isOneToOne: false
            referencedRelation: "implementation_commercial_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meeting_even_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meeting_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meeting_events_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meeting_events_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "implementation_commercial_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_commercial_meetings: {
        Row: {
          command_id: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          implementation_id: string
          join_url: string | null
          mode: string
          rescheduled_from_id: string | null
          responsible_user_id: string
          starts_at: string
          status: string
          time_zone: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          command_id: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          implementation_id: string
          join_url?: string | null
          mode: string
          rescheduled_from_id?: string | null
          responsible_user_id: string
          starts_at: string
          status: string
          time_zone: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          command_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          implementation_id?: string
          join_url?: string | null
          mode?: string
          rescheduled_from_id?: string | null
          responsible_user_id?: string
          starts_at?: string
          status?: string
          time_zone?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "implementation_commercial_meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meetings_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meetings_rescheduled_from_id_fkey"
            columns: ["rescheduled_from_id"]
            isOneToOne: false
            referencedRelation: "implementation_commercial_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meetings_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_commercial_meetings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_contract_conditions: {
        Row: {
          administration_fee: number | null
          cleaning_responsibility: string | null
          duration_months: number | null
          exclusivity: boolean | null
          implementation_id: string
          initial_cleaning_cost_bearer: string | null
          initial_cleaning_option: string | null
          initial_cleaning_other: string | null
          maintenance_limit: number | null
          notice_period_days: number | null
          payout_rule: string | null
          turnover_cleaning_fee: number | null
          turnover_cleaning_payer: string | null
          turnover_cleaning_team: string | null
          updated_at: string
        }
        Insert: {
          administration_fee?: number | null
          cleaning_responsibility?: string | null
          duration_months?: number | null
          exclusivity?: boolean | null
          implementation_id: string
          initial_cleaning_cost_bearer?: string | null
          initial_cleaning_option?: string | null
          initial_cleaning_other?: string | null
          maintenance_limit?: number | null
          notice_period_days?: number | null
          payout_rule?: string | null
          turnover_cleaning_fee?: number | null
          turnover_cleaning_payer?: string | null
          turnover_cleaning_team?: string | null
          updated_at?: string
        }
        Update: {
          administration_fee?: number | null
          cleaning_responsibility?: string | null
          duration_months?: number | null
          exclusivity?: boolean | null
          implementation_id?: string
          initial_cleaning_cost_bearer?: string | null
          initial_cleaning_option?: string | null
          initial_cleaning_other?: string | null
          maintenance_limit?: number | null
          notice_period_days?: number | null
          payout_rule?: string | null
          turnover_cleaning_fee?: number | null
          turnover_cleaning_payer?: string | null
          turnover_cleaning_team?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_contract_conditions_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: true
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_field_confirmations: {
        Row: {
          field_key: string
          id: string
          implementation_id: string
          note: string | null
          state: Database["public"]["Enums"]["owner_field_state"]
          updated_at: string
          updated_by: string | null
          value_snapshot: string | null
        }
        Insert: {
          field_key: string
          id?: string
          implementation_id: string
          note?: string | null
          state?: Database["public"]["Enums"]["owner_field_state"]
          updated_at?: string
          updated_by?: string | null
          value_snapshot?: string | null
        }
        Update: {
          field_key?: string
          id?: string
          implementation_id?: string
          note?: string | null
          state?: Database["public"]["Enums"]["owner_field_state"]
          updated_at?: string
          updated_by?: string | null
          value_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "implementation_field_confirmations_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_field_sources: {
        Row: {
          actor_id: string | null
          field: string
          implementation_id: string
          source: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          field: string
          implementation_id: string
          source: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          field?: string
          implementation_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_field_sources_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_inspections: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          implementation_id: string
          internal_notes: string | null
          owner_visible: boolean
          public_notes: string | null
          scheduled_for: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_id: string
          internal_notes?: string | null
          owner_visible?: boolean
          public_notes?: string | null
          scheduled_for?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          implementation_id?: string
          internal_notes?: string | null
          owner_visible?: boolean
          public_notes?: string | null
          scheduled_for?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_inspections_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_items: {
        Row: {
          blocker: boolean
          category: string
          completed_at: string | null
          completed_by: string | null
          description: string | null
          display_order: number
          due_date: string | null
          id: string
          implementation_id: string
          mandatory: boolean
          observation: string | null
          owner_visible: boolean
          phase: string
          readiness_override_at: string | null
          readiness_override_by: string | null
          readiness_override_reason: string | null
          responsible_user_id: string | null
          status: Database["public"]["Enums"]["implementation_item_status"]
          title: string
        }
        Insert: {
          blocker?: boolean
          category: string
          completed_at?: string | null
          completed_by?: string | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          implementation_id: string
          mandatory?: boolean
          observation?: string | null
          owner_visible?: boolean
          phase: string
          readiness_override_at?: string | null
          readiness_override_by?: string | null
          readiness_override_reason?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["implementation_item_status"]
          title: string
        }
        Update: {
          blocker?: boolean
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          description?: string | null
          display_order?: number
          due_date?: string | null
          id?: string
          implementation_id?: string
          mandatory?: boolean
          observation?: string | null
          owner_visible?: boolean
          phase?: string
          readiness_override_at?: string | null
          readiness_override_by?: string | null
          readiness_override_reason?: string | null
          responsible_user_id?: string | null
          status?: Database["public"]["Enums"]["implementation_item_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_items_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_next_actions: {
        Row: {
          closed_at: string | null
          closed_command_id: string | null
          command_id: string
          created_at: string
          created_by: string
          due_at: string
          id: string
          implementation_id: string
          responsible_user_id: string | null
          status: string
          time_zone: string
          title: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          closed_at?: string | null
          closed_command_id?: string | null
          command_id: string
          created_at?: string
          created_by: string
          due_at: string
          id?: string
          implementation_id: string
          responsible_user_id?: string | null
          status?: string
          time_zone: string
          title: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          closed_at?: string | null
          closed_command_id?: string | null
          command_id?: string
          created_at?: string
          created_by?: string
          due_at?: string
          id?: string
          implementation_id?: string
          responsible_user_id?: string | null
          status?: string
          time_zone?: string
          title?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "implementation_next_actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_next_actions_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_next_actions_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_next_actions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_owners: {
        Row: {
          address: string | null
          created_at: string
          display_order: number
          id: string
          implementation_id: string
          owner_id: string
          role: string
          share_percent: number | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          display_order?: number
          id?: string
          implementation_id: string
          owner_id: string
          role?: string
          share_percent?: number | null
        }
        Update: {
          address?: string | null
          created_at?: string
          display_order?: number
          id?: string
          implementation_id?: string
          owner_id?: string
          role?: string
          share_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "implementation_owners_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_owners_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_projects: {
        Row: {
          address: string | null
          bedrooms: number | null
          capacity: number | null
          city: string | null
          code: string
          completion_date_estimate: string | null
          condominium_id: string | null
          condominium_name: string | null
          core_owner_id: string | null
          core_property_id: string | null
          cover_approved_at: string | null
          cover_approved_by: string | null
          cover_image: string | null
          cover_source: string | null
          created_at: string
          draft_completed_at: string | null
          draft_step: string | null
          id: string
          nickname: string | null
          notes: string | null
          origin: string | null
          owner_facing_notes: string | null
          owner_id: string | null
          postal_code: string | null
          property_type: string | null
          responsible_user_id: string | null
          start_date_estimate: string | null
          status: Database["public"]["Enums"]["implementation_status"]
          tower: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bedrooms?: number | null
          capacity?: number | null
          city?: string | null
          code: string
          completion_date_estimate?: string | null
          condominium_id?: string | null
          condominium_name?: string | null
          core_owner_id?: string | null
          core_property_id?: string | null
          cover_approved_at?: string | null
          cover_approved_by?: string | null
          cover_image?: string | null
          cover_source?: string | null
          created_at?: string
          draft_completed_at?: string | null
          draft_step?: string | null
          id?: string
          nickname?: string | null
          notes?: string | null
          origin?: string | null
          owner_facing_notes?: string | null
          owner_id?: string | null
          postal_code?: string | null
          property_type?: string | null
          responsible_user_id?: string | null
          start_date_estimate?: string | null
          status?: Database["public"]["Enums"]["implementation_status"]
          tower?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bedrooms?: number | null
          capacity?: number | null
          city?: string | null
          code?: string
          completion_date_estimate?: string | null
          condominium_id?: string | null
          condominium_name?: string | null
          core_owner_id?: string | null
          core_property_id?: string | null
          cover_approved_at?: string | null
          cover_approved_by?: string | null
          cover_image?: string | null
          cover_source?: string | null
          created_at?: string
          draft_completed_at?: string | null
          draft_step?: string | null
          id?: string
          nickname?: string | null
          notes?: string | null
          origin?: string | null
          owner_facing_notes?: string | null
          owner_id?: string | null
          postal_code?: string | null
          property_type?: string | null
          responsible_user_id?: string | null
          start_date_estimate?: string | null
          status?: Database["public"]["Enums"]["implementation_status"]
          tower?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_projects_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "admin_condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "implementation_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_property_details: {
        Row: {
          access_code: string | null
          access_notes: string | null
          access_type: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          complement: string | null
          district: string | null
          implementation_id: string
          notes: string | null
          number: string | null
          parking_box: string | null
          parking_spots: number | null
          postal_code: string | null
          property_type: string | null
          state: string | null
          street: string | null
          suites: number | null
          updated_at: string
          wifi_network: string | null
          wifi_password: string | null
        }
        Insert: {
          access_code?: string | null
          access_notes?: string | null
          access_type?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          complement?: string | null
          district?: string | null
          implementation_id: string
          notes?: string | null
          number?: string | null
          parking_box?: string | null
          parking_spots?: number | null
          postal_code?: string | null
          property_type?: string | null
          state?: string | null
          street?: string | null
          suites?: number | null
          updated_at?: string
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Update: {
          access_code?: string | null
          access_notes?: string | null
          access_type?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          complement?: string | null
          district?: string | null
          implementation_id?: string
          notes?: string | null
          number?: string | null
          parking_box?: string | null
          parking_spots?: number | null
          postal_code?: string | null
          property_type?: string | null
          state?: string | null
          street?: string | null
          suites?: number | null
          updated_at?: string
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "implementation_property_details_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: true
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_proposal_settings: {
        Row: {
          implementation_id: string
          payment_notes: string | null
          updated_at: string
          validity_days: number
        }
        Insert: {
          implementation_id: string
          payment_notes?: string | null
          updated_at?: string
          validity_days?: number
        }
        Update: {
          implementation_id?: string
          payment_notes?: string | null
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "implementation_proposal_settings_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: true
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_rooms: {
        Row: {
          beds: string | null
          capacity: number | null
          created_at: string
          display_order: number
          id: string
          implementation_id: string
          kind: string
          name: string
          notes: string | null
        }
        Insert: {
          beds?: string | null
          capacity?: number | null
          created_at?: string
          display_order?: number
          id?: string
          implementation_id: string
          kind?: string
          name: string
          notes?: string | null
        }
        Update: {
          beds?: string | null
          capacity?: number | null
          created_at?: string
          display_order?: number
          id?: string
          implementation_id?: string
          kind?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "implementation_rooms_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_supply_items: {
        Row: {
          blocks_readiness: boolean
          created_at: string
          display_order: number
          existing_qty: number
          id: string
          implementation_id: string
          module: Database["public"]["Enums"]["supply_module"]
          name: string
          notes: string | null
          payee_name: string | null
          payment_target: string
          pix_hidden: boolean
          pix_key: string | null
          priority: Database["public"]["Enums"]["supply_priority"]
          procurement_stage: string
          required_qty: number
          responsible: string | null
          room: string | null
          size: string | null
          status: Database["public"]["Enums"]["supply_status"]
          supplier: string | null
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          blocks_readiness?: boolean
          created_at?: string
          display_order?: number
          existing_qty?: number
          id?: string
          implementation_id: string
          module: Database["public"]["Enums"]["supply_module"]
          name: string
          notes?: string | null
          payee_name?: string | null
          payment_target?: string
          pix_hidden?: boolean
          pix_key?: string | null
          priority?: Database["public"]["Enums"]["supply_priority"]
          procurement_stage?: string
          required_qty?: number
          responsible?: string | null
          room?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["supply_status"]
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          blocks_readiness?: boolean
          created_at?: string
          display_order?: number
          existing_qty?: number
          id?: string
          implementation_id?: string
          module?: Database["public"]["Enums"]["supply_module"]
          name?: string
          notes?: string | null
          payee_name?: string | null
          payment_target?: string
          pix_hidden?: boolean
          pix_key?: string | null
          priority?: Database["public"]["Enums"]["supply_priority"]
          procurement_stage?: string
          required_qty?: number
          responsible?: string | null
          room?: string | null
          size?: string | null
          status?: Database["public"]["Enums"]["supply_status"]
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_supply_items_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      implementation_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          payload?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          payload?: Json
        }
        Relationships: []
      }
      implementation_timeline_updates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_date: string
          id: string
          implementation_id: string
          kind: string
          owner_visible: boolean
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          implementation_id: string
          kind?: string
          owner_visible?: boolean
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_date?: string
          id?: string
          implementation_id?: string
          kind?: string
          owner_visible?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "implementation_timeline_updates_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      initial_charges: {
        Row: {
          amount: number
          code: string
          created_at: string
          due_at: string | null
          id: string
          implementation_id: string
          items: Json
          notes: string | null
          owner_id: string | null
          paid_at: string | null
          payment_reference: string | null
          proposal_id: string
          status: Database["public"]["Enums"]["initial_charge_status"]
        }
        Insert: {
          amount?: number
          code: string
          created_at?: string
          due_at?: string | null
          id?: string
          implementation_id: string
          items?: Json
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          proposal_id: string
          status?: Database["public"]["Enums"]["initial_charge_status"]
        }
        Update: {
          amount?: number
          code?: string
          created_at?: string
          due_at?: string | null
          id?: string
          implementation_id?: string
          items?: Json
          notes?: string | null
          owner_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          proposal_id?: string
          status?: Database["public"]["Enums"]["initial_charge_status"]
        }
        Relationships: []
      }
      outbound_messages: {
        Row: {
          body: string
          created_at: string
          destination: string
          error: string | null
          failed_at: string | null
          id: string
          implementation_id: string
          owner_id: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_message_status"]
          template: string
        }
        Insert: {
          body: string
          created_at?: string
          destination: string
          error?: string | null
          failed_at?: string | null
          id?: string
          implementation_id: string
          owner_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_message_status"]
          template: string
        }
        Update: {
          body?: string
          created_at?: string
          destination?: string
          error?: string | null
          failed_at?: string | null
          id?: string
          implementation_id?: string
          owner_id?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_message_status"]
          template?: string
        }
        Relationships: []
      }
      owner_intake_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          implementation_id: string
          last_access_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          implementation_id: string
          last_access_at?: string | null
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          implementation_id?: string
          last_access_at?: string | null
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_intake_links_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_intake_submissions: {
        Row: {
          created_at: string
          current_step: number
          data: Json
          implementation_id: string
          link_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          data?: Json
          implementation_id: string
          link_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: number
          data?: Json
          implementation_id?: string
          link_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_intake_submissions_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: true
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_intake_submissions_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "owner_intake_links"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notes: {
        Row: {
          content: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_onboarding_people: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          full_name: string | null
          id: string
          implementation_id: string
          person_type: string
          phone: string | null
          position: number
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          implementation_id: string
          person_type?: string
          phone?: string | null
          position?: number
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          implementation_id?: string
          person_type?: string
          phone?: string | null
          position?: number
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_onboarding_people_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_onboarding_profiles: {
        Row: {
          city: string | null
          complement: string | null
          created_at: string
          current_step: number
          district: string | null
          email: string | null
          implementation_id: string
          legal_name: string | null
          number: string | null
          person_type: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          street: string | null
          submitted_at: string | null
          tax_id: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          complement?: string | null
          created_at?: string
          current_step?: number
          district?: string | null
          email?: string | null
          implementation_id: string
          legal_name?: string | null
          number?: string | null
          person_type?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          submitted_at?: string | null
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          complement?: string | null
          created_at?: string
          current_step?: number
          district?: string | null
          email?: string | null
          implementation_id?: string
          legal_name?: string | null
          number?: string | null
          person_type?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street?: string | null
          submitted_at?: string | null
          tax_id?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_onboarding_profiles_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: true
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_onboarding_submissions: {
        Row: {
          document: string | null
          email: string
          full_name: string
          id: string
          implementation_id: string
          phone: string
          pix_key: string | null
          submitted_at: string
        }
        Insert: {
          document?: string | null
          email: string
          full_name: string
          id?: string
          implementation_id: string
          phone: string
          pix_key?: string | null
          submitted_at?: string
        }
        Update: {
          document?: string | null
          email?: string
          full_name?: string
          id?: string
          implementation_id?: string
          phone?: string
          pix_key?: string | null
          submitted_at?: string
        }
        Relationships: []
      }
      owner_payout_accounts: {
        Row: {
          account_holder: string | null
          account_number: string | null
          account_type: string | null
          bank_branch: string | null
          bank_name: string | null
          created_at: string
          holder_tax_id: string | null
          id: string
          implementation_id: string
          is_primary: boolean
          pix_key: string | null
          pix_type: string | null
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          holder_tax_id?: string | null
          id?: string
          implementation_id: string
          is_primary?: boolean
          pix_key?: string | null
          pix_type?: string | null
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          created_at?: string
          holder_tax_id?: string | null
          id?: string
          implementation_id?: string
          is_primary?: boolean
          pix_key?: string | null
          pix_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_payout_accounts_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: true
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_portal_accounts: {
        Row: {
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_portal_accounts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_portal_invitation_secrets: {
        Row: {
          created_at: string
          invitation_id: string
          token: string
        }
        Insert: {
          created_at?: string
          invitation_id: string
          token: string
        }
        Update: {
          created_at?: string
          invitation_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_portal_invitation_secrets_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "owner_portal_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_portal_invitations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          implementation_id: string
          last_access_at: string | null
          owner_id: string | null
          public_snapshot: Json | null
          revoked_at: string | null
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          implementation_id: string
          last_access_at?: string | null
          owner_id?: string | null
          public_snapshot?: Json | null
          revoked_at?: string | null
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          implementation_id?: string
          last_access_at?: string | null
          owner_id?: string | null
          public_snapshot?: Json | null
          revoked_at?: string | null
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_portal_invitations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_proposal_confirmations: {
        Row: {
          command_id: string
          confirmed_at: string
          confirmed_name: string
          id: string
          implementation_id: string
          invitation_id: string
          proposal_id: string
          result: string
          snapshot: Json
          snapshot_hash: string
          statement: string
          version: number
        }
        Insert: {
          command_id: string
          confirmed_at?: string
          confirmed_name: string
          id?: string
          implementation_id: string
          invitation_id: string
          proposal_id: string
          result?: string
          snapshot: Json
          snapshot_hash: string
          statement: string
          version: number
        }
        Update: {
          command_id?: string
          confirmed_at?: string
          confirmed_name?: string
          id?: string
          implementation_id?: string
          invitation_id?: string
          proposal_id?: string
          result?: string
          snapshot?: Json
          snapshot_hash?: string
          statement?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "owner_proposal_confirmations_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_proposal_confirmations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "owner_portal_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_proposal_confirmations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_records: {
        Row: {
          core_owner_id: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          lifecycle_status: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          core_owner_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          lifecycle_status?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          core_owner_id?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          lifecycle_status?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      owner_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          implementation_id: string | null
          kind: string
          owner_id: string
          status: Database["public"]["Enums"]["owner_task_status"]
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          implementation_id?: string | null
          kind: string
          owner_id: string
          status?: Database["public"]["Enums"]["owner_task_status"]
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          implementation_id?: string | null
          kind?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["owner_task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_tasks_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owner_records"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_content_blocks: {
        Row: {
          created_at: string
          display_order: number
          draft_body: string
          draft_title: string
          id: string
          kind: Database["public"]["Enums"]["portal_block_kind"]
          published_at: string | null
          published_body: string | null
          published_title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          draft_body?: string
          draft_title?: string
          id?: string
          kind?: Database["public"]["Enums"]["portal_block_kind"]
          published_at?: string | null
          published_body?: string | null
          published_title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          draft_body?: string
          draft_title?: string
          id?: string
          kind?: Database["public"]["Enums"]["portal_block_kind"]
          published_at?: string | null
          published_body?: string | null
          published_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_visibility_releases: {
        Row: {
          block: string
          content: Json
          id: string
          implementation_id: string
          released_at: string
          released_by: string
          released_by_name: string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          block: string
          content: Json
          id?: string
          implementation_id: string
          released_at?: string
          released_by: string
          released_by_name?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Update: {
          block?: string
          content?: Json
          id?: string
          implementation_id?: string
          released_at?: string
          released_by?: string
          released_by_name?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_visibility_releases_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_content_blocks: {
        Row: {
          body: string
          created_at: string
          display_order: number
          id: string
          implementation_id: string
          title: string
          visibility: Database["public"]["Enums"]["proposal_block_visibility"]
        }
        Insert: {
          body?: string
          created_at?: string
          display_order?: number
          id?: string
          implementation_id: string
          title: string
          visibility?: Database["public"]["Enums"]["proposal_block_visibility"]
        }
        Update: {
          body?: string
          created_at?: string
          display_order?: number
          id?: string
          implementation_id?: string
          title?: string
          visibility?: Database["public"]["Enums"]["proposal_block_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "proposal_content_blocks_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_share_links: {
        Row: {
          created_at: string
          expires_at: string | null
          implementation_id: string
          link_type: string
          proposal_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          implementation_id: string
          link_type?: string
          proposal_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          implementation_id?: string
          link_type?: string
          proposal_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_share_links_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_share_links_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          accepted_name: string | null
          created_at: string
          draft_item_options: Json
          draft_partnership_object: string | null
          draft_responsibilities: Json
          draft_revision: number
          id: string
          implementation_id: string
          items: Json
          last_draft_command_id: string | null
          publish_command_id: string | null
          published_at: string | null
          published_by: string | null
          required_signatories: Json
          snapshot: Json | null
          status: string
          total: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_name?: string | null
          created_at?: string
          draft_item_options?: Json
          draft_partnership_object?: string | null
          draft_responsibilities?: Json
          draft_revision?: number
          id?: string
          implementation_id: string
          items: Json
          last_draft_command_id?: string | null
          publish_command_id?: string | null
          published_at?: string | null
          published_by?: string | null
          required_signatories?: Json
          snapshot?: Json | null
          status?: string
          total: number
          updated_at?: string
          updated_by?: string | null
          version: number
        }
        Update: {
          accepted_at?: string | null
          accepted_name?: string | null
          created_at?: string
          draft_item_options?: Json
          draft_partnership_object?: string | null
          draft_responsibilities?: Json
          draft_revision?: number
          id?: string
          implementation_id?: string
          items?: Json
          last_draft_command_id?: string | null
          publish_command_id?: string | null
          published_at?: string | null
          published_by?: string | null
          required_signatories?: Json
          snapshot?: Json | null
          status?: string
          total?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_catalog_items: {
        Row: {
          created_at: string
          id: string
          name: string
          room: string | null
          size: string | null
          supplier: string | null
          unit_cost: number | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          room?: string | null
          size?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room?: string | null
          size?: string | null
          supplier?: string | null
          unit_cost?: number | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      supply_item_documents: {
        Row: {
          created_at: string
          filename: string
          id: string
          implementation_id: string
          kind: string
          mime_type: string
          size_bytes: number
          storage_path: string
          supply_item_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          implementation_id: string
          kind?: string
          mime_type: string
          size_bytes?: number
          storage_path: string
          supply_item_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          implementation_id?: string
          kind?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          supply_item_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_item_documents_implementation_id_fkey"
            columns: ["implementation_id"]
            isOneToOne: false
            referencedRelation: "implementation_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_item_documents_supply_item_id_fkey"
            columns: ["supply_item_id"]
            isOneToOne: false
            referencedRelation: "implementation_supply_items"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_template_items: {
        Row: {
          display_order: number
          id: string
          name: string
          required_qty: number
          room: string | null
          size: string | null
          template_id: string
        }
        Insert: {
          display_order?: number
          id?: string
          name: string
          required_qty?: number
          room?: string | null
          size?: string | null
          template_id: string
        }
        Update: {
          display_order?: number
          id?: string
          name?: string
          required_qty?: number
          room?: string | null
          size?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "supply_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_templates: {
        Row: {
          created_at: string
          id: string
          module: Database["public"]["Enums"]["supply_module"]
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["supply_module"]
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["supply_module"]
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_autosave_opportunity: {
        Args: { p_base: Json; p_implementation_id: string; p_patch: Json }
        Returns: Json
      }
      admin_close_implementation_next_action: {
        Args: { p_data: Json }
        Returns: Json
      }
      admin_complete_opportunity_draft: {
        Args: { p_implementation_id: string }
        Returns: {
          address: string | null
          bedrooms: number | null
          capacity: number | null
          city: string | null
          code: string
          completion_date_estimate: string | null
          condominium_id: string | null
          condominium_name: string | null
          core_owner_id: string | null
          core_property_id: string | null
          cover_approved_at: string | null
          cover_approved_by: string | null
          cover_image: string | null
          cover_source: string | null
          created_at: string
          draft_completed_at: string | null
          draft_step: string | null
          id: string
          nickname: string | null
          notes: string | null
          origin: string | null
          owner_facing_notes: string | null
          owner_id: string | null
          postal_code: string | null
          property_type: string | null
          responsible_user_id: string | null
          start_date_estimate: string | null
          status: Database["public"]["Enums"]["implementation_status"]
          tower: string | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "implementation_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_draft_opportunity: {
        Args: { p_data: Json }
        Returns: {
          address: string | null
          bedrooms: number | null
          capacity: number | null
          city: string | null
          code: string
          completion_date_estimate: string | null
          condominium_id: string | null
          condominium_name: string | null
          core_owner_id: string | null
          core_property_id: string | null
          cover_approved_at: string | null
          cover_approved_by: string | null
          cover_image: string | null
          cover_source: string | null
          created_at: string
          draft_completed_at: string | null
          draft_step: string | null
          id: string
          nickname: string | null
          notes: string | null
          origin: string | null
          owner_facing_notes: string | null
          owner_id: string | null
          postal_code: string | null
          property_type: string | null
          responsible_user_id: string | null
          start_date_estimate: string | null
          status: Database["public"]["Enums"]["implementation_status"]
          tower: string | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "implementation_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_implementation: {
        Args: { p_data: Json }
        Returns: {
          address: string | null
          bedrooms: number | null
          capacity: number | null
          city: string | null
          code: string
          completion_date_estimate: string | null
          condominium_id: string | null
          condominium_name: string | null
          core_owner_id: string | null
          core_property_id: string | null
          cover_approved_at: string | null
          cover_approved_by: string | null
          cover_image: string | null
          cover_source: string | null
          created_at: string
          draft_completed_at: string | null
          draft_step: string | null
          id: string
          nickname: string | null
          notes: string | null
          origin: string | null
          owner_facing_notes: string | null
          owner_id: string | null
          postal_code: string | null
          property_type: string | null
          responsible_user_id: string | null
          start_date_estimate: string | null
          status: Database["public"]["Enums"]["implementation_status"]
          tower: string | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "implementation_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_opportunity: {
        Args: { p_data: Json }
        Returns: {
          address: string | null
          bedrooms: number | null
          capacity: number | null
          city: string | null
          code: string
          completion_date_estimate: string | null
          condominium_id: string | null
          condominium_name: string | null
          core_owner_id: string | null
          core_property_id: string | null
          cover_approved_at: string | null
          cover_approved_by: string | null
          cover_image: string | null
          cover_source: string | null
          created_at: string
          draft_completed_at: string | null
          draft_step: string | null
          id: string
          nickname: string | null
          notes: string | null
          origin: string | null
          owner_facing_notes: string | null
          owner_id: string | null
          postal_code: string | null
          property_type: string | null
          responsible_user_id: string | null
          start_date_estimate: string | null
          status: Database["public"]["Enums"]["implementation_status"]
          tower: string | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "implementation_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_find_owner_phone_duplicates: {
        Args: { p_phone: string }
        Returns: {
          id: string
          lifecycle_status: string
          name: string
          phone: string
        }[]
      }
      admin_get_commercial_meeting_state: {
        Args: { p_implementation_id: string }
        Returns: Json
      }
      admin_hide_portal_block: {
        Args: { p_block: string; p_implementation_id: string }
        Returns: undefined
      }
      admin_list_commercial_assignees: {
        Args: never
        Returns: {
          full_name: string
          id: string
          role: Database["public"]["Enums"]["admin_role"]
        }[]
      }
      admin_list_commercial_overview: {
        Args: never
        Returns: {
          implementation_id: string
          meeting_mode: string
          meeting_responsible_name: string
          meeting_responsible_user_id: string
          meeting_starts_at: string
          meeting_status: string
          meeting_time_zone: string
          next_action_due_at: string
          next_action_responsible_name: string
          next_action_responsible_user_id: string
          next_action_time_zone: string
          next_action_title: string
        }[]
      }
      admin_list_proposal_versions: {
        Args: { p_implementation_id: string }
        Returns: Json
      }
      admin_profiles_is_empty: { Args: never; Returns: boolean }
      admin_publish_proposal: { Args: { p_data: Json }; Returns: Json }
      admin_release_portal_block: { Args: { p_data: Json }; Returns: Json }
      admin_reschedule_commercial_meeting: {
        Args: { p_data: Json }
        Returns: Json
      }
      admin_review_owner_intake: { Args: { p_data: Json }; Returns: Json }
      admin_save_opportunity_contact: {
        Args: { p_data: Json; p_implementation_id: string }
        Returns: {
          address: string | null
          bedrooms: number | null
          capacity: number | null
          city: string | null
          code: string
          completion_date_estimate: string | null
          condominium_id: string | null
          condominium_name: string | null
          core_owner_id: string | null
          core_property_id: string | null
          cover_approved_at: string | null
          cover_approved_by: string | null
          cover_image: string | null
          cover_source: string | null
          created_at: string
          draft_completed_at: string | null
          draft_step: string | null
          id: string
          nickname: string | null
          notes: string | null
          origin: string | null
          owner_facing_notes: string | null
          owner_id: string | null
          postal_code: string | null
          property_type: string | null
          responsible_user_id: string | null
          start_date_estimate: string | null
          status: Database["public"]["Enums"]["implementation_status"]
          tower: string | null
          unit: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "implementation_projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_save_proposal_draft: { Args: { p_data: Json }; Returns: Json }
      admin_schedule_commercial_meeting: {
        Args: { p_data: Json }
        Returns: Json
      }
      admin_set_implementation_next_action: {
        Args: { p_data: Json }
        Returns: Json
      }
      admin_update_commercial_meeting_status: {
        Args: { p_data: Json }
        Returns: Json
      }
      current_admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      has_admin_role: {
        Args: { roles: Database["public"]["Enums"]["admin_role"][] }
        Returns: boolean
      }
      implementation_effective_cover: {
        Args: { p_implementation_id: string }
        Returns: Json
      }
      is_valid_brazilian_document: {
        Args: { p_value: string }
        Returns: boolean
      }
      owner_account_link: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          id: string
          owner_id: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_portal_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owner_can_access_implementation: {
        Args: { p_implementation_id: string }
        Returns: boolean
      }
      owner_cover_by_token: { Args: { p_token: string }; Returns: Json }
      owner_cover_for_implementation: {
        Args: { p_implementation_id: string }
        Returns: Json
      }
      owner_intake_link_by_token: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          implementation_id: string
          last_access_at: string | null
          revoked_at: string | null
          token_hash: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_intake_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owner_intake_resolve: { Args: { p_token: string }; Returns: Json }
      owner_intake_save: {
        Args: {
          p_data: Json
          p_step: number
          p_submit: boolean
          p_token: string
        }
        Returns: Json
      }
      owner_journey_accept_proposal: {
        Args: {
          p_accepted_name: string
          p_command_id: string
          p_proposal_id: string
          p_token: string
        }
        Returns: Json
      }
      owner_journey_current_confirmed: {
        Args: { p_implementation_id: string }
        Returns: boolean
      }
      owner_journey_resolve_proposal: {
        Args: { p_token: string }
        Returns: Json
      }
      owner_next_meeting: {
        Args: { p_implementation_id: string }
        Returns: Json
      }
      owner_onboarding_draft_resolve: {
        Args: { p_token: string }
        Returns: Json
      }
      owner_onboarding_draft_resolve_v2: {
        Args: { p_token: string }
        Returns: Json
      }
      owner_onboarding_draft_save: {
        Args: { p_data: Json; p_submit?: boolean; p_token: string }
        Returns: Json
      }
      owner_onboarding_draft_save_v2: {
        Args: { p_data: Json; p_submit?: boolean; p_token: string }
        Returns: Json
      }
      owner_onboarding_resolve_token: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          implementation_id: string
          revoked_at: string
          used_at: string
        }[]
      }
      owner_onboarding_submit: {
        Args: {
          p_document: string
          p_email: string
          p_full_name: string
          p_phone: string
          p_pix_key: string
          p_token: string
        }
        Returns: {
          document: string | null
          email: string
          full_name: string
          id: string
          implementation_id: string
          phone: string
          pix_key: string | null
          submitted_at: string
        }
        SetofOptions: {
          from: "*"
          to: "owner_onboarding_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      owner_portal_accept_proposal: {
        Args: { p_accepted_name: string; p_token: string }
        Returns: Json
      }
      owner_portal_resolve: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          public_snapshot: Json
          revoked_at: string
        }[]
      }
      owner_property_details_resolve_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      owner_property_details_save_by_token: {
        Args: { p_data: Json; p_token: string }
        Returns: Json
      }
      portal_attachment_released: {
        Args: { p_attachment_id: string; p_implementation_id: string }
        Returns: boolean
      }
      proposal_accept_by_token: {
        Args: { p_accepted_name: string; p_token: string }
        Returns: {
          accepted_at: string
          accepted_name: string
          created_at: string
          implementation_id: string
          items: Json
          proposal_id: string
          total: number
          version: number
        }[]
      }
      proposal_public_link_status: {
        Args: { p_token: string }
        Returns: string
      }
      proposal_public_resolve_by_token: {
        Args: { p_token: string }
        Returns: Json
      }
      proposal_resolve_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          accepted_name: string
          created_at: string
          implementation_id: string
          items: Json
          proposal_id: string
          total: number
          version: number
        }[]
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "admin"
        | "commercial"
        | "operations"
        | "finance"
        | "viewer"
      charge_type:
        | "percentage"
        | "fixed_once"
        | "per_reservation"
        | "monthly"
        | "optional"
        | "informational"
      implementation_item_status:
        | "pendente"
        | "em_andamento"
        | "concluido"
        | "bloqueado"
        | "nao_aplicavel"
        | "pulado"
      implementation_status:
        | "prospect"
        | "proposta"
        | "aguardando_aprovacao"
        | "aprovado"
        | "planejamento"
        | "em_implantacao"
        | "validacao"
        | "pronto_para_operacao"
        | "ativo"
        | "pausado"
        | "nao_convertido"
        | "cancelado"
      initial_charge_status:
        | "draft"
        | "issued"
        | "pending"
        | "paid"
        | "cancelled"
        | "overdue"
      outbound_message_status:
        | "draft"
        | "queued"
        | "sent"
        | "failed"
        | "cancelled"
      owner_field_state:
        | "not_informed"
        | "prefilled_by_stayo"
        | "confirmed_by_owner"
        | "changed_by_owner"
        | "reviewed_by_stayo"
      owner_task_status: "pending" | "done" | "dismissed"
      portal_block_kind: "hero" | "destaque" | "passo" | "faq" | "rodape"
      proposal_block_visibility: "interno" | "proposta" | "portal"
      supply_module: "enxoval" | "faltante"
      supply_priority: "baixa" | "media" | "alta"
      supply_status:
        | "pendente"
        | "comprado"
        | "entregue"
        | "instalado"
        | "nao_aplicavel"
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
      admin_role: [
        "super_admin",
        "admin",
        "commercial",
        "operations",
        "finance",
        "viewer",
      ],
      charge_type: [
        "percentage",
        "fixed_once",
        "per_reservation",
        "monthly",
        "optional",
        "informational",
      ],
      implementation_item_status: [
        "pendente",
        "em_andamento",
        "concluido",
        "bloqueado",
        "nao_aplicavel",
        "pulado",
      ],
      implementation_status: [
        "prospect",
        "proposta",
        "aguardando_aprovacao",
        "aprovado",
        "planejamento",
        "em_implantacao",
        "validacao",
        "pronto_para_operacao",
        "ativo",
        "pausado",
        "nao_convertido",
        "cancelado",
      ],
      initial_charge_status: [
        "draft",
        "issued",
        "pending",
        "paid",
        "cancelled",
        "overdue",
      ],
      outbound_message_status: [
        "draft",
        "queued",
        "sent",
        "failed",
        "cancelled",
      ],
      owner_field_state: [
        "not_informed",
        "prefilled_by_stayo",
        "confirmed_by_owner",
        "changed_by_owner",
        "reviewed_by_stayo",
      ],
      owner_task_status: ["pending", "done", "dismissed"],
      portal_block_kind: ["hero", "destaque", "passo", "faq", "rodape"],
      proposal_block_visibility: ["interno", "proposta", "portal"],
      supply_module: ["enxoval", "faltante"],
      supply_priority: ["baixa", "media", "alta"],
      supply_status: [
        "pendente",
        "comprado",
        "entregue",
        "instalado",
        "nao_aplicavel",
      ],
    },
  },
} as const
