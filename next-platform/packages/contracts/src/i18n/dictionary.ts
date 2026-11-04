import { SupportedLanguage } from './types';

export const APP_DICTIONARY: Record<SupportedLanguage, Record<string, string>> = {
  'pt-BR': {
    // Perfis Operacionais
    'role.capataz': 'Capataz',
    'role.gerente': 'Gerente',
    'role.escritorio': 'Escritório',
    'role.fabrica': 'Fábrica de Ração',
    'role.administrador': 'Administrador Global',

    // Entidades e Termos Zootécnicos
    'domain.fazenda': 'Fazenda',
    'domain.retiro': 'Retiro',
    'domain.pasto': 'Pasto',
    'domain.cocho': 'Cocho',
    'domain.lote': 'Lote',
    'domain.animal': 'Animal',
    'domain.salga': 'Salga e Nutrição',
    'domain.misturador': 'Misturador',
    'domain.batida': 'Batida de Ração',
    'domain.silo': 'Silo de Armazenagem',
    'domain.materia_prima': 'Matéria-Prima',
    'domain.formula': 'Fórmula Nutricional',
    'domain.gmd': 'Ganho Médio Diário (GMD)',
    'domain.escore_cocho': 'Escore de Cocho',
    'domain.pesagem': 'Pesagem',
    'domain.nota_fiscal': 'Nota Fiscal',
    'domain.ordem_compra': 'Ordem de Compra',

    // Ações e Botões Comuns
    'action.save': 'Salvar',
    'action.cancel': 'Cancelar',
    'action.confirm': 'Confirmar',
    'action.delete': 'Excluir',
    'action.edit': 'Editar',
    'action.login': 'Entrar',
    'action.logout': 'Sair',
    'action.selectContext': 'Selecionar Contexto',
    'action.syncNow': 'Sincronizar Agora',
    'action.downloadApp': 'Baixar App',
    'action.back': 'Voltar',
    'action.retry': 'Tentar Novamente',
    'action.refresh': 'Atualizar',

    // Mensagens de Status e Sincronização
    'status.online': 'Conectado',
    'status.offline': 'Modo Campo Off-Grid',
    'status.syncing': 'Sincronizando com a API...',
    'status.synced': 'Todos os comandos sincronizados',
    'status.pending': 'Comandos pendentes de sincronização',
    'status.conflict': 'Conflito de concorrência detectado',
    'status.error': 'Erro de comunicação',

    // Erros da Barreira Central da API
    'api.error.unauthorized': 'Acesso não autenticado. Token Bearer ausente ou inválido.',
    'api.error.invalid_token': 'Token sintético expirado ou com assinatura inválida.',
    'api.error.context_mismatch': 'Violação de isolamento multi-tenant: contexto do token diverge do envelope.',
    'api.error.profile_mismatch': 'Violação de perfil: perfil do token diverge do envelope.',
    'api.error.forbidden_command': 'Comando não autorizado para o perfil atual.',
    'api.error.invalid_envelope': 'Envelope de comando atômico estruturalmente inválido.',
    'api.error.invalid_domain_payload': 'Payload de dados viola as regras de validação do domínio.',
    'api.error.concurrency_conflict': 'Conflito de concorrência: a versão base do registro divergiu no servidor.',
    'api.error.command_not_allowed': 'Comando desconhecido fora da allowlist autorizada.'
  },
  'en-US': {
    // Operational Roles
    'role.capataz': 'Ranch Supervisor',
    'role.gerente': 'Manager',
    'role.escritorio': 'Office',
    'role.fabrica': 'Feed Mill',
    'role.administrador': 'Global Administrator',

    // Entities and Livestock Terms
    'domain.fazenda': 'Ranch',
    'domain.retiro': 'Ranch Unit',
    'domain.pasto': 'Pasture',
    'domain.cocho': 'Trough',
    'domain.lote': 'Herd Lot',
    'domain.animal': 'Cattle',
    'domain.salga': 'Salt Supplementation',
    'domain.misturador': 'Feed Mixer',
    'domain.batida': 'Feed Batch',
    'domain.silo': 'Storage Silo',
    'domain.materia_prima': 'Raw Material',
    'domain.formula': 'Nutritional Formula',
    'domain.gmd': 'Average Daily Gain (ADG)',
    'domain.escore_cocho': 'Trough Score',
    'domain.pesagem': 'Weighing',
    'domain.nota_fiscal': 'Invoice / NF-e',
    'domain.ordem_compra': 'Purchase Order',

    // Common Actions and Buttons
    'action.save': 'Save',
    'action.cancel': 'Cancel',
    'action.confirm': 'Confirm',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.login': 'Sign In',
    'action.logout': 'Sign Out',
    'action.selectContext': 'Select Context',
    'action.syncNow': 'Sync Now',
    'action.downloadApp': 'Download App',
    'action.back': 'Back',
    'action.retry': 'Try Again',
    'action.refresh': 'Refresh',

    // Status and Sync Messages
    'status.online': 'Connected',
    'status.offline': 'Off-Grid Field Mode',
    'status.syncing': 'Syncing with API...',
    'status.synced': 'All commands synchronized',
    'status.pending': 'Commands pending synchronization',
    'status.conflict': 'Concurrency conflict detected',
    'status.error': 'Communication error',

    // Central API Barrier Errors
    'api.error.unauthorized': 'Unauthenticated request. Bearer token missing or invalid.',
    'api.error.invalid_token': 'Synthetic token expired or has invalid signature.',
    'api.error.context_mismatch': 'Multi-tenant isolation breach: token context does not match envelope.',
    'api.error.profile_mismatch': 'Profile violation: token profile does not match envelope.',
    'api.error.forbidden_command': 'Command not authorized for the current profile.',
    'api.error.invalid_envelope': 'Atomic command envelope structurally invalid.',
    'api.error.invalid_domain_payload': 'Data payload violates domain validation rules.',
    'api.error.concurrency_conflict': 'Concurrency conflict: record base version diverged on server.',
    'api.error.command_not_allowed': 'Unknown command outside authorized allowlist.'
  }
};

/**
 * Função utilitária pura de tradução com fallback estrito:
 * 1. Procura na língua solicitada
 * 2. Se não encontrar, tenta em pt-BR
 * 3. Se não encontrar, usa fallback fornecido ou a própria chave
 */
export function translateKey(
  language: SupportedLanguage,
  key: string,
  fallback?: string
): string {
  const langDict = APP_DICTIONARY[language];
  if (langDict && Object.prototype.hasOwnProperty.call(langDict, key) && langDict[key] !== undefined) {
    return langDict[key]!;
  }
  const ptDict = APP_DICTIONARY['pt-BR'];
  if (ptDict && Object.prototype.hasOwnProperty.call(ptDict, key) && ptDict[key] !== undefined) {
    return ptDict[key]!;
  }
  return fallback ?? key;
}
