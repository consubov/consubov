import React from 'react';
import { UserProfileId } from '@consubov/contracts';

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
    loader: () => import('@consubov/fazenda-gerente')
  },
  capataz: {
    moduleId: 'capataz',
    profileId: 'capataz',
    basePath: '/fazenda/capataz',
    titleKey: 'role.capataz',
    iconName: 'clipboard-check',
    loader: () => import('@consubov/fazenda-capataz')
  },
  escritorio: {
    moduleId: 'escritorio',
    profileId: 'escritorio',
    basePath: '/fazenda/escritorio',
    titleKey: 'role.escritorio',
    iconName: 'building-office',
    loader: () => import('@consubov/fazenda-escritorio')
  },
  fabrica: {
    moduleId: 'fabrica',
    profileId: 'fabrica',
    basePath: '/fazenda/fabrica',
    titleKey: 'role.fabrica',
    iconName: 'cog-6-tooth',
    loader: () => import('@consubov/fazenda-fabrica')
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
