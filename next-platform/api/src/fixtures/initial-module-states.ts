// Synthetic laboratory data, served only after an authorized context is selected.
// Copied from the existing F23 fixtures; no new domain rules or real records.
export const INITIAL_MODULE_STATES: Record<string, Record<string, unknown>> = {
  "capataz": {
    "pastos": [
      {
        "pasto_id": "pasto-01",
        "nome_pasto": "Pasto 01 - Mombaça Sede",
        "setor": "Sede",
        "qr_code_esperado": "PASTO-01-MOMBACA-SEDE",
        "lote_id": "lote-recria-01",
        "lote_nome": "Lote Recria 01 (Nelore)",
        "cocho_id": "cocho-pasto-01",
        "status_cocho": "limpo",
        "altura_media_cm": 65
      },
      {
        "pasto_id": "pasto-02",
        "nome_pasto": "Pasto 02 - Braquiária Baixada",
        "setor": "Baixada",
        "qr_code_esperado": "PASTO-02-BRAQUIARIA-BX",
        "lote_id": "lote-terminacao-02",
        "lote_nome": "Lote Terminação 02 (Cruzamento Industrial)",
        "cocho_id": "cocho-pasto-02",
        "status_cocho": "com_sobra",
        "altura_media_cm": 38
      },
      {
        "pasto_id": "pasto-03",
        "nome_pasto": "Pasto 03 - Piatã Piquete Sul",
        "setor": "Retiro Sul",
        "qr_code_esperado": "PASTO-03-PIATA-SUL",
        "lote_id": "lote-novilhas-03",
        "lote_nome": "Lote Novilhas 03 (Fêmeas Precoces)",
        "cocho_id": "cocho-pasto-03",
        "status_cocho": "limpo",
        "altura_media_cm": 45
      },
      {
        "pasto_id": "pasto-04",
        "nome_pasto": "Pasto 04 - Mombaça Confinamento",
        "setor": "Confinamento",
        "qr_code_esperado": "PASTO-04-MOMBACA-CONF",
        "lote_id": "lote-boi-gordo-04",
        "lote_nome": "Lote Boi Gordo 04 (Giro Rápido)",
        "cocho_id": "cocho-pasto-04",
        "status_cocho": "limpo",
        "altura_media_cm": 72
      }
    ],
    "lotes": [
      {
        "lote_id": "lote-recria-01",
        "nome_lote": "Lote Recria 01 (Nelore)",
        "categoria": "Garrotes Nelore",
        "quantidade_cabecas": 120,
        "peso_medio_kg": 345
      },
      {
        "lote_id": "lote-terminacao-02",
        "nome_lote": "Lote Terminação 02 (Cruzamento Industrial)",
        "categoria": "Bois Angus x Nelore",
        "quantidade_cabecas": 95,
        "peso_medio_kg": 480
      },
      {
        "lote_id": "lote-novilhas-03",
        "nome_lote": "Lote Novilhas 03 (Fêmeas Precoces)",
        "categoria": "Novilhas Nelore",
        "quantidade_cabecas": 80,
        "peso_medio_kg": 310
      },
      {
        "lote_id": "lote-boi-gordo-04",
        "nome_lote": "Lote Boi Gordo 04 (Giro Rápido)",
        "categoria": "Boi Gordo 18+",
        "quantidade_cabecas": 110,
        "peso_medio_kg": 535
      }
    ],
    "produtos": [
      {
        "produto_id": "prod-sal-mineral-80",
        "nome_produto": "Sal Mineral Fosfatado 80",
        "tipo": "sal_mineral",
        "peso_saco_padrao_kg": 25
      },
      {
        "produto_id": "prod-proteinado-aguas",
        "nome_produto": "Suplemento Proteinado Águas 0.1%",
        "tipo": "proteinado",
        "peso_saco_padrao_kg": 30
      },
      {
        "produto_id": "prod-racao-terminacao-22",
        "nome_produto": "Ração de Terminação Alta Energia 22%",
        "tipo": "racao_terminacao",
        "peso_saco_padrao_kg": 40
      }
    ],
    "leiturasCocho": [],
    "leiturasQr": [],
    "contagens": [],
    "fotos": {},
    "outbox": [],
    "syncedCommands": [],
    "conflitos": [],
    "isLeader": false,
    "circuitState": "CLOSED",
    "quotaExceededError": null,
    "localRevision": 0,
    "baseVersions": {
      "pasto-01": 1,
      "pasto-02": 1,
      "pasto-03": 1,
      "pasto-04": 1
    }
  },
  "gerente": {
    "kpis": {
      "gmdAtual": 1.45,
      "gmdMeta": 1.35,
      "escoreCochoPct": 98.2,
      "animaisAtivos": 3420,
      "custoArrobaBrl": 215.5,
      "taxaMortalidadePct": 0.8
    },
    "gmdConfig": {
      "modo": "geral",
      "estacao": "verao",
      "metaGeralKgDia": 1.35
    },
    "lotes": [
      {
        "lote_id": "lote-recria-01",
        "nome_lote": "Lote 01 - Garrotes Nelore",
        "pasto_id": "pasto-04",
        "pasto_nome": "Pasto 04 (Mombaça)",
        "categoria": "garrote",
        "quantidade_cabecas": 320,
        "peso_medio_kg": 340,
        "gmd_atual_kg_dia": 1.42,
        "meta_gmd_kg_dia": 1.35,
        "data_alvo_abate": "2026-12-15T00:00:00.000Z",
        "estrategia_nutricional": "pasto_aguas",
        "consumo_esperado_g_cab_dia": 1200
      },
      {
        "lote_id": "lote-terminacao-02",
        "nome_lote": "Lote 02 - Bois Confinamento",
        "pasto_id": "pasto-07",
        "pasto_nome": "Pasto 07 (Piquete Confinamento)",
        "categoria": "boi_gordo",
        "quantidade_cabecas": 450,
        "peso_medio_kg": 490,
        "gmd_atual_kg_dia": 1.58,
        "meta_gmd_kg_dia": 1.5,
        "data_alvo_abate": "2026-11-30T00:00:00.000Z",
        "estrategia_nutricional": "semi_confinamento",
        "consumo_esperado_g_cab_dia": 3500
      }
    ],
    "custos": [
      {
        "centro_custo": "Nutrição Animal",
        "valor": 85400,
        "percentual": 58
      },
      {
        "centro_custo": "Sanidade e Vacinas",
        "valor": 18200,
        "percentual": 12
      },
      {
        "centro_custo": "Pastagem e Adubação",
        "valor": 26500,
        "percentual": 18
      },
      {
        "centro_custo": "Operacional e Mão de Obra",
        "valor": 17600,
        "percentual": 12
      }
    ],
    "auditoriasCocho": [
      {
        "leitura_cocho_id": "leitura-01",
        "pasto_id": "pasto-04",
        "pasto_nome": "Pasto 04 (Mombaça)",
        "escore_registrado": 3,
        "sacos_fornecidos": 8,
        "status": "pendente",
        "registrado_em": "2026-11-04T07:30:00.000Z"
      },
      {
        "leitura_cocho_id": "leitura-02",
        "pasto_id": "pasto-07",
        "pasto_nome": "Pasto 07 (Piquete)",
        "escore_registrado": 4,
        "sacos_fornecidos": 12,
        "status": "pendente",
        "registrado_em": "2026-11-04T07:45:00.000Z"
      }
    ],
    "outbox": [],
    "localRevision": 0,
    "baseVersions": {
      "lote-recria-01": 0,
      "lote-terminacao-02": 0,
      "leitura-01": 0,
      "leitura-02": 0
    }
  },
  "escritorio": {
    "kpis": {
      "pendentesConferencia": 3,
      "comprasAprovadas": 8,
      "totalComprometidoBrl": 148500
    },
    "notasFiscais": [
      {
        "nota_fiscal_id": "nfe-001-2026",
        "numero_nf": "10482",
        "serie": "1",
        "chave_acesso_nfe": "35261112345678000195550010000104821234567890",
        "fornecedor_nome": "NutriAgro Nutrição Animal Ltda",
        "fornecedor_cnpj_cpf": "12345678000195",
        "valor_total_brl": 45000,
        "data_emissao": "2026-11-03T10:00:00.000Z",
        "itens": [
          {
            "produto_descricao": "Milho Grão Padrão",
            "quantidade": 30000,
            "unidade_medida": "kg",
            "valor_unitario_brl": 1.2,
            "valor_total_item_brl": 36000
          },
          {
            "produto_descricao": "Núcleo Mineral Confinamento",
            "quantidade": 1500,
            "unidade_medida": "kg",
            "valor_unitario_brl": 6,
            "valor_total_item_brl": 9000
          }
        ]
      }
    ],
    "pedidosCompra": [
      {
        "pedido_compra_id": "oc-2026-081",
        "fornecedor_id": "forn-01",
        "fornecedor_nome": "NutriAgro Nutrição Animal",
        "produto_insumo_id": "insumo-farelo-soja",
        "produto_nome": "Farelo de Soja 46%",
        "quantidade_pedida": 25,
        "unidade": "ton",
        "preco_unitario_brl": 2200,
        "condicao_pagamento": "30_dias",
        "previsao_entrega": "2026-11-10T00:00:00.000Z",
        "status": "aprovado"
      }
    ],
    "lotes": [
      {
        "lote_id": "lote-adm-01",
        "fazenda_id": "fazenda-01",
        "pasto_id": "pasto-04",
        "nome_lote": "Lote 01 - Recria 2026",
        "categoria_animal": "garrote",
        "quantidade_cabecas": 320,
        "peso_medio_inicial_kg": 280,
        "data_entrada": "2026-10-01T00:00:00.000Z"
      }
    ],
    "fechamentos": [],
    "outbox": [],
    "baseVersions": {
      "nfe-001-2026": 0,
      "oc-2026-081": 0,
      "lote-adm-01": 0
    },
    "localRevision": 0,
    "persistenceError": null
  },
  "fabrica": {
    "kpis": {
      "misturadoresAtivos": 1,
      "producaoHojeKg": 12500,
      "metaHojeKg": 20000,
      "silosAlertaCount": 0
    },
    "misturadores": [
      {
        "misturador_id": "misturador-01",
        "nome": "Misturador Horizontal 01 (2000kg)",
        "status": "misturando",
        "batida_atual_id": "batida-42",
        "capacidade_kg": 2000
      },
      {
        "misturador_id": "misturador-02",
        "nome": "Misturador Vertical 02 (1500kg)",
        "status": "ocioso",
        "capacidade_kg": 1500
      }
    ],
    "formulas": [
      {
        "formula_id": "form-terminacao-22",
        "nome_formula": "Terminação 22%",
        "tipo_raca_destino": "racao_confinamento",
        "tamanho_batida_padrao_kg": 2000,
        "ativo": true,
        "ingredientes": [
          {
            "materia_prima_id": "mp-milho",
            "nome_ingrediente": "Milho Moído",
            "porcentagem_inclusao": 65
          },
          {
            "materia_prima_id": "mp-soja",
            "nome_ingrediente": "Farelo de Soja 46%",
            "porcentagem_inclusao": 25
          },
          {
            "materia_prima_id": "mp-nucleo",
            "nome_ingrediente": "Núcleo Confinamento",
            "porcentagem_inclusao": 7
          },
          {
            "materia_prima_id": "mp-calcario",
            "nome_ingrediente": "Calcário Calcítico",
            "porcentagem_inclusao": 3
          }
        ]
      }
    ],
    "batidas": [
      {
        "batida_id": "batida-42",
        "ordem_producao_id": "op-2026-1104",
        "formula_id": "form-terminacao-22",
        "misturador_id": "misturador-01",
        "quantidade_planejada_kg": 2000,
        "operador_id": "user-fabrica-synthetic",
        "iniciado_em": "2026-11-04T09:30:00.000Z",
        "status": "em_andamento"
      }
    ],
    "silos": [
      {
        "silo_id": "silo-01",
        "nome_silo": "Silo 01",
        "materia_prima_id": "mp-milho",
        "materia_prima_nome": "Milho Moído",
        "capacidade_total_kg": 60000,
        "nivel_atual_kg": 42000,
        "ocupacao_pct": 70
      },
      {
        "silo_id": "silo-02",
        "nome_silo": "Silo 02",
        "materia_prima_id": "mp-soja",
        "materia_prima_nome": "Farelo de Soja",
        "capacidade_total_kg": 40000,
        "nivel_atual_kg": 33800,
        "ocupacao_pct": 84.5
      },
      {
        "silo_id": "silo-03",
        "nome_silo": "Silo 03",
        "materia_prima_id": "mp-nucleo",
        "materia_prima_nome": "Núcleo Mineral",
        "capacidade_total_kg": 20000,
        "nivel_atual_kg": 14500,
        "ocupacao_pct": 72.5
      }
    ],
    "calibracoes": [
      {
        "balanca_id": "balanca-misturador-01",
        "equipamento_tipo": "celula_carga_misturador",
        "peso_padrao_kg": 1000,
        "peso_medido_kg": 1002,
        "desvio_pct": 0.2,
        "calibrado": true,
        "data_calibracao": "2026-11-01T08:00:00.000Z"
      }
    ],
    "outbox": [],
    "localRevision": 0,
    "baseVersions": {
      "form-terminacao-22": 0,
      "batida-42": 0,
      "silo-01": 0,
      "silo-02": 0,
      "silo-03": 0,
      "balanca-misturador-01": 0
    }
  }
};
