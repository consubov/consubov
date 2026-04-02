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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      administradores: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string
          id: string
          nome: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email: string
          id?: string
          nome: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string
          user_id?: string | null
        }
        Relationships: []
      }
      capatazes: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string
          id: string
          nome: string
          retiro_id: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email: string
          id?: string
          nome: string
          retiro_id?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string
          retiro_id?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capatazes_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos: {
        Row: {
          ano: number
          criado_em: string | null
          fazenda_id: string
          fechado: boolean | null
          fechado_em: string | null
          id: string
          mes: number
          num_dias: number
        }
        Insert: {
          ano: number
          criado_em?: string | null
          fazenda_id: string
          fechado?: boolean | null
          fechado_em?: string | null
          id?: string
          mes: number
          num_dias?: number
        }
        Update: {
          ano?: number
          criado_em?: string | null
          fazenda_id?: string
          fechado?: boolean | null
          fechado_em?: string | null
          id?: string
          mes?: number
          num_dias?: number
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      fazendas: {
        Row: {
          administrador_id: string | null
          ativo: boolean | null
          cidade: string
          criado_em: string | null
          estado: string
          id: string
          intervalo_padrao_dias: number
          nome: string
        }
        Insert: {
          administrador_id?: string | null
          ativo?: boolean | null
          cidade: string
          criado_em?: string | null
          estado?: string
          id?: string
          intervalo_padrao_dias?: number
          nome: string
        }
        Update: {
          administrador_id?: string | null
          ativo?: boolean | null
          cidade?: string
          criado_em?: string | null
          estado?: string
          id?: string
          intervalo_padrao_dias?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "fazendas_administrador_id_fkey"
            columns: ["administrador_id"]
            isOneToOne: false
            referencedRelation: "administradores"
            referencedColumns: ["id"]
          },
        ]
      }
      gerentes: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string
          fazenda_id: string | null
          id: string
          nome: string
          retiro_id: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email: string
          fazenda_id?: string | null
          id?: string
          nome: string
          retiro_id?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string
          fazenda_id?: string | null
          id?: string
          nome?: string
          retiro_id?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gerentes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gerentes_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          capataz_nome: string | null
          categoria: string | null
          ciclo_id: string
          consumo_esperado_kg: number | null
          consumo_g_cab_dia: number | null
          consumo_real_kg: number | null
          custo_total: number | null
          dias_intervalo: number | null
          dias_no_pasto: number | null
          foto_url: string | null
          gmd_kg_dia: number | null
          id: string
          indice_consumo: number | null
          lancado_em: string | null
          num_animais: number
          num_sacos: number
          origem: string | null
          pasto_id: string
          peso_medio_kg: number | null
          produto_id: string | null
          sexo: string | null
          status_consumo: string | null
        }
        Insert: {
          capataz_nome?: string | null
          categoria?: string | null
          ciclo_id: string
          consumo_esperado_kg?: number | null
          consumo_g_cab_dia?: number | null
          consumo_real_kg?: number | null
          custo_total?: number | null
          dias_intervalo?: number | null
          dias_no_pasto?: number | null
          foto_url?: string | null
          gmd_kg_dia?: number | null
          id?: string
          indice_consumo?: number | null
          lancado_em?: string | null
          num_animais: number
          num_sacos?: number
          origem?: string | null
          pasto_id: string
          peso_medio_kg?: number | null
          produto_id?: string | null
          sexo?: string | null
          status_consumo?: string | null
        }
        Update: {
          capataz_nome?: string | null
          categoria?: string | null
          ciclo_id?: string
          consumo_esperado_kg?: number | null
          consumo_g_cab_dia?: number | null
          consumo_real_kg?: number | null
          custo_total?: number | null
          dias_intervalo?: number | null
          dias_no_pasto?: number | null
          foto_url?: string | null
          gmd_kg_dia?: number | null
          id?: string
          indice_consumo?: number | null
          lancado_em?: string | null
          num_animais?: number
          num_sacos?: number
          origem?: string | null
          pasto_id?: string
          peso_medio_kg?: number | null
          produto_id?: string | null
          sexo?: string | null
          status_consumo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      observacoes: {
        Row: {
          capataz_nome: string | null
          criado_em: string | null
          descricao: string | null
          fazenda_id: string
          foto_url: string | null
          id: string
          pasto_id: string | null
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por: string | null
          retiro_id: string | null
          tipo: string | null
        }
        Insert: {
          capataz_nome?: string | null
          criado_em?: string | null
          descricao?: string | null
          fazenda_id: string
          foto_url?: string | null
          id?: string
          pasto_id?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          retiro_id?: string | null
          tipo?: string | null
        }
        Update: {
          capataz_nome?: string | null
          criado_em?: string | null
          descricao?: string | null
          fazenda_id?: string
          foto_url?: string | null
          id?: string
          pasto_id?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por?: string | null
          retiro_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "observacoes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacoes_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observacoes_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      pastos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          criado_em: string | null
          dias_no_pasto: number | null
          gmd_kg_dia: number | null
          id: string
          nome: string
          num_animais: number
          peso_abate_meta_kg: number | null
          peso_medio_kg: number | null
          produto_id: string | null
          qr_uuid: string
          retiro_id: string
          sexo: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          criado_em?: string | null
          dias_no_pasto?: number | null
          gmd_kg_dia?: number | null
          id?: string
          nome: string
          num_animais?: number
          peso_abate_meta_kg?: number | null
          peso_medio_kg?: number | null
          produto_id?: string | null
          qr_uuid?: string
          retiro_id: string
          sexo?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          criado_em?: string | null
          dias_no_pasto?: number | null
          gmd_kg_dia?: number | null
          id?: string
          nome?: string
          num_animais?: number
          peso_abate_meta_kg?: number | null
          peso_medio_kg?: number | null
          produto_id?: string | null
          qr_uuid?: string
          retiro_id?: string
          sexo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pastos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastos_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          administrador_id: string | null
          ativo: boolean | null
          consumo_engorda: number | null
          consumo_recria1: number | null
          consumo_recria2: number | null
          criado_em: string | null
          id: string
          marca: string | null
          margem_engorda: number | null
          margem_recria1: number | null
          margem_recria2: number | null
          nome: string
          peso_saco_kg: number
          preco_por_kg: number | null
          tipo: string | null
        }
        Insert: {
          administrador_id?: string | null
          ativo?: boolean | null
          consumo_engorda?: number | null
          consumo_recria1?: number | null
          consumo_recria2?: number | null
          criado_em?: string | null
          id?: string
          marca?: string | null
          margem_engorda?: number | null
          margem_recria1?: number | null
          margem_recria2?: number | null
          nome: string
          peso_saco_kg?: number
          preco_por_kg?: number | null
          tipo?: string | null
        }
        Update: {
          administrador_id?: string | null
          ativo?: boolean | null
          consumo_engorda?: number | null
          consumo_recria1?: number | null
          consumo_recria2?: number | null
          criado_em?: string | null
          id?: string
          marca?: string | null
          margem_engorda?: number | null
          margem_recria1?: number | null
          margem_recria2?: number | null
          nome?: string
          peso_saco_kg?: number
          preco_por_kg?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_administrador_id_fkey"
            columns: ["administrador_id"]
            isOneToOne: false
            referencedRelation: "administradores"
            referencedColumns: ["id"]
          },
        ]
      }
      retiros: {
        Row: {
          alerta_atraso_enviado: boolean
          ativo: boolean | null
          capataz: string
          consumo_engorda: number | null
          consumo_recria1: number | null
          consumo_recria2: number | null
          criado_em: string | null
          estoque_sacos: number | null
          fazenda_id: string
          gmd_engorda: number | null
          gmd_recria1: number | null
          gmd_recria2: number | null
          id: string
          margem_engorda: number | null
          margem_recria1: number | null
          margem_recria2: number | null
          nome: string
          peso_abate_kg: number | null
          peso_saco_kg: number | null
          preco_por_kg: number | null
          produto_id: string | null
          sexo_padrao: string | null
          ultima_salga_em: string | null
        }
        Insert: {
          alerta_atraso_enviado?: boolean
          ativo?: boolean | null
          capataz: string
          consumo_engorda?: number | null
          consumo_recria1?: number | null
          consumo_recria2?: number | null
          criado_em?: string | null
          estoque_sacos?: number | null
          fazenda_id: string
          gmd_engorda?: number | null
          gmd_recria1?: number | null
          gmd_recria2?: number | null
          id?: string
          margem_engorda?: number | null
          margem_recria1?: number | null
          margem_recria2?: number | null
          nome: string
          peso_abate_kg?: number | null
          peso_saco_kg?: number | null
          preco_por_kg?: number | null
          produto_id?: string | null
          sexo_padrao?: string | null
          ultima_salga_em?: string | null
        }
        Update: {
          alerta_atraso_enviado?: boolean
          ativo?: boolean | null
          capataz?: string
          consumo_engorda?: number | null
          consumo_recria1?: number | null
          consumo_recria2?: number | null
          criado_em?: string | null
          estoque_sacos?: number | null
          fazenda_id?: string
          gmd_engorda?: number | null
          gmd_recria1?: number | null
          gmd_recria2?: number | null
          id?: string
          margem_engorda?: number | null
          margem_recria1?: number | null
          margem_recria2?: number | null
          nome?: string
          peso_abate_kg?: number | null
          peso_saco_kg?: number | null
          preco_por_kg?: number | null
          produto_id?: string | null
          sexo_padrao?: string | null
          ultima_salga_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retiros_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retiros_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots: {
        Row: {
          ano: number
          ciclo_id: string
          dados: Json
          fazenda_id: string
          gerado_em: string | null
          gerado_por: string | null
          id: string
          mes: number
        }
        Insert: {
          ano: number
          ciclo_id: string
          dados: Json
          fazenda_id: string
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          mes: number
        }
        Update: {
          ano?: number
          ciclo_id?: string
          dados?: Json
          fazenda_id?: string
          gerado_em?: string | null
          gerado_por?: string | null
          id?: string
          mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      teste: {
        Row: {
          id: number
          nome: string | null
        }
        Insert: {
          id?: number
          nome?: string | null
        }
        Update: {
          id?: number
          nome?: string | null
        }
        Relationships: []
      }
      visitas: {
        Row: {
          ciclo_id: string | null
          criado_em: string | null
          fazenda_id: string
          gerente_id: string | null
          id: string
          observacoes: string | null
          pdf_url: string | null
          recomendacoes: string | null
          titulo: string | null
          visitado_em: string | null
        }
        Insert: {
          ciclo_id?: string | null
          criado_em?: string | null
          fazenda_id: string
          gerente_id?: string | null
          id?: string
          observacoes?: string | null
          pdf_url?: string | null
          recomendacoes?: string | null
          titulo?: string | null
          visitado_em?: string | null
        }
        Update: {
          ciclo_id?: string | null
          criado_em?: string | null
          fazenda_id?: string
          gerente_id?: string | null
          id?: string
          observacoes?: string | null
          pdf_url?: string | null
          recomendacoes?: string | null
          titulo?: string | null
          visitado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_gerente_id_fkey"
            columns: ["gerente_id"]
            isOneToOne: false
            referencedRelation: "gerentes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_ciclo_atual: { Args: { p_fazenda_id: string }; Returns: string }
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
