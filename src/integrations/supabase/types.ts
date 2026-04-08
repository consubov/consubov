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
      abates: {
        Row: {
          ano: number
          created_at: string
          data: string
          fazenda_id: string
          id: string
          mes: number
          pasto_id: string
          quantidade: number
          retiro_id: string
          usuario_id: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          data?: string
          fazenda_id: string
          id?: string
          mes: number
          pasto_id: string
          quantidade: number
          retiro_id: string
          usuario_id?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          data?: string
          fazenda_id?: string
          id?: string
          mes?: number
          pasto_id?: string
          quantidade?: number
          retiro_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abates_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abates_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abates_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      administradores: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string
          id: string
          nome: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email: string
          id?: string
          nome: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
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
      ciclos_auditoria: {
        Row: {
          acao: string
          ciclo_id: string
          criado_em: string
          detalhes: Json | null
          fazenda_id: string
          id: string
          usuario_email: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          ciclo_id: string
          criado_em?: string
          detalhes?: Json | null
          fazenda_id: string
          id?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          ciclo_id?: string
          criado_em?: string
          detalhes?: Json | null
          fazenda_id?: string
          id?: string
          usuario_email?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      configuracoes_gerais: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          chave: string
          criado_em: string | null
          descricao: string | null
          formula: string | null
          id: string
          tipo: string
          titulo: string
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          chave: string
          criado_em?: string | null
          descricao?: string | null
          formula?: string | null
          id?: string
          tipo?: string
          titulo: string
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          chave?: string
          criado_em?: string | null
          descricao?: string | null
          formula?: string | null
          id?: string
          tipo?: string
          titulo?: string
          valor?: number | null
        }
        Relationships: []
      }
      configuracoes_historico: {
        Row: {
          alterado_por: string | null
          configuracao_id: string
          data: string | null
          id: string
          valor_antigo: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por?: string | null
          configuracao_id: string
          data?: string | null
          id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string | null
          configuracao_id?: string
          data?: string | null
          id?: string
          valor_antigo?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_historico_configuracao_id_fkey"
            columns: ["configuracao_id"]
            isOneToOne: false
            referencedRelation: "configuracoes_gerais"
            referencedColumns: ["id"]
          },
        ]
      }
      escritorios: {
        Row: {
          ativo: boolean
          criado_em: string | null
          email: string
          fazenda_id: string
          id: string
          nome: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string | null
          email: string
          fazenda_id: string
          id?: string
          nome: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string | null
          email?: string
          fazenda_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escritorios_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_retiro: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          quantidade_atual: number
          retiro_id: string
          ultimo_alerta_estoque: string | null
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          quantidade_atual?: number
          retiro_id: string
          ultimo_alerta_estoque?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          quantidade_atual?: number
          retiro_id?: string
          ultimo_alerta_estoque?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_retiro_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
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
          ano_referencia: number
          categoria: string | null
          consumo_g_cab_dia: number | null
          created_at: string
          dias_no_pasto: number
          fazenda_id: string
          id: string
          indice_consumo: number | null
          mes_referencia: number
          num_animais: number
          num_sacos: number
          origem: string
          pasto_id: string
          peso_medio_kg: number | null
          retiro_id: string
          sexo: string | null
          status_consumo: string | null
        }
        Insert: {
          ano_referencia: number
          categoria?: string | null
          consumo_g_cab_dia?: number | null
          created_at?: string
          dias_no_pasto?: number
          fazenda_id: string
          id?: string
          indice_consumo?: number | null
          mes_referencia: number
          num_animais?: number
          num_sacos?: number
          origem?: string
          pasto_id: string
          peso_medio_kg?: number | null
          retiro_id: string
          sexo?: string | null
          status_consumo?: string | null
        }
        Update: {
          ano_referencia?: number
          categoria?: string | null
          consumo_g_cab_dia?: number | null
          created_at?: string
          dias_no_pasto?: number
          fazenda_id?: string
          id?: string
          indice_consumo?: number | null
          mes_referencia?: number
          num_animais?: number
          num_sacos?: number
          origem?: string
          pasto_id?: string
          peso_medio_kg?: number | null
          retiro_id?: string
          sexo?: string | null
          status_consumo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_manuais_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_manuais_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_manuais_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_content: {
        Row: {
          atualizado_em: string | null
          chave: string
          id: string
          valor: string | null
        }
        Insert: {
          atualizado_em?: string | null
          chave: string
          id?: string
          valor?: string | null
        }
        Update: {
          atualizado_em?: string | null
          chave?: string
          id?: string
          valor?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          criado_em: string
          email: string
          id: string
          mensagem: string | null
          nome: string
          telefone: string
          whatsapp: string
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          mensagem?: string | null
          nome: string
          telefone: string
          whatsapp: string
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          mensagem?: string | null
          nome?: string
          telefone?: string
          whatsapp?: string
        }
        Relationships: []
      }
      mapas: {
        Row: {
          criado_em: string | null
          fazenda_id: string
          id: string
          imagem_url: string
        }
        Insert: {
          criado_em?: string | null
          fazenda_id: string
          id?: string
          imagem_url: string
        }
        Update: {
          criado_em?: string | null
          fazenda_id?: string
          id?: string
          imagem_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapas_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      mortalidades: {
        Row: {
          ano: number
          created_at: string
          data: string
          fazenda_id: string
          foto_url: string
          id: string
          mes: number
          observacao: string | null
          pasto_id: string
          quantidade: number
          retiro_id: string
          usuario_id: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          data?: string
          fazenda_id: string
          foto_url: string
          id?: string
          mes: number
          observacao?: string | null
          pasto_id: string
          quantidade: number
          retiro_id: string
          usuario_id?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          data?: string
          fazenda_id?: string
          foto_url?: string
          id?: string
          mes?: number
          observacao?: string | null
          pasto_id?: string
          quantidade?: number
          retiro_id?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      movimentacoes_animais: {
        Row: {
          ano: number
          created_at: string
          data: string
          fazenda_id: string
          id: string
          mes: number
          pasto_destino_id: string
          pasto_origem_id: string
          quantidade: number
          retiro_id: string
          usuario_id: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          data?: string
          fazenda_id: string
          id?: string
          mes: number
          pasto_destino_id: string
          pasto_origem_id: string
          quantidade: number
          retiro_id: string
          usuario_id?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          data?: string
          fazenda_id?: string
          id?: string
          mes?: number
          pasto_destino_id?: string
          pasto_origem_id?: string
          quantidade?: number
          retiro_id?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      movimentacoes_estoque: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          origem: string
          quantidade: number
          referencia_id: string | null
          retiro_id: string
          tipo: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          origem: string
          quantidade: number
          referencia_id?: string | null
          retiro_id: string
          tipo: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          origem?: string
          quantidade?: number
          referencia_id?: string | null
          retiro_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          dados: Json | null
          id: string
          lida: boolean
          mensagem: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          criado_em?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
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
      pastos_mapa: {
        Row: {
          coordenadas: Json
          criado_em: string | null
          id: string
          mapa_id: string
          pasto_id: string
        }
        Insert: {
          coordenadas?: Json
          criado_em?: string | null
          id?: string
          mapa_id: string
          pasto_id: string
        }
        Update: {
          coordenadas?: Json
          criado_em?: string | null
          id?: string
          mapa_id?: string
          pasto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pastos_mapa_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pastos_mapa_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          administrador_id: string | null
          ativo: boolean | null
          consumo_engorda: number | null
          consumo_por_100kg: number | null
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
          consumo_por_100kg?: number | null
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
          consumo_por_100kg?: number | null
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
      transferencias_estoque: {
        Row: {
          aprovado_por: string | null
          created_at: string
          id: string
          quantidade: number
          retiro_destino_id: string
          retiro_origem_id: string
          solicitado_por: string | null
          status: string
          tipo_acao: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          created_at?: string
          id?: string
          quantidade: number
          retiro_destino_id: string
          retiro_origem_id: string
          solicitado_por?: string | null
          status?: string
          tipo_acao: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          created_at?: string
          id?: string
          quantidade?: number
          retiro_destino_id?: string
          retiro_origem_id?: string
          solicitado_por?: string | null
          status?: string
          tipo_acao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_estoque_retiro_destino_id_fkey"
            columns: ["retiro_destino_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_estoque_retiro_origem_id_fkey"
            columns: ["retiro_origem_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
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
      ensure_ciclo: {
        Args: { p_ano: number; p_fazenda_id: string; p_mes: number }
        Returns: string
      }
      ensure_ciclo_atual: { Args: { p_fazenda_id: string }; Returns: string }
      get_escritorio_fazenda_id: { Args: { _user_id: string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_escritorio: { Args: { _user_id: string }; Returns: boolean }
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
