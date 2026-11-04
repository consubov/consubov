export const colorTokens = {
  // Fundo e superfícies com contraste solar
  surface: {
    canvas: '#F8FAFC',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    border: '#E2E8F0',
    borderStrong: '#94A3B8'
  },
  // Tipografia de alto contraste (mínimo 7:1 para sol do meio-dia)
  text: {
    primary: '#0F172A',
    secondary: '#334155',
    muted: '#64748B',
    inverse: '#FFFFFF'
  },
  // Identidade CONSUBOV
  brand: {
    primary: '#15803D',    // Verde pecuária intenso
    primaryHover: '#166534',
    secondary: '#0369A1',  // Azul institucional
    accent: '#B45309'      // Âmbar terroso
  },
  // Estados Semânticos Universais
  status: {
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    info: '#0284C7',
    // Estados de Sincronização
    savedLocal: '#475569',   // Salvo no dispositivo (cinza azulado)
    pending: '#D97706',      // Pendente de envio (laranja)
    syncing: '#0284C7',      // Enviando (azul)
    synced: '#15803D',       // Sincronizado com API (verde)
    conflict: '#DC2626'      // Conflito 409 (vermelho vivo)
  }
} as const;
