import { z } from 'zod';
import * as schemas from './commands.schema';

/**
 * Registro Canônico de Validadores de Domínio Zod por Tipo de Comando.
 * Mapeia os 22 comandos autorizados (tanto em formato qualificado quanto aliases).
 */
export const DOMAIN_PAYLOAD_VALIDATORS: Record<string, z.ZodType<any>> = {
  // Capataz
  'capataz.salga.lancar': schemas.lancamentoCochoPayloadSchema,
  'capataz.cocho.registrar_escore': schemas.lancamentoCochoPayloadSchema,
  'capataz.cocho.foto_adicionar': schemas.fotoCochoPayloadSchema,
  'capataz.pasto.leitura_qr': schemas.leituraPastoPayloadSchema,
  'capataz.animais.contagem': schemas.contagemRebanhoPayloadSchema,

  // Aliases de Domínio Capataz
  'lancamento_cocho': schemas.lancamentoCochoPayloadSchema,
  'pesagem_animal': schemas.pesagemAnimalPayloadSchema,
  'contagem_rebanho': schemas.contagemRebanhoPayloadSchema,
  'leitura_pasto': schemas.leituraPastoPayloadSchema,
  'movimentacao_lote': schemas.movimentacaoLotePayloadSchema,

  // Gerente
  'gerente.metas.definir': schemas.definirMetasPayloadSchema,
  'gerente.gmd.ajustar_curva': schemas.ajustarDietaPayloadSchema,
  'gerente.lote.transferir_pasto': schemas.movimentacaoLotePayloadSchema,
  'gerente.custos.apropriar': schemas.apropriarCustosPayloadSchema,

  // Aliases de Domínio Gerente
  'definir_metas': schemas.definirMetasPayloadSchema,
  'aprovar_leitura_cocho': schemas.aprovarLeituraCochoPayloadSchema,
  'ajustar_dieta': schemas.ajustarDietaPayloadSchema,
  'criar_lote': schemas.criarLotePayloadSchema,

  // Escritório
  'escritorio.compras.criar_pedido': schemas.registrarCompraInsumoPayloadSchema,
  'escritorio.notas.registrar_entrada': schemas.registrarNotaFiscalPayloadSchema,
  'escritorio.lotes.cadastrar': schemas.criarLotePayloadSchema,
  'escritorio.lotes.particionar': schemas.particionarLotePayloadSchema,

  // Aliases de Domínio Escritório
  'registrar_nota_fiscal': schemas.registrarNotaFiscalPayloadSchema,
  'registrar_compra_insumo': schemas.registrarCompraInsumoPayloadSchema,
  'fechar_custo_lote': schemas.fecharCustoLotePayloadSchema,
  'emitir_relatorio_financeiro': schemas.emitirRelatorioFinanceiroPayloadSchema,

  // Fábrica
  'fabrica.formulas.salvar': schemas.criarFormulaRacaoPayloadSchema,
  'fabrica.batidas.iniciar': schemas.registrarBatidaPayloadSchema,
  'fabrica.batidas.concluir': schemas.registrarBatidaPayloadSchema,
  'fabrica.estoque.ajustar': schemas.ajustarEstoqueMateriaPrimaPayloadSchema,
  'fabrica.materia_prima.receber': schemas.receberMateriaPrimaPayloadSchema,

  // Aliases de Domínio Fábrica
  'criar_formula_racao': schemas.criarFormulaRacaoPayloadSchema,
  'registrar_batida': schemas.registrarBatidaPayloadSchema,
  'dar_baixa_ingrediente': schemas.darBaixaIngredientePayloadSchema,
  'ajustar_estoque_materia_prima': schemas.ajustarEstoqueMateriaPrimaPayloadSchema,
  'calibrar_balanca_misturador': schemas.calibrarBalancaMisturadorPayloadSchema,

  // ADM Global
  'admin.tenants.criar': schemas.criarTenantPayloadSchema,
  'admin.tenants.suspender': schemas.suspenderTenantPayloadSchema,
  'admin.licencas.atualizar': schemas.atualizarLicencaPayloadSchema,
  'admin.usuarios.vincular': schemas.vincularUsuarioPayloadSchema,

  // Aliases de Domínio ADM Global
  'criar_tenant': schemas.criarTenantPayloadSchema,
  'ativar_modulo': schemas.ativarModuloPayloadSchema,
  'bloquear_usuario': schemas.bloquearUsuarioPayloadSchema,
  'gerar_licenca_offgrid': schemas.gerarLicencaOffgridPayloadSchema
};

export type ValidatePayloadResult =
  | { success: true; data: any }
  | { success: false; errors: z.ZodIssue[] };

/**
 * Validador em tempo de execução com fail-closed para payloads de comandos de domínio.
 */
export function validateCommandPayload(
  commandType: string,
  payload: unknown
): ValidatePayloadResult {
  const schema = DOMAIN_PAYLOAD_VALIDATORS[commandType];
  if (!schema) {
    // Se não houver validador registrado, rejeita por segurança (fail-closed)
    return {
      success: false,
      errors: [
        {
          code: 'custom',
          message: `Nenhum schema de validação registrado para o comando '${commandType}'.`,
          path: []
        }
      ]
    };
  }

  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error.issues };
  }
}
