import { UserProfileId } from '../envelope';
import {
  RBAC_PROFILE_COMMANDS,
  COMMAND_PERMISSIONS,
  isProfileAuthorizedForCommand
} from '../rbac/permissions';

export {
  RBAC_PROFILE_COMMANDS,
  COMMAND_PERMISSIONS,
  isProfileAuthorizedForCommand
};

export const ALLOWED_COMMAND_TYPES = [
  // Capataz (Campo Crítico)
  'capataz.salga.lancar',
  'capataz.cocho.registrar_escore',
  'capataz.cocho.foto_adicionar',
  'capataz.pasto.leitura_qr',
  'capataz.animais.contagem',
  // Gerente (Gestão Analítica)
  'gerente.metas.definir',
  'gerente.gmd.ajustar_curva',
  'gerente.lote.transferir_pasto',
  'gerente.custos.apropriar',
  'gerente.leitura_cocho.aprovar',
  // Escritório (Administração da Fazenda)
  'escritorio.compras.criar_pedido',
  'escritorio.notas.registrar_entrada',
  'escritorio.lotes.cadastrar',
  'escritorio.lotes.particionar',
  'escritorio.custos.fechar',
  'escritorio.relatorios.emitir',
  // Fábrica (Nutrição e Moagem)
  'fabrica.formulas.salvar',
  'fabrica.batidas.iniciar',
  'fabrica.batidas.concluir',
  'fabrica.estoque.ajustar',
  'fabrica.materia_prima.receber',
  'fabrica.ingrediente.dar_baixa',
  'fabrica.balanca.calibrar',
  // ADM Global (SaaS Backoffice)
  'admin.tenants.criar',
  'admin.tenants.suspender',
  'admin.licencas.atualizar',
  'admin.usuarios.vincular'
] as const;

export const DOMAIN_COMMAND_ALIASES = [
  'pesagem_animal',
  'lancamento_cocho',
  'contagem_rebanho',
  'leitura_pasto',
  'movimentacao_lote',
  'definir_metas',
  'aprovar_leitura_cocho',
  'ajustar_dieta',
  'criar_lote',
  'registrar_nota_fiscal',
  'registrar_compra_insumo',
  'fechar_custo_lote',
  'emitir_relatorio_financeiro',
  'criar_formula_racao',
  'registrar_batida',
  'dar_baixa_ingrediente',
  'ajustar_estoque_materia_prima',
  'calibrar_balanca_misturador',
  'criar_tenant',
  'ativar_modulo',
  'bloquear_usuario',
  'gerar_licenca_offgrid'
] as const;

export type AllowedCommandType = typeof ALLOWED_COMMAND_TYPES[number];

export function isAllowedCommand(commandType: string): boolean {
  return (
    (ALLOWED_COMMAND_TYPES as readonly string[]).includes(commandType) ||
    (DOMAIN_COMMAND_ALIASES as readonly string[]).includes(commandType)
  );
}

/**
 * Constrói a chave composta e isolada do agregado multi-tenant:
 * ${tenant_id}::${aggregate_type}::${aggregate_id}
 */
export function buildAggregateKey(
  tenantId: string,
  aggregateType: string,
  aggregateId: string
): string {
  return `${tenantId}::${aggregateType}::${aggregateId}`;
}

/**
 * Constrói a chave composta de deduplicação idempotente multi-tenant:
 * ${tenant_id}::${idempotency_key}
 */
export function buildIdempotencyKey(
  tenantId: string,
  idempotencyKey: string
): string {
  return `${tenantId}::${idempotencyKey}`;
}
