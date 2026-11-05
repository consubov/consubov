import { ProductId } from '@consubov/contracts';
import { designTokens } from '@consubov/ui';

export { App } from './App';
export { AdminRouter } from './router/AdminRouter';
export { AdminAuthProvider, useAdminAuth } from './auth/AdminAuthContext';
export type { AdminUser, AdminRole, AdminSession } from './auth/AdminAuthContext';
export { useAdminStore } from './store/adminStore';
export type { TenantRecord, OffgridLicenseRecord, GlobalUserRecord, AuditLogRecord } from './store/adminStore';

export const ADMIN_GLOBAL_MANIFEST = {
  app_id: 'admin-global',
  name: 'ADM CONSUBOV (Global SaaS)',
  version: '0.1.0',
  defaultProduct: 'consubov' as ProductId,
  theme: designTokens.colors.brand
};
