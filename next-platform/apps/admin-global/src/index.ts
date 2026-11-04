import { ProductId } from '@consubov/contracts';
import { designTokens } from '@consubov/ui';

export const ADMIN_GLOBAL_MANIFEST = {
  app_id: 'admin-global',
  name: 'ADM CONSUBOV (Global SaaS)',
  version: '0.1.0',
  defaultProduct: 'consubov' as ProductId,
  theme: designTokens.colors.brand
};
