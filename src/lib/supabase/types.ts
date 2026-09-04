export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academy_info: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string | null
          email: string
        }
        Insert: {
          created_at?: string | null
          email: string
        }
        Update: {
          created_at?: string | null
          email?: string
        }
        Relationships: []
      }
      class_series: {
        Row: {
          class_type_id: string
          classroom_id: string
          created_at: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_recurring: boolean | null
          recurrence_end: string | null
          recurrence_start: string
          start_time: string
          stream_id: string | null
          subject_id: string
          tutor_id: string
        }
        Insert: {
          class_type_id: string
          classroom_id: string
          created_at?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_recurring?: boolean | null
          recurrence_end?: string | null
          recurrence_start: string
          start_time: string
          stream_id?: string | null
          subject_id: string
          tutor_id: string
        }
        Update: {
          class_type_id?: string
          classroom_id?: string
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          recurrence_end?: string | null
          recurrence_start?: string
          start_time?: string
          stream_id?: string | null
          subject_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_series_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_series_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_series_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_series_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_series_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_type_id: string | null
          classroom_id: string | null
          created_at: string | null
          date: string
          end_time: string
          id: string
          is_adhoc: boolean | null
          makeup_for_session_id: string | null
          notes: string | null
          series_id: string | null
          start_time: string
          status: string | null
          stream_id: string | null
          subject_id: string | null
          tutor_id: string | null
        }
        Insert: {
          class_type_id?: string | null
          classroom_id?: string | null
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          is_adhoc?: boolean | null
          makeup_for_session_id?: string | null
          notes?: string | null
          series_id?: string | null
          start_time: string
          status?: string | null
          stream_id?: string | null
          subject_id?: string | null
          tutor_id?: string | null
        }
        Update: {
          class_type_id?: string | null
          classroom_id?: string | null
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          is_adhoc?: boolean | null
          makeup_for_session_id?: string | null
          notes?: string | null
          series_id?: string | null
          start_time?: string
          status?: string | null
          stream_id?: string | null
          subject_id?: string | null
          tutor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_makeup_for_session_id_fkey"
            columns: ["makeup_for_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "class_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      class_types: {
        Row: {
          created_at: string | null
          hourly_rate: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          hourly_rate: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          hourly_rate?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      classrooms: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string | null
          dates_attended: string | null
          description: string
          hourly_rate: number | null
          hours: number | null
          id: string
          invoice_id: string
          is_adhoc: boolean | null
          total: number
        }
        Insert: {
          created_at?: string | null
          dates_attended?: string | null
          description: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_id: string
          is_adhoc?: boolean | null
          total: number
        }
        Update: {
          created_at?: string | null
          dates_attended?: string | null
          description?: string
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          invoice_id?: string
          is_adhoc?: boolean | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string | null
          id: string
          invoice_number: string | null
          month: number
          parent_id: string | null
          pdf_url: string | null
          status: string | null
          student_id: string
          subtotal: number | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          month: number
          parent_id?: string | null
          pdf_url?: string | null
          status?: string | null
          student_id: string
          subtotal?: number | null
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          month?: number
          parent_id?: string | null
          pdf_url?: string | null
          status?: string | null
          student_id?: string
          subtotal?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_students: {
        Row: {
          parent_id: string
          student_id: string
        }
        Insert: {
          parent_id: string
          student_id: string
        }
        Update: {
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string | null
          details: string
          display_order: number | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          details: string
          display_order?: number | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          details?: string
          display_order?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      session_students: {
        Row: {
          attendance_status: Database["public"]["Enums"]["attendance_status"]
          id: string
          session_id: string
          student_id: string
        }
        Insert: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          id?: string
          session_id: string
          student_id: string
        }
        Update: {
          attendance_status?: Database["public"]["Enums"]["attendance_status"]
          id?: string
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string | null
          id: string
          level_order: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level_order?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level_order?: number
          name?: string
        }
        Relationships: []
      }
      student_subjects: {
        Row: {
          student_id: string
          subject_id: string
        }
        Insert: {
          student_id: string
          subject_id: string
        }
        Update: {
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          id: string
          name: string
          stream_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          stream_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_streams: {
        Row: {
          stream_id: string
          subject_id: string
        }
        Insert: {
          stream_id: string
          subject_id: string
        }
        Update: {
          stream_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_streams_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_streams_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string | null
          id: string
          level: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string
          name?: string
        }
        Relationships: []
      }
      tm_assignments: {
        Row: {
          additional_materials: string | null
          code: string
          created_at: string | null
          curriculum_briefed: boolean
          deposit_amount: number | null
          deposit_status: string
          group_chat_created: boolean
          id: string
          monthly_est_profit: number | null
          post_trial_checkin_done: boolean
          remarks: string | null
          status: string
          student_id: string
          subject: string
          timeslot: string | null
          tutor_id: string
        }
        Insert: {
          additional_materials?: string | null
          code: string
          created_at?: string | null
          curriculum_briefed?: boolean
          deposit_amount?: number | null
          deposit_status?: string
          group_chat_created?: boolean
          id?: string
          monthly_est_profit?: number | null
          post_trial_checkin_done?: boolean
          remarks?: string | null
          status?: string
          student_id: string
          subject: string
          timeslot?: string | null
          tutor_id: string
        }
        Update: {
          additional_materials?: string | null
          code?: string
          created_at?: string | null
          curriculum_briefed?: boolean
          deposit_amount?: number | null
          deposit_status?: string
          group_chat_created?: boolean
          id?: string
          monthly_est_profit?: number | null
          post_trial_checkin_done?: boolean
          remarks?: string | null
          status?: string
          student_id?: string
          subject?: string
          timeslot?: string | null
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "tm_students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_assignments_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tm_tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_entry_edits: {
        Row: {
          edited_at: string | null
          edited_by: string | null
          entry_id: string
          id: string
          previous: Json
        }
        Insert: {
          edited_at?: string | null
          edited_by?: string | null
          entry_id: string
          id?: string
          previous: Json
        }
        Update: {
          edited_at?: string | null
          edited_by?: string | null
          entry_id?: string
          id?: string
          previous?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tm_entry_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_entry_edits_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "tm_timesheet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_invoices: {
        Row: {
          assignment_id: string
          created_at: string | null
          id: string
          invoice_amount: number
          invoice_number: string | null
          month: number
          parent_paid_at: string | null
          profit: number | null
          remarks: string | null
          source: string
          total_hours: number | null
          tutor_paid_at: string | null
          tutor_payout: number
          year: number
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          id?: string
          invoice_amount: number
          invoice_number?: string | null
          month: number
          parent_paid_at?: string | null
          profit?: number | null
          remarks?: string | null
          source: string
          total_hours?: number | null
          tutor_paid_at?: string | null
          tutor_payout: number
          year: number
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          id?: string
          invoice_amount?: number
          invoice_number?: string | null
          month?: number
          parent_paid_at?: string | null
          profit?: number | null
          remarks?: string | null
          source?: string
          total_hours?: number | null
          tutor_paid_at?: string | null
          tutor_payout?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tm_invoices_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tm_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_rate_tiers: {
        Row: {
          assignment_id: string
          created_at: string | null
          id: string
          label: string
          parent_rate: number
          sort_order: number
          tutor_rate: number
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          id?: string
          label: string
          parent_rate: number
          sort_order?: number
          tutor_rate: number
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          id?: string
          label?: string
          parent_rate?: number
          sort_order?: number
          tutor_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tm_rate_tiers_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tm_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_settings: {
        Row: {
          company_name: string
          created_at: string | null
          default_rate_tiers: Json
          id: string
          legal_name: string
          payment_details: string
          payment_terms: string
          paynow_uen: string
          qr_code_path: string
        }
        Insert: {
          company_name?: string
          created_at?: string | null
          default_rate_tiers?: Json
          id?: string
          legal_name?: string
          payment_details?: string
          payment_terms?: string
          paynow_uen?: string
          qr_code_path?: string
        }
        Update: {
          company_name?: string
          created_at?: string | null
          default_rate_tiers?: Json
          id?: string
          legal_name?: string
          payment_details?: string
          payment_terms?: string
          paynow_uen?: string
          qr_code_path?: string
        }
        Relationships: []
      }
      tm_students: {
        Row: {
          address: string | null
          contact_preference: string | null
          created_at: string | null
          id: string
          name: string
          parent_name: string | null
          parent_phone: string | null
          remarks: string | null
        }
        Insert: {
          address?: string | null
          contact_preference?: string | null
          created_at?: string | null
          id?: string
          name: string
          parent_name?: string | null
          parent_phone?: string | null
          remarks?: string | null
        }
        Update: {
          address?: string | null
          contact_preference?: string | null
          created_at?: string | null
          id?: string
          name?: string
          parent_name?: string | null
          parent_phone?: string | null
          remarks?: string | null
        }
        Relationships: []
      }
      tm_submissions: {
        Row: {
          assignment_id: string
          created_at: string | null
          id: string
          invoice_id: string | null
          month: number
          return_reason: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string | null
          tutor_id: string
          year: number
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          month: number
          return_reason?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          tutor_id: string
          year: number
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          month?: number
          return_reason?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string | null
          tutor_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tm_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tm_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_submissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tm_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_submissions_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tm_tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_timesheet_entries: {
        Row: {
          assignment_id: string
          created_at: string | null
          date: string
          end_time: string | null
          hours: number | null
          id: string
          invoice_id: string | null
          note: string | null
          parent_rate: number
          rate_tier_id: string | null
          start_time: string | null
          status: string
          submission_id: string | null
          tier_label: string
          tutor_id: string
          tutor_rate: number
          updated_at: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string | null
          date: string
          end_time?: string | null
          hours?: number | null
          id?: string
          invoice_id?: string | null
          note?: string | null
          parent_rate: number
          rate_tier_id?: string | null
          start_time?: string | null
          status?: string
          submission_id?: string | null
          tier_label: string
          tutor_id: string
          tutor_rate: number
          updated_at?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string | null
          date?: string
          end_time?: string | null
          hours?: number | null
          id?: string
          invoice_id?: string | null
          note?: string | null
          parent_rate?: number
          rate_tier_id?: string | null
          start_time?: string | null
          status?: string
          submission_id?: string | null
          tier_label?: string
          tutor_id?: string
          tutor_rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tm_timesheet_entries_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tm_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_timesheet_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tm_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_timesheet_entries_rate_tier_id_fkey"
            columns: ["rate_tier_id"]
            isOneToOne: false
            referencedRelation: "tm_rate_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_timesheet_entries_rate_tier_id_fkey"
            columns: ["rate_tier_id"]
            isOneToOne: false
            referencedRelation: "tm_rate_tiers_tutor_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_timesheet_entries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "tm_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tm_timesheet_entries_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tm_tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tm_tutors: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string | null
          profile_id: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          profile_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tm_tutors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_streams: {
        Row: {
          stream_id: string
          tutor_id: string
        }
        Insert: {
          stream_id: string
          tutor_id: string
        }
        Update: {
          stream_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_streams_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_streams_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_subjects: {
        Row: {
          subject_id: string
          tutor_id: string
        }
        Insert: {
          subject_id: string
          tutor_id: string
        }
        Update: {
          subject_id?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_subjects_tutor_id_fkey"
            columns: ["tutor_id"]
            isOneToOne: false
            referencedRelation: "tutors"
            referencedColumns: ["id"]
          },
        ]
      }
      tutors: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      tm_rate_tiers_tutor_view: {
        Row: {
          assignment_id: string | null
          id: string | null
          label: string | null
          sort_order: number | null
          tutor_rate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tm_rate_tiers_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "tm_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_role: { Args: never; Returns: string }
      current_tutor_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      tm_approve_signup: {
        Args: {
          p_name?: string
          p_phone?: string
          p_profile_id: string
          p_tutor_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      attendance_status: "pending" | "attended" | "absent" | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_status: ["pending", "attended", "absent", "cancelled"],
    },
  },
} as const

