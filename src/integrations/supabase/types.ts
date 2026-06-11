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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          modelo: string | null
          nome: string
          qr_token: string
          ultimo_horimetro: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          modelo?: string | null
          nome: string
          qr_token?: string
          ultimo_horimetro?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          modelo?: string | null
          nome?: string
          qr_token?: string
          ultimo_horimetro?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          matricula: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          matricula?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          matricula?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      readings: {
        Row: {
          client_created_at: string | null
          confianca: number | null
          created_at: string
          device_id: string | null
          foto_path: string | null
          gps_accuracy_m: number | null
          id: string
          integration_attempts: number
          integration_last_attempt_at: string | null
          integration_response: Json | null
          integration_status: Database["public"]["Enums"]["integration_status"]
          lat: number | null
          lng: number | null
          machine_id: string
          operator_id: string
          shift_id: string
          site_confirmado_id: string | null
          site_sugerido_id: string | null
          synced_at: string
          tipo: Database["public"]["Enums"]["reading_type"]
          valor_confirmado: number
          valor_ocr: number | null
        }
        Insert: {
          client_created_at?: string | null
          confianca?: number | null
          created_at?: string
          device_id?: string | null
          foto_path?: string | null
          gps_accuracy_m?: number | null
          id?: string
          integration_attempts?: number
          integration_last_attempt_at?: string | null
          integration_response?: Json | null
          integration_status?: Database["public"]["Enums"]["integration_status"]
          lat?: number | null
          lng?: number | null
          machine_id: string
          operator_id: string
          shift_id: string
          site_confirmado_id?: string | null
          site_sugerido_id?: string | null
          synced_at?: string
          tipo: Database["public"]["Enums"]["reading_type"]
          valor_confirmado: number
          valor_ocr?: number | null
        }
        Update: {
          client_created_at?: string | null
          confianca?: number | null
          created_at?: string
          device_id?: string | null
          foto_path?: string | null
          gps_accuracy_m?: number | null
          id?: string
          integration_attempts?: number
          integration_last_attempt_at?: string | null
          integration_response?: Json | null
          integration_status?: Database["public"]["Enums"]["integration_status"]
          lat?: number | null
          lng?: number | null
          machine_id?: string
          operator_id?: string
          shift_id?: string
          site_confirmado_id?: string | null
          site_sugerido_id?: string | null
          synced_at?: string
          tipo?: Database["public"]["Enums"]["reading_type"]
          valor_confirmado?: number
          valor_ocr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "readings_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readings_site_confirmado_id_fkey"
            columns: ["site_confirmado_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readings_site_sugerido_id_fkey"
            columns: ["site_sugerido_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          fim_at: string | null
          fim_horimetro: number | null
          id: string
          inicio_at: string | null
          inicio_horimetro: number | null
          machine_id: string
          observacoes: string | null
          operator_id: string
          site_id: string | null
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fim_at?: string | null
          fim_horimetro?: number | null
          id?: string
          inicio_at?: string | null
          inicio_horimetro?: number | null
          machine_id: string
          observacoes?: string | null
          operator_id: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fim_at?: string | null
          fim_horimetro?: number | null
          id?: string
          inicio_at?: string | null
          inicio_horimetro?: number | null
          machine_id?: string
          observacoes?: string | null
          operator_id?: string
          site_id?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          nome: string
          raio_m: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nome: string
          raio_m?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          nome?: string
          raio_m?: number
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
    }
    Enums: {
      app_role: "admin" | "operator"
      integration_status: "pendente" | "enviado" | "erro"
      reading_type: "inicio" | "fim"
      shift_status: "aberto" | "fechado" | "cancelado"
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
      app_role: ["admin", "operator"],
      integration_status: ["pendente", "enviado", "erro"],
      reading_type: ["inicio", "fim"],
      shift_status: ["aberto", "fechado", "cancelado"],
    },
  },
} as const
