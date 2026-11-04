import { UserProfileId } from '../envelope';

/**
 * Matriz Declarativa RBAC 5x22:
 * Mapeamento estrito entre os 5 perfis operacionais e os 22 comandos autorizados da allowlist.
 * Política de Fail-Closed e Deny-by-Default em tempo de execução.
 */
export const RBAC_PROFILE_COMMANDS: Record<UserProfileId, readonly string[]> = {
  capataz: [
    'capataz.salga.lancar',
    'capataz.cocho.registrar_escore',
    'capataz.cocho.foto_adicionar',
    'capataz.pasto.leitura_qr',
    'capataz.animais.contagem',
    // Aliases de domínio
    'lancamento_cocho',
    'pesagem_animal',
    'contagem_rebanho',
    'leitura_pasto',
    'movimentacao_lote'
  ],
  gerente: [
    'gerente.metas.definir',
    'gerente.gmd.ajustar_curva',
    'gerente.lote.transferir_pasto',
    'gerente.custos.apropriar',
    // Aliases de domínio
    'definir_metas',
    'aprovar_leitura_cocho',
    'ajustar_dieta',
    'criar_lote'
  ],
  escritorio: [
    'escritorio.compras.criar_pedido',
    'escritorio.notas.registrar_entrada',
    'escritorio.lotes.cadastrar',
    'escritorio.lotes.particionar',
    // Aliases de domínio
    'registrar_nota_fiscal',
    'registrar_compra_insumo',
    'fechar_custo_lote',
    'emitir_relatorio_financeiro'
  ],
  fabrica: [
    'fabrica.formulas.salvar',
    'fabrica.batidas.iniciar',
    'fabrica.batidas.concluir',
    'fabrica.estoque.ajustar',
    'fabrica.materia_prima.receber',
    // Aliases de domínio
    'criar_formula_racao',
    'registrar_batida',
    'dar_baixa_ingrediente',
    'ajustar_estoque_materia_prima',
    'calibrar_balanca_misturador'
  ],
  administrador: [
    'admin.tenants.criar',
    'admin.tenants.suspender',
    'admin.licencas.atualizar',
    'admin.usuarios.vincular',
    // Aliases de domínio
    'criar_tenant',
    'ativar_modulo',
    'bloquear_usuario',
    'gerar_licenca_offgrid'
  ]
};

/**
 * Mapeamento invertido: cada comando mapeado para a lista de perfis autorizados a executá-lo.
 */
export const COMMAND_PERMISSIONS: Record<string, readonly UserProfileId[]> = Object.entries(
  RBAC_PROFILE_COMMANDS
).reduce((acc, [profile, commands]) => {
  commands.forEach(cmd => {
    if (!acc[cmd]) {
      acc[cmd] = [];
    }
    acc[cmd].push(profile as UserProfileId);
  });
  return acc;
}, {} as Record<string, UserProfileId[]>);

/**
 * Validação RBAC estrita em tempo de execução:
 * Retorna true se e somente se o perfil tiver permissão explícita para o comando.
 */
export function isProfileAuthorizedForCommand(
  profile: UserProfileId,
  commandType: string
): boolean {
  const allowed = RBAC_PROFILE_COMMANDS[profile];
  if (!allowed) return false;
  return allowed.includes(commandType);
}
