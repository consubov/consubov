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
      animais_pecuarista: {
        Row: {
          created_at: string | null
          id: string
          lote_atual_id: string
          numero: string
          pecuarista_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lote_atual_id: string
          numero: string
          pecuarista_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lote_atual_id?: string
          numero?: string
          pecuarista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "animais_pecuarista_lote_atual_id_fkey"
            columns: ["lote_atual_id"]
            isOneToOne: false
            referencedRelation: "lotes_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animais_pecuarista_pecuarista_id_fkey"
            columns: ["pecuarista_id"]
            isOneToOne: false
            referencedRelation: "pecuaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      apartacao_destinos_pecuarista: {
        Row: {
          apartacao_id: string
          created_at: string | null
          id: string
          lote_destino_id: string
          ordem: number
          peso_max: number | null
          peso_min: number | null
        }
        Insert: {
          apartacao_id: string
          created_at?: string | null
          id?: string
          lote_destino_id: string
          ordem: number
          peso_max?: number | null
          peso_min?: number | null
        }
        Update: {
          apartacao_id?: string
          created_at?: string | null
          id?: string
          lote_destino_id?: string
          ordem?: number
          peso_max?: number | null
          peso_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "apartacao_destinos_pecuarista_apartacao_id_fkey"
            columns: ["apartacao_id"]
            isOneToOne: false
            referencedRelation: "apartacoes_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartacao_destinos_pecuarista_lote_destino_id_fkey"
            columns: ["lote_destino_id"]
            isOneToOne: false
            referencedRelation: "lotes_pecuarista"
            referencedColumns: ["id"]
          },
        ]
      }
      apartacao_lotes: {
        Row: {
          apartacao_id: string
          created_at: string
          faixa_peso_max: number | null
          faixa_peso_min: number | null
          id: string
          media_kg: number | null
          nome_lote: string
          ordem: string
          pasto_destino_id: string | null
          quantidade: number
        }
        Insert: {
          apartacao_id: string
          created_at?: string
          faixa_peso_max?: number | null
          faixa_peso_min?: number | null
          id?: string
          media_kg?: number | null
          nome_lote: string
          ordem: string
          pasto_destino_id?: string | null
          quantidade?: number
        }
        Update: {
          apartacao_id?: string
          created_at?: string
          faixa_peso_max?: number | null
          faixa_peso_min?: number | null
          id?: string
          media_kg?: number | null
          nome_lote?: string
          ordem?: string
          pasto_destino_id?: string | null
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "apartacao_lotes_apartacao_id_fkey"
            columns: ["apartacao_id"]
            isOneToOne: false
            referencedRelation: "apartacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartacao_lotes_pasto_destino_id_fkey"
            columns: ["pasto_destino_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      apartacoes: {
        Row: {
          created_at: string
          data_apartacao: string
          id: string
          media_geral_kg: number
          observacoes: string | null
          pasto_origem_id: string | null
          quantidade_lotes: number
          retiro_id: string | null
          total_animais: number
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          data_apartacao?: string
          id?: string
          media_geral_kg: number
          observacoes?: string | null
          pasto_origem_id?: string | null
          quantidade_lotes: number
          retiro_id?: string | null
          total_animais: number
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          data_apartacao?: string
          id?: string
          media_geral_kg?: number
          observacoes?: string | null
          pasto_origem_id?: string | null
          quantidade_lotes?: number
          retiro_id?: string | null
          total_animais?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartacoes_pasto_origem_id_fkey"
            columns: ["pasto_origem_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartacoes_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      apartacoes_pecuarista: {
        Row: {
          created_at: string | null
          data_apartacao: string
          hora_inicio: string | null
          id: string
          lote_origem_id: string
          pdf_url: string | null
          pecuarista_id: string
          quantidade_lotes_destino: number
        }
        Insert: {
          created_at?: string | null
          data_apartacao?: string
          hora_inicio?: string | null
          id?: string
          lote_origem_id: string
          pdf_url?: string | null
          pecuarista_id: string
          quantidade_lotes_destino: number
        }
        Update: {
          created_at?: string | null
          data_apartacao?: string
          hora_inicio?: string | null
          id?: string
          lote_origem_id?: string
          pdf_url?: string | null
          pecuarista_id?: string
          quantidade_lotes_destino?: number
        }
        Relationships: [
          {
            foreignKeyName: "apartacoes_pecuarista_lote_origem_id_fkey"
            columns: ["lote_origem_id"]
            isOneToOne: false
            referencedRelation: "lotes_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartacoes_pecuarista_pecuarista_id_fkey"
            columns: ["pecuarista_id"]
            isOneToOne: false
            referencedRelation: "pecuaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_conferencias: {
        Row: {
          created_at: string
          fazenda_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          pasto_id: string | null
          perfil: string | null
          qr_code: string
          retiro_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fazenda_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          pasto_id?: string | null
          perfil?: string | null
          qr_code: string
          retiro_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fazenda_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          pasto_id?: string | null
          perfil?: string | null
          qr_code?: string
          retiro_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_conferencias_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_conferencias_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_conferencias_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_sorteios: {
        Row: {
          bloco: number
          fazenda_id: string
          gerado_em: string
          id: string
          posicoes_com_foto: Json
          retiro_id: string
        }
        Insert: {
          bloco: number
          fazenda_id: string
          gerado_em?: string
          id?: string
          posicoes_com_foto?: Json
          retiro_id: string
        }
        Update: {
          bloco?: number
          fazenda_id?: string
          gerado_em?: string
          id?: string
          posicoes_com_foto?: Json
          retiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_sorteios_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_sorteios_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_fabrica_visita: {
        Row: {
          created_at: string
          id: string
          organizacao_fabrica_nota: number | null
          organizacao_insumos_nota: number | null
          updated_at: string
          visita_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organizacao_fabrica_nota?: number | null
          organizacao_insumos_nota?: number | null
          updated_at?: string
          visita_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organizacao_fabrica_nota?: number | null
          organizacao_insumos_nota?: number | null
          updated_at?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_fabrica_visita_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_fabrica_quesito: {
        Row: {
          created_at: string
          id: string
          nota: number
          quesito: string
          updated_at: string
          visita_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nota: number
          quesito: string
          updated_at?: string
          visita_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nota?: number
          quesito?: string
          updated_at?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_fabrica_quesito_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_score: {
        Row: {
          id: string
          nota: number
          tipo: string
          visita_curral_id: string | null
          visita_pasto_id: string | null
        }
        Insert: {
          id?: string
          nota: number
          tipo: string
          visita_curral_id?: string | null
          visita_pasto_id?: string | null
        }
        Update: {
          id?: string
          nota?: number
          tipo?: string
          visita_curral_id?: string | null
          visita_pasto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_score_visita_curral_id_fkey"
            columns: ["visita_curral_id"]
            isOneToOne: false
            referencedRelation: "visita_currais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_score_visita_pasto_id_fkey"
            columns: ["visita_pasto_id"]
            isOneToOne: false
            referencedRelation: "visita_pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      batidas: {
        Row: {
          criado_em: string | null
          data_finalizacao: string | null
          data_inicio: string
          fabrica_id: string
          formula_id: string
          foto_finalizacao_url: string | null
          foto_inicio_url: string | null
          hora_finalizacao: string | null
          hora_inicio: string | null
          id: string
          observacao: string | null
          operador_id: string | null
          quantidade_produzida: number | null
          status: string | null
        }
        Insert: {
          criado_em?: string | null
          data_finalizacao?: string | null
          data_inicio: string
          fabrica_id: string
          formula_id: string
          foto_finalizacao_url?: string | null
          foto_inicio_url?: string | null
          hora_finalizacao?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          operador_id?: string | null
          quantidade_produzida?: number | null
          status?: string | null
        }
        Update: {
          criado_em?: string | null
          data_finalizacao?: string | null
          data_inicio?: string
          fabrica_id?: string
          formula_id?: string
          foto_finalizacao_url?: string | null
          foto_inicio_url?: string | null
          hora_finalizacao?: string | null
          hora_inicio?: string | null
          id?: string
          observacao?: string | null
          operador_id?: string | null
          quantidade_produzida?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batidas_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batidas_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas_fabrica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batidas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "operadores_fabrica"
            referencedColumns: ["id"]
          },
        ]
      }
      batidas_producao: {
        Row: {
          batida_id: string
          criado_em: string | null
          id: string
          materia_prima_id: string
          quantidade_esperada: number
          quantidade_utilizada: number | null
        }
        Insert: {
          batida_id: string
          criado_em?: string | null
          id?: string
          materia_prima_id: string
          quantidade_esperada: number
          quantidade_utilizada?: number | null
        }
        Update: {
          batida_id?: string
          criado_em?: string | null
          id?: string
          materia_prima_id?: string
          quantidade_esperada?: number
          quantidade_utilizada?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batidas_producao_batida_id_fkey"
            columns: ["batida_id"]
            isOneToOne: false
            referencedRelation: "batidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batidas_producao_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "materias_primas"
            referencedColumns: ["id"]
          },
        ]
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
      categorias_pecuarista: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          pecuarista_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          pecuarista_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          pecuarista_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_pecuarista_pecuarista_id_fkey"
            columns: ["pecuarista_id"]
            isOneToOne: false
            referencedRelation: "pecuaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos: {
        Row: {
          ano: number
          criado_em: string | null
          data_fim: string | null
          data_inicio: string | null
          duracao_dias: number | null
          fazenda_id: string
          fechado: boolean | null
          fechado_em: string | null
          id: string
          mes: number
          num_dias: number
          retiro_id: string | null
        }
        Insert: {
          ano: number
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          duracao_dias?: number | null
          fazenda_id: string
          fechado?: boolean | null
          fechado_em?: string | null
          id?: string
          mes: number
          num_dias?: number
          retiro_id?: string | null
        }
        Update: {
          ano?: number
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          duracao_dias?: number | null
          fazenda_id?: string
          fechado?: boolean | null
          fechado_em?: string | null
          id?: string
          mes?: number
          num_dias?: number
          retiro_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ciclos_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclos_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
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
      clientes_pesador: {
        Row: {
          cidade: string | null
          created_at: string | null
          id: string
          nome: string
          nome_fazenda: string | null
          pesador_id: string
          telefone: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          id?: string
          nome: string
          nome_fazenda?: string | null
          pesador_id: string
          telefone?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          nome_fazenda?: string | null
          pesador_id?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_pesador_pesador_id_fkey"
            columns: ["pesador_id"]
            isOneToOne: false
            referencedRelation: "pesadores"
            referencedColumns: ["id"]
          },
        ]
      }
      conferencias_checklist: {
        Row: {
          cocho_abastecido: boolean
          cocho_danificado: boolean
          cocho_parcial: boolean
          cocho_vazio: boolean
          created_at: string
          fazenda_id: string | null
          fotos: string[]
          id: string
          necessita_atencao: boolean
          observacoes: string | null
          pasto_id: string | null
          perfil: string | null
          placa_qr_danificada: boolean
          placa_qr_presente: boolean
          qtd_compativel: boolean
          qtd_divergente: boolean
          retiro_id: string | null
          user_id: string
        }
        Insert: {
          cocho_abastecido?: boolean
          cocho_danificado?: boolean
          cocho_parcial?: boolean
          cocho_vazio?: boolean
          created_at?: string
          fazenda_id?: string | null
          fotos?: string[]
          id?: string
          necessita_atencao?: boolean
          observacoes?: string | null
          pasto_id?: string | null
          perfil?: string | null
          placa_qr_danificada?: boolean
          placa_qr_presente?: boolean
          qtd_compativel?: boolean
          qtd_divergente?: boolean
          retiro_id?: string | null
          user_id: string
        }
        Update: {
          cocho_abastecido?: boolean
          cocho_danificado?: boolean
          cocho_parcial?: boolean
          cocho_vazio?: boolean
          created_at?: string
          fazenda_id?: string | null
          fotos?: string[]
          id?: string
          necessita_atencao?: boolean
          observacoes?: string | null
          pasto_id?: string | null
          perfil?: string | null
          placa_qr_danificada?: boolean
          placa_qr_presente?: boolean
          qtd_compativel?: boolean
          qtd_divergente?: boolean
          retiro_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conferencias_checklist_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_checklist_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conferencias_checklist_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
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
      consultores: {
        Row: {
          ativo: boolean
          created_at: string
          demo_criado_em: string | null
          id: string
          is_demo: boolean
          logo_direita_url: string | null
          logo_esquerda_url: string | null
          logo_modo: string
          logo_personalizada_url: string | null
          modulo_despesas_ativo: boolean
          nome: string
          profissao: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          demo_criado_em?: string | null
          id?: string
          is_demo?: boolean
          logo_direita_url?: string | null
          logo_esquerda_url?: string | null
          logo_modo?: string
          logo_personalizada_url?: string | null
          modulo_despesas_ativo?: boolean
          nome: string
          profissao?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          demo_criado_em?: string | null
          id?: string
          is_demo?: boolean
          logo_direita_url?: string | null
          logo_esquerda_url?: string | null
          logo_modo?: string
          logo_personalizada_url?: string | null
          modulo_despesas_ativo?: boolean
          nome?: string
          profissao?: string | null
          user_id?: string
        }
        Relationships: []
      }
      despesas_combustivel: {
        Row: {
          consultor_id: string
          created_at: string
          data_despesa: string
          foto_cupom_url: string
          id: string
          relatorio_despesa_id: string | null
          valor: number
        }
        Insert: {
          consultor_id: string
          created_at?: string
          data_despesa?: string
          foto_cupom_url: string
          id?: string
          relatorio_despesa_id?: string | null
          valor?: number
        }
        Update: {
          consultor_id?: string
          created_at?: string
          data_despesa?: string
          foto_cupom_url?: string
          id?: string
          relatorio_despesa_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_combustivel_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_combustivel_relatorio_despesa_id_fkey"
            columns: ["relatorio_despesa_id"]
            isOneToOne: false
            referencedRelation: "relatorios_despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      dieta_categorias: {
        Row: {
          consultor_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          consultor_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          consultor_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "dieta_categorias_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      elementos_mapa: {
        Row: {
          criado_em: string | null
          emoji: string
          id: string
          mapa_id: string
          posicao_x: number
          posicao_y: number
          rotulo: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string | null
          emoji?: string
          id?: string
          mapa_id: string
          posicao_x: number
          posicao_y: number
          rotulo?: string | null
          tipo?: string
        }
        Update: {
          criado_em?: string | null
          emoji?: string
          id?: string
          mapa_id?: string
          posicao_x?: number
          posicao_y?: number
          rotulo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "elementos_mapa_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas"
            referencedColumns: ["id"]
          },
        ]
      }
      entradas_materias_primas: {
        Row: {
          criado_em: string | null
          data_entrada: string
          fabrica_id: string
          foto_url: string | null
          id: string
          materia_prima_id: string
          observacao: string | null
          quantidade: number
          registrado_por: string | null
        }
        Insert: {
          criado_em?: string | null
          data_entrada?: string
          fabrica_id: string
          foto_url?: string | null
          id?: string
          materia_prima_id: string
          observacao?: string | null
          quantidade: number
          registrado_por?: string | null
        }
        Update: {
          criado_em?: string | null
          data_entrada?: string
          fabrica_id?: string
          foto_url?: string | null
          id?: string
          materia_prima_id?: string
          observacao?: string | null
          quantidade?: number
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entradas_materias_primas_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_materias_primas_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "materias_primas"
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
      estoque_produto_acabado: {
        Row: {
          criado_em: string | null
          fabrica_id: string
          id: string
          produto_id: string
          quantidade_kg: number | null
          quantidade_sacos: number | null
        }
        Insert: {
          criado_em?: string | null
          fabrica_id: string
          id?: string
          produto_id: string
          quantidade_kg?: number | null
          quantidade_sacos?: number | null
        }
        Update: {
          criado_em?: string | null
          fabrica_id?: string
          id?: string
          produto_id?: string
          quantidade_kg?: number | null
          quantidade_sacos?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produto_acabado_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_produto_acabado_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
      eventos_lote: {
        Row: {
          criado_em: string
          dados: Json | null
          data_evento: string
          id: string
          lote_id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          dados?: Json | null
          data_evento?: string
          id?: string
          lote_id: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          dados?: Json | null
          data_evento?: string
          id?: string
          lote_id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_lote_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_sanitarios: {
        Row: {
          aplicador_id: string | null
          categoria: string
          data_aplicacao: string
          data_fim_carencia: string | null
          dias_carencia: number | null
          dose: string
          evento_id: string
          id: string
          lote_completo: boolean
          lote_id: string
          medicamento: string
          quantidade_tratada: number | null
          tem_carencia: boolean
        }
        Insert: {
          aplicador_id?: string | null
          categoria: string
          data_aplicacao?: string
          data_fim_carencia?: string | null
          dias_carencia?: number | null
          dose: string
          evento_id: string
          id?: string
          lote_completo?: boolean
          lote_id: string
          medicamento: string
          quantidade_tratada?: number | null
          tem_carencia?: boolean
        }
        Update: {
          aplicador_id?: string | null
          categoria?: string
          data_aplicacao?: string
          data_fim_carencia?: string | null
          dias_carencia?: number | null
          dose?: string
          evento_id?: string
          id?: string
          lote_completo?: boolean
          lote_id?: string
          medicamento?: string
          quantidade_tratada?: number | null
          tem_carencia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "eventos_sanitarios_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_sanitarios_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_destinos: {
        Row: {
          criado_em: string | null
          fabrica_id: string
          fazenda_id: string | null
          id: string
          retiro_id: string | null
        }
        Insert: {
          criado_em?: string | null
          fabrica_id: string
          fazenda_id?: string | null
          id?: string
          retiro_id?: string | null
        }
        Update: {
          criado_em?: string | null
          fabrica_id?: string
          fazenda_id?: string | null
          id?: string
          retiro_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_destinos_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_destinos_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_destinos_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      fabricas: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          qr_code: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          qr_code?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          qr_code?: string | null
        }
        Relationships: []
      }
      fazendas: {
        Row: {
          administrador_id: string | null
          ativo: boolean | null
          auditoria_fotos_por_bloco: number
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
          auditoria_fotos_por_bloco?: number
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
          auditoria_fotos_por_bloco?: number
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
      fazendas_consultor: {
        Row: {
          consultor_id: string
          created_at: string
          deleted_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          municipio: string | null
          nome_fazenda: string
          proprietario: string | null
          responsavel: string | null
          uf: string | null
        }
        Insert: {
          consultor_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome_fazenda: string
          proprietario?: string | null
          responsavel?: string | null
          uf?: string | null
        }
        Update: {
          consultor_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nome_fazenda?: string
          proprietario?: string | null
          responsavel?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fazendas_consultor_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
        ]
      }
      fazendas_pecuarista: {
        Row: {
          cidade: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          nome_fazenda: string
          pecuarista_id: string
          uf: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome_fazenda: string
          pecuarista_id: string
          uf?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          nome_fazenda?: string
          pecuarista_id?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fazendas_pecuarista_pecuarista_id_fkey"
            columns: ["pecuarista_id"]
            isOneToOne: false
            referencedRelation: "pecuaristas"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_ingredientes: {
        Row: {
          criado_em: string | null
          formula_id: string
          id: string
          materia_prima_id: string
          quantidade: number
        }
        Insert: {
          criado_em?: string | null
          formula_id: string
          id?: string
          materia_prima_id: string
          quantidade: number
        }
        Update: {
          criado_em?: string | null
          formula_id?: string
          id?: string
          materia_prima_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_ingredientes_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas_fabrica"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_ingredientes_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "materias_primas"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas_fabrica: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          fabrica_id: string
          id: string
          nome: string
          peso_batida: number
          peso_por_saco: number
          producao_esperada: number
          produto_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          fabrica_id: string
          id?: string
          nome: string
          peso_batida: number
          peso_por_saco: number
          producao_esperada: number
          produto_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          fabrica_id?: string
          id?: string
          nome?: string
          peso_batida?: number
          peso_por_saco?: number
          producao_esperada?: number
          produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formulas_fabrica_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulas_fabrica_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas_sistema: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          chave: string
          criado_em: string
          descricao: string | null
          formula: string
          id: string
          nome: string
          parametros: Json | null
          variaveis: string[]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria: string
          chave: string
          criado_em?: string
          descricao?: string | null
          formula: string
          id?: string
          nome: string
          parametros?: Json | null
          variaveis?: string[]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          chave?: string
          criado_em?: string
          descricao?: string | null
          formula?: string
          id?: string
          nome?: string
          parametros?: Json | null
          variaveis?: string[]
        }
        Relationships: []
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
      indicadores_zootecnicos: {
        Row: {
          animais_ativos: number | null
          created_at: string
          currais_ocupados: number | null
          id: string
          updated_at: string
          visita_id: string
        }
        Insert: {
          animais_ativos?: number | null
          created_at?: string
          currais_ocupados?: number | null
          id?: string
          updated_at?: string
          visita_id: string
        }
        Update: {
          animais_ativos?: number | null
          created_at?: string
          currais_ocupados?: number | null
          id?: string
          updated_at?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicadores_zootecnicos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: true
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_zootecnicos_faixa: {
        Row: {
          consumo_medio_pv: number | null
          created_at: string
          faixa: string
          id: string
          indicadores_zootecnicos_id: string
          ordem: number
          quantidade_animais: number | null
          updated_at: string
        }
        Insert: {
          consumo_medio_pv?: number | null
          created_at?: string
          faixa: string
          id?: string
          indicadores_zootecnicos_id: string
          ordem: number
          quantidade_animais?: number | null
          updated_at?: string
        }
        Update: {
          consumo_medio_pv?: number | null
          created_at?: string
          faixa?: string
          id?: string
          indicadores_zootecnicos_id?: string
          ordem?: number
          quantidade_animais?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicadores_zootecnicos_faixa_indicadores_zootecnicos_id_fkey"
            columns: ["indicadores_zootecnicos_id"]
            isOneToOne: false
            referencedRelation: "indicadores_zootecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventarios_fabrica: {
        Row: {
          criado_em: string | null
          data_inventario: string
          divergencia_percentual: number | null
          divergencia_sacos: number | null
          estoque_real_sacos: number
          estoque_teorico_sacos: number
          fabrica_id: string
          formula_id: string
          foto_url: string | null
          id: string
          observacao: string | null
          realizado_por: string | null
        }
        Insert: {
          criado_em?: string | null
          data_inventario?: string
          divergencia_percentual?: number | null
          divergencia_sacos?: number | null
          estoque_real_sacos: number
          estoque_teorico_sacos: number
          fabrica_id: string
          formula_id: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          realizado_por?: string | null
        }
        Update: {
          criado_em?: string | null
          data_inventario?: string
          divergencia_percentual?: number | null
          divergencia_sacos?: number | null
          estoque_real_sacos?: number
          estoque_teorico_sacos?: number
          fabrica_id?: string
          formula_id?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          realizado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventarios_fabrica_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventarios_fabrica_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas_fabrica"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos: {
        Row: {
          ano_referencia: number
          aprovado_em: string | null
          aprovado_por: string | null
          categoria: string | null
          ciclo_id: string | null
          ciclo_id_legado: string | null
          cobertura_dias_override: number | null
          cocho_cheio: boolean
          consumo_g_cab_dia: number | null
          created_at: string
          criado_por: string | null
          data_salga_informada: string | null
          dias_no_pasto: number
          fazenda_id: string
          foto_cocho_url: string | null
          id: string
          indice_consumo: number | null
          mes_referencia: number
          motivo_recusa: string | null
          num_animais: number
          num_sacos: number
          observacao: string | null
          ocupacao_id: string | null
          origem: string
          pasto_id: string
          peso_medio_kg: number | null
          retiro_id: string
          sexo: string | null
          status_aprovacao: string | null
          status_consumo: string | null
        }
        Insert: {
          ano_referencia: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: string | null
          ciclo_id?: string | null
          ciclo_id_legado?: string | null
          cobertura_dias_override?: number | null
          cocho_cheio?: boolean
          consumo_g_cab_dia?: number | null
          created_at?: string
          criado_por?: string | null
          data_salga_informada?: string | null
          dias_no_pasto?: number
          fazenda_id: string
          foto_cocho_url?: string | null
          id?: string
          indice_consumo?: number | null
          mes_referencia: number
          motivo_recusa?: string | null
          num_animais?: number
          num_sacos?: number
          observacao?: string | null
          ocupacao_id?: string | null
          origem?: string
          pasto_id: string
          peso_medio_kg?: number | null
          retiro_id: string
          sexo?: string | null
          status_aprovacao?: string | null
          status_consumo?: string | null
        }
        Update: {
          ano_referencia?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          categoria?: string | null
          ciclo_id?: string | null
          ciclo_id_legado?: string | null
          cobertura_dias_override?: number | null
          cocho_cheio?: boolean
          consumo_g_cab_dia?: number | null
          created_at?: string
          criado_por?: string | null
          data_salga_informada?: string | null
          dias_no_pasto?: number
          fazenda_id?: string
          foto_cocho_url?: string | null
          id?: string
          indice_consumo?: number | null
          mes_referencia?: number
          motivo_recusa?: string | null
          num_animais?: number
          num_sacos?: number
          observacao?: string | null
          ocupacao_id?: string | null
          origem?: string
          pasto_id?: string
          peso_medio_kg?: number | null
          retiro_id?: string
          sexo?: string | null
          status_aprovacao?: string | null
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
          {
            foreignKeyName: "lancamentos_ocupacao_id_fkey"
            columns: ["ocupacao_id"]
            isOneToOne: false
            referencedRelation: "ocupacoes_pasto"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_content: {
        Row: {
          atualizado_em: string | null
          chave: string
          id: string
          landing_slug: string
          valor: string | null
        }
        Insert: {
          atualizado_em?: string | null
          chave: string
          id?: string
          landing_slug?: string
          valor?: string | null
        }
        Update: {
          atualizado_em?: string | null
          chave?: string
          id?: string
          landing_slug?: string
          valor?: string | null
        }
        Relationships: []
      }
      landing_parceiros: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          landing_slug: string
          logo_url: string | null
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          landing_slug?: string
          logo_url?: string | null
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          landing_slug?: string
          logo_url?: string | null
          nome?: string
          ordem?: number
          updated_at?: string
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
      leituras_balancao_pecuarista: {
        Row: {
          created_at: string | null
          id: string
          ordem: number
          pesagem_lote_id: string
          peso_individual: number
          peso_total: number
          quantidade_animais: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          ordem: number
          pesagem_lote_id: string
          peso_individual: number
          peso_total: number
          quantidade_animais: number
        }
        Update: {
          created_at?: string | null
          id?: string
          ordem?: number
          pesagem_lote_id?: string
          peso_individual?: number
          peso_total?: number
          quantidade_animais?: number
        }
        Relationships: [
          {
            foreignKeyName: "leituras_balancao_pecuarista_pesagem_lote_id_fkey"
            columns: ["pesagem_lote_id"]
            isOneToOne: false
            referencedRelation: "pesagens_lote_pecuarista"
            referencedColumns: ["id"]
          },
        ]
      }
      leituras_balancao_pesador: {
        Row: {
          created_at: string | null
          id: string
          ordem: number
          pesagem_id: string
          peso_individual: number
          peso_total: number
          quantidade_animais: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          ordem: number
          pesagem_id: string
          peso_individual: number
          peso_total: number
          quantidade_animais: number
        }
        Update: {
          created_at?: string | null
          id?: string
          ordem?: number
          pesagem_id?: string
          peso_individual?: number
          peso_total?: number
          quantidade_animais?: number
        }
        Relationships: [
          {
            foreignKeyName: "leituras_balancao_pesador_pesagem_id_fkey"
            columns: ["pesagem_id"]
            isOneToOne: false
            referencedRelation: "pesagens_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      linhas_mapa: {
        Row: {
          coordenadas: Json
          cor: string
          criado_em: string | null
          id: string
          mapa_id: string
          rotulo: string | null
          tipo: string
        }
        Insert: {
          coordenadas?: Json
          cor?: string
          criado_em?: string | null
          id?: string
          mapa_id: string
          rotulo?: string | null
          tipo?: string
        }
        Update: {
          coordenadas?: Json
          cor?: string
          criado_em?: string | null
          id?: string
          mapa_id?: string
          rotulo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "linhas_mapa_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          ativo: boolean
          categoria: string | null
          criado_em: string
          encerrado_em: string | null
          fazenda_id: string
          id: string
          num_animais: number | null
          origem: string
          pasto_id: string | null
          peso_medio_kg: number | null
          retiro_id: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          criado_em?: string
          encerrado_em?: string | null
          fazenda_id: string
          id?: string
          num_animais?: number | null
          origem?: string
          pasto_id?: string | null
          peso_medio_kg?: number | null
          retiro_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          criado_em?: string
          encerrado_em?: string | null
          fazenda_id?: string
          id?: string
          num_animais?: number | null
          origem?: string
          pasto_id?: string | null
          peso_medio_kg?: number | null
          retiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_pecuarista: {
        Row: {
          categoria: string
          categoria_customizada_id: string | null
          codigo: string
          created_at: string | null
          encerrado_at: string | null
          fazenda_id: string
          id: string
          identificado: boolean
          nome_lote: string
          pecuarista_id: string
          status: string
        }
        Insert: {
          categoria: string
          categoria_customizada_id?: string | null
          codigo: string
          created_at?: string | null
          encerrado_at?: string | null
          fazenda_id: string
          id?: string
          identificado?: boolean
          nome_lote: string
          pecuarista_id: string
          status?: string
        }
        Update: {
          categoria?: string
          categoria_customizada_id?: string | null
          codigo?: string
          created_at?: string | null
          encerrado_at?: string | null
          fazenda_id?: string
          id?: string
          identificado?: boolean
          nome_lote?: string
          pecuarista_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_pecuarista_categoria_customizada_id_fkey"
            columns: ["categoria_customizada_id"]
            isOneToOne: false
            referencedRelation: "categorias_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_pecuarista_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_pecuarista_pecuarista_id_fkey"
            columns: ["pecuarista_id"]
            isOneToOne: false
            referencedRelation: "pecuaristas"
            referencedColumns: ["id"]
          },
        ]
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
      materias_primas: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          fabrica_id: string
          id: string
          nome: string
          peso_por_saco: number | null
          unidade: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          fabrica_id: string
          id?: string
          nome: string
          peso_por_saco?: number | null
          unidade: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          fabrica_id?: string
          id?: string
          nome?: string
          peso_por_saco?: number | null
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "materias_primas_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
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
          foto_brinco_url: string | null
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
          foto_brinco_url?: string | null
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
          foto_brinco_url?: string | null
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
          categoria: string | null
          created_at: string
          data: string
          fazenda_id: string
          id: string
          mes: number
          pasto_destino_id: string
          pasto_origem_id: string
          peso_medio: number | null
          quantidade: number
          retiro_id: string
          usuario_id: string | null
        }
        Insert: {
          ano: number
          categoria?: string | null
          created_at?: string
          data?: string
          fazenda_id: string
          id?: string
          mes: number
          pasto_destino_id: string
          pasto_origem_id: string
          peso_medio?: number | null
          quantidade: number
          retiro_id: string
          usuario_id?: string | null
        }
        Update: {
          ano?: number
          categoria?: string | null
          created_at?: string
          data?: string
          fazenda_id?: string
          id?: string
          mes?: number
          pasto_destino_id?: string
          pasto_origem_id?: string
          peso_medio?: number | null
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
          fazenda_id: string | null
          id: string
          lida: boolean
          mensagem: string | null
          modulo: string
          tipo: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          dados?: Json | null
          fazenda_id?: string | null
          id?: string
          lida?: boolean
          mensagem?: string | null
          modulo?: string
          tipo?: string
          titulo: string
        }
        Update: {
          criado_em?: string
          dados?: Json | null
          fazenda_id?: string | null
          id?: string
          lida?: boolean
          mensagem?: string | null
          modulo?: string
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
      ocupacoes_pasto: {
        Row: {
          ciclo_id: string | null
          criado_em: string
          data_entrada: string
          data_saida: string | null
          fazenda_id: string
          id: string
          lote_id: string
          num_animais_entrada: number | null
          pasto_id: string
          produto_id: string | null
          retiro_id: string
        }
        Insert: {
          ciclo_id?: string | null
          criado_em?: string
          data_entrada: string
          data_saida?: string | null
          fazenda_id: string
          id?: string
          lote_id: string
          num_animais_entrada?: number | null
          pasto_id: string
          produto_id?: string | null
          retiro_id: string
        }
        Update: {
          ciclo_id?: string | null
          criado_em?: string
          data_entrada?: string
          data_saida?: string | null
          fazenda_id?: string
          id?: string
          lote_id?: string
          num_animais_entrada?: number | null
          pasto_id?: string
          produto_id?: string | null
          retiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocupacoes_pasto_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupacoes_pasto_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupacoes_pasto_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupacoes_pasto_pasto_id_fkey"
            columns: ["pasto_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupacoes_pasto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocupacoes_pasto_retiro_id_fkey"
            columns: ["retiro_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      operadores_fabrica: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          email: string | null
          fabrica_id: string
          id: string
          nome: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string | null
          fabrica_id: string
          id?: string
          nome: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          email?: string | null
          fabrica_id?: string
          id?: string
          nome?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operadores_fabrica_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
        ]
      }
      pastos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          criado_em: string | null
          data_entrada: string | null
          data_fim_carencia: string | null
          data_movimentacao: string | null
          dias_no_pasto: number | null
          gmd_kg_dia: number | null
          id: string
          nome: string
          num_animais: number
          pasto_origem_id: string | null
          peso_abate_meta_kg: number | null
          peso_entrada: number | null
          peso_medio_kg: number | null
          produto_id: string | null
          qr_uuid: string
          retiro_id: string
          sexo: string | null
          ultima_pesagem_em: string | null
          ultimo_evento_sanitario_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          criado_em?: string | null
          data_entrada?: string | null
          data_fim_carencia?: string | null
          data_movimentacao?: string | null
          dias_no_pasto?: number | null
          gmd_kg_dia?: number | null
          id?: string
          nome: string
          num_animais?: number
          pasto_origem_id?: string | null
          peso_abate_meta_kg?: number | null
          peso_entrada?: number | null
          peso_medio_kg?: number | null
          produto_id?: string | null
          qr_uuid?: string
          retiro_id: string
          sexo?: string | null
          ultima_pesagem_em?: string | null
          ultimo_evento_sanitario_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          criado_em?: string | null
          data_entrada?: string | null
          data_fim_carencia?: string | null
          data_movimentacao?: string | null
          dias_no_pasto?: number | null
          gmd_kg_dia?: number | null
          id?: string
          nome?: string
          num_animais?: number
          pasto_origem_id?: string | null
          peso_abate_meta_kg?: number | null
          peso_entrada?: number | null
          peso_medio_kg?: number | null
          produto_id?: string | null
          qr_uuid?: string
          retiro_id?: string
          sexo?: string | null
          ultima_pesagem_em?: string | null
          ultimo_evento_sanitario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pastos_pasto_origem_id_fkey"
            columns: ["pasto_origem_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "pastos_ultimo_evento_sanitario_id_fkey"
            columns: ["ultimo_evento_sanitario_id"]
            isOneToOne: false
            referencedRelation: "eventos_sanitarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pastos_mapa: {
        Row: {
          coordenadas: Json
          cor: string
          criado_em: string | null
          id: string
          mapa_id: string
          pasto_id: string
        }
        Insert: {
          coordenadas?: Json
          cor?: string
          criado_em?: string | null
          id?: string
          mapa_id: string
          pasto_id: string
        }
        Update: {
          coordenadas?: Json
          cor?: string
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
      pecuaristas: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          nome: string
          nome_empresa: string | null
          telefone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          nome_empresa?: string | null
          telefone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_empresa?: string | null
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pesadores: {
        Row: {
          ativo: boolean
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          nome: string
          nome_empresa: string | null
          telefone: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          nome_empresa?: string | null
          telefone?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_empresa?: string | null
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pesagens: {
        Row: {
          data_pesagem: string
          evento_id: string
          id: string
          lote_id: string
          media_calculada: number | null
          peso_medio_aplicado: number | null
          pesos: Json
          quantidade_animais: number | null
          total_pesado: number
          usuario_id: string | null
        }
        Insert: {
          data_pesagem?: string
          evento_id: string
          id?: string
          lote_id: string
          media_calculada?: number | null
          peso_medio_aplicado?: number | null
          pesos?: Json
          quantidade_animais?: number | null
          total_pesado?: number
          usuario_id?: string | null
        }
        Update: {
          data_pesagem?: string
          evento_id?: string
          id?: string
          lote_id?: string
          media_calculada?: number | null
          peso_medio_aplicado?: number | null
          pesos?: Json
          quantidade_animais?: number | null
          total_pesado?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesagens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      pesagens_compra: {
        Row: {
          categoria: string
          cliente_id: string
          created_at: string | null
          finalizada_at: string | null
          id: string
          modo_percentual: string | null
          pdf_url: string | null
          percentual_fixo: number | null
          pesador_id: string
          preco_arroba: number | null
          preco_fixo_animal: number | null
          preco_kg: number | null
          preco_valor: number | null
          quantidade_padrao_balancao: number | null
          sem_valores: boolean
          status: string
          tipo_balanca: string
          tipo_preco: string | null
          valor_total_pago: number | null
        }
        Insert: {
          categoria: string
          cliente_id: string
          created_at?: string | null
          finalizada_at?: string | null
          id?: string
          modo_percentual?: string | null
          pdf_url?: string | null
          percentual_fixo?: number | null
          pesador_id: string
          preco_arroba?: number | null
          preco_fixo_animal?: number | null
          preco_kg?: number | null
          preco_valor?: number | null
          quantidade_padrao_balancao?: number | null
          sem_valores?: boolean
          status?: string
          tipo_balanca?: string
          tipo_preco?: string | null
          valor_total_pago?: number | null
        }
        Update: {
          categoria?: string
          cliente_id?: string
          created_at?: string | null
          finalizada_at?: string | null
          id?: string
          modo_percentual?: string | null
          pdf_url?: string | null
          percentual_fixo?: number | null
          pesador_id?: string
          preco_arroba?: number | null
          preco_fixo_animal?: number | null
          preco_kg?: number | null
          preco_valor?: number | null
          quantidade_padrao_balancao?: number | null
          sem_valores?: boolean
          status?: string
          tipo_balanca?: string
          tipo_preco?: string | null
          valor_total_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_compra_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_pesador"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesagens_compra_pesador_id_fkey"
            columns: ["pesador_id"]
            isOneToOne: false
            referencedRelation: "pesadores"
            referencedColumns: ["id"]
          },
        ]
      }
      pesagens_compra_categorias: {
        Row: {
          categoria: string
          created_at: string | null
          id: string
          pesagem_id: string
          preco_valor: number
          tipo_preco: string
        }
        Insert: {
          categoria: string
          created_at?: string | null
          id?: string
          pesagem_id: string
          preco_valor: number
          tipo_preco: string
        }
        Update: {
          categoria?: string
          created_at?: string | null
          id?: string
          pesagem_id?: string
          preco_valor?: number
          tipo_preco?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_compra_categorias_pesagem_id_fkey"
            columns: ["pesagem_id"]
            isOneToOne: false
            referencedRelation: "pesagens_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      pesagens_lote_pecuarista: {
        Row: {
          apartacao_id: string | null
          created_at: string | null
          data_pesagem: string
          gmd: number | null
          hora_inicio: string | null
          id: string
          lote_id: string
          pdf_url: string | null
          peso_medio: number
          peso_total: number
          quantidade_animais: number
          quantidade_padrao_balancao: number | null
          tipo_balanca: string
        }
        Insert: {
          apartacao_id?: string | null
          created_at?: string | null
          data_pesagem?: string
          gmd?: number | null
          hora_inicio?: string | null
          id?: string
          lote_id: string
          pdf_url?: string | null
          peso_medio: number
          peso_total: number
          quantidade_animais: number
          quantidade_padrao_balancao?: number | null
          tipo_balanca?: string
        }
        Update: {
          apartacao_id?: string | null
          created_at?: string | null
          data_pesagem?: string
          gmd?: number | null
          hora_inicio?: string | null
          id?: string
          lote_id?: string
          pdf_url?: string | null
          peso_medio?: number
          peso_total?: number
          quantidade_animais?: number
          quantidade_padrao_balancao?: number | null
          tipo_balanca?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesagens_lote_pecuarista_apartacao_id_fkey"
            columns: ["apartacao_id"]
            isOneToOne: false
            referencedRelation: "apartacoes_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesagens_lote_pecuarista_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_pecuarista"
            referencedColumns: ["id"]
          },
        ]
      }
      pesos_animais_pecuarista: {
        Row: {
          animal_id: string
          created_at: string | null
          gmd_individual: number | null
          id: string
          leitura_balancao_id: string | null
          pesagem_lote_id: string
          peso_kg: number
        }
        Insert: {
          animal_id: string
          created_at?: string | null
          gmd_individual?: number | null
          id?: string
          leitura_balancao_id?: string | null
          pesagem_lote_id: string
          peso_kg: number
        }
        Update: {
          animal_id?: string
          created_at?: string | null
          gmd_individual?: number | null
          id?: string
          leitura_balancao_id?: string | null
          pesagem_lote_id?: string
          peso_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "pesos_animais_pecuarista_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animais_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesos_animais_pecuarista_leitura_balancao_id_fkey"
            columns: ["leitura_balancao_id"]
            isOneToOne: false
            referencedRelation: "leituras_balancao_pecuarista"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesos_animais_pecuarista_pesagem_lote_id_fkey"
            columns: ["pesagem_lote_id"]
            isOneToOne: false
            referencedRelation: "pesagens_lote_pecuarista"
            referencedColumns: ["id"]
          },
        ]
      }
      pesos_pesagem_compra: {
        Row: {
          categoria_individual: string | null
          created_at: string | null
          id: string
          leitura_balancao_id: string | null
          ordem: number
          percentual_individual: number | null
          pesagem_id: string
          peso_kg: number
          tipo_preco_individual: string | null
        }
        Insert: {
          categoria_individual?: string | null
          created_at?: string | null
          id?: string
          leitura_balancao_id?: string | null
          ordem: number
          percentual_individual?: number | null
          pesagem_id: string
          peso_kg: number
          tipo_preco_individual?: string | null
        }
        Update: {
          categoria_individual?: string | null
          created_at?: string | null
          id?: string
          leitura_balancao_id?: string | null
          ordem?: number
          percentual_individual?: number | null
          pesagem_id?: string
          peso_kg?: number
          tipo_preco_individual?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pesos_pesagem_compra_leitura_balancao_id_fkey"
            columns: ["leitura_balancao_id"]
            isOneToOne: false
            referencedRelation: "leituras_balancao_pesador"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesos_pesagem_compra_pesagem_id_fkey"
            columns: ["pesagem_id"]
            isOneToOne: false
            referencedRelation: "pesagens_compra"
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
      push_subscriptions: {
        Row: {
          created_at: string | null
          enabled: boolean
          endpoint: string
          id: string
          subscription: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean
          endpoint: string
          id?: string
          subscription: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean
          endpoint?: string
          id?: string
          subscription?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recebimentos_transferencia: {
        Row: {
          criado_em: string | null
          data_recebimento: string | null
          divergencia_percentual: number | null
          divergencia_sacos: number | null
          foto_url: string | null
          hora_recebimento: string | null
          id: string
          observacao: string | null
          quantidade_recebida: number
          recebido_por: string | null
          status: string | null
          transferencia_id: string
        }
        Insert: {
          criado_em?: string | null
          data_recebimento?: string | null
          divergencia_percentual?: number | null
          divergencia_sacos?: number | null
          foto_url?: string | null
          hora_recebimento?: string | null
          id?: string
          observacao?: string | null
          quantidade_recebida: number
          recebido_por?: string | null
          status?: string | null
          transferencia_id: string
        }
        Update: {
          criado_em?: string | null
          data_recebimento?: string | null
          divergencia_percentual?: number | null
          divergencia_sacos?: number | null
          foto_url?: string | null
          hora_recebimento?: string | null
          id?: string
          observacao?: string | null
          quantidade_recebida?: number
          recebido_por?: string | null
          status?: string | null
          transferencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_transferencia_transferencia_id_fkey"
            columns: ["transferencia_id"]
            isOneToOne: false
            referencedRelation: "transferencias_fabrica"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios_despesas: {
        Row: {
          consultor_id: string
          data_fim: string
          data_inicio: string
          gerado_em: string
          id: string
          pdf_url: string | null
          tipo_periodo: string
          valor_total: number
        }
        Insert: {
          consultor_id: string
          data_fim: string
          data_inicio: string
          gerado_em?: string
          id?: string
          pdf_url?: string | null
          tipo_periodo: string
          valor_total?: number
        }
        Update: {
          consultor_id?: string
          data_fim?: string
          data_inicio?: string
          gerado_em?: string
          id?: string
          pdf_url?: string | null
          tipo_periodo?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_despesas_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
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
      solicitacoes_lancamento_itens: {
        Row: {
          created_at: string
          data_salga: string
          id: string
          lancamento_id: string | null
          num_sacos: number
          pasto_id: string
          solicitacao_id: string
        }
        Insert: {
          created_at?: string
          data_salga: string
          id?: string
          lancamento_id?: string | null
          num_sacos: number
          pasto_id: string
          solicitacao_id: string
        }
        Update: {
          created_at?: string
          data_salga?: string
          id?: string
          lancamento_id?: string | null
          num_sacos?: number
          pasto_id?: string
          solicitacao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_lancamento_itens_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_lancamento_manual"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_lancamento_manual: {
        Row: {
          capataz_nome: string | null
          capataz_user_id: string | null
          created_at: string
          data_salga_geral: string
          decidido_em: string | null
          decidido_por: string | null
          fazenda_id: string
          id: string
          motivo_recusa: string | null
          observacao: string | null
          retiro_id: string
          status: string
          total_sacos: number
          updated_at: string
        }
        Insert: {
          capataz_nome?: string | null
          capataz_user_id?: string | null
          created_at?: string
          data_salga_geral?: string
          decidido_em?: string | null
          decidido_por?: string | null
          fazenda_id: string
          id?: string
          motivo_recusa?: string | null
          observacao?: string | null
          retiro_id: string
          status?: string
          total_sacos?: number
          updated_at?: string
        }
        Update: {
          capataz_nome?: string | null
          capataz_user_id?: string | null
          created_at?: string
          data_salga_geral?: string
          decidido_em?: string | null
          decidido_por?: string | null
          fazenda_id?: string
          id?: string
          motivo_recusa?: string | null
          observacao?: string | null
          retiro_id?: string
          status?: string
          total_sacos?: number
          updated_at?: string
        }
        Relationships: []
      }
      sync_commands: {
        Row: {
          acknowledged_at: string | null
          command: string
          created_at: string
          id: string
          sender_user_id: string | null
          target_user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          command?: string
          created_at?: string
          id?: string
          sender_user_id?: string | null
          target_user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          command?: string
          created_at?: string
          id?: string
          sender_user_id?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      sync_log: {
        Row: {
          device_info: Json | null
          id: string
          last_attempt: string | null
          last_success: string | null
          record_count_pending: number
          storage_estimate_bytes: number | null
          storage_quota_bytes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          device_info?: Json | null
          id?: string
          last_attempt?: string | null
          last_success?: string | null
          record_count_pending?: number
          storage_estimate_bytes?: number | null
          storage_quota_bytes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          device_info?: Json | null
          id?: string
          last_attempt?: string | null
          last_success?: string | null
          record_count_pending?: number
          storage_estimate_bytes?: number | null
          storage_quota_bytes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      syncvet_animais: {
        Row: {
          brinco: string | null
          categoria: string | null
          created_at: string
          id: string
          idade: number | null
          lote_id: string
          numero: string | null
          raca: string | null
        }
        Insert: {
          brinco?: string | null
          categoria?: string | null
          created_at?: string
          id?: string
          idade?: number | null
          lote_id: string
          numero?: string | null
          raca?: string | null
        }
        Update: {
          brinco?: string | null
          categoria?: string | null
          created_at?: string
          id?: string
          idade?: number | null
          lote_id?: string
          numero?: string | null
          raca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "syncvet_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhes: Json | null
          dispositivo: string | null
          empresa_id: string
          entidade: string
          entidade_id: string | null
          equipe_id: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: Json | null
          dispositivo?: string | null
          empresa_id: string
          entidade: string
          entidade_id?: string | null
          equipe_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: Json | null
          dispositivo?: string | null
          empresa_id?: string
          entidade?: string
          entidade_id?: string | null
          equipe_id?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_auditoria_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_auditoria_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_empresas: {
        Row: {
          cidade: string | null
          cnpj: string | null
          created_at: string
          crmv: string | null
          email: string | null
          id: string
          logo_url: string | null
          nome: string
          responsavel_tecnico: string | null
          telefone: string | null
          uf: string | null
        }
        Insert: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          crmv?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          responsavel_tecnico?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          crmv?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          responsavel_tecnico?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      syncvet_equipe: {
        Row: {
          ativo: boolean
          convite_status: string
          created_at: string
          email: string | null
          empresa_id: string
          horario_notificacao_proximo_dia: string | null
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["syncvet_perfil"]
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          convite_status?: string
          created_at?: string
          email?: string | null
          empresa_id: string
          horario_notificacao_proximo_dia?: string | null
          id?: string
          nome: string
          perfil: Database["public"]["Enums"]["syncvet_perfil"]
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          convite_status?: string
          created_at?: string
          email?: string | null
          empresa_id?: string
          horario_notificacao_proximo_dia?: string | null
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["syncvet_perfil"]
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_equipe_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_equipe_notificacoes: {
        Row: {
          created_at: string
          equipe_id: string
          horas_antes: number
          id: string
        }
        Insert: {
          created_at?: string
          equipe_id: string
          horas_antes: number
          id?: string
        }
        Update: {
          created_at?: string
          equipe_id?: string
          horas_antes?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_equipe_notificacoes_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_estacao_protocolos: {
        Row: {
          created_at: string
          estacao_id: string
          id: string
          observacoes: string | null
          preco_por_cabeca: number
          protocolo_id: string
        }
        Insert: {
          created_at?: string
          estacao_id: string
          id?: string
          observacoes?: string | null
          preco_por_cabeca: number
          protocolo_id: string
        }
        Update: {
          created_at?: string
          estacao_id?: string
          id?: string
          observacoes?: string | null
          preco_por_cabeca?: number
          protocolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_estacao_protocolos_estacao_id_fkey"
            columns: ["estacao_id"]
            isOneToOne: false
            referencedRelation: "syncvet_estacoes_monta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_estacao_protocolos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_estacao_semen: {
        Row: {
          created_at: string
          estacao_id: string
          id: string
          observacoes: string | null
          semen_id: string
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          estacao_id: string
          id?: string
          observacoes?: string | null
          semen_id: string
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          estacao_id?: string
          id?: string
          observacoes?: string | null
          semen_id?: string
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_estacao_semen_estacao_id_fkey"
            columns: ["estacao_id"]
            isOneToOne: false
            referencedRelation: "syncvet_estacoes_monta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_estacao_semen_semen_id_fkey"
            columns: ["semen_id"]
            isOneToOne: false
            referencedRelation: "syncvet_semen"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_estacoes_monta: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          fazenda_id: string
          id: string
          nome: string
          observacoes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          fazenda_id: string
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          fazenda_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_estacoes_monta_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_fazendas: {
        Row: {
          created_at: string
          empresa_id: string
          estado: string | null
          fazenda_matriz_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          modelo_cobranca: Database["public"]["Enums"]["syncvet_modelo_cobranca"]
          municipio: string | null
          nome: string
          observacoes: string | null
          proprietario: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          empresa_id: string
          estado?: string | null
          fazenda_matriz_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          modelo_cobranca?: Database["public"]["Enums"]["syncvet_modelo_cobranca"]
          municipio?: string | null
          nome: string
          observacoes?: string | null
          proprietario?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string
          estado?: string | null
          fazenda_matriz_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          modelo_cobranca?: Database["public"]["Enums"]["syncvet_modelo_cobranca"]
          municipio?: string | null
          nome?: string
          observacoes?: string | null
          proprietario?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_fazendas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_fazendas_fazenda_matriz_id_fkey"
            columns: ["fazenda_matriz_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_lote_ciclos: {
        Row: {
          created_at: string
          data_d0: string
          estacao_id: string
          fonte_protocolo: string
          fonte_semen: string
          id: string
          lote_id: string
          observacoes: string | null
          protocolo_id: string
          semen_descricao_fazenda: string | null
          semen_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data_d0: string
          estacao_id: string
          fonte_protocolo?: string
          fonte_semen?: string
          id?: string
          lote_id: string
          observacoes?: string | null
          protocolo_id: string
          semen_descricao_fazenda?: string | null
          semen_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data_d0?: string
          estacao_id?: string
          fonte_protocolo?: string
          fonte_semen?: string
          id?: string
          lote_id?: string
          observacoes?: string | null
          protocolo_id?: string
          semen_descricao_fazenda?: string | null
          semen_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_lote_ciclos_estacao_id_fkey"
            columns: ["estacao_id"]
            isOneToOne: false
            referencedRelation: "syncvet_estacoes_monta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_lote_ciclos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "syncvet_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_lote_ciclos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_lote_ciclos_semen_id_fkey"
            columns: ["semen_id"]
            isOneToOne: false
            referencedRelation: "syncvet_semen"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_lotes: {
        Row: {
          categoria: string | null
          created_at: string
          fazenda_id: string
          id: string
          nome: string
          observacoes: string | null
          quantidade_animais: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          fazenda_id: string
          id?: string
          nome: string
          observacoes?: string | null
          quantidade_animais?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          fazenda_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          quantidade_animais?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_lotes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_manejo_resultados: {
        Row: {
          animal_id: string
          created_at: string
          id: string
          manejo_id: string
          observacoes: string | null
          resultado: string
        }
        Insert: {
          animal_id: string
          created_at?: string
          id?: string
          manejo_id: string
          observacoes?: string | null
          resultado: string
        }
        Update: {
          animal_id?: string
          created_at?: string
          id?: string
          manejo_id?: string
          observacoes?: string | null
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_manejo_resultados_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "syncvet_animais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejo_resultados_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_historico_animal"
            referencedColumns: ["animal_id"]
          },
          {
            foreignKeyName: "syncvet_manejo_resultados_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_manejos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejo_resultados_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_historico_animal"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_manejo_resultados_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_manejo_fazenda"
            referencedColumns: ["manejo_id"]
          },
        ]
      }
      syncvet_manejos: {
        Row: {
          codigo_preco: string | null
          created_at: string
          data_execucao: string | null
          data_prevista: string
          descricao_avulsa: string | null
          etapa_id: string | null
          fazenda_id: string | null
          fonte_protocolo: string | null
          fonte_semen: string | null
          hora_inicio: string | null
          id: string
          lote_ciclo_id: string | null
          lote_id: string | null
          observacoes: string | null
          origem: string
          responsavel_id: string | null
          semen_descricao_fazenda: string | null
          semen_id: string | null
          status: string
          tipo_manejo: string | null
        }
        Insert: {
          codigo_preco?: string | null
          created_at?: string
          data_execucao?: string | null
          data_prevista: string
          descricao_avulsa?: string | null
          etapa_id?: string | null
          fazenda_id?: string | null
          fonte_protocolo?: string | null
          fonte_semen?: string | null
          hora_inicio?: string | null
          id?: string
          lote_ciclo_id?: string | null
          lote_id?: string | null
          observacoes?: string | null
          origem?: string
          responsavel_id?: string | null
          semen_descricao_fazenda?: string | null
          semen_id?: string | null
          status?: string
          tipo_manejo?: string | null
        }
        Update: {
          codigo_preco?: string | null
          created_at?: string
          data_execucao?: string | null
          data_prevista?: string
          descricao_avulsa?: string | null
          etapa_id?: string | null
          fazenda_id?: string | null
          fonte_protocolo?: string | null
          fonte_semen?: string | null
          hora_inicio?: string | null
          id?: string
          lote_ciclo_id?: string | null
          lote_id?: string | null
          observacoes?: string | null
          origem?: string
          responsavel_id?: string | null
          semen_descricao_fazenda?: string | null
          semen_id?: string | null
          status?: string
          tipo_manejo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_manejos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_protocolo_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejos_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejos_lote_ciclo_id_fkey"
            columns: ["lote_ciclo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_lote_ciclos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "syncvet_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejos_semen_id_fkey"
            columns: ["semen_id"]
            isOneToOne: false
            referencedRelation: "syncvet_semen"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_medicamentos: {
        Row: {
          created_at: string
          dosagem_padrao: string | null
          empresa_id: string
          foto_url: string | null
          id: string
          laboratorio: string | null
          nome_comercial: string
          observacoes: string | null
          principio_ativo: string | null
          via_aplicacao: string | null
        }
        Insert: {
          created_at?: string
          dosagem_padrao?: string | null
          empresa_id: string
          foto_url?: string | null
          id?: string
          laboratorio?: string | null
          nome_comercial: string
          observacoes?: string | null
          principio_ativo?: string | null
          via_aplicacao?: string | null
        }
        Update: {
          created_at?: string
          dosagem_padrao?: string | null
          empresa_id?: string
          foto_url?: string | null
          id?: string
          laboratorio?: string | null
          nome_comercial?: string
          observacoes?: string | null
          principio_ativo?: string | null
          via_aplicacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_medicamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_prenhez_historico: {
        Row: {
          created_at: string
          data: string
          fazenda_id: string | null
          id: string
          lote_id: string | null
          manejo_id: string
          taxa_pct: number | null
          total_diagnosticadas: number
          total_prenhas: number
          veterinario_id: string | null
        }
        Insert: {
          created_at?: string
          data: string
          fazenda_id?: string | null
          id?: string
          lote_id?: string | null
          manejo_id: string
          taxa_pct?: number | null
          total_diagnosticadas?: number
          total_prenhas?: number
          veterinario_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          fazenda_id?: string | null
          id?: string
          lote_id?: string | null
          manejo_id?: string
          taxa_pct?: number | null
          total_diagnosticadas?: number
          total_prenhas?: number
          veterinario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_prenhez_historico_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_manejos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_prenhez_historico_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_historico_animal"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_prenhez_historico_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_manejo_fazenda"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_prenhez_historico_veterinario_id_fkey"
            columns: ["veterinario_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_protocolo_etapa_itens: {
        Row: {
          created_at: string
          descricao: string
          dosagem: string | null
          etapa_id: string
          id: string
          medicamento_id: string | null
          observacoes: string | null
          ordem: number
        }
        Insert: {
          created_at?: string
          descricao: string
          dosagem?: string | null
          etapa_id: string
          id?: string
          medicamento_id?: string | null
          observacoes?: string | null
          ordem?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          dosagem?: string | null
          etapa_id?: string
          id?: string
          medicamento_id?: string | null
          observacoes?: string | null
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_protocolo_etapa_itens_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_protocolo_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_protocolo_etapa_itens_medicamento_id_fkey"
            columns: ["medicamento_id"]
            isOneToOne: false
            referencedRelation: "syncvet_medicamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_protocolo_etapas: {
        Row: {
          codigo_preco: string | null
          created_at: string
          dia_offset: number
          id: string
          nome_etapa: string | null
          ordem: number
          protocolo_id: string
        }
        Insert: {
          codigo_preco?: string | null
          created_at?: string
          dia_offset: number
          id?: string
          nome_etapa?: string | null
          ordem?: number
          protocolo_id: string
        }
        Update: {
          codigo_preco?: string | null
          created_at?: string
          dia_offset?: number
          id?: string
          nome_etapa?: string | null
          ordem?: number
          protocolo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_protocolo_etapas_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_protocolos: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_protocolos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_racas_gestacao: {
        Row: {
          created_at: string
          dias_gestacao: number
          empresa_id: string
          id: string
          raca: string
        }
        Insert: {
          created_at?: string
          dias_gestacao?: number
          empresa_id: string
          id?: string
          raca: string
        }
        Update: {
          created_at?: string
          dias_gestacao?: number
          empresa_id?: string
          id?: string
          raca?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_racas_gestacao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_semen: {
        Row: {
          central: string | null
          codigo: string | null
          created_at: string
          empresa_id: string
          id: string
          lote: string | null
          observacoes: string | null
          raca: string | null
          touro: string
        }
        Insert: {
          central?: string | null
          codigo?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          lote?: string | null
          observacoes?: string | null
          raca?: string | null
          touro: string
        }
        Update: {
          central?: string | null
          codigo?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          lote?: string | null
          observacoes?: string | null
          raca?: string | null
          touro?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_semen_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "syncvet_empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_servico_equipe: {
        Row: {
          equipe_id: string
          servico_id: string
          vinculado_em: string
        }
        Insert: {
          equipe_id: string
          servico_id: string
          vinculado_em?: string
        }
        Update: {
          equipe_id?: string
          servico_id?: string
          vinculado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_servico_equipe_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_servico_equipe_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "syncvet_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_servico_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          quantidade: number
          servico_id: string
          tipo_item: string
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          quantidade?: number
          servico_id: string
          tipo_item: string
          valor_total: number
          valor_unitario: number
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          quantidade?: number
          servico_id?: string
          tipo_item?: string
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_servico_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "syncvet_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_servico_manejos: {
        Row: {
          manejo_id: string
          servico_id: string
        }
        Insert: {
          manejo_id: string
          servico_id: string
        }
        Update: {
          manejo_id?: string
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_servico_manejos_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_manejos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_servico_manejos_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_historico_animal"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_servico_manejos_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_manejo_fazenda"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_servico_manejos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "syncvet_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_servicos: {
        Row: {
          animais_atendidos: number | null
          created_at: string
          data_referencia: string
          data_vencimento: string | null
          dias_trabalhados: number | null
          estacao_id: string | null
          fazenda_id: string
          id: string
          km_total: number | null
          observacoes: string | null
          status: Database["public"]["Enums"]["syncvet_status_pagamento"]
          valor_total: number
          veterinario_id: string
        }
        Insert: {
          animais_atendidos?: number | null
          created_at?: string
          data_referencia: string
          data_vencimento?: string | null
          dias_trabalhados?: number | null
          estacao_id?: string | null
          fazenda_id: string
          id?: string
          km_total?: number | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["syncvet_status_pagamento"]
          valor_total?: number
          veterinario_id: string
        }
        Update: {
          animais_atendidos?: number | null
          created_at?: string
          data_referencia?: string
          data_vencimento?: string | null
          dias_trabalhados?: number | null
          estacao_id?: string | null
          fazenda_id?: string
          id?: string
          km_total?: number | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["syncvet_status_pagamento"]
          valor_total?: number
          veterinario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_servicos_estacao_id_fkey"
            columns: ["estacao_id"]
            isOneToOne: false
            referencedRelation: "syncvet_estacoes_monta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_servicos_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_servicos_veterinario_id_fkey"
            columns: ["veterinario_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_tabela_precos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          tipo_servico: string
          unidade: string
          valor: number
          veterinario_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          tipo_servico: string
          unidade: string
          valor: number
          veterinario_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          tipo_servico?: string
          unidade?: string
          valor?: number
          veterinario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_tabela_precos_veterinario_id_fkey"
            columns: ["veterinario_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_trajetos: {
        Row: {
          created_at: string
          data: string
          destino_lat: number
          destino_lng: number
          distancia_km: number | null
          duracao_min: number | null
          fazenda_id: string
          fonte: string
          id: string
          manejo_id: string | null
          origem_endereco: string | null
          origem_lat: number
          origem_lng: number
          veterinario_id: string
        }
        Insert: {
          created_at?: string
          data: string
          destino_lat: number
          destino_lng: number
          distancia_km?: number | null
          duracao_min?: number | null
          fazenda_id: string
          fonte?: string
          id?: string
          manejo_id?: string | null
          origem_endereco?: string | null
          origem_lat: number
          origem_lng: number
          veterinario_id: string
        }
        Update: {
          created_at?: string
          data?: string
          destino_lat?: number
          destino_lng?: number
          distancia_km?: number | null
          duracao_min?: number | null
          fazenda_id?: string
          fonte?: string
          id?: string
          manejo_id?: string | null
          origem_endereco?: string | null
          origem_lat?: number
          origem_lng?: number
          veterinario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_trajetos_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_trajetos_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_manejos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_trajetos_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_historico_animal"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_trajetos_manejo_id_fkey"
            columns: ["manejo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_view_manejo_fazenda"
            referencedColumns: ["manejo_id"]
          },
          {
            foreignKeyName: "syncvet_trajetos_veterinario_id_fkey"
            columns: ["veterinario_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
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
      transferencias_fabrica: {
        Row: {
          criado_em: string | null
          fabrica_id: string
          fazenda_destino_id: string | null
          foto_url: string | null
          id: string
          observacao: string | null
          produto_id: string
          quantidade_kg: number
          quantidade_sacos: number
          registrado_por: string | null
          retiro_destino_id: string | null
          status: string | null
        }
        Insert: {
          criado_em?: string | null
          fabrica_id: string
          fazenda_destino_id?: string | null
          foto_url?: string | null
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade_kg: number
          quantidade_sacos: number
          registrado_por?: string | null
          retiro_destino_id?: string | null
          status?: string | null
        }
        Update: {
          criado_em?: string | null
          fabrica_id?: string
          fazenda_destino_id?: string | null
          foto_url?: string | null
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade_kg?: number
          quantidade_sacos?: number
          registrado_por?: string | null
          retiro_destino_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_fabrica_fabrica_id_fkey"
            columns: ["fabrica_id"]
            isOneToOne: false
            referencedRelation: "fabricas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_fabrica_fazenda_destino_id_fkey"
            columns: ["fazenda_destino_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_fabrica_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_fabrica_retiro_destino_id_fkey"
            columns: ["retiro_destino_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_retiros: {
        Row: {
          created_at: string
          criado_por: string | null
          data_aceite: string | null
          data_solicitacao: string
          fazenda_id: string
          id: string
          observacao: string | null
          peso_medio: number | null
          quantidade: number
          retiro_destino_id: string
          retiro_origem_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_aceite?: string | null
          data_solicitacao?: string
          fazenda_id: string
          id?: string
          observacao?: string | null
          peso_medio?: number | null
          quantidade: number
          retiro_destino_id: string
          retiro_origem_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_aceite?: string | null
          data_solicitacao?: string
          fazenda_id?: string
          id?: string
          observacao?: string | null
          peso_medio?: number | null
          quantidade?: number
          retiro_destino_id?: string
          retiro_origem_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_retiros_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_retiros_retiro_destino_id_fkey"
            columns: ["retiro_destino_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_retiros_retiro_origem_id_fkey"
            columns: ["retiro_origem_id"]
            isOneToOne: false
            referencedRelation: "retiros"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_assinantes: {
        Row: {
          cargo_funcao: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          visita_id: string
        }
        Insert: {
          cargo_funcao?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          visita_id: string
        }
        Update: {
          cargo_funcao?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_assinantes_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_currais: {
        Row: {
          created_at: string
          dieta_categoria: string | null
          id: string
          num_curral: string
          ordem: number
          organizacao_fabrica_nota: number | null
          organizacao_insumos_nota: number | null
          visita_id: string
        }
        Insert: {
          created_at?: string
          dieta_categoria?: string | null
          id?: string
          num_curral: string
          ordem?: number
          organizacao_fabrica_nota?: number | null
          organizacao_insumos_nota?: number | null
          visita_id: string
        }
        Update: {
          created_at?: string
          dieta_categoria?: string | null
          id?: string
          num_curral?: string
          ordem?: number
          organizacao_fabrica_nota?: number | null
          organizacao_insumos_nota?: number | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_currais_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_fotos: {
        Row: {
          created_at: string
          id: string
          ordem: number
          url: string
          visita_curral_id: string | null
          visita_pasto_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          url: string
          visita_curral_id?: string | null
          visita_pasto_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          url?: string
          visita_curral_id?: string | null
          visita_pasto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visita_fotos_visita_curral_id_fkey"
            columns: ["visita_curral_id"]
            isOneToOne: false
            referencedRelation: "visita_currais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visita_fotos_visita_pasto_id_fkey"
            columns: ["visita_pasto_id"]
            isOneToOne: false
            referencedRelation: "visita_pastos"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_pastos: {
        Row: {
          categoria: string | null
          consumo_esperado_kg: number | null
          consumo_kg_dia: number | null
          consumo_medio_g: number | null
          consumo_real_kg: number | null
          fazenda_nome: string | null
          id: string
          letra: string
          num_pasto: string | null
          observacao: string | null
          ordem: number
          pasto_id: string | null
          percentual_pv: string | null
          peso_medio_kg: number | null
          qtd_animais: number | null
          retiro_nome: string | null
          sexo: string | null
          tipo_produto: string | null
          ultima_salga: string | null
          visita_id: string
        }
        Insert: {
          categoria?: string | null
          consumo_esperado_kg?: number | null
          consumo_kg_dia?: number | null
          consumo_medio_g?: number | null
          consumo_real_kg?: number | null
          fazenda_nome?: string | null
          id?: string
          letra: string
          num_pasto?: string | null
          observacao?: string | null
          ordem?: number
          pasto_id?: string | null
          percentual_pv?: string | null
          peso_medio_kg?: number | null
          qtd_animais?: number | null
          retiro_nome?: string | null
          sexo?: string | null
          tipo_produto?: string | null
          ultima_salga?: string | null
          visita_id: string
        }
        Update: {
          categoria?: string | null
          consumo_esperado_kg?: number | null
          consumo_kg_dia?: number | null
          consumo_medio_g?: number | null
          consumo_real_kg?: number | null
          fazenda_nome?: string | null
          id?: string
          letra?: string
          num_pasto?: string | null
          observacao?: string | null
          ordem?: number
          pasto_id?: string | null
          percentual_pv?: string | null
          peso_medio_kg?: number | null
          qtd_animais?: number | null
          retiro_nome?: string | null
          sexo?: string | null
          tipo_produto?: string | null
          ultima_salga?: string | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_pastos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas_tecnicas"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_topico_fotos: {
        Row: {
          created_at: string
          id: string
          ordem: number
          url: string
          visita_topico_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          url: string
          visita_topico_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          url?: string
          visita_topico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_topico_fotos_visita_topico_id_fkey"
            columns: ["visita_topico_id"]
            isOneToOne: false
            referencedRelation: "visita_topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      visita_topicos: {
        Row: {
          created_at: string
          id: string
          ordem: number
          texto: string | null
          titulo: string
          visita_id: string
          zona: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          texto?: string | null
          titulo?: string
          visita_id: string
          zona?: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          texto?: string | null
          titulo?: string
          visita_id?: string
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "visita_topicos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas_tecnicas"
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
      visitas_tecnicas: {
        Row: {
          administrador_id: string | null
          conclusao: string | null
          consultor_id: string | null
          consultor_nome_override: string | null
          created_at: string
          deleted_at: string | null
          fazenda_consultor_id: string | null
          fazenda_id: string | null
          fazenda_nome_override: string | null
          hora_fim: string | null
          hora_inicio: string
          id: string
          indicadores_gerais: string | null
          indicadores_tabela: Json | null
          localizacao_override: string | null
          objetivo_visita: string | null
          observacoes_gerais: string | null
          pdf_url: string | null
          proprietario_override: string | null
          responsavel_override: string | null
          resumo_executivo: string | null
          status: string
          tipo: string
        }
        Insert: {
          administrador_id?: string | null
          conclusao?: string | null
          consultor_id?: string | null
          consultor_nome_override?: string | null
          created_at?: string
          deleted_at?: string | null
          fazenda_consultor_id?: string | null
          fazenda_id?: string | null
          fazenda_nome_override?: string | null
          hora_fim?: string | null
          hora_inicio?: string
          id?: string
          indicadores_gerais?: string | null
          indicadores_tabela?: Json | null
          localizacao_override?: string | null
          objetivo_visita?: string | null
          observacoes_gerais?: string | null
          pdf_url?: string | null
          proprietario_override?: string | null
          responsavel_override?: string | null
          resumo_executivo?: string | null
          status?: string
          tipo?: string
        }
        Update: {
          administrador_id?: string | null
          conclusao?: string | null
          consultor_id?: string | null
          consultor_nome_override?: string | null
          created_at?: string
          deleted_at?: string | null
          fazenda_consultor_id?: string | null
          fazenda_id?: string | null
          fazenda_nome_override?: string | null
          hora_fim?: string | null
          hora_inicio?: string
          id?: string
          indicadores_gerais?: string | null
          indicadores_tabela?: Json | null
          localizacao_override?: string | null
          objetivo_visita?: string | null
          observacoes_gerais?: string | null
          pdf_url?: string | null
          proprietario_override?: string | null
          responsavel_override?: string | null
          resumo_executivo?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_tecnicas_administrador_id_fkey"
            columns: ["administrador_id"]
            isOneToOne: false
            referencedRelation: "administradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_tecnicas_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_tecnicas_fazenda_consultor_id_fkey"
            columns: ["fazenda_consultor_id"]
            isOneToOne: false
            referencedRelation: "fazendas_consultor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_tecnicas_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "fazendas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      syncvet_view_historico_animal: {
        Row: {
          animal_id: string | null
          brinco: string | null
          data_execucao: string | null
          data_prevista: string | null
          manejo_descricao: string | null
          manejo_id: string | null
          numero: string | null
          resultado: string | null
          status: string | null
        }
        Relationships: []
      }
      syncvet_view_manejo_fazenda: {
        Row: {
          data_execucao: string | null
          data_prevista: string | null
          fazenda_id: string | null
          lote_id: string | null
          manejo_id: string | null
          responsavel_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_manejos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      syncvet_view_taxa_prenhez: {
        Row: {
          estacao_id: string | null
          fazenda_id: string | null
          lote_id: string | null
          protocolo_id: string | null
          taxa_prenhez_pct: number | null
          total_diagnosticadas: number | null
          total_prenhas: number | null
          veterinario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "syncvet_animais_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "syncvet_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_lote_ciclos_estacao_id_fkey"
            columns: ["estacao_id"]
            isOneToOne: false
            referencedRelation: "syncvet_estacoes_monta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_lote_ciclos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "syncvet_protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_lotes_fazenda_id_fkey"
            columns: ["fazenda_id"]
            isOneToOne: false
            referencedRelation: "syncvet_fazendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "syncvet_manejos_responsavel_id_fkey"
            columns: ["veterinario_id"]
            isOneToOne: false
            referencedRelation: "syncvet_equipe"
            referencedColumns: ["id"]
          },
        ]
      }
      view_consumo_consolidado: {
        Row: {
          ano_referencia: number | null
          categoria: string | null
          ciclo_id: string | null
          consumo_g_cab_dia: number | null
          created_at: string | null
          dias_no_pasto: number | null
          fazenda_id: string | null
          id: string | null
          indice_consumo: number | null
          mes_referencia: number | null
          num_animais: number | null
          num_sacos: number | null
          pasto_id: string | null
          peso_medio_kg: number | null
          retiro_id: string | null
          sexo: string | null
          status_consumo: string | null
        }
        Insert: {
          ano_referencia?: number | null
          categoria?: string | null
          ciclo_id?: string | null
          consumo_g_cab_dia?: number | null
          created_at?: string | null
          dias_no_pasto?: number | null
          fazenda_id?: string | null
          id?: string | null
          indice_consumo?: number | null
          mes_referencia?: number | null
          num_animais?: number | null
          num_sacos?: number | null
          pasto_id?: string | null
          peso_medio_kg?: number | null
          retiro_id?: string | null
          sexo?: string | null
          status_consumo?: string | null
        }
        Update: {
          ano_referencia?: number | null
          categoria?: string | null
          ciclo_id?: string | null
          consumo_g_cab_dia?: number | null
          created_at?: string | null
          dias_no_pasto?: number | null
          fazenda_id?: string | null
          id?: string | null
          indice_consumo?: number | null
          mes_referencia?: number | null
          num_animais?: number | null
          num_sacos?: number | null
          pasto_id?: string | null
          peso_medio_kg?: number | null
          retiro_id?: string | null
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
      view_consumo_mineral: {
        Row: {
          ano_referencia: number | null
          cab_dias: number | null
          categoria: string | null
          ciclo_id: string | null
          consumo_g_cab_dia: number | null
          consumo_kg_cabeca: number | null
          created_at: string | null
          dias_no_pasto: number | null
          fazenda_id: string | null
          id: string | null
          indice_consumo: number | null
          mes_referencia: number | null
          num_animais: number | null
          num_sacos: number | null
          origem: string | null
          pasto_id: string | null
          peso_medio_kg: number | null
          preco_por_kg: number | null
          retiro_id: string | null
          sexo: string | null
          status_consumo: string | null
          total_sal_kg: number | null
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
      view_consumo_tempo_real: {
        Row: {
          ano_referencia: number | null
          categoria: string | null
          ciclo_id: string | null
          consumo_g_cab_dia: number | null
          created_at: string | null
          dias_no_pasto: number | null
          fazenda_id: string | null
          id: string | null
          indice_consumo: number | null
          is_open_period: boolean | null
          mes_referencia: number | null
          num_animais: number | null
          num_sacos: number | null
          origem: string | null
          pasto_id: string | null
          peso_medio_kg: number | null
          retiro_id: string | null
          sexo: string | null
          status_consumo: string | null
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
      view_lancamento_consumo_real: {
        Row: {
          ano_referencia: number | null
          cab_dias_assumidos: number | null
          ciclo_id: string | null
          created_at: string | null
          fazenda_id: string | null
          intervalo_padrao_dias: number | null
          kg_fornecido: number | null
          lancamento_id: string | null
          mes_referencia: number | null
          num_animais: number | null
          num_sacos: number | null
          ocupacao_id: string | null
          pasto_id: string | null
          peso_saco_kg: number | null
          retiro_id: string | null
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
          {
            foreignKeyName: "lancamentos_ocupacao_id_fkey"
            columns: ["ocupacao_id"]
            isOneToOne: false
            referencedRelation: "ocupacoes_pasto"
            referencedColumns: ["id"]
          },
        ]
      }
      view_painel_mae_pasto: {
        Row: {
          ano_referencia: number | null
          cab_dias_global: number | null
          cab_dias_real: number | null
          consumo_global_g_cab_dia: number | null
          consumo_real_g_cab_dia: number | null
          eficiencia_pasto: number | null
          fazenda_id: string | null
          indice_global: number | null
          indice_real: number | null
          kg_fornecido: number | null
          mes_referencia: number | null
          num_animais: number | null
          pasto_id: string | null
          peso_medio_kg: number | null
          retiro_id: string | null
          status_global: string | null
          status_real: string | null
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
      view_painel_mae_pasto_atual: {
        Row: {
          ano_referencia: number | null
          cab_dias_global: number | null
          cab_dias_real: number | null
          consumo_global_g_cab_dia: number | null
          consumo_real_g_cab_dia: number | null
          eficiencia_pasto: number | null
          fazenda_id: string | null
          indice_global: number | null
          indice_real: number | null
          mes_referencia: number | null
          num_animais: number | null
          pasto_id: string | null
          peso_medio_kg: number | null
          retiro_id: string | null
          status_global: string | null
          status_real: string | null
          ultima_salga_real_em: string | null
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
    }
    Functions: {
      ensure_ciclo: {
        Args: { p_ano: number; p_fazenda_id: string; p_mes: number }
        Returns: string
      }
      ensure_ciclo_atual: { Args: { p_fazenda_id: string }; Returns: string }
      ensure_ciclo_retiro: {
        Args: { p_ano?: number; p_mes?: number; p_retiro_id: string }
        Returns: string
      }
      get_consultor_id: { Args: { _user_id: string }; Returns: string }
      get_consumo_mineral: {
        Args: { p_ano: number; p_fazenda_id: string; p_mes: number }
        Returns: {
          capataz: string
          consumo_medio_g: number
          custo_diario: number
          custo_mensal: number
          eficiencia: number
          gmd_medio: number
          pastos_na_meta: number
          retiro_id: string
          retiro_nome: string
          status_alto: number
          status_baixo: number
          status_ideal: number
          total_animais: number
          total_cab_dias: number
          total_kg_consumido: number
          total_pastos: number
          total_sacos: number
          total_salgas: number
        }[]
      }
      get_consumo_real_v2: {
        Args: {
          p_ano?: number
          p_mes?: number
          p_pasto_id?: string
          p_retiro_id: string
        }
        Returns: {
          consumo_real_g_cab_dia: number
          total_cab_dias: number
          total_kg: number
          total_sacos: number
        }[]
      }
      get_escritorio_fazenda_id: { Args: { _user_id: string }; Returns: string }
      get_operador_fabrica_id: { Args: { _user_id: string }; Returns: string }
      get_painel_mae: {
        Args: {
          p_ano?: number
          p_fazenda_id: string
          p_mes?: number
          p_retiro_id?: string
        }
        Returns: {
          consumo_global_g_cab_dia: number
          consumo_real_g_cab_dia: number
          eficiencia: number
          pastos_na_meta_den: number
          pastos_na_meta_num: number
          peso_medio_kg: number
        }[]
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_consultor: { Args: { _user_id: string }; Returns: boolean }
      is_escritorio: { Args: { _user_id: string }; Returns: boolean }
      is_operador_fabrica: { Args: { _user_id: string }; Returns: boolean }
      register_push_subscription: {
        Args: { p_enabled?: boolean; p_endpoint: string; p_subscription: Json }
        Returns: {
          created_at: string | null
          enabled: boolean
          endpoint: string
          id: string
          subscription: Json
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "push_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolver_ocupacao_ativa: {
        Args: {
          p_categoria: string
          p_num_animais: number
          p_pasto_id: string
          p_peso_medio_kg: number
        }
        Returns: string
      }
      send_push_async: {
        Args: {
          p_body: string
          p_fazenda_id: string
          p_title: string
          p_url: string
        }
        Returns: undefined
      }
      sync_capataz_lancamento: { Args: { p_lancamento: Json }; Returns: Json }
      verificar_salgas_atrasadas: { Args: never; Returns: undefined }
    }
    Enums: {
      syncvet_modelo_cobranca: "protocolo_completo" | "mao_obra_km"
      syncvet_perfil:
        | "administrador"
        | "veterinario"
        | "prestador_servico"
        | "estagiario"
        | "auxiliar"
      syncvet_status_pagamento: "pendente" | "pago" | "vencido"
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
      syncvet_modelo_cobranca: ["protocolo_completo", "mao_obra_km"],
      syncvet_perfil: [
        "administrador",
        "veterinario",
        "prestador_servico",
        "estagiario",
        "auxiliar",
      ],
      syncvet_status_pagamento: ["pendente", "pago", "vencido"],
    },
  },
} as const
