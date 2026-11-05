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

export * from './auth/AuthContext';
export * from './auth/useAuth';
export * from './auth/ProtectedRoute';
export * from './router/moduleRegistry';
export * from './router/routes.config';
export * from './router/AppRouter';
export * from './components/layout/ShellLayout';
export * from './components/layout/ShellAppBar';
export * from './components/layout/ShellNavigation';
export * from './components/layout/ContextSwitchModal';
export * from './components/views/LoginView';
export * from './components/views/ContextSelectorView';
export * from './components/views/AccessDeniedView';
export * from './types/shell.types';
export * from './App';
export { default } from './App';
