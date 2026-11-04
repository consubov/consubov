import { ProductId } from '@consubov/contracts';
import { SessionManager } from '@consubov/auth-client';
import { QuiescenceRegistry } from '@consubov/module-release';

export const FAZENDA_SHELL_CONFIG = {
  app_id: 'fazenda-shell',
  version: '0.1.0',
  defaultProduct: 'consubov' as ProductId,
  sessionManager: new SessionManager(),
  quiescence: new QuiescenceRegistry()
};
