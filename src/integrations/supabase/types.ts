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
      adverse_events: {
        Row: {
          appointment_id: string | null
          body_region: string | null
          client_email: string
          client_first_name: string | null
          client_last_name: string | null
          clinical_note_id: string | null
          created_at: string
          event_date: string
          event_type: Database["public"]["Enums"]["adverse_event_type"]
          followup_at: string | null
          followup_complete: boolean
          id: string
          intervention: string | null
          lot_id: string | null
          medications_given: string[]
          notes: string | null
          np_notified_at: string | null
          np_notified_user_id: string | null
          outcome: Database["public"]["Enums"]["adverse_event_outcome"]
          photos: string[]
          product_involved: string | null
          reported_at: string
          reported_by: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["adverse_event_severity"]
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          body_region?: string | null
          client_email: string
          client_first_name?: string | null
          client_last_name?: string | null
          clinical_note_id?: string | null
          created_at?: string
          event_date?: string
          event_type: Database["public"]["Enums"]["adverse_event_type"]
          followup_at?: string | null
          followup_complete?: boolean
          id?: string
          intervention?: string | null
          lot_id?: string | null
          medications_given?: string[]
          notes?: string | null
          np_notified_at?: string | null
          np_notified_user_id?: string | null
          outcome?: Database["public"]["Enums"]["adverse_event_outcome"]
          photos?: string[]
          product_involved?: string | null
          reported_at?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity: Database["public"]["Enums"]["adverse_event_severity"]
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          body_region?: string | null
          client_email?: string
          client_first_name?: string | null
          client_last_name?: string | null
          clinical_note_id?: string | null
          created_at?: string
          event_date?: string
          event_type?: Database["public"]["Enums"]["adverse_event_type"]
          followup_at?: string | null
          followup_complete?: boolean
          id?: string
          intervention?: string | null
          lot_id?: string | null
          medications_given?: string[]
          notes?: string | null
          np_notified_at?: string | null
          np_notified_user_id?: string | null
          outcome?: Database["public"]["Enums"]["adverse_event_outcome"]
          photos?: string[]
          product_involved?: string | null
          reported_at?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["adverse_event_severity"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adverse_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverse_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "product_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          after_hours_instructions: string | null
          appointment_reminder_hours: number[]
          consent_max_reminders: number
          consent_reminder_hours: number
          consent_reminder_schedule: number[]
          default_consent_validity_months: number
          discount_presets: Json
          emergency_phone: string | null
          id: number
          owner_email: string | null
          perks_anniversary_amount_cents: number
          perks_anniversary_enabled: boolean
          perks_anniversary_validity_days: number
          perks_birthday_amount_cents: number
          perks_birthday_enabled: boolean
          perks_birthday_validity_days: number
          receptionist_email: string | null
          shared_google_calendar_id: string | null
          updated_at: string
        }
        Insert: {
          after_hours_instructions?: string | null
          appointment_reminder_hours?: number[]
          consent_max_reminders?: number
          consent_reminder_hours?: number
          consent_reminder_schedule?: number[]
          default_consent_validity_months?: number
          discount_presets?: Json
          emergency_phone?: string | null
          id?: number
          owner_email?: string | null
          perks_anniversary_amount_cents?: number
          perks_anniversary_enabled?: boolean
          perks_anniversary_validity_days?: number
          perks_birthday_amount_cents?: number
          perks_birthday_enabled?: boolean
          perks_birthday_validity_days?: number
          receptionist_email?: string | null
          shared_google_calendar_id?: string | null
          updated_at?: string
        }
        Update: {
          after_hours_instructions?: string | null
          appointment_reminder_hours?: number[]
          consent_max_reminders?: number
          consent_reminder_hours?: number
          consent_reminder_schedule?: number[]
          default_consent_validity_months?: number
          discount_presets?: Json
          emergency_phone?: string | null
          id?: number
          owner_email?: string | null
          perks_anniversary_amount_cents?: number
          perks_anniversary_enabled?: boolean
          perks_anniversary_validity_days?: number
          perks_birthday_amount_cents?: number
          perks_birthday_enabled?: boolean
          perks_birthday_validity_days?: number
          receptionist_email?: string | null
          shared_google_calendar_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      appointment_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          appointment_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["appointment_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["appointment_status"] | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          appointment_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          appointment_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["appointment_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["appointment_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_audit_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_consents: {
        Row: {
          appointment_id: string
          assigned_at: string
          assigned_by: string | null
          consent_form_id: string
          id: string
          last_reminded_at: string | null
          reminder_count: number
          sent_to_email: string | null
          signed: boolean
        }
        Insert: {
          appointment_id: string
          assigned_at?: string
          assigned_by?: string | null
          consent_form_id: string
          id?: string
          last_reminded_at?: string | null
          reminder_count?: number
          sent_to_email?: string | null
          signed?: boolean
        }
        Update: {
          appointment_id?: string
          assigned_at?: string
          assigned_by?: string | null
          consent_form_id?: string
          id?: string
          last_reminded_at?: string | null
          reminder_count?: number
          sent_to_email?: string | null
          signed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appointment_consents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_consents_consent_form_id_fkey"
            columns: ["consent_form_id"]
            isOneToOne: false
            referencedRelation: "consent_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_reminder_log: {
        Row: {
          appointment_id: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          recipient: string
          reminder_hours: number
          status: string
        }
        Insert: {
          appointment_id: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          recipient: string
          reminder_hours: number
          status?: string
        }
        Update: {
          appointment_id?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          recipient?: string
          reminder_hours?: number
          status?: string
        }
        Relationships: []
      }
      appointment_services: {
        Row: {
          appointment_id: string
          created_at: string
          display_order: number
          duration_minutes: number
          id: string
          service_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          display_order?: number
          duration_minutes: number
          id?: string
          service_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          display_order?: number
          duration_minutes?: number
          id?: string
          service_id?: string
        }
        Relationships: []
      }
      appointment_staff_calendar_events: {
        Row: {
          appointment_id: string
          calendar_id: string
          created_at: string
          google_event_id: string
          id: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          calendar_id?: string
          created_at?: string
          google_event_id: string
          id?: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          calendar_id?: string
          created_at?: string
          google_event_id?: string
          id?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_staff_calendar_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_staff_calendar_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_staff_calendar_events_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calendar_sequence: number
          checked_in_at: string | null
          checked_in_by: string | null
          checkin_sms_sent_at: string | null
          client_dob: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          client_notes: string | null
          client_phone: string
          confirmation_sms_sent_at: string | null
          consent_pdf_url: string | null
          created_at: string
          day7_tox_sms_sent_at: string | null
          denial_reason: string | null
          deposit_amount_cents: number | null
          deposit_charge_id: string | null
          deposit_charged_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          end_at: string
          followup_day14_sent_at: string | null
          followup_day2_sent_at: string | null
          google_event_owner_id: string | null
          google_event_provider_id: string | null
          id: string
          intake_completed_at: string | null
          intake_last_sent_at: string | null
          intake_reminder_24h_sent_at: string | null
          intake_reminder_48h_sent_at: string | null
          intake_send_count: number | null
          intake_sent_at: string | null
          is_new_client: boolean | null
          location_id: string
          no_show_charge_id: string | null
          no_show_charged_at: string | null
          post_op_sent_at: string | null
          pre_op_sent_at: string | null
          public_token: string
          rebook_sms_sent_at: string | null
          referral_code: string | null
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          review_sms_sent_at: string | null
          service_id: string
          sms_opt_in: boolean
          sms_opt_in_at: string | null
          staff_id: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_setup_intent_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calendar_sequence?: number
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_sms_sent_at?: string | null
          client_dob?: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          client_notes?: string | null
          client_phone: string
          confirmation_sms_sent_at?: string | null
          consent_pdf_url?: string | null
          created_at?: string
          day7_tox_sms_sent_at?: string | null
          denial_reason?: string | null
          deposit_amount_cents?: number | null
          deposit_charge_id?: string | null
          deposit_charged_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_at: string
          followup_day14_sent_at?: string | null
          followup_day2_sent_at?: string | null
          google_event_owner_id?: string | null
          google_event_provider_id?: string | null
          id?: string
          intake_completed_at?: string | null
          intake_last_sent_at?: string | null
          intake_reminder_24h_sent_at?: string | null
          intake_reminder_48h_sent_at?: string | null
          intake_send_count?: number | null
          intake_sent_at?: string | null
          is_new_client?: boolean | null
          location_id: string
          no_show_charge_id?: string | null
          no_show_charged_at?: string | null
          post_op_sent_at?: string | null
          pre_op_sent_at?: string | null
          public_token?: string
          rebook_sms_sent_at?: string | null
          referral_code?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          review_sms_sent_at?: string | null
          service_id: string
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          staff_id: string
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calendar_sequence?: number
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_sms_sent_at?: string | null
          client_dob?: string | null
          client_email?: string
          client_first_name?: string
          client_last_name?: string
          client_notes?: string | null
          client_phone?: string
          confirmation_sms_sent_at?: string | null
          consent_pdf_url?: string | null
          created_at?: string
          day7_tox_sms_sent_at?: string | null
          denial_reason?: string | null
          deposit_amount_cents?: number | null
          deposit_charge_id?: string | null
          deposit_charged_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_at?: string
          followup_day14_sent_at?: string | null
          followup_day2_sent_at?: string | null
          google_event_owner_id?: string | null
          google_event_provider_id?: string | null
          id?: string
          intake_completed_at?: string | null
          intake_last_sent_at?: string | null
          intake_reminder_24h_sent_at?: string | null
          intake_reminder_48h_sent_at?: string | null
          intake_send_count?: number | null
          intake_sent_at?: string | null
          is_new_client?: boolean | null
          location_id?: string
          no_show_charge_id?: string | null
          no_show_charged_at?: string | null
          post_op_sent_at?: string | null
          pre_op_sent_at?: string | null
          public_token?: string
          rebook_sms_sent_at?: string | null
          referral_code?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          review_sms_sent_at?: string | null
          service_id?: string
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          staff_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_setup_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_clients: {
        Row: {
          blocked_by: string | null
          created_at: string
          email: string
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          email: string
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          email?: string
          reason?: string | null
        }
        Relationships: []
      }
      booking_attempts: {
        Row: {
          completed_at: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          intended_start_at: string | null
          last_name: string | null
          location_id: string | null
          notified_at: string | null
          phone: string | null
          service_id: string | null
          session_id: string
          staff_id: string | null
          started_at: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          intended_start_at?: string | null
          last_name?: string | null
          location_id?: string | null
          notified_at?: string | null
          phone?: string | null
          service_id?: string | null
          session_id: string
          staff_id?: string | null
          started_at?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          intended_start_at?: string | null
          last_name?: string | null
          location_id?: string | null
          notified_at?: string | null
          phone?: string | null
          service_id?: string | null
          session_id?: string
          staff_id?: string | null
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          location_id: string | null
          metadata: Json | null
          service_id: string | null
          session_id: string
          staff_id: string | null
          step: number | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          location_id?: string | null
          metadata?: Json | null
          service_id?: string | null
          session_id: string
          staff_id?: string | null
          step?: number | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          location_id?: string | null
          metadata?: Json | null
          service_id?: string | null
          session_id?: string
          staff_id?: string | null
          step?: number | null
        }
        Relationships: []
      }
      breach_report_notes: {
        Row: {
          author_name: string | null
          author_user_id: string | null
          breach_report_id: string
          created_at: string
          id: string
          note: string
        }
        Insert: {
          author_name?: string | null
          author_user_id?: string | null
          breach_report_id: string
          created_at?: string
          id?: string
          note: string
        }
        Update: {
          author_name?: string | null
          author_user_id?: string | null
          breach_report_id?: string
          created_at?: string
          id?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "breach_report_notes_breach_report_id_fkey"
            columns: ["breach_report_id"]
            isOneToOne: false
            referencedRelation: "breach_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      breach_reports: {
        Row: {
          created_at: string
          description: string
          discovered_at: string
          id: string
          immediate_actions: string | null
          individuals_affected: number | null
          occurred_at: string | null
          phi_involved: string | null
          reporter_email: string | null
          reporter_name: string | null
          reporter_user_id: string | null
          status: string
          systems_involved: string | null
        }
        Insert: {
          created_at?: string
          description: string
          discovered_at?: string
          id?: string
          immediate_actions?: string | null
          individuals_affected?: number | null
          occurred_at?: string | null
          phi_involved?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_user_id?: string | null
          status?: string
          systems_involved?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          discovered_at?: string
          id?: string
          immediate_actions?: string | null
          individuals_affected?: number | null
          occurred_at?: string | null
          phi_involved?: string | null
          reporter_email?: string | null
          reporter_name?: string | null
          reporter_user_id?: string | null
          status?: string
          systems_involved?: string | null
        }
        Relationships: []
      }
      chart_lot_consumption: {
        Row: {
          category: string | null
          clinical_note_id: string
          consumed_at: string | null
          created_at: string
          id: string
          lot_id: string
          qty: number
          unit: string
        }
        Insert: {
          category?: string | null
          clinical_note_id: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          lot_id: string
          qty: number
          unit?: string
        }
        Update: {
          category?: string | null
          clinical_note_id?: string
          consumed_at?: string | null
          created_at?: string
          id?: string
          lot_id?: string
          qty?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_lot_consumption_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_lot_consumption_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "product_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_note_templates: {
        Row: {
          body: Json
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          subtype: string | null
          updated_at: string
        }
        Insert: {
          body?: Json
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          subtype?: string | null
          updated_at?: string
        }
        Update: {
          body?: Json
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          subtype?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      checkout_proposals: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          appointment_id: string | null
          client_email: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          items: Json
          note: string | null
          status: string
          suggested_discount_amount_cents: number | null
          suggested_discount_pct: number | null
          suggested_discount_reason: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          appointment_id?: string | null
          client_email?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          items?: Json
          note?: string | null
          status?: string
          suggested_discount_amount_cents?: number | null
          suggested_discount_pct?: number | null
          suggested_discount_reason?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          appointment_id?: string | null
          client_email?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          items?: Json
          note?: string | null
          status?: string
          suggested_discount_amount_cents?: number | null
          suggested_discount_pct?: number | null
          suggested_discount_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_proposals_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credits: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          client_email: string
          created_at: string
          id: string
          issued_by: string | null
          kind: string
          note: string | null
          reason: string
          redeemed_amount_cents: number | null
          redeemed_at: string | null
          redeemed_sale_id: string | null
          service_id: string | null
          service_label: string | null
          units: number | null
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          client_email: string
          created_at?: string
          id?: string
          issued_by?: string | null
          kind?: string
          note?: string | null
          reason: string
          redeemed_amount_cents?: number | null
          redeemed_at?: string | null
          redeemed_sale_id?: string | null
          service_id?: string | null
          service_label?: string | null
          units?: number | null
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          client_email?: string
          created_at?: string
          id?: string
          issued_by?: string | null
          kind?: string
          note?: string | null
          reason?: string
          redeemed_amount_cents?: number | null
          redeemed_at?: string | null
          redeemed_sale_id?: string | null
          service_id?: string | null
          service_label?: string | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_credits_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credits_redeemed_sale_id_fkey"
            columns: ["redeemed_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      client_feedback: {
        Row: {
          allow_testimonial: boolean
          appointment_id: string
          client_email: string
          comment: string | null
          created_at: string
          display_first_name: string | null
          featured: boolean
          google_review_sms_sent_at: string | null
          id: string
          location_id: string | null
          rating: number
          service_id: string | null
          staff_id: string | null
        }
        Insert: {
          allow_testimonial?: boolean
          appointment_id: string
          client_email: string
          comment?: string | null
          created_at?: string
          display_first_name?: string | null
          featured?: boolean
          google_review_sms_sent_at?: string | null
          id?: string
          location_id?: string | null
          rating: number
          service_id?: string | null
          staff_id?: string | null
        }
        Update: {
          allow_testimonial?: boolean
          appointment_id?: string
          client_email?: string
          comment?: string | null
          created_at?: string
          display_first_name?: string | null
          featured?: boolean
          google_review_sms_sent_at?: string | null
          id?: string
          location_id?: string | null
          rating?: number
          service_id?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_feedback_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_feedback_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_intake_submissions: {
        Row: {
          ai_scribe_consent: boolean
          ai_scribe_consent_at: string | null
          alcohol_use: string | null
          allergies: string[]
          allergies_other: string | null
          appointment_id: string
          based_on_submission_id: string | null
          changes_allergies: string | null
          changes_history: string | null
          changes_meds: string | null
          changes_pregnancy: string | null
          client_email: string
          concerns: string | null
          created_at: string
          current_medications: string[]
          current_medications_other: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          exercise_frequency: string | null
          family_history: string[] | null
          goals: string | null
          has_changes: boolean | null
          hipaa_acknowledged: boolean | null
          id: string
          ip_address: string | null
          medical_history: string[]
          medical_history_other: string | null
          pregnancy_status: string | null
          primary_care_physician: string | null
          prior_cosmetic_procedures: string[] | null
          recent_illness_or_event: string | null
          recent_treatments: string | null
          signature_date: string | null
          signature_full_name: string | null
          skin_concerns: string[] | null
          skin_type: string | null
          skincare_products: string[] | null
          smoking_status: string | null
          social_history: string[] | null
          submission_kind: string
          submitted_at: string
          sun_exposure: string | null
          truthful_acknowledged: boolean | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          ai_scribe_consent?: boolean
          ai_scribe_consent_at?: string | null
          alcohol_use?: string | null
          allergies?: string[]
          allergies_other?: string | null
          appointment_id: string
          based_on_submission_id?: string | null
          changes_allergies?: string | null
          changes_history?: string | null
          changes_meds?: string | null
          changes_pregnancy?: string | null
          client_email: string
          concerns?: string | null
          created_at?: string
          current_medications?: string[]
          current_medications_other?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          exercise_frequency?: string | null
          family_history?: string[] | null
          goals?: string | null
          has_changes?: boolean | null
          hipaa_acknowledged?: boolean | null
          id?: string
          ip_address?: string | null
          medical_history?: string[]
          medical_history_other?: string | null
          pregnancy_status?: string | null
          primary_care_physician?: string | null
          prior_cosmetic_procedures?: string[] | null
          recent_illness_or_event?: string | null
          recent_treatments?: string | null
          signature_date?: string | null
          signature_full_name?: string | null
          skin_concerns?: string[] | null
          skin_type?: string | null
          skincare_products?: string[] | null
          smoking_status?: string | null
          social_history?: string[] | null
          submission_kind?: string
          submitted_at?: string
          sun_exposure?: string | null
          truthful_acknowledged?: boolean | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          ai_scribe_consent?: boolean
          ai_scribe_consent_at?: string | null
          alcohol_use?: string | null
          allergies?: string[]
          allergies_other?: string | null
          appointment_id?: string
          based_on_submission_id?: string | null
          changes_allergies?: string | null
          changes_history?: string | null
          changes_meds?: string | null
          changes_pregnancy?: string | null
          client_email?: string
          concerns?: string | null
          created_at?: string
          current_medications?: string[]
          current_medications_other?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          exercise_frequency?: string | null
          family_history?: string[] | null
          goals?: string | null
          has_changes?: boolean | null
          hipaa_acknowledged?: boolean | null
          id?: string
          ip_address?: string | null
          medical_history?: string[]
          medical_history_other?: string | null
          pregnancy_status?: string | null
          primary_care_physician?: string | null
          prior_cosmetic_procedures?: string[] | null
          recent_illness_or_event?: string | null
          recent_treatments?: string | null
          signature_date?: string | null
          signature_full_name?: string | null
          skin_concerns?: string[] | null
          skin_type?: string | null
          skincare_products?: string[] | null
          smoking_status?: string | null
          social_history?: string[] | null
          submission_kind?: string
          submitted_at?: string
          sun_exposure?: string | null
          truthful_acknowledged?: boolean | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_intake_submissions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_intake_submissions_based_on_submission_id_fkey"
            columns: ["based_on_submission_id"]
            isOneToOne: false
            referencedRelation: "client_intake_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_payment_methods: {
        Row: {
          added_by: string | null
          brand: string | null
          cardholder_name: string | null
          client_email: string
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          brand?: string | null
          cardholder_name?: string | null
          client_email: string
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          brand?: string | null
          cardholder_name?: string | null
          client_email?: string
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_perks: {
        Row: {
          client_email: string
          created_at: string
          is_friend: boolean
          is_healthcare_worker: boolean
          note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_email: string
          created_at?: string
          is_friend?: boolean
          is_healthcare_worker?: boolean
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_email?: string
          created_at?: string
          is_friend?: boolean
          is_healthcare_worker?: boolean
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      client_points_ledger: {
        Row: {
          client_email: string
          created_at: string
          created_by: string | null
          delta: number
          id: string
          notes: string | null
          reason: string
          sale_id: string | null
        }
        Insert: {
          client_email: string
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          notes?: string | null
          reason: string
          sale_id?: string | null
        }
        Update: {
          client_email?: string
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          notes?: string | null
          reason?: string
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_points_ledger_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      client_points_settings: {
        Row: {
          block_promo_combo: boolean
          earn_dollars_per_point: number
          id: boolean
          inactivity_expiry_months: number
          is_enabled: boolean
          max_redemption_pct: number
          point_value_cents: number
          updated_at: string
        }
        Insert: {
          block_promo_combo?: boolean
          earn_dollars_per_point?: number
          id?: boolean
          inactivity_expiry_months?: number
          is_enabled?: boolean
          max_redemption_pct?: number
          point_value_cents?: number
          updated_at?: string
        }
        Update: {
          block_promo_combo?: boolean
          earn_dollars_per_point?: number
          id?: boolean
          inactivity_expiry_months?: number
          is_enabled?: boolean
          max_redemption_pct?: number
          point_value_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          dob: string | null
          email: string
          first_name: string
          id: string
          internal_note_updated_at: string | null
          internal_note_updated_by: string | null
          internal_staff_note: string | null
          is_lead: boolean
          last_name: string
          lead_captured_at: string | null
          lead_source: string | null
          npp_acknowledged_at: string | null
          npp_version: string | null
          phone: string | null
          sms_opt_in: boolean
          sms_opt_in_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          dob?: string | null
          email: string
          first_name: string
          id?: string
          internal_note_updated_at?: string | null
          internal_note_updated_by?: string | null
          internal_staff_note?: string | null
          is_lead?: boolean
          last_name: string
          lead_captured_at?: string | null
          lead_source?: string | null
          npp_acknowledged_at?: string | null
          npp_version?: string | null
          phone?: string | null
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          dob?: string | null
          email?: string
          first_name?: string
          id?: string
          internal_note_updated_at?: string | null
          internal_note_updated_by?: string | null
          internal_staff_note?: string | null
          is_lead?: boolean
          last_name?: string
          lead_captured_at?: string | null
          lead_source?: string | null
          npp_acknowledged_at?: string | null
          npp_version?: string | null
          phone?: string | null
          sms_opt_in?: boolean
          sms_opt_in_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_review_promos: {
        Row: {
          appointment_id: string | null
          client_email: string
          code: string
          id: string
          issued_at: string
          promo_code_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          client_email: string
          code: string
          id?: string
          issued_at?: string
          promo_code_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          client_email?: string
          code?: string
          id?: string
          issued_at?: string
          promo_code_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_review_promos_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_review_promos_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      client_treatment_plans: {
        Row: {
          client_email: string
          created_at: string
          expires_at: string | null
          id: string
          issued_by: string | null
          name: string
          notes: string | null
          price_cents: number
          purchase_sale_id: string | null
          purchased_at: string
          refund_reason: string | null
          refunded_at: string | null
          service_id: string | null
          sessions_used: number
          status: string
          template_id: string | null
          total_sessions: number
          updated_at: string
        }
        Insert: {
          client_email: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string | null
          name: string
          notes?: string | null
          price_cents?: number
          purchase_sale_id?: string | null
          purchased_at?: string
          refund_reason?: string | null
          refunded_at?: string | null
          service_id?: string | null
          sessions_used?: number
          status?: string
          template_id?: string | null
          total_sessions: number
          updated_at?: string
        }
        Update: {
          client_email?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string | null
          name?: string
          notes?: string | null
          price_cents?: number
          purchase_sale_id?: string | null
          purchased_at?: string
          refund_reason?: string | null
          refunded_at?: string | null
          service_id?: string | null
          sessions_used?: number
          status?: string
          template_id?: string | null
          total_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_treatment_plans_purchase_sale_id_fkey"
            columns: ["purchase_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_treatment_plans_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_treatment_plans_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "treatment_plan_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      client_unit_banks: {
        Row: {
          appointment_id: string | null
          client_email: string
          created_at: string
          id: string
          issued_by: string | null
          note: string | null
          reason: string
          sale_id: string | null
          service_id: string
          units: number
        }
        Insert: {
          appointment_id?: string | null
          client_email: string
          created_at?: string
          id?: string
          issued_by?: string | null
          note?: string | null
          reason: string
          sale_id?: string | null
          service_id: string
          units: number
        }
        Update: {
          appointment_id?: string | null
          client_email?: string
          created_at?: string
          id?: string
          issued_by?: string | null
          note?: string | null
          reason?: string
          sale_id?: string | null
          service_id?: string
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_unit_banks_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_unit_banks_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_unit_banks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_uploaded_photos: {
        Row: {
          appointment_id: string
          caption: string | null
          client_email: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          appointment_id: string
          caption?: string | null
          client_email: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          appointment_id?: string
          caption?: string | null
          client_email?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_uploaded_photos_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_audit_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          resource_id: string
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id: string
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          resource_id?: string
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      clinical_encounter_followups: {
        Row: {
          adverse_events: string | null
          created_at: string
          decision:
            | Database["public"]["Enums"]["clinical_encounter_decision"]
            | null
          encounter_id: string
          id: string
          objective_deltas: string | null
          rationale: string | null
          tolerability: string | null
        }
        Insert: {
          adverse_events?: string | null
          created_at?: string
          decision?:
            | Database["public"]["Enums"]["clinical_encounter_decision"]
            | null
          encounter_id: string
          id?: string
          objective_deltas?: string | null
          rationale?: string | null
          tolerability?: string | null
        }
        Update: {
          adverse_events?: string | null
          created_at?: string
          decision?:
            | Database["public"]["Enums"]["clinical_encounter_decision"]
            | null
          encounter_id?: string
          id?: string
          objective_deltas?: string | null
          rationale?: string | null
          tolerability?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_encounter_followups_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_encounter_labs: {
        Row: {
          analyte: string
          created_at: string
          drawn_on: string | null
          encounter_id: string
          id: string
          notes: string | null
          source: string
          unit: string | null
          value: string | null
        }
        Insert: {
          analyte: string
          created_at?: string
          drawn_on?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          source?: string
          unit?: string | null
          value?: string | null
        }
        Update: {
          analyte?: string
          created_at?: string
          drawn_on?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          source?: string
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_encounter_labs_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_encounter_prescriptions: {
        Row: {
          created_at: string
          dispense: string | null
          drug: string
          duration: string | null
          encounter_id: string
          frequency: string | null
          id: string
          notes: string | null
          refills: number
          route: string | null
          strength: string | null
          titration: Json
        }
        Insert: {
          created_at?: string
          dispense?: string | null
          drug: string
          duration?: string | null
          encounter_id: string
          frequency?: string | null
          id?: string
          notes?: string | null
          refills?: number
          route?: string | null
          strength?: string | null
          titration?: Json
        }
        Update: {
          created_at?: string
          dispense?: string | null
          drug?: string
          duration?: string | null
          encounter_id?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          refills?: number
          route?: string | null
          strength?: string | null
          titration?: Json
        }
        Relationships: [
          {
            foreignKeyName: "clinical_encounter_prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "clinical_encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_encounters: {
        Row: {
          appointment_id: string | null
          assessment: string | null
          category: Database["public"]["Enums"]["clinical_protocol_category"]
          chief_complaint: string | null
          client_dob: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          clinical_pdf_url: string | null
          counseling_acknowledged: boolean
          created_at: string
          created_by: string
          handout_pdf_url: string | null
          id: string
          necessity_attestation: string | null
          objective: string | null
          plan: string | null
          reference_protocol_version_id: string | null
          signature_png: string | null
          signed_at: string | null
          signed_by_license: string | null
          signed_by_name: string | null
          signed_by_user_id: string | null
          status: Database["public"]["Enums"]["clinical_encounter_status"]
          subjective: string | null
          updated_at: string
          visit_type: Database["public"]["Enums"]["clinical_encounter_visit_type"]
        }
        Insert: {
          appointment_id?: string | null
          assessment?: string | null
          category: Database["public"]["Enums"]["clinical_protocol_category"]
          chief_complaint?: string | null
          client_dob?: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          clinical_pdf_url?: string | null
          counseling_acknowledged?: boolean
          created_at?: string
          created_by?: string
          handout_pdf_url?: string | null
          id?: string
          necessity_attestation?: string | null
          objective?: string | null
          plan?: string | null
          reference_protocol_version_id?: string | null
          signature_png?: string | null
          signed_at?: string | null
          signed_by_license?: string | null
          signed_by_name?: string | null
          signed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["clinical_encounter_status"]
          subjective?: string | null
          updated_at?: string
          visit_type: Database["public"]["Enums"]["clinical_encounter_visit_type"]
        }
        Update: {
          appointment_id?: string | null
          assessment?: string | null
          category?: Database["public"]["Enums"]["clinical_protocol_category"]
          chief_complaint?: string | null
          client_dob?: string | null
          client_email?: string
          client_first_name?: string
          client_last_name?: string
          clinical_pdf_url?: string | null
          counseling_acknowledged?: boolean
          created_at?: string
          created_by?: string
          handout_pdf_url?: string | null
          id?: string
          necessity_attestation?: string | null
          objective?: string | null
          plan?: string | null
          reference_protocol_version_id?: string | null
          signature_png?: string | null
          signed_at?: string | null
          signed_by_license?: string | null
          signed_by_name?: string | null
          signed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["clinical_encounter_status"]
          subjective?: string | null
          updated_at?: string
          visit_type?: Database["public"]["Enums"]["clinical_encounter_visit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "clinical_encounters_reference_protocol_version_id_fkey"
            columns: ["reference_protocol_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocol_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_addendums: {
        Row: {
          author_name: string
          author_role: string | null
          author_user_id: string
          body: string
          clinical_note_id: string
          created_at: string
          id: string
          ip_address: string | null
          reason: string
          signature_png: string | null
        }
        Insert: {
          author_name: string
          author_role?: string | null
          author_user_id: string
          body: string
          clinical_note_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          reason: string
          signature_png?: string | null
        }
        Update: {
          author_name?: string
          author_role?: string | null
          author_user_id?: string
          body?: string
          clinical_note_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string
          signature_png?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_addendums_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_energy: {
        Row: {
          adverse_events: string[]
          areas: string[]
          clinical_note_id: string
          cooling: string | null
          cooling_used: boolean
          depth_mm: number | null
          device: string
          device_name: string | null
          device_serial: string | null
          endpoint_achieved: string[]
          energy: number | null
          energy_unit: string | null
          expiration_date: string | null
          fitzpatrick: string | null
          lot_number: string | null
          numbing_used: boolean
          passes: number | null
          preset_id: string | null
          pulse_hz: number | null
          pulse_ms: number | null
          settings: Json
          site_map: Json | null
          spot_size_mm: number | null
        }
        Insert: {
          adverse_events?: string[]
          areas?: string[]
          clinical_note_id: string
          cooling?: string | null
          cooling_used?: boolean
          depth_mm?: number | null
          device: string
          device_name?: string | null
          device_serial?: string | null
          endpoint_achieved?: string[]
          energy?: number | null
          energy_unit?: string | null
          expiration_date?: string | null
          fitzpatrick?: string | null
          lot_number?: string | null
          numbing_used?: boolean
          passes?: number | null
          preset_id?: string | null
          pulse_hz?: number | null
          pulse_ms?: number | null
          settings?: Json
          site_map?: Json | null
          spot_size_mm?: number | null
        }
        Update: {
          adverse_events?: string[]
          areas?: string[]
          clinical_note_id?: string
          cooling?: string | null
          cooling_used?: boolean
          depth_mm?: number | null
          device?: string
          device_name?: string | null
          device_serial?: string | null
          endpoint_achieved?: string[]
          energy?: number | null
          energy_unit?: string | null
          expiration_date?: string | null
          fitzpatrick?: string | null
          lot_number?: string | null
          numbing_used?: boolean
          passes?: number | null
          preset_id?: string | null
          pulse_hz?: number | null
          pulse_ms?: number | null
          settings?: Json
          site_map?: Json | null
          spot_size_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_energy_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: true
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_note_energy_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "device_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_filler: {
        Row: {
          adverse_events: string[]
          anesthetic: string | null
          areas: string[]
          clinical_note_id: string
          delivery: string | null
          hyaluronidase_onsite: boolean
          lot_entries: Json
          needle_gauge: string | null
          product: string
          site_map: Json | null
          syringes_used: number
          technique: string[] | null
          vascular_protocol_reviewed: boolean
        }
        Insert: {
          adverse_events?: string[]
          anesthetic?: string | null
          areas?: string[]
          clinical_note_id: string
          delivery?: string | null
          hyaluronidase_onsite?: boolean
          lot_entries?: Json
          needle_gauge?: string | null
          product: string
          site_map?: Json | null
          syringes_used?: number
          technique?: string[] | null
          vascular_protocol_reviewed?: boolean
        }
        Update: {
          adverse_events?: string[]
          anesthetic?: string | null
          areas?: string[]
          clinical_note_id?: string
          delivery?: string | null
          hyaluronidase_onsite?: boolean
          lot_entries?: Json
          needle_gauge?: string | null
          product?: string
          site_map?: Json | null
          syringes_used?: number
          technique?: string[] | null
          vascular_protocol_reviewed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_filler_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: true
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_neurotoxin: {
        Row: {
          adverse_events: string[]
          clinical_note_id: string
          dilution: string | null
          expiration_date: string
          injection_map: Json
          lot_number: string
          needle_gauge: string | null
          post_care_given: boolean
          product: string
          reconstitution_agent: string | null
          technique: string[] | null
          total_units: number
        }
        Insert: {
          adverse_events?: string[]
          clinical_note_id: string
          dilution?: string | null
          expiration_date: string
          injection_map?: Json
          lot_number: string
          needle_gauge?: string | null
          post_care_given?: boolean
          product: string
          reconstitution_agent?: string | null
          technique?: string[] | null
          total_units?: number
        }
        Update: {
          adverse_events?: string[]
          clinical_note_id?: string
          dilution?: string | null
          expiration_date?: string
          injection_map?: Json
          lot_number?: string
          needle_gauge?: string | null
          post_care_given?: boolean
          product?: string
          reconstitution_agent?: string | null
          technique?: string[] | null
          total_units?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_neurotoxin_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: true
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_signatures: {
        Row: {
          clinical_note_id: string
          id: string
          ip_address: string | null
          signature_png: string | null
          signed_at: string
          signer_license: string | null
          signer_name: string
          signer_role: string
          signer_staff_id: string | null
          signer_user_id: string
          user_agent: string | null
        }
        Insert: {
          clinical_note_id: string
          id?: string
          ip_address?: string | null
          signature_png?: string | null
          signed_at?: string
          signer_license?: string | null
          signer_name: string
          signer_role: string
          signer_staff_id?: string | null
          signer_user_id: string
          user_agent?: string | null
        }
        Update: {
          clinical_note_id?: string
          id?: string
          ip_address?: string | null
          signature_png?: string | null
          signed_at?: string
          signer_license?: string | null
          signer_name?: string
          signer_role?: string
          signer_staff_id?: string | null
          signer_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_signatures_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_wellness: {
        Row: {
          adverse_events: string[]
          clinical_note_id: string
          dose: string | null
          expiration_date: string | null
          layers: number | null
          lot_number: string | null
          neutralization: string | null
          product: string | null
          route: string | null
          service_type: string
          site_map: Json | null
          strength: string | null
        }
        Insert: {
          adverse_events?: string[]
          clinical_note_id: string
          dose?: string | null
          expiration_date?: string | null
          layers?: number | null
          lot_number?: string | null
          neutralization?: string | null
          product?: string | null
          route?: string | null
          service_type: string
          site_map?: Json | null
          strength?: string | null
        }
        Update: {
          adverse_events?: string[]
          clinical_note_id?: string
          dose?: string | null
          expiration_date?: string | null
          layers?: number | null
          lot_number?: string | null
          neutralization?: string | null
          product?: string | null
          route?: string | null
          service_type?: string
          site_map?: Json | null
          strength?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_wellness_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: true
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          allergies_confirmed_today: string[]
          appointment_id: string | null
          bp_diastolic: number | null
          bp_systolic: number | null
          category: Database["public"]["Enums"]["clinical_note_category"]
          client_dob: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          consent_doc_names: string[]
          consents_verified: boolean
          cosigned_at: string | null
          created_at: string
          emergency_equipment_available: boolean
          followup_weeks: number | null
          gfe_record_id: string | null
          heart_rate: number | null
          id: string
          indication: string | null
          location_id: string | null
          locked_at: string | null
          new_medications_since_gfe: string | null
          pain_score_post: number | null
          pain_score_pre: number | null
          patient_verbalized_understanding: boolean
          pdf_url: string | null
          photo_post_paths: string[]
          photo_post_url: string | null
          photo_pre_paths: string[]
          photo_pre_url: string | null
          post_assessment: string[]
          post_op_reviewed: boolean
          provider_name: string
          provider_notes: string | null
          provider_role: string | null
          provider_staff_id: string | null
          provider_user_id: string
          requires_cosign: boolean
          service_name: string | null
          signed_at: string | null
          site_marked: boolean
          status: Database["public"]["Enums"]["clinical_note_status"]
          summary: string | null
          time_out_completed: boolean
          updated_at: string
        }
        Insert: {
          allergies_confirmed_today?: string[]
          appointment_id?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          category: Database["public"]["Enums"]["clinical_note_category"]
          client_dob?: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          consent_doc_names?: string[]
          consents_verified?: boolean
          cosigned_at?: string | null
          created_at?: string
          emergency_equipment_available?: boolean
          followup_weeks?: number | null
          gfe_record_id?: string | null
          heart_rate?: number | null
          id?: string
          indication?: string | null
          location_id?: string | null
          locked_at?: string | null
          new_medications_since_gfe?: string | null
          pain_score_post?: number | null
          pain_score_pre?: number | null
          patient_verbalized_understanding?: boolean
          pdf_url?: string | null
          photo_post_paths?: string[]
          photo_post_url?: string | null
          photo_pre_paths?: string[]
          photo_pre_url?: string | null
          post_assessment?: string[]
          post_op_reviewed?: boolean
          provider_name: string
          provider_notes?: string | null
          provider_role?: string | null
          provider_staff_id?: string | null
          provider_user_id: string
          requires_cosign?: boolean
          service_name?: string | null
          signed_at?: string | null
          site_marked?: boolean
          status?: Database["public"]["Enums"]["clinical_note_status"]
          summary?: string | null
          time_out_completed?: boolean
          updated_at?: string
        }
        Update: {
          allergies_confirmed_today?: string[]
          appointment_id?: string | null
          bp_diastolic?: number | null
          bp_systolic?: number | null
          category?: Database["public"]["Enums"]["clinical_note_category"]
          client_dob?: string | null
          client_email?: string
          client_first_name?: string
          client_last_name?: string
          consent_doc_names?: string[]
          consents_verified?: boolean
          cosigned_at?: string | null
          created_at?: string
          emergency_equipment_available?: boolean
          followup_weeks?: number | null
          gfe_record_id?: string | null
          heart_rate?: number | null
          id?: string
          indication?: string | null
          location_id?: string | null
          locked_at?: string | null
          new_medications_since_gfe?: string | null
          pain_score_post?: number | null
          pain_score_pre?: number | null
          patient_verbalized_understanding?: boolean
          pdf_url?: string | null
          photo_post_paths?: string[]
          photo_post_url?: string | null
          photo_pre_paths?: string[]
          photo_pre_url?: string | null
          post_assessment?: string[]
          post_op_reviewed?: boolean
          provider_name?: string
          provider_notes?: string | null
          provider_role?: string | null
          provider_staff_id?: string | null
          provider_user_id?: string
          requires_cosign?: boolean
          service_name?: string | null
          signed_at?: string | null
          site_marked?: boolean
          status?: Database["public"]["Enums"]["clinical_note_status"]
          summary?: string | null
          time_out_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      clinical_photo_meta: {
        Row: {
          angle: string
          appointment_id: string | null
          client_email: string
          clinical_note_id: string | null
          created_at: string
          created_by: string | null
          exposure_iso: string | null
          framing_ref_path: string | null
          is_shared_with_patient: boolean
          kind: string
          product: string | null
          region: string | null
          storage_path: string
        }
        Insert: {
          angle?: string
          appointment_id?: string | null
          client_email: string
          clinical_note_id?: string | null
          created_at?: string
          created_by?: string | null
          exposure_iso?: string | null
          framing_ref_path?: string | null
          is_shared_with_patient?: boolean
          kind?: string
          product?: string | null
          region?: string | null
          storage_path: string
        }
        Update: {
          angle?: string
          appointment_id?: string | null
          client_email?: string
          clinical_note_id?: string | null
          created_at?: string
          created_by?: string | null
          exposure_iso?: string | null
          framing_ref_path?: string | null
          is_shared_with_patient?: boolean
          kind?: string
          product?: string | null
          region?: string | null
          storage_path?: string
        }
        Relationships: []
      }
      clinical_protocol_applications: {
        Row: {
          applied_by: string
          appointment_id: string | null
          client_dob: string | null
          client_email: string
          client_first_name: string | null
          client_last_name: string | null
          clinical_pdf_url: string | null
          created_at: string
          handout_pdf_url: string | null
          id: string
          prescriber_notes: string | null
          protocol_version_id: string
          starting_week: number
        }
        Insert: {
          applied_by: string
          appointment_id?: string | null
          client_dob?: string | null
          client_email: string
          client_first_name?: string | null
          client_last_name?: string | null
          clinical_pdf_url?: string | null
          created_at?: string
          handout_pdf_url?: string | null
          id?: string
          prescriber_notes?: string | null
          protocol_version_id: string
          starting_week?: number
        }
        Update: {
          applied_by?: string
          appointment_id?: string | null
          client_dob?: string | null
          client_email?: string
          client_first_name?: string | null
          client_last_name?: string | null
          clinical_pdf_url?: string | null
          created_at?: string
          handout_pdf_url?: string | null
          id?: string
          prescriber_notes?: string | null
          protocol_version_id?: string
          starting_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocol_applications_protocol_version_id_fkey"
            columns: ["protocol_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocol_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_protocol_versions: {
        Row: {
          baseline_labs: string[]
          contraindications: Json
          counseling: string[]
          created_at: string
          created_by: string
          default_prescriptions: Json
          evidence: Json
          followup_labs: string[]
          hold_criteria: string | null
          id: string
          indication: string | null
          max_dose: string | null
          monitoring: string[]
          necessity_template: string | null
          patient_handout_md: string | null
          protocol_id: string
          recommended_labs: Json
          red_flags: string[]
          regulatory_basis: string | null
          signature_png: string | null
          signed_at: string | null
          signed_by_license: string | null
          signed_by_name: string | null
          signed_by_user_id: string | null
          status: Database["public"]["Enums"]["clinical_protocol_status"]
          taper_rules: string | null
          titration: Json
          updated_at: string
          version_number: number
        }
        Insert: {
          baseline_labs?: string[]
          contraindications?: Json
          counseling?: string[]
          created_at?: string
          created_by: string
          default_prescriptions?: Json
          evidence?: Json
          followup_labs?: string[]
          hold_criteria?: string | null
          id?: string
          indication?: string | null
          max_dose?: string | null
          monitoring?: string[]
          necessity_template?: string | null
          patient_handout_md?: string | null
          protocol_id: string
          recommended_labs?: Json
          red_flags?: string[]
          regulatory_basis?: string | null
          signature_png?: string | null
          signed_at?: string | null
          signed_by_license?: string | null
          signed_by_name?: string | null
          signed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["clinical_protocol_status"]
          taper_rules?: string | null
          titration?: Json
          updated_at?: string
          version_number?: number
        }
        Update: {
          baseline_labs?: string[]
          contraindications?: Json
          counseling?: string[]
          created_at?: string
          created_by?: string
          default_prescriptions?: Json
          evidence?: Json
          followup_labs?: string[]
          hold_criteria?: string | null
          id?: string
          indication?: string | null
          max_dose?: string | null
          monitoring?: string[]
          necessity_template?: string | null
          patient_handout_md?: string | null
          protocol_id?: string
          recommended_labs?: Json
          red_flags?: string[]
          regulatory_basis?: string | null
          signature_png?: string | null
          signed_at?: string | null
          signed_by_license?: string | null
          signed_by_name?: string | null
          signed_by_user_id?: string | null
          status?: Database["public"]["Enums"]["clinical_protocol_status"]
          taper_rules?: string | null
          titration?: Json
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocol_versions_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_protocols: {
        Row: {
          category: Database["public"]["Enums"]["clinical_protocol_category"]
          created_at: string
          created_by: string
          current_version_id: string | null
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["clinical_protocol_category"]
          created_at?: string
          created_by: string
          current_version_id?: string | null
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["clinical_protocol_category"]
          created_at?: string
          created_by?: string
          current_version_id?: string | null
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocols_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocol_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_protocol_assignments: {
        Row: {
          assigned_at: string
          created_at: string
          due_at: string | null
          id: string
          notes: string | null
          protocol_id: string
          protocol_version: number
          signed_signature_id: string | null
          staff_id: string
          staff_user_id: string | null
          status: Database["public"]["Enums"]["compliance_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          protocol_id: string
          protocol_version: number
          signed_signature_id?: string | null
          staff_id: string
          staff_user_id?: string | null
          status?: Database["public"]["Enums"]["compliance_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          protocol_id?: string
          protocol_version?: number
          signed_signature_id?: string | null
          staff_id?: string
          staff_user_id?: string | null
          status?: Database["public"]["Enums"]["compliance_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_protocol_assignments_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "compliance_protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_protocol_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_protocol_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_protocols: {
        Row: {
          applies_to_roles: string[]
          body_markdown: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          published_at: string | null
          renewal_months: number
          requires_license: boolean
          sections: Json
          slug: string
          summary: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          applies_to_roles?: string[]
          body_markdown: string
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          published_at?: string | null
          renewal_months?: number
          requires_license?: boolean
          sections?: Json
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          applies_to_roles?: string[]
          body_markdown?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          published_at?: string | null
          renewal_months?: number
          requires_license?: boolean
          sections?: Json
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      compliance_signatures: {
        Row: {
          body_sha256: string | null
          created_at: string
          expires_at: string | null
          id: string
          ip_address: string | null
          license_number: string | null
          license_state: string | null
          pdf_path: string | null
          pdf_sha256: string | null
          protocol_id: string
          protocol_slug: string
          protocol_title: string
          protocol_version: number
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          section_initials: Json
          signature_png: string
          signed_at: string
          signed_full_name: string
          staff_id: string
          staff_user_id: string
          status: Database["public"]["Enums"]["compliance_signature_status"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          body_sha256?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          license_number?: string | null
          license_state?: string | null
          pdf_path?: string | null
          pdf_sha256?: string | null
          protocol_id: string
          protocol_slug: string
          protocol_title: string
          protocol_version: number
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          section_initials?: Json
          signature_png: string
          signed_at?: string
          signed_full_name: string
          staff_id: string
          staff_user_id: string
          status?: Database["public"]["Enums"]["compliance_signature_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          body_sha256?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          license_number?: string | null
          license_state?: string | null
          pdf_path?: string | null
          pdf_sha256?: string | null
          protocol_id?: string
          protocol_slug?: string
          protocol_title?: string
          protocol_version?: number
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          section_initials?: Json
          signature_png?: string
          signed_at?: string
          signed_full_name?: string
          staff_id?: string
          staff_user_id?: string
          status?: Database["public"]["Enums"]["compliance_signature_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_signatures_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "compliance_protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_signatures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_signatures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_email_log: {
        Row: {
          appointment_id: string
          consent_form_id: string | null
          created_at: string
          error_message: string | null
          forms_count: number | null
          id: string
          idempotency_key: string | null
          metadata: Json
          recipient_email: string
          reminder_number: number | null
          source: string
          status: string
          template_name: string
        }
        Insert: {
          appointment_id: string
          consent_form_id?: string | null
          created_at?: string
          error_message?: string | null
          forms_count?: number | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          recipient_email: string
          reminder_number?: number | null
          source: string
          status?: string
          template_name: string
        }
        Update: {
          appointment_id?: string
          consent_form_id?: string | null
          created_at?: string
          error_message?: string | null
          forms_count?: number | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          recipient_email?: string
          reminder_number?: number | null
          source?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      consent_forms: {
        Row: {
          body_markdown: string
          consent_scope: string
          created_at: string
          id: string
          is_active: boolean
          is_optional: boolean
          is_universal: boolean
          slug: string
          title: string
          updated_at: string
          validity_months: number | null
          version: number
        }
        Insert: {
          body_markdown: string
          consent_scope?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_optional?: boolean
          is_universal?: boolean
          slug: string
          title: string
          updated_at?: string
          validity_months?: number | null
          version?: number
        }
        Update: {
          body_markdown?: string
          consent_scope?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_optional?: boolean
          is_universal?: boolean
          slug?: string
          title?: string
          updated_at?: string
          validity_months?: number | null
          version?: number
        }
        Relationships: []
      }
      consent_pdf_audit: {
        Row: {
          appointment_id: string
          generated_at: string
          generated_by_name: string | null
          generated_by_uid: string | null
          id: string
          pdf_path: string
          sha256: string
          signed_url: string | null
          trigger_source: string
        }
        Insert: {
          appointment_id: string
          generated_at?: string
          generated_by_name?: string | null
          generated_by_uid?: string | null
          id?: string
          pdf_path: string
          sha256: string
          signed_url?: string | null
          trigger_source?: string
        }
        Update: {
          appointment_id?: string
          generated_at?: string
          generated_by_name?: string | null
          generated_by_uid?: string | null
          id?: string
          pdf_path?: string
          sha256?: string
          signed_url?: string | null
          trigger_source?: string
        }
        Relationships: []
      }
      consent_signatures: {
        Row: {
          appointment_id: string
          attestation_flags: Json
          client_attested_review: boolean
          client_email: string
          consent_form_id: string
          decision: string
          expires_at: string | null
          form_version: number
          id: string
          ip_address: string | null
          pdf_hash: string | null
          signature_png: string | null
          signed_at: string
          signed_full_name: string
          signing_mode: string
          user_agent: string | null
          witness_name: string | null
          witness_signed_at: string | null
          witness_staff_id: string | null
        }
        Insert: {
          appointment_id: string
          attestation_flags?: Json
          client_attested_review?: boolean
          client_email: string
          consent_form_id: string
          decision?: string
          expires_at?: string | null
          form_version: number
          id?: string
          ip_address?: string | null
          pdf_hash?: string | null
          signature_png?: string | null
          signed_at?: string
          signed_full_name: string
          signing_mode?: string
          user_agent?: string | null
          witness_name?: string | null
          witness_signed_at?: string | null
          witness_staff_id?: string | null
        }
        Update: {
          appointment_id?: string
          attestation_flags?: Json
          client_attested_review?: boolean
          client_email?: string
          consent_form_id?: string
          decision?: string
          expires_at?: string | null
          form_version?: number
          id?: string
          ip_address?: string | null
          pdf_hash?: string | null
          signature_png?: string | null
          signed_at?: string
          signed_full_name?: string
          signing_mode?: string
          user_agent?: string | null
          witness_name?: string | null
          witness_signed_at?: string | null
          witness_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_signatures_consent_form_id_fkey"
            columns: ["consent_form_id"]
            isOneToOne: false
            referencedRelation: "consent_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_validation_log: {
        Row: {
          appointment_id: string
          client_email: string
          created_at: string
          decision: Json
          id: string
          missing_form_ids: string[]
          required_form_ids: string[]
          satisfied_form_ids: string[]
          source: string
        }
        Insert: {
          appointment_id: string
          client_email: string
          created_at?: string
          decision?: Json
          id?: string
          missing_form_ids?: string[]
          required_form_ids?: string[]
          satisfied_form_ids?: string[]
          source: string
        }
        Update: {
          appointment_id?: string
          client_email?: string
          created_at?: string
          decision?: Json
          id?: string
          missing_form_ids?: string[]
          required_form_ids?: string[]
          satisfied_form_ids?: string[]
          source?: string
        }
        Relationships: []
      }
      device_presets: {
        Row: {
          cooling: string | null
          created_at: string
          created_by: string | null
          depth_mm: number | null
          device_name: string
          energy: number | null
          energy_unit: string | null
          fitzpatrick: string | null
          id: string
          is_archived: boolean
          notes: string | null
          passes: number | null
          pulse_hz: number | null
          pulse_ms: number | null
          spot_size_mm: number | null
          treatment_type: string
          updated_at: string
        }
        Insert: {
          cooling?: string | null
          created_at?: string
          created_by?: string | null
          depth_mm?: number | null
          device_name: string
          energy?: number | null
          energy_unit?: string | null
          fitzpatrick?: string | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          passes?: number | null
          pulse_hz?: number | null
          pulse_ms?: number | null
          spot_size_mm?: number | null
          treatment_type: string
          updated_at?: string
        }
        Update: {
          cooling?: string | null
          created_at?: string
          created_by?: string | null
          depth_mm?: number | null
          device_name?: string
          energy?: number | null
          energy_unit?: string | null
          fitzpatrick?: string | null
          id?: string
          is_archived?: boolean
          notes?: string | null
          passes?: number | null
          pulse_hz?: number | null
          pulse_ms?: number | null
          spot_size_mm?: number | null
          treatment_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      filler_region_log: {
        Row: {
          cannula_or_needle: string | null
          clinical_note_id: string
          created_at: string
          depth: string | null
          id: string
          lot_id: string | null
          notes: string | null
          product: string
          region: string
          technique: string | null
          volume_ml: number
        }
        Insert: {
          cannula_or_needle?: string | null
          clinical_note_id: string
          created_at?: string
          depth?: string | null
          id?: string
          lot_id?: string | null
          notes?: string | null
          product: string
          region: string
          technique?: string | null
          volume_ml: number
        }
        Update: {
          cannula_or_needle?: string | null
          clinical_note_id?: string
          created_at?: string
          depth?: string | null
          id?: string
          lot_id?: string | null
          notes?: string | null
          product?: string
          region?: string
          technique?: string | null
          volume_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "filler_region_log_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filler_region_log_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "product_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      gfe_records: {
        Row: {
          allergies: string[]
          allergies_other: string | null
          authorized_treatments: Json
          bp_diastolic: number | null
          bp_systolic: number | null
          chief_concerns: string[]
          chief_concerns_notes: string | null
          client_dob: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          created_at: string
          current_medications: string[]
          current_medications_other: string | null
          expires_at: string
          fitzpatrick: string | null
          heart_rate: number | null
          height_in: number | null
          hyaluronidase_risk_disclosed: boolean
          id: string
          is_locked: boolean
          medical_history: string[]
          medical_history_other: string | null
          np_assessment_plan: string
          np_license: string | null
          np_name: string
          np_staff_id: string | null
          np_user_id: string
          patient_id_verified: boolean
          pdf_hash: string | null
          pdf_url: string | null
          photo_consent: boolean
          pregnancy_status: string | null
          prior_gfe_id: string | null
          prior_treatments: string[]
          prior_treatments_last_date: string | null
          re_exam_reason: string | null
          signature_png: string | null
          signed_at: string
          signed_ip: string | null
          signed_user_agent: string | null
          skin_assessment: string[]
          standing_order_ref: string | null
          treatment_goals: string[]
          updated_at: string
          vascular_occlusion_protocol_confirmed: boolean
          weight_lb: number | null
        }
        Insert: {
          allergies?: string[]
          allergies_other?: string | null
          authorized_treatments?: Json
          bp_diastolic?: number | null
          bp_systolic?: number | null
          chief_concerns?: string[]
          chief_concerns_notes?: string | null
          client_dob?: string | null
          client_email: string
          client_first_name: string
          client_last_name: string
          created_at?: string
          current_medications?: string[]
          current_medications_other?: string | null
          expires_at?: string
          fitzpatrick?: string | null
          heart_rate?: number | null
          height_in?: number | null
          hyaluronidase_risk_disclosed?: boolean
          id?: string
          is_locked?: boolean
          medical_history?: string[]
          medical_history_other?: string | null
          np_assessment_plan: string
          np_license?: string | null
          np_name: string
          np_staff_id?: string | null
          np_user_id: string
          patient_id_verified?: boolean
          pdf_hash?: string | null
          pdf_url?: string | null
          photo_consent?: boolean
          pregnancy_status?: string | null
          prior_gfe_id?: string | null
          prior_treatments?: string[]
          prior_treatments_last_date?: string | null
          re_exam_reason?: string | null
          signature_png?: string | null
          signed_at?: string
          signed_ip?: string | null
          signed_user_agent?: string | null
          skin_assessment?: string[]
          standing_order_ref?: string | null
          treatment_goals?: string[]
          updated_at?: string
          vascular_occlusion_protocol_confirmed?: boolean
          weight_lb?: number | null
        }
        Update: {
          allergies?: string[]
          allergies_other?: string | null
          authorized_treatments?: Json
          bp_diastolic?: number | null
          bp_systolic?: number | null
          chief_concerns?: string[]
          chief_concerns_notes?: string | null
          client_dob?: string | null
          client_email?: string
          client_first_name?: string
          client_last_name?: string
          created_at?: string
          current_medications?: string[]
          current_medications_other?: string | null
          expires_at?: string
          fitzpatrick?: string | null
          heart_rate?: number | null
          height_in?: number | null
          hyaluronidase_risk_disclosed?: boolean
          id?: string
          is_locked?: boolean
          medical_history?: string[]
          medical_history_other?: string | null
          np_assessment_plan?: string
          np_license?: string | null
          np_name?: string
          np_staff_id?: string | null
          np_user_id?: string
          patient_id_verified?: boolean
          pdf_hash?: string | null
          pdf_url?: string | null
          photo_consent?: boolean
          pregnancy_status?: string | null
          prior_gfe_id?: string | null
          prior_treatments?: string[]
          prior_treatments_last_date?: string | null
          re_exam_reason?: string | null
          signature_png?: string | null
          signed_at?: string
          signed_ip?: string | null
          signed_user_agent?: string | null
          skin_assessment?: string[]
          standing_order_ref?: string | null
          treatment_goals?: string[]
          updated_at?: string
          vascular_occlusion_protocol_confirmed?: boolean
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gfe_records_prior_gfe_id_fkey"
            columns: ["prior_gfe_id"]
            isOneToOne: false
            referencedRelation: "gfe_records"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_reminder_log: {
        Row: {
          appointment_id: string
          id: string
          reminder_type: string
          sent_at: string
        }
        Insert: {
          appointment_id: string
          id?: string
          reminder_type: string
          sent_at?: string
        }
        Update: {
          appointment_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
        }
        Relationships: []
      }
      hipaa_policies: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body_markdown: string
          category: string
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          review_due_date: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body_markdown?: string
          category: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          review_due_date?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body_markdown?: string
          category?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          review_due_date?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      hipaa_policy_versions: {
        Row: {
          approved_at: string
          approved_by: string | null
          body_markdown: string
          created_at: string
          effective_date: string | null
          id: string
          policy_id: string
          summary: string | null
          title: string
          version: number
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          body_markdown: string
          created_at?: string
          effective_date?: string | null
          id?: string
          policy_id: string
          summary?: string | null
          title: string
          version: number
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          body_markdown?: string
          created_at?: string
          effective_date?: string | null
          id?: string
          policy_id?: string
          summary?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hipaa_policy_versions_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "hipaa_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_clients: {
        Row: {
          avatar_path: string | null
          created_at: string
          dob: string | null
          email: string
          first_name: string
          gender: string | null
          id: string
          imported_by: string | null
          invited_at: string | null
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          dob?: string | null
          email: string
          first_name: string
          gender?: string | null
          id?: string
          imported_by?: string | null
          invited_at?: string | null
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          dob?: string | null
          email?: string
          first_name?: string
          gender?: string | null
          id?: string
          imported_by?: string | null
          invited_at?: string | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lot_id: string
          notes: string | null
          qty_delta: number
          reason: string
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_id: string
          notes?: string | null
          qty_delta: number
          reason: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lot_id?: string
          notes?: string | null
          qty_delta?: number
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "product_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string
          city: string
          created_at: string
          google_place_id: string | null
          google_review_url: string | null
          hero_image_url: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          phone: string | null
          processing_fee_pct: number
          slug: string
          state: string
          stripe_terminal_location_id: string | null
          tip_enabled: boolean
          zip: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          google_place_id?: string | null
          google_review_url?: string | null
          hero_image_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          phone?: string | null
          processing_fee_pct?: number
          slug: string
          state: string
          stripe_terminal_location_id?: string | null
          tip_enabled?: boolean
          zip: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          google_place_id?: string | null
          google_review_url?: string | null
          hero_image_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          phone?: string | null
          processing_fee_pct?: number
          slug?: string
          state?: string
          stripe_terminal_location_id?: string | null
          tip_enabled?: boolean
          zip?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          audience_params: Json
          audience_type: string
          body_markdown: string
          cooldown_days: number
          created_at: string
          created_by: string | null
          cta_label: string | null
          cta_url: string | null
          hero_image_url: string | null
          id: string
          last_run_at: string | null
          name: string
          preview_text: string | null
          recurrence: string
          scheduled_at: string | null
          slug: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          audience_params?: Json
          audience_type: string
          body_markdown: string
          cooldown_days?: number
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          hero_image_url?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          preview_text?: string | null
          recurrence?: string
          scheduled_at?: string | null
          slug: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          audience_params?: Json
          audience_type?: string
          body_markdown?: string
          cooldown_days?: number
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          cta_url?: string | null
          hero_image_url?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          preview_text?: string | null
          recurrence?: string
          scheduled_at?: string | null
          slug?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_sends: {
        Row: {
          campaign_id: string
          client_email: string
          id: string
          sent_at: string
          status: string
        }
        Insert: {
          campaign_id: string
          client_email: string
          id?: string
          sent_at?: string
          status?: string
        }
        Update: {
          campaign_id?: string
          client_email?: string
          id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      perk_grants: {
        Row: {
          amount_cents: number
          client_email: string
          created_at: string
          email_sent_at: string | null
          id: string
          perk_kind: string
          perk_year: number
          voucher_id: string | null
        }
        Insert: {
          amount_cents: number
          client_email: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          perk_kind: string
          perk_year: number
          voucher_id?: string | null
        }
        Update: {
          amount_cents?: number
          client_email?: string
          created_at?: string
          email_sent_at?: string | null
          id?: string
          perk_kind?: string
          perk_year?: number
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perk_grants_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      phi_access_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          actor_user_id: string | null
          break_glass_reason: string | null
          client_email: string | null
          created_at: string
          id: string
          ip: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          route: string | null
          user_agent: string | null
        }
        Insert: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          break_glass_reason?: string | null
          client_email?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          route?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          break_glass_reason?: string | null
          client_email?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          route?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      phi_deletion_requests: {
        Row: {
          client_email: string
          id: string
          notes: string | null
          reason: string | null
          requested_at: string
          requested_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          client_email: string
          id?: string
          notes?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          client_email?: string
          id?: string
          notes?: string | null
          reason?: string | null
          requested_at?: string
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      photo_consent_records: {
        Row: {
          body_markdown_version: number
          client_email: string
          created_at: string
          id: string
          revoked_at: string | null
          revoked_reason: string | null
          signature_png: string
          signed_at: string
          signed_name: string
          witness_name: string | null
          witness_user_id: string | null
        }
        Insert: {
          body_markdown_version?: number
          client_email: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          signature_png: string
          signed_at?: string
          signed_name: string
          witness_name?: string | null
          witness_user_id?: string | null
        }
        Update: {
          body_markdown_version?: number
          client_email?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          signature_png?: string
          signed_at?: string
          signed_name?: string
          witness_name?: string | null
          witness_user_id?: string | null
        }
        Relationships: []
      }
      postop_checkins: {
        Row: {
          appointment_id: string
          bruising: number | null
          client_email: string
          created_at: string
          day_offset: number
          id: string
          notes: string | null
          pain: number | null
          photo_path: string | null
          submitted_at: string
          swelling: number | null
          updated_at: string
        }
        Insert: {
          appointment_id: string
          bruising?: number | null
          client_email: string
          created_at?: string
          day_offset: number
          id?: string
          notes?: string | null
          pain?: number | null
          photo_path?: string | null
          submitted_at?: string
          swelling?: number | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          bruising?: number | null
          client_email?: string
          created_at?: string
          day_offset?: number
          id?: string
          notes?: string | null
          pain?: number | null
          photo_path?: string | null
          submitted_at?: string
          swelling?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      preop_checklist_progress: {
        Row: {
          appointment_id: string
          checked_at: string | null
          client_email: string
          created_at: string
          id: string
          item_key: string
          item_text: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          checked_at?: string | null
          client_email: string
          created_at?: string
          id?: string
          item_key: string
          item_text: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          checked_at?: string | null
          client_email?: string
          created_at?: string
          id?: string
          item_key?: string
          item_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_lots: {
        Row: {
          category: string | null
          created_at: string
          expiration_date: string | null
          id: string
          is_active: boolean
          location_id: string | null
          lot_number: string
          low_stock_threshold: number
          notes: string | null
          product_id: string | null
          product_name: string
          quantity_initial: number
          quantity_remaining: number
          received_at: string
          received_by: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          lot_number: string
          low_stock_threshold?: number
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity_initial?: number
          quantity_remaining?: number
          received_at?: string
          received_by?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          location_id?: string | null
          lot_number?: string
          low_stock_threshold?: number
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity_initial?: number
          quantity_remaining?: number
          received_at?: string
          received_by?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_lots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["product_kind"]
          location_id: string | null
          metadata: Json
          name: string
          price_cents: number
          service_id: string | null
          sku: string | null
          taxable: boolean
          tippable: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          location_id?: string | null
          metadata?: Json
          name: string
          price_cents: number
          service_id?: string | null
          sku?: string | null
          taxable?: boolean
          tippable?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          location_id?: string | null
          metadata?: Json
          name?: string
          price_cents?: number
          service_id?: string | null
          sku?: string | null
          taxable?: boolean
          tippable?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      prom_instruments: {
        Row: {
          category: string
          created_at: string
          default_offset_days: number | null
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          questions: Json
          scoring_meta: Json
          scoring_method: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_offset_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          questions: Json
          scoring_meta?: Json
          scoring_method?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_offset_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          questions?: Json
          scoring_meta?: Json
          scoring_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      prom_responses: {
        Row: {
          answers: Json
          appointment_id: string | null
          client_email: string
          clinical_note_id: string | null
          completed_at: string
          created_at: string
          id: string
          instrument_id: string
          instrument_key: string
          normalized_score: number | null
          raw_score: number | null
          timepoint: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          appointment_id?: string | null
          client_email: string
          clinical_note_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          instrument_id: string
          instrument_key: string
          normalized_score?: number | null
          raw_score?: number | null
          timepoint?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          appointment_id?: string | null
          client_email?: string
          clinical_note_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          instrument_id?: string
          instrument_key?: string
          normalized_score?: number | null
          raw_score?: number | null
          timepoint?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prom_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_responses_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_responses_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "prom_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          applies_to: string
          code: string
          conditions: Json
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["promo_kind"]
          label: string
          max_uses: number | null
          staff_only: boolean
          starts_at: string | null
          updated_at: string
          used_count: number
          value_cents: number | null
          value_pct: number | null
        }
        Insert: {
          applies_to?: string
          code: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["promo_kind"]
          label: string
          max_uses?: number | null
          staff_only?: boolean
          starts_at?: string | null
          updated_at?: string
          used_count?: number
          value_cents?: number | null
          value_pct?: number | null
        }
        Update: {
          applies_to?: string
          code?: string
          conditions?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promo_kind"]
          label?: string
          max_uses?: number | null
          staff_only?: boolean
          starts_at?: string | null
          updated_at?: string
          used_count?: number
          value_cents?: number | null
          value_pct?: number | null
        }
        Relationships: []
      }
      promo_slots: {
        Row: {
          claimed_appointment_id: string | null
          claimed_at: string | null
          created_at: string
          id: string
          location_id: string
          promo_group: string
          slot_at: string
        }
        Insert: {
          claimed_appointment_id?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          location_id: string
          promo_group: string
          slot_at: string
        }
        Update: {
          claimed_appointment_id?: string | null
          claimed_at?: string | null
          created_at?: string
          id?: string
          location_id?: string
          promo_group?: string
          slot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_slots_claimed_appointment_id_fkey"
            columns: ["claimed_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_entries: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          instagram_handle: string | null
          phone: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          instagram_handle?: string | null
          phone: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          instagram_handle?: string | null
          phone?: string
        }
        Relationships: []
      }
      quick_phrases: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          phrase: string
          service_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          phrase: string
          service_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          phrase?: string
          service_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_phrases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          owner_email: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          owner_email: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          owner_email?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          kind: Database["public"]["Enums"]["sale_item_kind"]
          label: string
          line_total_cents: number
          metadata: Json
          quantity: number
          reference_id: string | null
          sale_id: string
          taxable: boolean
          tippable: boolean
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          kind: Database["public"]["Enums"]["sale_item_kind"]
          label: string
          line_total_cents?: number
          metadata?: Json
          quantity?: number
          reference_id?: string | null
          sale_id: string
          taxable?: boolean
          tippable?: boolean
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          kind?: Database["public"]["Enums"]["sale_item_kind"]
          label?: string
          line_total_cents?: number
          metadata?: Json
          quantity?: number
          reference_id?: string | null
          sale_id?: string
          taxable?: boolean
          tippable?: boolean
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_due_cents: number
          appointment_id: string | null
          cashier_user_id: string | null
          client_email: string | null
          client_first_name: string | null
          client_last_name: string | null
          client_phone: string | null
          created_at: string
          credit_applied_cents: number
          discount_amount_cents: number | null
          discount_cents: number
          discount_pct: number | null
          discount_reason: string | null
          id: string
          location_id: string
          notes: string | null
          paid_at: string | null
          payment_method:
            | Database["public"]["Enums"]["sale_payment_method"]
            | null
          points_redeemed: number
          processing_fee_cents: number
          promo_code: string | null
          reader_action_status: string | null
          receipt_email_sent_at: string | null
          receipt_url: string | null
          refunded_amount_cents: number
          staff_id: string | null
          status: Database["public"]["Enums"]["sale_status"]
          stripe_charge_id: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_terminal_reader_id: string | null
          subtotal_cents: number
          tax_cents: number
          tip_cents: number
          total_cents: number
          unit_bank_applied_cents: number
          updated_at: string
          voucher_applied_cents: number
        }
        Insert: {
          amount_due_cents?: number
          appointment_id?: string | null
          cashier_user_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          created_at?: string
          credit_applied_cents?: number
          discount_amount_cents?: number | null
          discount_cents?: number
          discount_pct?: number | null
          discount_reason?: string | null
          id?: string
          location_id: string
          notes?: string | null
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["sale_payment_method"]
            | null
          points_redeemed?: number
          processing_fee_cents?: number
          promo_code?: string | null
          reader_action_status?: string | null
          receipt_email_sent_at?: string | null
          receipt_url?: string | null
          refunded_amount_cents?: number
          staff_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_terminal_reader_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tip_cents?: number
          total_cents?: number
          unit_bank_applied_cents?: number
          updated_at?: string
          voucher_applied_cents?: number
        }
        Update: {
          amount_due_cents?: number
          appointment_id?: string | null
          cashier_user_id?: string | null
          client_email?: string | null
          client_first_name?: string | null
          client_last_name?: string | null
          client_phone?: string | null
          created_at?: string
          credit_applied_cents?: number
          discount_amount_cents?: number | null
          discount_cents?: number
          discount_pct?: number | null
          discount_reason?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?:
            | Database["public"]["Enums"]["sale_payment_method"]
            | null
          points_redeemed?: number
          processing_fee_cents?: number
          promo_code?: string | null
          reader_action_status?: string | null
          receipt_email_sent_at?: string | null
          receipt_url?: string | null
          refunded_amount_cents?: number
          staff_id?: string | null
          status?: Database["public"]["Enums"]["sale_status"]
          stripe_charge_id?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_terminal_reader_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tip_cents?: number
          total_cents?: number
          unit_bank_applied_cents?: number
          updated_at?: string
          voucher_applied_cents?: number
        }
        Relationships: []
      }
      schedule_overrides: {
        Row: {
          created_at: string
          end_at: string
          id: string
          location_id: string | null
          override_type: Database["public"]["Enums"]["override_type"]
          reason: string | null
          staff_id: string
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          location_id?: string | null
          override_type: Database["public"]["Enums"]["override_type"]
          reason?: string | null
          staff_id: string
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          location_id?: string | null
          override_type?: Database["public"]["Enums"]["override_type"]
          reason?: string | null
          staff_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scribe_sessions: {
        Row: {
          appointment_id: string | null
          audio_duration_sec: number | null
          audio_path: string | null
          auto_delete_at: string
          category: string | null
          client_email: string
          consent_confirmed_at: string | null
          created_at: string
          error: string | null
          generated_note: Json | null
          id: string
          provider_user_id: string
          service_name: string | null
          status: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          audio_duration_sec?: number | null
          audio_path?: string | null
          auto_delete_at?: string
          category?: string | null
          client_email: string
          consent_confirmed_at?: string | null
          created_at?: string
          error?: string | null
          generated_note?: Json | null
          id?: string
          provider_user_id: string
          service_name?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          audio_duration_sec?: number | null
          audio_path?: string | null
          auto_delete_at?: string
          category?: string | null
          client_email?: string
          consent_confirmed_at?: string | null
          created_at?: string
          error?: string | null
          generated_note?: Json | null
          id?: string
          provider_user_id?: string
          service_name?: string | null
          status?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scribe_sessions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      service_consents: {
        Row: {
          consent_form_id: string
          created_at: string
          id: string
          service_id: string
        }
        Insert: {
          consent_form_id: string
          created_at?: string
          id?: string
          service_id: string
        }
        Update: {
          consent_form_id?: string
          created_at?: string
          id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_consents_consent_form_id_fkey"
            columns: ["consent_form_id"]
            isOneToOne: false
            referencedRelation: "consent_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_post_op_instructions: {
        Row: {
          body_markdown: string
          created_at: string
          id: string
          last_edited_by: string | null
          service_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_markdown?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          service_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_markdown?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          service_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_post_op_instructions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_pre_op_instructions: {
        Row: {
          body_markdown: string
          created_at: string
          id: string
          last_edited_by: string | null
          service_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_markdown?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          service_id: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_markdown?: string
          created_at?: string
          id?: string
          last_edited_by?: string | null
          service_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_pre_op_instructions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          id: string
          location_id: string
          service_id: string
          staff_id: string
        }
        Insert: {
          id?: string
          location_id: string
          service_id: string
          staff_id: string
        }
        Update: {
          id?: string
          location_id?: string
          service_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_providers_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          buffer_minutes: number
          category_id: string
          created_at: string
          deposit_cents: number
          description: string | null
          display_order: number
          duration_minutes: number
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price_cents: number | null
          price_note: string | null
          promo_group: string | null
          rebook_followup_days: number | null
          requires_consult: boolean
          skip_consents: boolean
          stack_numbing_minutes: number
          tippable: boolean
        }
        Insert: {
          buffer_minutes?: number
          category_id: string
          created_at?: string
          deposit_cents?: number
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_cents?: number | null
          price_note?: string | null
          promo_group?: string | null
          rebook_followup_days?: number | null
          requires_consult?: boolean
          skip_consents?: boolean
          stack_numbing_minutes?: number
          tippable?: boolean
        }
        Update: {
          buffer_minutes?: number
          category_id?: string
          created_at?: string
          deposit_cents?: number
          description?: string | null
          display_order?: number
          duration_minutes?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_cents?: number | null
          price_note?: string | null
          promo_group?: string | null
          rebook_followup_days?: number | null
          requires_consult?: boolean
          skip_consents?: boolean
          stack_numbing_minutes?: number
          tippable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          appointment_id: string | null
          body: string
          client_email: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["sms_direction"]
          ghl_contact_id: string | null
          ghl_message_id: string | null
          id: string
          phone: string | null
          read_by_client_at: string | null
          read_by_staff_at: string | null
          sender_role: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          client_email: string
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["sms_direction"]
          ghl_contact_id?: string | null
          ghl_message_id?: string | null
          id?: string
          phone?: string | null
          read_by_client_at?: string | null
          read_by_staff_at?: string | null
          sender_role: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          client_email?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["sms_direction"]
          ghl_contact_id?: string | null
          ghl_message_id?: string | null
          id?: string
          phone?: string | null
          read_by_client_at?: string | null
          read_by_staff_at?: string | null
          sender_role?: string
        }
        Relationships: []
      }
      sms_send_log: {
        Row: {
          appointment_id: string | null
          body: string
          client_email: string | null
          created_at: string
          created_by: string | null
          error: string | null
          ghl_message_id: string | null
          id: string
          phone: string | null
          status: string
          template: string
        }
        Insert: {
          appointment_id?: string | null
          body: string
          client_email?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          ghl_message_id?: string | null
          id?: string
          phone?: string | null
          status?: string
          template: string
        }
        Update: {
          appointment_id?: string | null
          body?: string
          client_email?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          ghl_message_id?: string | null
          id?: string
          phone?: string | null
          status?: string
          template?: string
        }
        Relationships: []
      }
      sms_snippets: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff_google_oauth: {
        Row: {
          access_token: string
          calendar_id: string
          connected_at: string
          google_email: string
          id: string
          last_refreshed_at: string
          refresh_token: string | null
          scope: string | null
          staff_id: string
          token_expires_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string
          connected_at?: string
          google_email: string
          id?: string
          last_refreshed_at?: string
          refresh_token?: string | null
          scope?: string | null
          staff_id: string
          token_expires_at: string
        }
        Update: {
          access_token?: string
          calendar_id?: string
          connected_at?: string
          google_email?: string
          id?: string
          last_refreshed_at?: string
          refresh_token?: string | null
          scope?: string | null
          staff_id?: string
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_google_oauth_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_google_oauth_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          staff_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          staff_id?: string
          token?: string
        }
        Relationships: []
      }
      staff_message_templates: {
        Row: {
          config: Json
          created_at: string
          delay_minutes: number | null
          enabled: boolean
          id: string
          message_type: string
          staff_id: string
          template: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          delay_minutes?: number | null
          enabled?: boolean
          id?: string
          message_type: string
          staff_id: string
          template?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          delay_minutes?: number | null
          enabled?: boolean
          id?: string
          message_type?: string
          staff_id?: string
          template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_message_templates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_message_templates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay_config: {
        Row: {
          commission_percent: number | null
          hourly_rate_cents: number | null
          staff_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_percent?: number | null
          hourly_rate_cents?: number | null
          staff_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_percent?: number | null
          hourly_rate_cents?: number | null
          staff_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_config_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_config_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_payouts: {
        Row: {
          adjustment_note: string | null
          adjustments_cents: number
          commission_base_cents: number
          commission_cents: number
          commission_percent: number
          created_at: string
          detail: Json
          hourly_pay_cents: number
          hourly_rate_cents: number
          hours_worked: number
          id: string
          method: string
          paid_at: string
          paid_by: string | null
          payment_note: string | null
          period_end: string
          period_start: string
          staff_id: string
          tips_cents: number
          total_cents: number
          updated_at: string
        }
        Insert: {
          adjustment_note?: string | null
          adjustments_cents?: number
          commission_base_cents?: number
          commission_cents?: number
          commission_percent?: number
          created_at?: string
          detail?: Json
          hourly_pay_cents?: number
          hourly_rate_cents?: number
          hours_worked?: number
          id?: string
          method?: string
          paid_at?: string
          paid_by?: string | null
          payment_note?: string | null
          period_end: string
          period_start: string
          staff_id: string
          tips_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Update: {
          adjustment_note?: string | null
          adjustments_cents?: number
          commission_base_cents?: number
          commission_cents?: number
          commission_percent?: number
          created_at?: string
          detail?: Json
          hourly_pay_cents?: number
          hourly_rate_cents?: number
          hours_worked?: number
          id?: string
          method?: string
          paid_at?: string
          paid_by?: string | null
          payment_note?: string | null
          period_end?: string
          period_start?: string
          staff_id?: string
          tips_cents?: number
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_payouts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_payouts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          bio: string | null
          calendar_email: string | null
          checkin_delay_hours: number
          color: string
          created_at: string
          credentials: string | null
          email: string | null
          full_name: string
          google_calendar_token: Json | null
          id: string
          is_active: boolean
          is_owner: boolean
          license_number: string | null
          phone: string | null
          photo_url: string | null
          saved_signature_name: string | null
          saved_signature_png: string | null
          signature_saved_at: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          calendar_email?: string | null
          checkin_delay_hours?: number
          color?: string
          created_at?: string
          credentials?: string | null
          email?: string | null
          full_name: string
          google_calendar_token?: Json | null
          id?: string
          is_active?: boolean
          is_owner?: boolean
          license_number?: string | null
          phone?: string | null
          photo_url?: string | null
          saved_signature_name?: string | null
          saved_signature_png?: string | null
          signature_saved_at?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          calendar_email?: string | null
          checkin_delay_hours?: number
          color?: string
          created_at?: string
          credentials?: string | null
          email?: string | null
          full_name?: string
          google_calendar_token?: Json | null
          id?: string
          is_active?: boolean
          is_owner?: boolean
          license_number?: string | null
          phone?: string | null
          photo_url?: string | null
          saved_signature_name?: string | null
          saved_signature_png?: string | null
          signature_saved_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_time_entries: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          notes: string | null
          staff_id: string
          updated_at: string
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          staff_id: string
          updated_at?: string
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          staff_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      terminal_readers: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          is_active: boolean
          label: string
          last_seen_at: string | null
          location_id: string
          registered_by: string | null
          serial_number: string | null
          status: string
          stripe_reader_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          is_active?: boolean
          label: string
          last_seen_at?: string | null
          location_id: string
          registered_by?: string | null
          serial_number?: string | null
          status?: string
          stripe_reader_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          is_active?: boolean
          label?: string
          last_seen_at?: string | null
          location_id?: string
          registered_by?: string | null
          serial_number?: string | null
          status?: string
          stripe_reader_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tox_zone_guardrails: {
        Row: {
          id: string
          max_units: number
          min_units: number
          notes: string | null
          product: string
          typical_units: number
          updated_at: string
          zone: string
        }
        Insert: {
          id?: string
          max_units: number
          min_units: number
          notes?: string | null
          product: string
          typical_units: number
          updated_at?: string
          zone: string
        }
        Update: {
          id?: string
          max_units?: number
          min_units?: number
          notes?: string | null
          product?: string
          typical_units?: number
          updated_at?: string
          zone?: string
        }
        Relationships: []
      }
      treatment_plan_redemptions: {
        Row: {
          appointment_id: string | null
          id: string
          notes: string | null
          plan_id: string
          redeemed_at: string
          redeemed_by: string | null
          sale_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          id?: string
          notes?: string | null
          plan_id: string
          redeemed_at?: string
          redeemed_by?: string | null
          sale_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          id?: string
          notes?: string | null
          plan_id?: string
          redeemed_at?: string
          redeemed_by?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_redemptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_redemptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "client_treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plan_redemptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      treatment_plan_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          service_id: string | null
          total_sessions: number
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          service_id?: string | null
          total_sessions: number
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          service_id?: string | null
          total_sessions?: number
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plan_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_services: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_units: number
          min_units: number
          price_per_unit_cents: number
          service_id: string
          unit_label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_units?: number
          min_units?: number
          price_per_unit_cents: number
          service_id: string
          unit_label?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_units?: number
          min_units?: number
          price_per_unit_cents?: number
          service_id?: string
          unit_label?: string
          updated_at?: string
        }
        Relationships: []
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
      vendors: {
        Row: {
          baa_renewal_at: string | null
          baa_required: boolean
          baa_signed_at: string | null
          baa_status: string
          category: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          touches_phi: boolean
          updated_at: string
        }
        Insert: {
          baa_renewal_at?: string | null
          baa_required?: boolean
          baa_signed_at?: string | null
          baa_status?: string
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          touches_phi?: boolean
          updated_at?: string
        }
        Update: {
          baa_renewal_at?: string | null
          baa_required?: boolean
          baa_signed_at?: string | null
          baa_status?: string
          category?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          touches_phi?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      vo_protocol_runs: {
        Row: {
          ae_id: string | null
          appointment_id: string | null
          client_email: string
          client_first_name: string | null
          client_last_name: string | null
          created_at: string
          id: string
          lead_np_user_id: string | null
          location_id: string | null
          notes: string | null
          onset_at: string | null
          product_suspected: string | null
          region: string | null
          resolved_at: string | null
          started_at: string
          started_by: string | null
          status: Database["public"]["Enums"]["vo_protocol_status"]
          updated_at: string
        }
        Insert: {
          ae_id?: string | null
          appointment_id?: string | null
          client_email: string
          client_first_name?: string | null
          client_last_name?: string | null
          created_at?: string
          id?: string
          lead_np_user_id?: string | null
          location_id?: string | null
          notes?: string | null
          onset_at?: string | null
          product_suspected?: string | null
          region?: string | null
          resolved_at?: string | null
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["vo_protocol_status"]
          updated_at?: string
        }
        Update: {
          ae_id?: string | null
          appointment_id?: string | null
          client_email?: string
          client_first_name?: string | null
          client_last_name?: string | null
          created_at?: string
          id?: string
          lead_np_user_id?: string | null
          location_id?: string | null
          notes?: string | null
          onset_at?: string | null
          product_suspected?: string | null
          region?: string | null
          resolved_at?: string | null
          started_at?: string
          started_by?: string | null
          status?: Database["public"]["Enums"]["vo_protocol_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vo_protocol_runs_ae_id_fkey"
            columns: ["ae_id"]
            isOneToOne: false
            referencedRelation: "adverse_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vo_protocol_runs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vo_protocol_runs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      vo_protocol_steps: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          due_offset_minutes: number
          id: string
          notes: string | null
          run_id: string
          sort_order: number
          step_key: string
          step_label: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_offset_minutes?: number
          id?: string
          notes?: string | null
          run_id: string
          sort_order?: number
          step_key: string
          step_label: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          due_offset_minutes?: number
          id?: string
          notes?: string | null
          run_id?: string
          sort_order?: number
          step_key?: string
          step_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "vo_protocol_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "vo_protocol_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_redemptions: {
        Row: {
          amount_cents: number
          id: string
          redeemed_at: string
          redeemed_by: string | null
          reversed_at: string | null
          sale_id: string
          voucher_id: string
        }
        Insert: {
          amount_cents: number
          id?: string
          redeemed_at?: string
          redeemed_by?: string | null
          reversed_at?: string | null
          sale_id: string
          voucher_id: string
        }
        Update: {
          amount_cents?: number
          id?: string
          redeemed_at?: string
          redeemed_by?: string | null
          reversed_at?: string | null
          sale_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          balance_cents: number
          code: string
          created_at: string
          entitlements: Json
          expires_at: string | null
          id: string
          is_active: boolean
          issued_by: string | null
          issued_to_email: string | null
          issued_to_name: string | null
          location_id: string | null
          notes: string | null
          original_amount_cents: number
          source: Database["public"]["Enums"]["voucher_source"]
          source_sale_id: string | null
          updated_at: string
        }
        Insert: {
          balance_cents: number
          code: string
          created_at?: string
          entitlements?: Json
          expires_at?: string | null
          id?: string
          is_active?: boolean
          issued_by?: string | null
          issued_to_email?: string | null
          issued_to_name?: string | null
          location_id?: string | null
          notes?: string | null
          original_amount_cents: number
          source?: Database["public"]["Enums"]["voucher_source"]
          source_sale_id?: string | null
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          code?: string
          created_at?: string
          entitlements?: Json
          expires_at?: string | null
          id?: string
          is_active?: boolean
          issued_by?: string | null
          issued_to_email?: string | null
          issued_to_name?: string | null
          location_id?: string | null
          notes?: string | null
          original_amount_cents?: number
          source?: Database["public"]["Enums"]["voucher_source"]
          source_sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_requests: {
        Row: {
          client_email: string
          client_first_name: string
          client_last_name: string
          client_phone: string
          created_at: string
          desired_date_from: string
          desired_date_to: string
          id: string
          location_id: string | null
          notes: string | null
          notified_at: string | null
          service_id: string
          staff_id: string | null
          status: Database["public"]["Enums"]["waitlist_status"]
          updated_at: string
        }
        Insert: {
          client_email: string
          client_first_name: string
          client_last_name: string
          client_phone: string
          created_at?: string
          desired_date_from: string
          desired_date_to: string
          id?: string
          location_id?: string | null
          notes?: string | null
          notified_at?: string | null
          service_id: string
          staff_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Update: {
          client_email?: string
          client_first_name?: string
          client_last_name?: string
          client_phone?: string
          created_at?: string
          desired_date_from?: string
          desired_date_to?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          notified_at?: string | null
          service_id?: string
          staff_id?: string | null
          status?: Database["public"]["Enums"]["waitlist_status"]
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events_processed: {
        Row: {
          event_type: string | null
          id: string
          processed_at: string
          source: string
        }
        Insert: {
          event_type?: string | null
          id: string
          processed_at?: string
          source: string
        }
        Update: {
          event_type?: string | null
          id?: string
          processed_at?: string
          source?: string
        }
        Relationships: []
      }
      weekly_schedules: {
        Row: {
          anchor_date: string | null
          created_at: string
          day_of_week: number
          effective_from: string | null
          end_time: string
          id: string
          is_active: boolean
          location_id: string
          recurrence: Database["public"]["Enums"]["recurrence_rule"]
          staff_id: string
          start_time: string
          weeks_of_month: number[] | null
        }
        Insert: {
          anchor_date?: string | null
          created_at?: string
          day_of_week: number
          effective_from?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          location_id: string
          recurrence?: Database["public"]["Enums"]["recurrence_rule"]
          staff_id: string
          start_time: string
          weeks_of_month?: number[] | null
        }
        Update: {
          anchor_date?: string | null
          created_at?: string
          day_of_week?: number
          effective_from?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          location_id?: string
          recurrence?: Database["public"]["Enums"]["recurrence_rule"]
          staff_id?: string
          start_time?: string
          weeks_of_month?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_credit_balances: {
        Row: {
          balance_cents: number | null
          client_email: string | null
          entries: number | null
          last_activity_at: string | null
        }
        Relationships: []
      }
      client_points_balances: {
        Row: {
          balance: number | null
          client_email: string | null
          last_activity_at: string | null
        }
        Relationships: []
      }
      client_service_credits_available: {
        Row: {
          amount_cents: number | null
          client_email: string | null
          created_at: string | null
          id: string | null
          kind: string | null
          note: string | null
          reason: string | null
          service_id: string | null
          service_label: string | null
          units: number | null
        }
        Insert: {
          amount_cents?: number | null
          client_email?: never
          created_at?: string | null
          id?: string | null
          kind?: string | null
          note?: string | null
          reason?: string | null
          service_id?: string | null
          service_label?: string | null
          units?: number | null
        }
        Update: {
          amount_cents?: number | null
          client_email?: never
          created_at?: string | null
          id?: string | null
          kind?: string | null
          note?: string | null
          reason?: string | null
          service_id?: string | null
          service_label?: string | null
          units?: number | null
        }
        Relationships: []
      }
      client_tox_lifetime: {
        Row: {
          client_email: string | null
          last_visit_at: string | null
          lifetime_units: number | null
          product: string | null
          units_last_12mo: number | null
          visit_count: number | null
        }
        Relationships: []
      }
      client_unit_bank_balances: {
        Row: {
          balance: number | null
          client_email: string | null
          entries: number | null
          last_activity_at: string | null
          service_id: string | null
          service_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_unit_banks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      public_testimonials: {
        Row: {
          comment: string | null
          created_at: string | null
          first_name: string | null
          id: string | null
          location_city: string | null
          location_slug: string | null
          provider_first_name: string | null
          rating: number | null
          service_name: string | null
        }
        Relationships: []
      }
      referral_stats: {
        Row: {
          code: string | null
          completed_referrals: number | null
          created_at: string | null
          last_referral_at: string | null
          owner_email: string | null
          total_referrals: number | null
        }
        Relationships: []
      }
      schedule_overrides_public: {
        Row: {
          end_at: string | null
          id: string | null
          location_id: string | null
          override_type: Database["public"]["Enums"]["override_type"] | null
          staff_id: string | null
          start_at: string | null
        }
        Insert: {
          end_at?: string | null
          id?: string | null
          location_id?: string | null
          override_type?: Database["public"]["Enums"]["override_type"] | null
          staff_id?: string | null
          start_at?: string | null
        }
        Update: {
          end_at?: string | null
          id?: string | null
          location_id?: string | null
          override_type?: Database["public"]["Enums"]["override_type"] | null
          staff_id?: string | null
          start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_overrides_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_overrides_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_directory: {
        Row: {
          bio: string | null
          color: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          title: string | null
        }
        Insert: {
          bio?: string | null
          color?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
        }
        Update: {
          bio?: string | null
          color?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_lot: {
        Args: {
          _lot_id: string
          _new_quantity: number
          _notes?: string
          _reason?: string
        }
        Returns: number
      }
      adjust_points: {
        Args: { _client_email: string; _delta: number; _reason?: string }
        Returns: number
      }
      can_manage_appointment_emails: {
        Args: { _appointment_id: string }
        Returns: boolean
      }
      client_has_card_on_file: { Args: never; Returns: boolean }
      consume_lot: {
        Args: {
          _lot_id: string
          _notes?: string
          _qty: number
          _ref_id?: string
          _ref_type?: string
        }
        Returns: number
      }
      current_client_email: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      expire_stale_points: { Args: never; Returns: number }
      force_create_appointment: {
        Args: {
          p_client_dob?: string
          p_client_email: string
          p_client_first_name: string
          p_client_last_name: string
          p_client_notes?: string
          p_client_phone: string
          p_end_at: string
          p_location_id: string
          p_service_id: string
          p_staff_id: string
          p_start_at: string
          p_stripe_customer_id?: string
          p_stripe_payment_method_id?: string
          p_stripe_setup_intent_id?: string
        }
        Returns: {
          id: string
          public_token: string
        }[]
      }
      force_reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_end_at: string
          p_location_id?: string
          p_staff_id?: string
          p_start_at: string
        }
        Returns: undefined
      }
      get_incomplete_charts: {
        Args: never
        Returns: {
          appointment_id: string
          client_email: string
          client_first_name: string
          client_last_name: string
          end_at: string
          missing_note: boolean
          staff_id: string
          staff_name: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          unsigned_consents: number
        }[]
      }
      get_my_staff_access: {
        Args: never
        Returns: {
          roles: Database["public"]["Enums"]["app_role"][]
          staff_id: string
        }[]
      }
      get_or_create_referral_code: { Args: never; Returns: string }
      get_outcomes_summary: {
        Args: {
          _from?: string
          _location_id?: string
          _staff_user_id?: string
          _to?: string
        }
        Returns: Json
      }
      get_points_balance: { Args: { _client_email: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_clinical_staff: { Args: { _user_id: string }; Returns: boolean }
      is_kiem: { Args: { _user_id: string }; Returns: boolean }
      is_nurse_practitioner: { Args: { _user_id: string }; Returns: boolean }
      is_scheduler_or_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
      log_phi_access: {
        Args: {
          _action?: string
          _client_email: string
          _metadata?: Json
          _resource_id: string
          _resource_type: string
          _route?: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purchase_treatment_plan: {
        Args: {
          _client_email: string
          _notes?: string
          _sale_id?: string
          _template_id: string
        }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      receive_lot: {
        Args: {
          _category?: string
          _expiration_date: string
          _location_id?: string
          _lot_number: string
          _low_stock_threshold?: number
          _notes?: string
          _product_name: string
          _quantity: number
          _unit?: string
        }
        Returns: string
      }
      redeem_treatment_plan_session: {
        Args: {
          _appointment_id?: string
          _notes?: string
          _plan_id: string
          _sale_id?: string
        }
        Returns: Json
      }
      redeem_voucher: {
        Args: {
          _amount_cents: number
          _redeemed_by: string
          _sale_id: string
          _voucher_id: string
        }
        Returns: Json
      }
      refund_treatment_plan: {
        Args: { _plan_id: string; _reason?: string }
        Returns: undefined
      }
      reverse_voucher_redemption: {
        Args: { _redemption_id: string }
        Returns: Json
      }
      update_appointment_end_force: {
        Args: {
          p_appointment_id: string
          p_end_at: string
          p_service_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      adverse_event_outcome:
        | "ongoing"
        | "improving"
        | "resolved"
        | "referred"
        | "er_sent"
      adverse_event_severity:
        | "mild"
        | "moderate"
        | "severe"
        | "life_threatening"
      adverse_event_type:
        | "bruising"
        | "swelling"
        | "nodule"
        | "granuloma"
        | "infection"
        | "tyndall"
        | "asymmetry"
        | "ptosis"
        | "headache"
        | "vascular_occlusion"
        | "necrosis"
        | "anaphylaxis"
        | "allergic_reaction"
        | "other"
      app_role:
        | "admin"
        | "staff"
        | "scheduler"
        | "receptionist"
        | "nurse_practitioner"
      appointment_status:
        | "pending"
        | "approved"
        | "denied"
        | "arrived"
        | "completed"
        | "cancelled"
        | "no_show"
      clinical_encounter_decision:
        | "increase"
        | "decrease"
        | "continue"
        | "discontinue"
        | "switch"
      clinical_encounter_status: "draft" | "signed"
      clinical_encounter_visit_type: "new" | "follow_up"
      clinical_note_category:
        | "neurotoxin"
        | "filler"
        | "energy"
        | "wellness"
        | "consult"
      clinical_note_status: "draft" | "signed" | "cosigned" | "locked"
      clinical_protocol_category:
        | "glp1"
        | "retatrutide"
        | "peptide"
        | "hrt"
        | "other"
        | "acne"
      clinical_protocol_status: "draft" | "published" | "archived"
      compliance_assignment_status:
        | "pending"
        | "signed"
        | "expired"
        | "superseded"
        | "waived"
      compliance_signature_status:
        | "active"
        | "superseded"
        | "revoked"
        | "expired"
      override_type: "extra_availability" | "block"
      product_kind: "retail" | "package" | "service_addon"
      promo_kind: "percent" | "fixed" | "package_price"
      recurrence_rule: "weekly" | "alternating_weeks" | "nth_weekday_of_month"
      sale_item_kind:
        | "service"
        | "unit_service"
        | "product"
        | "package"
        | "voucher_sale"
        | "tip"
        | "fee"
        | "discount"
        | "voucher_redemption"
        | "custom"
      sale_payment_method:
        | "terminal"
        | "manual_card"
        | "card_on_file"
        | "cash"
        | "voucher_only"
        | "mixed"
        | "account_credit"
        | "unit_bank"
        | "mixed_non_card"
      sale_status:
        | "draft"
        | "pending_payment"
        | "paid"
        | "voided"
        | "refunded"
        | "partially_refunded"
      sms_direction: "inbound" | "outbound"
      vo_protocol_status: "active" | "resolved" | "escalated" | "cancelled"
      voucher_source: "purchased" | "comp" | "refund_credit"
      waitlist_status: "open" | "notified" | "booked" | "expired" | "cancelled"
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
      adverse_event_outcome: [
        "ongoing",
        "improving",
        "resolved",
        "referred",
        "er_sent",
      ],
      adverse_event_severity: [
        "mild",
        "moderate",
        "severe",
        "life_threatening",
      ],
      adverse_event_type: [
        "bruising",
        "swelling",
        "nodule",
        "granuloma",
        "infection",
        "tyndall",
        "asymmetry",
        "ptosis",
        "headache",
        "vascular_occlusion",
        "necrosis",
        "anaphylaxis",
        "allergic_reaction",
        "other",
      ],
      app_role: [
        "admin",
        "staff",
        "scheduler",
        "receptionist",
        "nurse_practitioner",
      ],
      appointment_status: [
        "pending",
        "approved",
        "denied",
        "arrived",
        "completed",
        "cancelled",
        "no_show",
      ],
      clinical_encounter_decision: [
        "increase",
        "decrease",
        "continue",
        "discontinue",
        "switch",
      ],
      clinical_encounter_status: ["draft", "signed"],
      clinical_encounter_visit_type: ["new", "follow_up"],
      clinical_note_category: [
        "neurotoxin",
        "filler",
        "energy",
        "wellness",
        "consult",
      ],
      clinical_note_status: ["draft", "signed", "cosigned", "locked"],
      clinical_protocol_category: [
        "glp1",
        "retatrutide",
        "peptide",
        "hrt",
        "other",
        "acne",
      ],
      clinical_protocol_status: ["draft", "published", "archived"],
      compliance_assignment_status: [
        "pending",
        "signed",
        "expired",
        "superseded",
        "waived",
      ],
      compliance_signature_status: [
        "active",
        "superseded",
        "revoked",
        "expired",
      ],
      override_type: ["extra_availability", "block"],
      product_kind: ["retail", "package", "service_addon"],
      promo_kind: ["percent", "fixed", "package_price"],
      recurrence_rule: ["weekly", "alternating_weeks", "nth_weekday_of_month"],
      sale_item_kind: [
        "service",
        "unit_service",
        "product",
        "package",
        "voucher_sale",
        "tip",
        "fee",
        "discount",
        "voucher_redemption",
        "custom",
      ],
      sale_payment_method: [
        "terminal",
        "manual_card",
        "card_on_file",
        "cash",
        "voucher_only",
        "mixed",
        "account_credit",
        "unit_bank",
        "mixed_non_card",
      ],
      sale_status: [
        "draft",
        "pending_payment",
        "paid",
        "voided",
        "refunded",
        "partially_refunded",
      ],
      sms_direction: ["inbound", "outbound"],
      vo_protocol_status: ["active", "resolved", "escalated", "cancelled"],
      voucher_source: ["purchased", "comp", "refund_credit"],
      waitlist_status: ["open", "notified", "booked", "expired", "cancelled"],
    },
  },
} as const
