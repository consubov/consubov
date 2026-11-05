import React from 'react';
import { UserProfileId } from '@consubov/contracts';
import { safeDynamicImport } from '@consubov/module-release';

export interface FazendaModuleDescriptor {
  moduleId: string;
  profileId: UserProfileId;
  basePath: string;
  titleKey: string;
  iconName: string;
  loader: () => Promise<{ default: React.ComponentType<any> }>;
}

export const FAZENDA_MODULES: Record<UserProfileId, FazendaModuleDescriptor> = {
  gerente: {
    moduleId: 'gerente',
    profileId: 'gerente',
    basePath: '/fazenda/gerente',
    titleKey: 'role.gerente',
    iconName: 'chart-bar',
    loader: () =>
      safeDynamicImport(() => import('@consubov/fazenda-gerente'), {
        moduleId: 'gerente'
      })
  },
  capataz: {
    moduleId: 'capataz',
    profileId: 'capataz',
    basePath: '/fazenda/capataz',
    titleKey: 'role.capataz',
    iconName: 'clipboard-check',
    loader: () =>
      safeDynamicImport(() => import('@consubov/fazenda-capataz'), {
        moduleId: 'capataz'
      })
  },
  escritorio: {
    moduleId: 'escritorio',
    profileId: 'escritorio',
    basePath: '/fazenda/escritorio',
    titleKey: 'role.escritorio',
    iconName: 'building-office',
    loader: () =>
      safeDynamicImport(() => import('@consubov/fazenda-escritorio'), {
        moduleId: 'escritorio'
      })
  },
  fabrica: {
    moduleId: 'fabrica',
    profileId: 'fabrica',
    basePath: '/fazenda/fabrica',
    titleKey: 'role.fabrica',
    iconName: 'cog-6-tooth',
    loader: () =>
      safeDynamicImport(() => import('@consubov/fazenda-fabrica'), {
        moduleId: 'fabrica'
      })
  },
  administrador: {
    moduleId: 'admin-global',
    profileId: 'administrador',
    basePath: '/admin',
    titleKey: 'role.administrador',
    iconName: 'shield-check',
    loader: () => Promise.reject(new Error('Admin Global é executado em app independente.'))
  }
};
