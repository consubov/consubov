import { z } from 'zod';

// ==========================================
// 1. CAPATAZ (5 COMANDOS DE CAMPO CRÍTICO)
// ==========================================

export const pesagemAnimalPayloadSchema = z.object({
  animal_id: z.string().min(1, 'ID do animal é obrigatório'),
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  pasto_id: z.string().min(1).optional(),
  peso_kg: z.number().positive('Peso do animal deve ser estritamente positivo').max(2000, 'Peso não pode exceder 2000 kg'),
  data_pesagem: z.string().datetime({ message: 'Data de pesagem deve ser ISO 8601' }),
  tipo_pesagem: z.enum(['individual', 'lote_amostragem']).optional(),
  escore_corporal: z.number().min(1).max(9).optional(),
  observacoes: z.string().max(500).optional()
}).strict();

export const lancamentoCochoPayloadSchema = z.object({
  pasto_id: z.string().min(1, 'ID do pasto é obrigatório'),
  lote_id: z.string().min(1).optional(),
  produto_id: z.string().min(1, 'ID do produto é obrigatório'),
  escore_cocho: z.number().int().min(0, 'Escore mínimo é 0').max(4, 'Escore máximo é 4'),
  sacos_fornecidos: z.number().nonnegative('Quantidade de sacos não pode ser negativa'),
  peso_saco_kg: z.number().positive('Peso do saco deve ser estritamente positivo').max(100).optional(),
  cocho_limpo: z.boolean().optional(),
  foto_attachment_id: z.string().min(1).optional(),
  justificativa_falha_qr: z.string().max(255).optional(),
  data_fornecimento: z.string().datetime({ message: 'Data de fornecimento deve ser ISO 8601' }).optional(),
  observacao: z.string().max(500).optional()
}).strict();

export const contagemRebanhoPayloadSchema = z.object({
  pasto_id: z.string().min(1, 'ID do pasto é obrigatório'),
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  quantidade_cabecas: z.number().int().nonnegative('Quantidade de cabeças deve ser inteira não-negativa'),
  quantidade_bezerros: z.number().int().nonnegative().optional(),
  quantidade_mortos: z.number().int().nonnegative().optional(),
  causa_mortalidade: z.string().max(255).optional(),
  data_contagem: z.string().datetime({ message: 'Data de contagem deve ser ISO 8601' }),
  observacoes: z.string().max(500).optional()
}).strict();

export const leituraPastoPayloadSchema = z.object({
  pasto_id: z.string().min(1, 'ID do pasto é obrigatório'),
  altura_media_cm: z.number().positive('Altura do pasto deve ser positiva').max(300, 'Altura máxima de 300 cm'),
  escore_massa_forragem: z.number().int().min(1).max(5).optional(),
  condicao_aguada: z.enum(['otima', 'boa', 'regular', 'ruim', 'seca']).optional(),
  condicao_cocho: z.enum(['otimo', 'bom', 'danificado', 'precisa_reparo']).optional(),
  qr_code_lido: z.string().min(8, 'QR code deve ter no mínimo 8 caracteres').max(128),
  data_leitura: z.string().datetime({ message: 'Data da leitura deve ser ISO 8601' }),
  foto_attachment_id: z.string().min(1).optional()
}).strict();

export const movimentacaoLotePayloadSchema = z.object({
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  pasto_origem_id: z.string().min(1, 'Pasto de origem é obrigatório'),
  pasto_destino_id: z.string().min(1, 'Pasto de destino é obrigatório'),
  quantidade_animais: z.number().int().positive('Quantidade de animais movimentados deve ser positiva'),
  motivo_movimentacao: z.enum(['rotacionamento', 'apartacao', 'tratamento', 'pesagem', 'venda', 'confinamento']),
  data_movimentacao: z.string().datetime({ message: 'Data da movimentação deve ser ISO 8601' }),
  responsavel_nome: z.string().min(2).max(100)
}).strict();

export const fotoCochoPayloadSchema = z.object({
  pasto_id: z.string().min(1, 'ID do pasto é obrigatório'),
  cocho_id: z.string().min(1).optional(),
  foto_attachment_id: z.string().min(1, 'ID do anexo de foto é obrigatório'),
  tipo_registro: z.enum(['leitura_matutina', 'leitura_vespertina', 'conferencia_limpeza', 'auditoria']),
  escore_estimado: z.number().int().min(0).max(4).optional(),
  registrado_em: z.string().datetime({ message: 'Data do registro deve ser ISO 8601' })
}).strict();

// ==========================================
// 2. GERENTE (4 COMANDOS DE GESTÃO E METAS)
// ==========================================

export const definirMetasPayloadSchema = z.object({
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  gmd_alvo_kg_dia: z.number().positive('GMD alvo deve ser positivo').max(3.5, 'GMD máximo de 3.5 kg/dia'),
  peso_final_alvo_kg: z.number().positive('Peso final deve ser positivo').max(1500),
  data_alvo_abate: z.string().datetime({ message: 'Data alvo de abate deve ser ISO 8601' }),
  estrategia_nutricional: z.enum(['pasto_aguas', 'pasto_seca', 'suplementacao_proteica', 'semi_confinamento', 'confinamento']).optional(),
  consumo_esperado_g_cab_dia: z.number().positive('Consumo diário deve ser positivo').optional()
}).strict();

export const aprovarLeituraCochoPayloadSchema = z.object({
  leitura_cocho_id: z.string().min(1, 'ID da leitura é obrigatório'),
  pasto_id: z.string().min(1, 'ID do pasto é obrigatório'),
  status_aprovacao: z.enum(['aprovado', 'ajuste_necessario', 'rejeitado']),
  escore_revisado: z.number().int().min(0).max(4).optional(),
  novo_fornecimento_sacos: z.number().nonnegative().optional(),
  justificativa_ajuste: z.string().max(500).optional(),
  aprovado_em: z.string().datetime({ message: 'Data de aprovação deve ser ISO 8601' })
}).strict();

export const ajustarDietaPayloadSchema = z.object({
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  produto_id: z.string().min(1, 'ID do produto nutricional é obrigatório'),
  nova_meta_consumo_g_cab_dia: z.number().positive('Meta de consumo deve ser positiva').max(10000),
  periodo_inicio: z.string().datetime({ message: 'Data de início deve ser ISO 8601' }),
  periodo_fim: z.string().datetime({ message: 'Data de fim deve ser ISO 8601' }).optional(),
  motivo_ajuste: z.string().min(5).max(300)
}).strict();

export const criarLotePayloadSchema = z.object({
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  fazenda_id: z.string().min(1, 'ID da fazenda é obrigatório'),
  pasto_id: z.string().min(1, 'ID do pasto é obrigatório'),
  nome_lote: z.string().min(2, 'Nome do lote deve ter ao menos 2 caracteres').max(80),
  categoria_animal: z.enum(['bezerro', 'bezerra', 'garrote', 'novilha', 'boi_magro', 'boi_gordo', 'vaca_solteira', 'vaca_prenha', 'touro']),
  quantidade_cabecas: z.number().int().positive('Quantidade de cabeças deve ser positiva'),
  peso_medio_inicial_kg: z.number().positive('Peso médio deve ser positivo').max(1500),
  data_entrada: z.string().datetime({ message: 'Data de entrada deve ser ISO 8601' })
}).strict();

export const apropriarCustosPayloadSchema = z.object({
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  periodo_mes: z.number().int().min(1).max(12),
  periodo_ano: z.number().int().min(2020).max(2050),
  valor_total_apropriado: z.number().nonnegative('Valor apropriado não pode ser negativo'),
  itens_apropriacao: z.array(z.object({
    centro_custo: z.string().min(2).max(80),
    valor: z.number().nonnegative()
  })).min(1),
  data_apropriacao: z.string().datetime({ message: 'Data de apropriação deve ser ISO 8601' })
}).strict();

// ==========================================
// 3. ESCRITÓRIO (4 COMANDOS ADMINISTRATIVOS)
// ==========================================

export const itemNotaFiscalSchema = z.object({
  produto_descricao: z.string().min(2).max(100),
  quantidade: z.number().positive('Quantidade do item deve ser positiva'),
  unidade_medida: z.enum(['kg', 'sc', 'ton', 'un', 'litro', 'cabeca']),
  valor_unitario_brl: z.number().positive('Valor unitário deve ser positivo'),
  valor_total_item_brl: z.number().positive('Valor total do item deve ser positivo')
}).strict();

export const registrarNotaFiscalPayloadSchema = z.object({
  nota_fiscal_id: z.string().min(1, 'ID da NF é obrigatório'),
  numero_nf: z.string().min(1).max(50),
  serie: z.string().min(1).max(10),
  chave_acesso_nfe: z.string().regex(/^[0-9]{44}$/, 'Chave da NF-e deve conter exatamente 44 dígitos numéricos'),
  fornecedor_cnpj_cpf: z.string().min(11).max(18),
  fornecedor_nome: z.string().min(2).max(120),
  valor_total_brl: z.number().positive('Valor total da NF deve ser positivo'),
  data_emissao: z.string().datetime({ message: 'Data de emissão deve ser ISO 8601' }),
  itens: z.array(itemNotaFiscalSchema).min(1, 'Nota fiscal deve conter ao menos 1 item')
}).strict();

export const registrarCompraInsumoPayloadSchema = z.object({
  pedido_compra_id: z.string().min(1, 'ID do pedido é obrigatório'),
  fornecedor_id: z.string().min(1, 'ID do fornecedor é obrigatório'),
  produto_insumo_id: z.string().min(1, 'ID do insumo é obrigatório'),
  quantidade_pedida: z.number().positive('Quantidade pedida deve ser positiva'),
  unidade: z.enum(['kg', 'sc', 'ton', 'litro']),
  preco_unitario_brl: z.number().positive('Preço unitário deve ser positivo'),
  condicao_pagamento: z.enum(['a_vista', '30_dias', '30_60_dias', 'safra']),
  previsao_entrega: z.string().datetime({ message: 'Previsao de entrega deve ser ISO 8601' })
}).strict();

export const fecharCustoLotePayloadSchema = z.object({
  lote_id: z.string().min(1, 'ID do lote é obrigatório'),
  periodo_mes: z.number().int().min(1).max(12),
  periodo_ano: z.number().int().min(2020).max(2050),
  custo_nutricao_brl: z.number().nonnegative(),
  custo_sanidade_brl: z.number().nonnegative(),
  custo_pastagem_brl: z.number().nonnegative(),
  custo_operacional_brl: z.number().nonnegative(),
  valor_total_apropriado_brl: z.number().nonnegative(),
  fechado_em: z.string().datetime({ message: 'Data de fechamento deve ser ISO 8601' })
}).strict();

export const emitirRelatorioFinanceiroPayloadSchema = z.object({
  relatorio_id: z.string().min(1, 'ID do relatório é obrigatório'),
  tipo_relatorio: z.enum(['dre_fazenda', 'custo_por_arroba_produzida', 'extrato_insumos', 'fluxo_caixa_operacional']),
  data_inicio: z.string().datetime({ message: 'Data de início deve ser ISO 8601' }),
  data_fim: z.string().datetime({ message: 'Data de fim deve ser ISO 8601' }),
  incluir_projecoes: z.boolean(),
  formato_exportacao: z.enum(['json', 'pdf', 'csv'])
}).strict();

export const particionarLotePayloadSchema = z.object({
  lote_origem_id: z.string().min(1, 'ID do lote de origem é obrigatório'),
  novos_lotes: z.array(z.object({
    nome_lote: z.string().min(2).max(80),
    pasto_destino_id: z.string().min(1, 'ID do pasto é obrigatório'),
    quantidade_cabecas: z.number().int().positive('Quantidade de cabeças deve ser positiva'),
    peso_medio_kg: z.number().positive('Peso médio deve ser positivo')
  })).min(1, 'Deve gerar ao menos 1 lote'),
  data_particao: z.string().datetime({ message: 'Data da partição deve ser ISO 8601' })
}).strict();

// ==========================================
// 4. FÁBRICA (5 COMANDOS INDUSTRIAIS)
// ==========================================

export const ingredienteFormulaSchema = z.object({
  materia_prima_id: z.string().min(1, 'ID da matéria-prima é obrigatório'),
  nome_ingrediente: z.string().min(2).max(80),
  porcentagem_inclusao: z.number().positive('Porcentagem de inclusão deve ser positiva').max(100)
}).strict();

export const criarFormulaRacaoPayloadSchema = z.object({
  formula_id: z.string().min(1, 'ID da fórmula é obrigatório'),
  nome_formula: z.string().min(2).max(80),
  tipo_raca_destino: z.enum(['mineral_linha_branca', 'proteinado_aguas', 'proteinado_seca', 'proteico_energetico', 'racao_confinamento', 'nucleo']),
  ingredientes: z.array(ingredienteFormulaSchema).min(1, 'Fórmula deve ter ao menos 1 ingrediente'),
  tamanho_batida_padrao_kg: z.number().positive('Tamanho padrão da batida deve ser positivo').max(10000),
  ativo: z.boolean()
}).strict();

export const registrarBatidaPayloadSchema = z.object({
  batida_id: z.string().min(1, 'ID da batida é obrigatório'),
  ordem_producao_id: z.string().min(1, 'ID da ordem de produção é obrigatório'),
  formula_id: z.string().min(1, 'ID da fórmula é obrigatório'),
  quantidade_planejada_kg: z.number().positive('Quantidade planejada deve ser positiva'),
  quantidade_realizada_kg: z.number().positive('Quantidade realizada deve ser positiva'),
  misturador_id: z.string().min(1, 'ID do misturador é obrigatório'),
  tempo_mistura_segundos: z.number().int().min(30, 'Tempo mínimo de mistura é 30s').max(3600),
  operador_id: z.string().min(1, 'ID do operador é obrigatório'),
  iniciado_em: z.string().datetime({ message: 'Início deve ser ISO 8601' }),
  finalizado_em: z.string().datetime({ message: 'Fim deve ser ISO 8601' }),
  desvio_peso_kg: z.number()
}).strict();

export const darBaixaIngredientePayloadSchema = z.object({
  baixa_id: z.string().min(1, 'ID da baixa é obrigatório'),
  batida_id: z.string().min(1, 'ID da batida é obrigatório'),
  materia_prima_id: z.string().min(1, 'ID da matéria-prima é obrigatório'),
  quantidade_consumida_kg: z.number().positive('Quantidade consumida deve ser positiva'),
  lote_materia_prima: z.string().min(1).max(40),
  silo_origem_id: z.string().min(1, 'ID do silo de origem é obrigatório'),
  data_baixa: z.string().datetime({ message: 'Data da baixa deve ser ISO 8601' })
}).strict();

export const ajustarEstoqueMateriaPrimaPayloadSchema = z.object({
  materia_prima_id: z.string().min(1, 'ID da matéria-prima é obrigatório'),
  silo_id: z.string().min(1, 'ID do silo é obrigatório'),
  quantidade_anterior_kg: z.number().nonnegative(),
  quantidade_ajustada_kg: z.number().nonnegative('Estoque ajustado não pode ser negativo'),
  tipo_ajuste: z.enum(['inventario_fisico', 'perda_umidade', 'avaria', 'sobra_processo', 'acerto_balanca']),
  justificativa: z.string().min(5).max(300),
  ajustado_em: z.string().datetime({ message: 'Data do ajuste deve ser ISO 8601' })
}).strict();

export const calibrarBalancaMisturadorPayloadSchema = z.object({
  balanca_id: z.string().min(1, 'ID da balança é obrigatório'),
  equipamento_tipo: z.enum(['balanca_silos', 'balanca_ensaque', 'celula_carga_misturador', 'balanca_rodoviaria']),
  peso_padrao_afericao_kg: z.number().positive('Peso padrão deve ser positivo'),
  peso_medido_kg: z.number().positive('Peso medido deve ser positivo'),
  desvio_percentual: z.number().min(-10).max(10),
  calibrado: z.boolean(),
  certificado_afericao_numero: z.string().max(60).optional(),
  proxima_calibracao_data: z.string().datetime({ message: 'Próxima calibração deve ser ISO 8601' }),
  data_calibracao: z.string().datetime({ message: 'Data de calibração deve ser ISO 8601' })
}).strict();

export const receberMateriaPrimaPayloadSchema = z.object({
  recebimento_id: z.string().min(1, 'ID do recebimento é obrigatório'),
  materia_prima_id: z.string().min(1, 'ID da matéria-prima é obrigatório'),
  silo_destino_id: z.string().min(1, 'ID do silo é obrigatório'),
  quantidade_kg: z.number().positive('Quantidade recebida deve ser positiva'),
  nota_fiscal_id: z.string().min(1).optional(),
  lote_fornecedor: z.string().min(1).max(50),
  recebido_em: z.string().datetime({ message: 'Data de recebimento deve ser ISO 8601' })
}).strict();

// ==========================================
// 5. ADM GLOBAL (4 COMANDOS SAAS DE BACKOFFICE)
// ==========================================

export const criarTenantPayloadSchema = z.object({
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  razao_social: z.string().min(3).max(120),
  nome_fantasia: z.string().min(2).max(80),
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter exatamente 14 dígitos numéricos'),
  plano: z.enum(['starter', 'profissional', 'enterprise', 'custom']),
  limite_fazendas: z.number().int().min(1).max(1000),
  limite_cabecas: z.number().int().min(1).max(500000),
  admin_email: z.string().email('E-mail do administrador deve ser válido'),
  admin_nome: z.string().min(2).max(80)
}).strict();

export const ativarModuloPayloadSchema = z.object({
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  fazenda_id: z.string().min(1).nullable().optional(),
  modulo_id: z.enum(['gerente', 'capataz', 'escritorio', 'fabrica', 'relatto_integracao', 'offline_pack']),
  ativo: z.boolean(),
  vigencia_inicio: z.string().datetime({ message: 'Vigência de início deve ser ISO 8601' }),
  vigencia_fim: z.string().datetime({ message: 'Vigência de fim deve ser ISO 8601' }).nullable().optional(),
  motivo_ativacao: z.string().min(3).max(200)
}).strict();

export const suspenderTenantPayloadSchema = z.object({
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  motivo_suspensao: z.enum(['inadimplencia', 'solicitacao_cliente', 'violacao_termos', 'auditoria_seguranca']),
  detalhes: z.string().min(5).max(500),
  suspender_imediatamente: z.boolean(),
  suspenso_em: z.string().datetime({ message: 'Data de suspensão deve ser ISO 8601' })
}).strict();

export const bloquearUsuarioPayloadSchema = z.object({
  usuario_id: z.string().min(1, 'ID do usuário é obrigatório'),
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  motivo_bloqueio: z.enum(['inadimplencia', 'desligamento_colaborador', 'violacao_seguranca', 'solicitacao_gestor', 'manutencao_cadastral']),
  detalhes_bloqueio: z.string().min(5).max(500),
  revogar_sessoes_ativas: z.boolean(),
  bloqueado_em: z.string().datetime({ message: 'Data de bloqueio deve ser ISO 8601' })
}).strict();

export const vincularUsuarioPayloadSchema = z.object({
  usuario_id: z.string().min(1, 'ID do usuário é obrigatório'),
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  fazenda_id: z.string().min(1, 'ID da fazenda é obrigatório'),
  profile_id: z.enum(['gerente', 'capataz', 'escritorio', 'fabrica', 'administrador']),
  ativo: z.boolean(),
  vinculado_em: z.string().datetime({ message: 'Data de vinculação deve ser ISO 8601' })
}).strict();

export const gerarLicencaOffgridPayloadSchema = z.object({
  licenca_id: z.string().min(1, 'ID da licença é obrigatório'),
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  fazenda_id: z.string().min(1, 'ID da fazenda é obrigatório'),
  dispositivo_id: z.string().min(1, 'ID do dispositivo é obrigatório'),
  dias_validade_offgrid: z.number().int().min(1, 'Validade mínima de 1 dia').max(90, 'Validade máxima de 90 dias'),
  modulos_autorizados: z.array(z.enum(['gerente', 'capataz', 'escritorio', 'fabrica'])).min(1, 'Ao menos um módulo autorizado'),
  chave_assinatura_publica: z.string().min(32).max(512),
  gerado_em: z.string().datetime({ message: 'Data de geração deve ser ISO 8601' })
}).strict();

export const atualizarLicencaPayloadSchema = z.object({
  licenca_id: z.string().min(1, 'ID da licença é obrigatório'),
  tenant_id: z.string().min(1, 'ID do tenant é obrigatório'),
  novo_status: z.enum(['ativa', 'suspensa', 'revogada', 'expirada']),
  justificativa: z.string().min(5).max(300),
  atualizado_em: z.string().datetime({ message: 'Data de atualização deve ser ISO 8601' })
}).strict();
