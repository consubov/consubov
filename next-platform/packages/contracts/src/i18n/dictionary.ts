import { SupportedLanguage, I18nParams } from './types';
import { interpolate } from './interpolate';

export const APP_DICTIONARY: Record<SupportedLanguage, Record<string, string>> = {
  'pt-BR': {
    // Identidade do App, Shell & Cabeçalho Global
    'app.name': 'CONSUBOV Fazendas',
    'app.subtitle': 'Plataforma de Gestão Pecuária de Alta Performance',
    'app.version': 'Versão {version}',
    'app.tagline': 'Tecnologia que move a pecuária',

    'shell.app.title': 'CONSUBOV Fazendas',
    'shell.app.tagline': 'Gestão Pecuária Integrada',

    'shell.header.activeFarm': 'Fazenda:',
    'shell.header.activeUnit': 'Retiro:',
    'shell.header.activeProfile': 'Perfil:',
    'shell.header.switchContext': 'Trocar Perfil / Fazenda',
    'shell.header.switchContextAria': 'Contexto ativo: {farm}, perfil {role}. Pressione para trocar de fazenda ou perfil.',
    'shell.header.currentContextAria': 'Contexto ativo: {farm}, perfil {role}',
    'shell.header.language': 'Idioma',
    'shell.header.languageAria': 'Idioma / Language',
    'shell.header.notifications': 'Notificações',
    'shell.header.menu': 'Abrir Menu de Navegação',

    'shell.logout.button': 'Sair',
    'shell.logout.confirmTitle': 'Confirmar Saída',
    'shell.logout.confirmMessage': 'Deseja realmente encerrar a sessão neste dispositivo?',
    'shell.logout.offlineNotice': 'Seus dados salvos localmente e comandos pendentes permanecerão protegidos no banco de dados local.',
    'shell.logout.confirmAction': 'Sim, Sair',
    'shell.logout.cancelAction': 'Permanecer Conectado',

    // Shell Login View
    'shell.login.title': 'Entrar no CONSUBOV Fazendas',
    'shell.login.subtitle': 'Acesse sua conta para operar em campo ou escritório',
    'shell.login.emailLabel': 'E-mail de Acesso',
    'shell.login.emailPlaceholder': 'ex: gerente@consubov.local',
    'shell.login.passwordLabel': 'Senha',
    'shell.login.passwordPlaceholder': '••••••••',
    'shell.login.rememberEmail': 'Lembrar meu e-mail neste aparelho',
    'shell.login.submitButton': 'Entrar no Sistema',
    'shell.login.submitting': 'Autenticando sessão...',
    'shell.login.quickFillTitle': 'Acesso Rápido de Bancada (Sintético)',
    'shell.login.quickFillAria': 'Preencher como {role}',
    'shell.login.errorInvalid': 'E-mail ou senha inválidos. Verifique suas credenciais.',
    'shell.login.errorInactive': 'Acesso Negado: Usuário inativo ou sem vínculos autorizados.',

    // Auth Login Unificado
    'auth.login.title': 'Acessar Sistema',
    'auth.login.subtitle': 'Entre com suas credenciais para gerenciar a operação',
    'auth.login.emailLabel': 'E-mail Profissional',
    'auth.login.emailPlaceholder': 'seu.email@fazenda.com.br',
    'auth.login.passwordLabel': 'Senha',
    'auth.login.passwordPlaceholder': '••••••••',
    'auth.login.rememberMe': 'Lembrar meu e-mail neste aparelho',
    'auth.login.forgotPassword': 'Esqueceu a senha?',
    'auth.login.submitButton': 'Entrar no Sistema',
    'auth.login.submitting': 'Autenticando credenciais...',
    'auth.login.helpText': 'Acesso seguro e isolado por fazenda',
    'auth.login.fieldRequired': 'Este campo é de preenchimento obrigatório.',
    'auth.login.emailInvalid': 'Por favor, insira um endereço de e-mail válido.',
    'auth.login.passwordMinLength': 'A senha deve ter no mínimo 6 caracteres.',
    'auth.login.invalidCredentials': 'Credenciais inválidas. Verifique seu e-mail e senha.',
    'auth.login.userNotFound': 'Usuário não encontrado no sistema.',
    'auth.login.accountDisabled': 'Sua conta de acesso foi desativada ou suspensa. Contate o administrador.',
    'auth.login.networkError': 'Não foi possível contatar a API central. Operando no modo local.',
    'auth.login.syntheticDemoNotice': 'Modo de laboratório isolado com credenciais sintéticas.',

    // Seletor de Contexto (ISO-004 Anti-First-Match)
    'shell.context.title': 'Selecione o Contexto Operacional',
    'shell.context.subtitle': 'Escolha a fazenda e a função com a qual deseja trabalhar agora:',
    'shell.context.cardFazenda': 'Fazenda',
    'shell.context.cardRetiro': 'Retiro / Unidade',
    'shell.context.cardPerfil': 'Perfil Operacional',
    'shell.context.btnSelect': 'Acessar Este Contexto',
    'shell.context.btnSelectAria': 'Acessar fazenda {farm} no perfil {role}',
    'shell.context.selectFarmRoleAria': 'Trocar para fazenda {farm} no perfil {role}',
    'shell.context.isoPrefix': 'ISO-004:',
    'shell.context.noMemberships': 'Nenhum vínculo ativo encontrado para este usuário.',
    'shell.context.switchModalTitle': 'Trocar de Fazenda ou Perfil',

    'auth.context.title': 'Selecione seu Perfil e Fazenda',
    'auth.context.subtitle': 'Você possui múltiplos vínculos de acesso autorizados. Escolha o contexto de trabalho:',
    'auth.context.antiFirstMatchNotice': 'Regra de Segurança ISO-004: Nenhum perfil ou fazenda é selecionado automaticamente. A escolha explícita é obrigatória.',
    'auth.context.chooseRole': 'Perfil Operacional:',
    'auth.context.tenantLabel': 'Empresa / Tenant:',
    'auth.context.farmLabel': 'Fazenda Ativa:',
    'auth.context.unitLabel': 'Retiro Atribuído:',
    'auth.context.allUnits': 'Todos os retiros da fazenda',
    'auth.context.confirmSelection': 'Confirmar Seleção e Abrir Módulo',
    'auth.context.switchUser': 'Trocar de Usuário',
    'auth.context.noActiveMemberships': 'Nenhuma associação ativa foi encontrada para o seu usuário.',
    'auth.context.selectionRequired': 'Seleção obrigatória: Por favor, selecione um perfil antes de prosseguir.',
    'auth.context.unauthorizedRole': 'Você não tem autorização para operar o perfil selecionado.',
    'auth.context.capabilitiesCount': '{count} permissão(ões) autorizada(s)',

    // Barra Superior e Navegação
    'shell.nav.switchContext': 'Trocar Contexto',
    'shell.nav.logout': 'Sair',
    'shell.nav.logoutConfirm': 'Deseja realmente encerrar a sessão?',
    'shell.nav.currentContext': 'Contexto Ativo',
    'shell.nav.online': 'Conectado à Fazenda',
    'shell.nav.offline': 'Modo Campo Off-Grid',
    'shell.nav.ariaLabel': 'Navegação Operacional',

    // Acesso Negado (403 RBAC)
    'shell.denied.title': 'Acesso Não Autorizado',
    'shell.denied.message': 'Seu perfil ativo não possui permissão para acessar este módulo.',
    'shell.denied.back': 'Voltar ao Meu Módulo',
    'shell.denied.required': 'Requerido:',

    // Falha de Carregamento Modular
    'shell.error.moduleLoadTitle': 'Falha ao Carregar Módulo',
    'shell.error.moduleLoadDesc': 'Não foi possível carregar os arquivos deste módulo. Verifique sua conexão e tente novamente.',
    'shell.error.retry': 'Tentar Novamente',

    // Perfis Operacionais
    'role.capataz': 'Capataz',
    'role.capataz.title': 'Capataz de Campo',
    'role.capataz.desc': 'Leitura de cocho por pasto, fotos de escore, registro de salga, contagem de animais e operação 100% offline.',
    'role.gerente': 'Gerente',
    'role.gerente.title': 'Gerente de Produção',
    'role.gerente.desc': 'Metas de GMD, curvas de peso, fechamento de lotes, auditoria de cocho e custos analíticos.',
    'role.escritorio': 'Escritório',
    'role.escritorio.title': 'Escritório Administrativo',
    'role.escritorio.desc': 'Entrada de notas fiscais, pedidos de compra de insumos, conferência e fechamento financeiro de lotes.',
    'role.fabrica': 'Fábrica de Ração',
    'role.fabrica.title': 'Operador da Fábrica de Ração',
    'role.fabrica.desc': 'Execução de batidas de ração, fórmulas nutricionais, pesagem de ingredientes e controle de estoque de silos.',
    'role.administrador': 'Administrador Global',
    'role.administrador.title': 'Administrador Global da Plataforma',
    'role.administrador.desc': 'Governança SaaS multi-tenant, gestão de planos, licenças de operação e controle de acessos.',
    'role.multirole': 'Multi-Perfil',

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
    'action.close': 'Fechar',
    'action.delete': 'Excluir',
    'action.edit': 'Editar',
    'action.login': 'Entrar',
    'action.logout': 'Sair',
    'action.selectContext': 'Selecionar Contexto',
    'action.syncNow': 'Sincronizar Agora',
    'action.downloadApp': 'Baixar App',
    'action.installPwa': 'Instalar Aplicativo',
    'action.back': 'Voltar',
    'action.next': 'Avançar',
    'action.retry': 'Tentar Novamente',
    'action.refresh': 'Atualizar',
    'action.search': 'Buscar...',
    'action.filter': 'Filtrar',
    'action.clearFilters': 'Limpar Filtros',

    // Termos Universais
    'common.wait': 'Aguarde...',
    'common.loading': 'Carregando...',
    'common.success': 'Operação realizada com sucesso!',
    'common.error': 'Ocorreu um erro inesperado.',
    'common.yes': 'Sim',
    'common.no': 'Não',

    // Estados de Visualização (StateBoundary)
    'state.loading': 'Carregando dados operacionais...',
    'state.error': 'Ocorreu um erro ao carregar os dados desta visualização.',
    'state.empty': 'Nenhum registro cadastrado no momento.',
    'state.emptyRegion': 'Sem registros',
    'state.partial': 'Exibindo dados locais com snapshot desatualizado.',
    'state.noInternet': 'Sem conexão com a internet. Os dados locais estão disponíveis.',

    // Mensagens de Status e Sincronização
    'status.online': 'Conectado à API Central',
    'status.offline': 'Modo Campo Off-Grid (100% Offline)',
    'status.offlineDesc': 'Dados operacionais gravados no dispositivo com segurança local',
    'status.syncing': 'Sincronizando com a API central...',
    'status.synced': 'Todos os lançamentos estão sincronizados',
    'status.pending': 'Comandos pendentes de sincronização',
    'status.pendingCount': '{count} comando(s) aguardando sincronização',
    'status.conflict': 'Conflito de concorrência detectado (409)',
    'status.conflictAction': 'Resolver Conflito',
    'status.error': 'Falha na comunicação com o servidor',
    'status.syncNow': 'Sincronizar Agora',
    'status.quiescenceWaiting': 'Aguardando ponto seguro para sincronizar (câmera ou formulário ativo)',

    // Erros da Barreira Central da API
    'api.error.unauthorized': 'Acesso não autenticado. Token Bearer ausente ou inválido.',
    'api.error.invalid_token': 'Token sintético expirado ou com assinatura inválida.',
    'api.error.context_mismatch': 'Violação de isolamento multi-tenant: contexto do token diverge do envelope.',
    'api.error.profile_mismatch': 'Violação de perfil: perfil do token diverge do envelope.',
    'api.error.forbidden_command': 'Comando não autorizado para o perfil atual.',
    'api.error.invalid_envelope': 'Envelope de comando atômico estruturalmente inválido.',
    'api.error.invalid_domain_payload': 'Payload de dados viola as regras de validação do domínio.',
    'api.error.concurrency_conflict': 'Conflito de concorrência: a versão base do registro divergiu no servidor.',
    'api.error.command_not_allowed': 'Comando desconhecido fora da allowlist autorizada.',

    // Abas Semânticas de Navegação
    'nav.tab.overview': 'Visão Geral',
    'nav.tab.gmd': 'Curvas de GMD',
    'nav.tab.lots': 'Lotes e Animais',
    'nav.tab.field': 'Painel Campo',
    'nav.tab.trough': 'Escore de Cocho',
    'nav.tab.salt': 'Salga e Ronda',
    'nav.tab.office': 'Painel Escritório',
    'nav.tab.invoices': 'Notas Fiscais',
    'nav.tab.purchases': 'Ordens de Compra',
    'nav.tab.factory': 'Painel Fábrica',
    'nav.tab.batches': 'Batidas de Ração',
    'nav.tab.silos': 'Estoque de Silos',
    'nav.tab.admin': 'Administração'
  },
  'en-US': {
    // App Identity, Shell & Global Header
    'app.name': 'CONSUBOV Ranches',
    'app.subtitle': 'High-Performance Cattle Management Platform',
    'app.version': 'Version {version}',
    'app.tagline': 'Technology that moves livestock',

    'shell.app.title': 'CONSUBOV Ranches',
    'shell.app.tagline': 'Integrated Cattle Management',

    'shell.header.activeFarm': 'Ranch:',
    'shell.header.activeUnit': 'Ranch Unit:',
    'shell.header.activeProfile': 'Profile:',
    'shell.header.switchContext': 'Switch Profile / Ranch',
    'shell.header.switchContextAria': 'Active context: {farm}, role {role}. Press to switch ranch or profile.',
    'shell.header.currentContextAria': 'Active context: {farm}, role {role}',
    'shell.header.language': 'Language',
    'shell.header.languageAria': 'Idioma / Language',
    'shell.header.notifications': 'Notifications',
    'shell.header.menu': 'Open Navigation Menu',

    'shell.logout.button': 'Sign Out',
    'shell.logout.confirmTitle': 'Confirm Sign Out',
    'shell.logout.confirmMessage': 'Are you sure you want to sign out from this device?',
    'shell.logout.offlineNotice': 'Your locally stored data and pending commands will remain protected in local storage.',
    'shell.logout.confirmAction': 'Yes, Sign Out',
    'shell.logout.cancelAction': 'Stay Signed In',

    // Shell Login View
    'shell.login.title': 'Sign In to CONSUBOV Ranches',
    'shell.login.subtitle': 'Sign in to operate in field or office mode',
    'shell.login.emailLabel': 'Access Email',
    'shell.login.emailPlaceholder': 'e.g.: manager@consubov.local',
    'shell.login.passwordLabel': 'Password',
    'shell.login.passwordPlaceholder': '••••••••',
    'shell.login.rememberEmail': 'Remember my email on this device',
    'shell.login.submitButton': 'Sign In to System',
    'shell.login.submitting': 'Authenticating session...',
    'shell.login.quickFillTitle': 'Synthetic Test Quick Access',
    'shell.login.quickFillAria': 'Fill credentials as {role}',
    'shell.login.errorInvalid': 'Invalid email or password. Please verify your credentials.',
    'shell.login.errorInactive': 'Access Denied: Inactive user or no authorized memberships.',

    // Unified Auth Login
    'auth.login.title': 'Sign In to System',
    'auth.login.subtitle': 'Enter your credentials to manage ranch operations',
    'auth.login.emailLabel': 'Work Email',
    'auth.login.emailPlaceholder': 'your.email@ranch.com',
    'auth.login.passwordLabel': 'Password',
    'auth.login.passwordPlaceholder': '••••••••',
    'auth.login.rememberMe': 'Remember my email on this device',
    'auth.login.forgotPassword': 'Forgot password?',
    'auth.login.submitButton': 'Sign In',
    'auth.login.submitting': 'Authenticating credentials...',
    'auth.login.helpText': 'Secure, ranch-isolated access',
    'auth.login.fieldRequired': 'This field is required.',
    'auth.login.emailInvalid': 'Please enter a valid email address.',
    'auth.login.passwordMinLength': 'Password must be at least 6 characters.',
    'auth.login.invalidCredentials': 'Invalid credentials. Please check your email and password.',
    'auth.login.userNotFound': 'User not found in system.',
    'auth.login.accountDisabled': 'Your account has been disabled or suspended. Contact administrator.',
    'auth.login.networkError': 'Unable to contact central API. Operating in local mode.',
    'auth.login.syntheticDemoNotice': 'Isolated lab mode with synthetic credentials.',

    // Context Selector (ISO-004 Anti-First-Match)
    'shell.context.title': 'Select Operational Context',
    'shell.context.subtitle': 'Choose the ranch and role you wish to operate right now:',
    'shell.context.cardFazenda': 'Ranch',
    'shell.context.cardRetiro': 'Ranch Unit / Retreat',
    'shell.context.cardPerfil': 'Operational Role',
    'shell.context.btnSelect': 'Access This Context',
    'shell.context.btnSelectAria': 'Access ranch {farm} as {role}',
    'shell.context.selectFarmRoleAria': 'Switch to ranch {farm} as {role}',
    'shell.context.isoPrefix': 'ISO-004:',
    'shell.context.noMemberships': 'No active memberships found for this user.',
    'shell.context.switchModalTitle': 'Switch Ranch or Role',

    'auth.context.title': 'Select your Profile and Ranch',
    'auth.context.subtitle': 'You have multiple authorized access roles. Choose your work context:',
    'auth.context.antiFirstMatchNotice': 'Safety Rule ISO-004: No profile or ranch is automatically selected. Explicit choice is required.',
    'auth.context.chooseRole': 'Operational Profile:',
    'auth.context.tenantLabel': 'Company / Tenant:',
    'auth.context.farmLabel': 'Active Ranch:',
    'auth.context.unitLabel': 'Assigned Ranch Unit:',
    'auth.context.allUnits': 'All ranch units',
    'auth.context.confirmSelection': 'Confirm Selection and Enter Module',
    'auth.context.switchUser': 'Switch User',
    'auth.context.noActiveMemberships': 'No active memberships found for your user.',
    'auth.context.selectionRequired': 'Required selection: Please select a profile before continuing.',
    'auth.context.unauthorizedRole': 'You are not authorized to operate the selected profile.',
    'auth.context.capabilitiesCount': '{count} authorized capability(ies)',

    // Top Bar and Navigation
    'shell.nav.switchContext': 'Switch Context',
    'shell.nav.logout': 'Sign Out',
    'shell.nav.logoutConfirm': 'Are you sure you want to sign out?',
    'shell.nav.currentContext': 'Active Context',
    'shell.nav.online': 'Connected to Ranch',
    'shell.nav.offline': 'Off-Grid Field Mode',
    'shell.nav.ariaLabel': 'Operational Navigation',

    // Access Denied (403 RBAC)
    'shell.denied.title': 'Unauthorized Access',
    'shell.denied.message': 'Your active role does not have permission to access this module.',
    'shell.denied.back': 'Back to My Module',
    'shell.denied.required': 'Required:',

    // Module Loading Failure
    'shell.error.moduleLoadTitle': 'Failed to Load Module',
    'shell.error.moduleLoadDesc': 'Could not load assets for this module. Please check your connection and try again.',
    'shell.error.retry': 'Try Again',

    // Operational Roles
    'role.capataz': 'Ranch Supervisor',
    'role.capataz.title': 'Ranch Supervisor',
    'role.capataz.desc': 'Pasture trough reading, score photos, salt supplementation, herd counting, and 100% offline operation.',
    'role.gerente': 'Manager',
    'role.gerente.title': 'Production Manager',
    'role.gerente.desc': 'ADG targets, weight curves, lot closing, trough audit, and cost analytics.',
    'role.escritorio': 'Office',
    'role.escritorio.title': 'Administrative Office',
    'role.escritorio.desc': 'Invoice intake, supply purchase orders, verification, and lot financial reconciliation.',
    'role.fabrica': 'Feed Mill',
    'role.fabrica.title': 'Feed Mill Operator',
    'role.fabrica.desc': 'Feed batch execution, nutritional formulas, ingredient weighing, and silo inventory tracking.',
    'role.administrador': 'Global Administrator',
    'role.administrador.title': 'Global Platform Administrator',
    'role.administrador.desc': 'Multi-tenant SaaS governance, plan management, operating licenses, and access administration.',
    'role.multirole': 'Multi-Role',

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
    'action.close': 'Close',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.login': 'Sign In',
    'action.logout': 'Sign Out',
    'action.selectContext': 'Select Context',
    'action.syncNow': 'Sync Now',
    'action.downloadApp': 'Download App',
    'action.installPwa': 'Install Application',
    'action.back': 'Back',
    'action.next': 'Next',
    'action.retry': 'Try Again',
    'action.refresh': 'Refresh',
    'action.search': 'Search...',
    'action.filter': 'Filter',
    'action.clearFilters': 'Clear Filters',

    // Universal Terms
    'common.wait': 'Please wait...',
    'common.loading': 'Loading...',
    'common.success': 'Operation completed successfully!',
    'common.error': 'An unexpected error occurred.',
    'common.yes': 'Yes',
    'common.no': 'No',

    // View States (StateBoundary)
    'state.loading': 'Loading operational data...',
    'state.error': 'An error occurred while loading this view\'s data.',
    'state.empty': 'No records registered at the moment.',
    'state.emptyRegion': 'No records',
    'state.partial': 'Displaying local data with outdated snapshot.',
    'state.noInternet': 'No internet connection. Local data remains available.',

    // Status and Sync Messages
    'status.online': 'Connected to Central API',
    'status.offline': 'Off-Grid Field Mode (100% Offline)',
    'status.offlineDesc': 'Operational data safely recorded to local device storage',
    'status.syncing': 'Syncing with central API...',
    'status.synced': 'All entries are synchronized',
    'status.pending': 'Commands pending synchronization',
    'status.pendingCount': '{count} command(s) pending synchronization',
    'status.conflict': 'Concurrency conflict detected (409)',
    'status.conflictAction': 'Resolve Conflict',
    'status.error': 'Server communication failure',
    'status.syncNow': 'Sync Now',
    'status.quiescenceWaiting': 'Waiting for safe idle state to sync (camera or form active)',

    // Central API Barrier Errors
    'api.error.unauthorized': 'Unauthenticated request. Bearer token missing or invalid.',
    'api.error.invalid_token': 'Synthetic token expired or has invalid signature.',
    'api.error.context_mismatch': 'Multi-tenant isolation breach: token context does not match envelope.',
    'api.error.profile_mismatch': 'Profile violation: token profile does not match envelope.',
    'api.error.forbidden_command': 'Command not authorized for the current profile.',
    'api.error.invalid_envelope': 'Atomic command envelope structurally invalid.',
    'api.error.invalid_domain_payload': 'Data payload violates domain validation rules.',
    'api.error.concurrency_conflict': 'Concurrency conflict: record base version diverged on server.',
    'api.error.command_not_allowed': 'Unknown command outside authorized allowlist.',

    // Semantic Navigation Tabs
    'nav.tab.overview': 'Overview',
    'nav.tab.gmd': 'ADG Curves',
    'nav.tab.lots': 'Lots & Cattle',
    'nav.tab.field': 'Field Dashboard',
    'nav.tab.trough': 'Trough Score',
    'nav.tab.salt': 'Salt & Round',
    'nav.tab.office': 'Office Dashboard',
    'nav.tab.invoices': 'Invoices',
    'nav.tab.purchases': 'Purchase Orders',
    'nav.tab.factory': 'Feed Mill Dashboard',
    'nav.tab.batches': 'Feed Batches',
    'nav.tab.silos': 'Silo Inventory',
    'nav.tab.admin': 'Administration'
  }
};

export type TranslationKey = keyof (typeof APP_DICTIONARY)['pt-BR'];

/**
 * Função utilitária pura de tradução com fallback estrito e suporte a interpolação:
 * 1. Procura na língua solicitada
 * 2. Se não encontrar, tenta em pt-BR
 * 3. Se não encontrar, usa fallback fornecido ou a própria chave
 * 4. Interpola parâmetros caso fornecidos
 */
export function translateKey(
  language: SupportedLanguage,
  key: string,
  paramsOrFallback?: I18nParams | string,
  fallbackArg?: string
): string {
  let params: I18nParams | undefined = undefined;
  let fallback: string | undefined = fallbackArg;

  if (typeof paramsOrFallback === 'string') {
    fallback = paramsOrFallback;
  } else if (paramsOrFallback && typeof paramsOrFallback === 'object') {
    params = paramsOrFallback;
  }

  const langDict = APP_DICTIONARY[language];
  let rawText: string | undefined = undefined;

  if (langDict && Object.prototype.hasOwnProperty.call(langDict, key) && langDict[key] !== undefined) {
    rawText = langDict[key];
  }

  if (rawText === undefined) {
    const ptDict = APP_DICTIONARY['pt-BR'];
    if (ptDict && Object.prototype.hasOwnProperty.call(ptDict, key) && ptDict[key] !== undefined) {
      rawText = ptDict[key];
    }
  }

  const template = rawText ?? fallback ?? key;
  return interpolate(template, params);
}
