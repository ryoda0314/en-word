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
      idioms: {
        Row: {
          created_at: string
          example_en: string | null
          example_ja: string | null
          id: string
          meaning_en: string | null
          meaning_ja: string | null
          phrase: string
        }
        Insert: {
          created_at?: string
          example_en?: string | null
          example_ja?: string | null
          id?: string
          meaning_en?: string | null
          meaning_ja?: string | null
          phrase: string
        }
        Update: {
          created_at?: string
          example_en?: string | null
          example_ja?: string | null
          id?: string
          meaning_en?: string | null
          meaning_ja?: string | null
          phrase?: string
        }
        Relationships: []
      }
      passages: {
        Row: {
          body: string
          created_at: string
          id: string
          language: string
          level: string | null
          part: string | null
          slug: string
          source: string | null
          title: string
          word_count: number | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          language?: string
          level?: string | null
          part?: string | null
          slug: string
          source?: string | null
          title: string
          word_count?: number | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          language?: string
          level?: string | null
          part?: string | null
          slug?: string
          source?: string | null
          title?: string
          word_count?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_goal: number
          display_name: string | null
          meaning_locale: string
          timezone: string
          ui_locale: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_goal?: number
          display_name?: string | null
          meaning_locale?: string
          timezone?: string
          ui_locale?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_goal?: number
          display_name?: string | null
          meaning_locale?: string
          timezone?: string
          ui_locale?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start?: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      review_events: {
        Row: {
          created_at: string
          id: string
          quality: number | null
          stage_after: Database["public"]["Enums"]["vocab_stage"]
          stage_before: Database["public"]["Enums"]["vocab_stage"]
          user_id: string
          user_vocab_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quality?: number | null
          stage_after: Database["public"]["Enums"]["vocab_stage"]
          stage_before: Database["public"]["Enums"]["vocab_stage"]
          user_id: string
          user_vocab_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quality?: number | null
          stage_after?: Database["public"]["Enums"]["vocab_stage"]
          stage_before?: Database["public"]["Enums"]["vocab_stage"]
          user_id?: string
          user_vocab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_user_vocab_id_fkey"
            columns: ["user_vocab_id"]
            isOneToOne: false
            referencedRelation: "user_vocab"
            referencedColumns: ["id"]
          },
        ]
      }
      user_passage_progress: {
        Row: {
          completed: boolean
          id: string
          last_opened_at: string
          passage_id: string
          tapped_positions: number[]
          user_id: string
        }
        Insert: {
          completed?: boolean
          id?: string
          last_opened_at?: string
          passage_id: string
          tapped_positions?: number[]
          user_id: string
        }
        Update: {
          completed?: boolean
          id?: string
          last_opened_at?: string
          passage_id?: string
          tapped_positions?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_passage_progress_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sentences: {
        Row: {
          ai_feedback: string | null
          created_at: string
          grade_grammar: number | null
          grade_meaning: number | null
          grade_naturalness: number | null
          grade_total: number | null
          id: string
          sentence: string
          user_id: string
          user_vocab_id: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          grade_grammar?: number | null
          grade_meaning?: number | null
          grade_naturalness?: number | null
          grade_total?: number | null
          id?: string
          sentence: string
          user_id: string
          user_vocab_id: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          grade_grammar?: number | null
          grade_meaning?: number | null
          grade_naturalness?: number | null
          grade_total?: number | null
          id?: string
          sentence?: string
          user_id?: string
          user_vocab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sentences_user_vocab_id_fkey"
            columns: ["user_vocab_id"]
            isOneToOne: false
            referencedRelation: "user_vocab"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vocab: {
        Row: {
          context_sentence: string | null
          created_at: string
          custom_meaning_ja: string | null
          custom_term: string | null
          ease: number
          id: string
          idiom_id: string | null
          interval_days: number
          lapses: number
          last_reviewed_at: string | null
          next_review_at: string
          repetition: number
          source_passage_id: string | null
          stage: Database["public"]["Enums"]["vocab_stage"]
          user_id: string
          word_id: string | null
        }
        Insert: {
          context_sentence?: string | null
          created_at?: string
          custom_meaning_ja?: string | null
          custom_term?: string | null
          ease?: number
          id?: string
          idiom_id?: string | null
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          next_review_at?: string
          repetition?: number
          source_passage_id?: string | null
          stage?: Database["public"]["Enums"]["vocab_stage"]
          user_id: string
          word_id?: string | null
        }
        Update: {
          context_sentence?: string | null
          created_at?: string
          custom_meaning_ja?: string | null
          custom_term?: string | null
          ease?: number
          id?: string
          idiom_id?: string | null
          interval_days?: number
          lapses?: number
          last_reviewed_at?: string | null
          next_review_at?: string
          repetition?: number
          source_passage_id?: string | null
          stage?: Database["public"]["Enums"]["vocab_stage"]
          user_id?: string
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_vocab_idiom_id_fkey"
            columns: ["idiom_id"]
            isOneToOne: false
            referencedRelation: "idioms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vocab_source_passage_id_fkey"
            columns: ["source_passage_id"]
            isOneToOne: false
            referencedRelation: "passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vocab_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      user_weaknesses: {
        Row: {
          category: string
          created_at: string
          id: string
          last_miss_at: string
          miss_count: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          last_miss_at?: string
          miss_count?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          last_miss_at?: string
          miss_count?: number
          user_id?: string
        }
        Relationships: []
      }
      words: {
        Row: {
          created_at: string
          example_en: string | null
          example_ja: string | null
          frequency_rank: number | null
          id: string
          ipa: string | null
          lemma: string
          meaning_en: string | null
          meaning_ja: string | null
          pos: string | null
        }
        Insert: {
          created_at?: string
          example_en?: string | null
          example_ja?: string | null
          frequency_rank?: number | null
          id?: string
          ipa?: string | null
          lemma: string
          meaning_en?: string | null
          meaning_ja?: string | null
          pos?: string | null
        }
        Update: {
          created_at?: string
          example_en?: string | null
          example_ja?: string | null
          frequency_rank?: number | null
          id?: string
          ipa?: string | null
          lemma?: string
          meaning_en?: string | null
          meaning_ja?: string | null
          pos?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      due_reviews: {
        Args: { limit_count?: number }
        Returns: {
          context_sentence: string | null
          created_at: string
          custom_meaning_ja: string | null
          custom_term: string | null
          ease: number
          id: string
          idiom_id: string | null
          interval_days: number
          lapses: number
          last_reviewed_at: string | null
          next_review_at: string
          repetition: number
          source_passage_id: string | null
          stage: Database["public"]["Enums"]["vocab_stage"]
          user_id: string
          word_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "user_vocab"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      vocab_stats: {
        Args: never
        Returns: {
          due_today_count: number
          mastered_count: number
          memorize_count: number
          produce_count: number
          recognize_count: number
          total_count: number
        }[]
      }
    }
    Enums: {
      vocab_stage: "memorize" | "recognize" | "produce" | "mastered"
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
      vocab_stage: ["memorize", "recognize", "produce", "mastered"],
    },
  },
} as const
