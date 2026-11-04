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
  // Escritório (Administração da Fazenda)
  'escritorio.compras.criar_pedido',
  'escritorio.notas.registrar_entrada',
  'escritorio.lotes.cadastrar',
  'escritorio.lotes.particionar',
  // Fábrica (Nutrição e Moagem)
  'fabrica.formulas.salvar',
  'fabrica.batidas.iniciar',
  'fabrica.batidas.concluir',
  'fabrica.estoque.ajustar',
  'fabrica.materia_prima.receber',
  // ADM Global (SaaS Backoffice)
  'admin.tenants.criar',
  'admin.tenants.suspender',
  'admin.licencas.atualizar',
  'admin.usuarios.vincular'
] as const;

export type AllowedCommandType = typeof ALLOWED_COMMAND_TYPES[number];

export function isAllowedCommand(commandType: string): commandType is AllowedCommandType {
  return (ALLOWED_COMMAND_TYPES as readonly string[]).includes(commandType);
}
