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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ads_reports: {
        Row: {
          ai_summary: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kpis: Json | null
          period_end: string
          period_start: string
          platforms: string[]
          raw_data: Json
          recommendations: Json | null
          status: string | null
        }
        Insert: {
          ai_summary?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kpis?: Json | null
          period_end: string
          period_start: string
          platforms?: string[]
          raw_data?: Json
          recommendations?: Json | null
          status?: string | null
        }
        Update: {
          ai_summary?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kpis?: Json | null
          period_end?: string
          period_start?: string
          platforms?: string[]
          raw_data?: Json
          recommendations?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_activity_logs: {
        Row: {
          action: string
          category: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          payload: Json | null
          result: Json | null
          status: Database["public"]["Enums"]["ai_activity_status"]
          target_id: string | null
          target_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          category: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: Database["public"]["Enums"]["ai_activity_status"]
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          category?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          status?: Database["public"]["Enums"]["ai_activity_status"]
          target_id?: string | null
          target_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at: string
          created_by: string | null
          id: string
          prospect_id: string
          reply_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          subject: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          prospect_id: string
          reply_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          prospect_id?: string
          reply_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          notes: string | null
          outcome: string | null
          prospect_id: string | null
          scheduled_at: string
          title: string
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          prospect_id?: string | null
          scheduled_at: string
          title: string
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          outcome?: string | null
          prospect_id?: string | null
          scheduled_at?: string
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      call_scripts: {
        Row: {
          closing: string | null
          created_at: string
          created_by: string | null
          hook: string | null
          id: string
          model_used: string | null
          objections: Json | null
          objective: string | null
          prospect_id: string | null
          script: string
          title: string
          tone: string | null
          variables: Json | null
        }
        Insert: {
          closing?: string | null
          created_at?: string
          created_by?: string | null
          hook?: string | null
          id?: string
          model_used?: string | null
          objections?: Json | null
          objective?: string | null
          prospect_id?: string | null
          script: string
          title: string
          tone?: string | null
          variables?: Json | null
        }
        Update: {
          closing?: string | null
          created_at?: string
          created_by?: string | null
          hook?: string | null
          id?: string
          model_used?: string | null
          objections?: Json | null
          objective?: string | null
          prospect_id?: string | null
          script?: string
          title?: string
          tone?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "call_scripts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_alerts: {
        Row: {
          active: boolean
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          last_triggered_at: string | null
          last_value: number | null
          metric: string
          operator: string
          threshold: number
        }
        Insert: {
          active?: boolean
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_triggered_at?: string | null
          last_value?: number | null
          metric: string
          operator: string
          threshold: number
        }
        Update: {
          active?: boolean
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          last_triggered_at?: string | null
          last_value?: number | null
          metric?: string
          operator?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_alerts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          amount: number | null
          channel: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          metadata: Json
          prospect_id: string | null
          source: string | null
          status_from: string | null
          status_to: string | null
        }
        Insert: {
          amount?: number | null
          channel?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json
          prospect_id?: string | null
          source?: string | null
          status_from?: string | null
          status_to?: string | null
        }
        Update: {
          amount?: number | null
          channel?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json
          prospect_id?: string | null
          source?: string | null
          status_from?: string | null
          status_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean | null
          client_id: string
          created_at: string
          current_clicks: number | null
          current_conversions: number | null
          current_cpl: number | null
          current_ctr: number | null
          current_impressions: number | null
          current_roas: number | null
          current_spend: number | null
          external_account_id: string | null
          id: string
          last_synced_at: string | null
          monthly_budget: number | null
          name: string
          platform: Database["public"]["Enums"]["campaign_platform"]
          target_roas: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          client_id: string
          created_at?: string
          current_clicks?: number | null
          current_conversions?: number | null
          current_cpl?: number | null
          current_ctr?: number | null
          current_impressions?: number | null
          current_roas?: number | null
          current_spend?: number | null
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          monthly_budget?: number | null
          name: string
          platform: Database["public"]["Enums"]["campaign_platform"]
          target_roas?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          client_id?: string
          created_at?: string
          current_clicks?: number | null
          current_conversions?: number | null
          current_cpl?: number | null
          current_ctr?: number | null
          current_impressions?: number | null
          current_roas?: number | null
          current_spend?: number | null
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          monthly_budget?: number | null
          name?: string
          platform?: Database["public"]["Enums"]["campaign_platform"]
          target_roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_manager: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          mrr: number | null
          notes: string | null
          phone: string | null
          prospect_id: string | null
          services: string[] | null
          start_date: string | null
          status: string | null
          total_billed: number | null
          updated_at: string
        }
        Insert: {
          account_manager?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mrr?: number | null
          notes?: string | null
          phone?: string | null
          prospect_id?: string | null
          services?: string[] | null
          start_date?: string | null
          status?: string | null
          total_billed?: number | null
          updated_at?: string
        }
        Update: {
          account_manager?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          mrr?: number | null
          notes?: string | null
          phone?: string | null
          prospect_id?: string | null
          services?: string[] | null
          start_date?: string | null
          status?: string | null
          total_billed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string | null
          id: string
          payload: Json
          provider: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payload: Json
          provider: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          provider?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          api_key: string | null
          base_url: string | null
          created_at: string
          enabled: boolean
          id: string
          kind: string
          label: string
          last_test_at: string | null
          last_test_message: string | null
          last_test_status: string | null
          model: string | null
          notes: string | null
          priority: number
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          model?: string | null
          notes?: string | null
          priority?: number
          provider: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_status?: string | null
          model?: string | null
          notes?: string | null
          priority?: number
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invoice_number: string
          paid_at: string | null
          pdf_url: string | null
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          paid_at?: string | null
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          channel: string
          content: string
          created_at: string
          created_by: string | null
          generated_by_ai: boolean | null
          id: string
          prospect_id: string
          replied_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          created_by?: string | null
          generated_by_ai?: boolean | null
          id?: string
          prospect_id: string
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          created_by?: string | null
          generated_by_ai?: boolean | null
          id?: string
          prospect_id?: string
          replied_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequences: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          created_by: string | null
          current_step: number
          custom_angle: string | null
          id: string
          max_steps: number
          next_run_at: string | null
          prospect_id: string
          status: Database["public"]["Enums"]["sequence_status"]
          stopped_reason: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by?: string | null
          current_step?: number
          custom_angle?: string | null
          id?: string
          max_steps?: number
          next_run_at?: string | null
          prospect_id: string
          status?: Database["public"]["Enums"]["sequence_status"]
          stopped_reason?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          created_by?: string | null
          current_step?: number
          custom_angle?: string | null
          id?: string
          max_steps?: number
          next_run_at?: string | null
          prospect_id?: string
          status?: Database["public"]["Enums"]["sequence_status"]
          stopped_reason?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          address: string | null
          ai_note: string | null
          analysis_score: number | null
          analyzed_at: string | null
          assigned_to: string | null
          category: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          digital_analysis: Json | null
          dirigeant: string | null
          email: string | null
          employees_count: number | null
          id: string
          instagram_handle: string | null
          last_contact_at: string | null
          linkedin_url: string | null
          name: string
          next_action_at: string | null
          notes: string | null
          pain_points: string[] | null
          phone: string | null
          rating: number | null
          recommended_services: string[] | null
          revenue_estimate: number | null
          reviews_count: number | null
          score: number | null
          sector: string | null
          siren: string | null
          source: Database["public"]["Enums"]["prospect_source"]
          source_url: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          tags: string[] | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          ai_note?: string | null
          analysis_score?: number | null
          analyzed_at?: string | null
          assigned_to?: string | null
          category?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          digital_analysis?: Json | null
          dirigeant?: string | null
          email?: string | null
          employees_count?: number | null
          id?: string
          instagram_handle?: string | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          name: string
          next_action_at?: string | null
          notes?: string | null
          pain_points?: string[] | null
          phone?: string | null
          rating?: number | null
          recommended_services?: string[] | null
          revenue_estimate?: number | null
          reviews_count?: number | null
          score?: number | null
          sector?: string | null
          siren?: string | null
          source?: Database["public"]["Enums"]["prospect_source"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          ai_note?: string | null
          analysis_score?: number | null
          analyzed_at?: string | null
          assigned_to?: string | null
          category?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          digital_analysis?: Json | null
          dirigeant?: string | null
          email?: string | null
          employees_count?: number | null
          id?: string
          instagram_handle?: string | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          name?: string
          next_action_at?: string | null
          notes?: string | null
          pain_points?: string[] | null
          phone?: string | null
          rating?: number | null
          recommended_services?: string[] | null
          revenue_estimate?: number | null
          reviews_count?: number | null
          score?: number | null
          sector?: string | null
          siren?: string | null
          source?: Database["public"]["Enums"]["prospect_source"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          tags?: string[] | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      scraping_jobs: {
        Row: {
          auto_enrich: boolean
          auto_import: boolean
          completed_at: string | null
          cost_credits: number | null
          created_at: string
          created_by: string | null
          duplicates_count: number
          duration_ms: number | null
          error_message: string | null
          external_run_id: string | null
          filters: Json
          id: string
          imported_count: number
          mode: string
          name: string | null
          progress: number
          results_count: number
          source: Database["public"]["Enums"]["scraping_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["scraping_status"]
        }
        Insert: {
          auto_enrich?: boolean
          auto_import?: boolean
          completed_at?: string | null
          cost_credits?: number | null
          created_at?: string
          created_by?: string | null
          duplicates_count?: number
          duration_ms?: number | null
          error_message?: string | null
          external_run_id?: string | null
          filters?: Json
          id?: string
          imported_count?: number
          mode?: string
          name?: string | null
          progress?: number
          results_count?: number
          source: Database["public"]["Enums"]["scraping_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["scraping_status"]
        }
        Update: {
          auto_enrich?: boolean
          auto_import?: boolean
          completed_at?: string | null
          cost_credits?: number | null
          created_at?: string
          created_by?: string | null
          duplicates_count?: number
          duration_ms?: number | null
          error_message?: string | null
          external_run_id?: string | null
          filters?: Json
          id?: string
          imported_count?: number
          mode?: string
          name?: string | null
          progress?: number
          results_count?: number
          source?: Database["public"]["Enums"]["scraping_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["scraping_status"]
        }
        Relationships: []
      }
      scraping_results: {
        Row: {
          address: string | null
          ai_score: number | null
          category: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          dirigeant: string | null
          duplicate_of: string | null
          email: string | null
          employees_count: number | null
          engagement_rate: number | null
          followers: number | null
          id: string
          import_status: Database["public"]["Enums"]["result_import_status"]
          imported_at: string | null
          imported_prospect_id: string | null
          instagram_handle: string | null
          job_id: string
          linkedin_url: string | null
          name: string
          phone: string | null
          rating: number | null
          raw_data: Json | null
          revenue_estimate: number | null
          reviews_count: number | null
          sector: string | null
          siren: string | null
          source: Database["public"]["Enums"]["scraping_source"]
          source_url: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          ai_score?: number | null
          category?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          dirigeant?: string | null
          duplicate_of?: string | null
          email?: string | null
          employees_count?: number | null
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          import_status?: Database["public"]["Enums"]["result_import_status"]
          imported_at?: string | null
          imported_prospect_id?: string | null
          instagram_handle?: string | null
          job_id: string
          linkedin_url?: string | null
          name: string
          phone?: string | null
          rating?: number | null
          raw_data?: Json | null
          revenue_estimate?: number | null
          reviews_count?: number | null
          sector?: string | null
          siren?: string | null
          source: Database["public"]["Enums"]["scraping_source"]
          source_url?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          ai_score?: number | null
          category?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          dirigeant?: string | null
          duplicate_of?: string | null
          email?: string | null
          employees_count?: number | null
          engagement_rate?: number | null
          followers?: number | null
          id?: string
          import_status?: Database["public"]["Enums"]["result_import_status"]
          imported_at?: string | null
          imported_prospect_id?: string | null
          instagram_handle?: string | null
          job_id?: string
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          rating?: number | null
          raw_data?: Json | null
          revenue_estimate?: number | null
          reviews_count?: number | null
          sector?: string | null
          siren?: string | null
          source?: Database["public"]["Enums"]["scraping_source"]
          source_url?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraping_results_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraping_results_imported_prospect_id_fkey"
            columns: ["imported_prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraping_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scraping_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      site_audits: {
        Row: {
          created_at: string
          findings: Json | null
          generated_by: string | null
          id: string
          pdf_url: string | null
          prospect_id: string | null
          recommendations: Json | null
          score_global: number | null
          score_mobile: number | null
          score_perf: number | null
          score_seo: number | null
          score_ux: number | null
          status: string | null
          url: string
        }
        Insert: {
          created_at?: string
          findings?: Json | null
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          prospect_id?: string | null
          recommendations?: Json | null
          score_global?: number | null
          score_mobile?: number | null
          score_perf?: number | null
          score_seo?: number | null
          score_ux?: number | null
          status?: string | null
          url: string
        }
        Update: {
          created_at?: string
          findings?: Json | null
          generated_by?: string | null
          id?: string
          pdf_url?: string | null
          prospect_id?: string | null
          recommendations?: Json | null
          score_global?: number | null
          score_mobile?: number | null
          score_perf?: number | null
          score_seo?: number | null
          score_ux?: number | null
          status?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_audits_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
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
      web_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          query: string
          query_hash: string
          results: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          query: string
          query_hash: string
          results: Json
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          query?: string
          query_hash?: string
          results?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      ai_activity_status: "running" | "success" | "error" | "cancelled"
      app_role: "admin" | "closer" | "setter"
      campaign_platform:
        | "google_ads"
        | "meta_ads"
        | "tiktok_ads"
        | "linkedin_ads"
        | "seo"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      message_channel:
        | "email"
        | "linkedin"
        | "instagram"
        | "whatsapp"
        | "sms"
        | "tiktok"
      message_status: "draft" | "approved" | "sent" | "replied" | "failed"
      prospect_source:
        | "google_maps"
        | "linkedin"
        | "instagram"
        | "tiktok"
        | "pages_jaunes"
        | "societe_com"
        | "manual"
        | "referral"
        | "website"
      prospect_status:
        | "a_contacter"
        | "contacte"
        | "rdv_pris"
        | "rdv_effectue"
        | "proposition"
        | "negociation"
        | "client"
        | "perdu"
        | "injoignable"
      result_import_status:
        | "pending"
        | "imported"
        | "skipped_duplicate"
        | "rejected"
      scraping_source:
        | "google_maps"
        | "pappers"
        | "hunter"
        | "instagram"
        | "tiktok"
        | "linkedin"
        | "pages_jaunes"
        | "societe_com"
        | "meta_ads"
        | "google_ads_transparency"
        | "trustpilot"
        | "csv"
        | "apify"
      scraping_status:
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "partial"
        | "cancelled"
      sequence_status: "active" | "paused" | "completed" | "stopped"
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
      ai_activity_status: ["running", "success", "error", "cancelled"],
      app_role: ["admin", "closer", "setter"],
      campaign_platform: [
        "google_ads",
        "meta_ads",
        "tiktok_ads",
        "linkedin_ads",
        "seo",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      message_channel: [
        "email",
        "linkedin",
        "instagram",
        "whatsapp",
        "sms",
        "tiktok",
      ],
      message_status: ["draft", "approved", "sent", "replied", "failed"],
      prospect_source: [
        "google_maps",
        "linkedin",
        "instagram",
        "tiktok",
        "pages_jaunes",
        "societe_com",
        "manual",
        "referral",
        "website",
      ],
      prospect_status: [
        "a_contacter",
        "contacte",
        "rdv_pris",
        "rdv_effectue",
        "proposition",
        "negociation",
        "client",
        "perdu",
        "injoignable",
      ],
      result_import_status: [
        "pending",
        "imported",
        "skipped_duplicate",
        "rejected",
      ],
      scraping_source: [
        "google_maps",
        "pappers",
        "hunter",
        "instagram",
        "tiktok",
        "linkedin",
        "pages_jaunes",
        "societe_com",
        "meta_ads",
        "google_ads_transparency",
        "trustpilot",
        "csv",
        "apify",
      ],
      scraping_status: [
        "queued",
        "running",
        "completed",
        "failed",
        "partial",
        "cancelled",
      ],
      sequence_status: ["active", "paused", "completed", "stopped"],
    },
  },
} as const
