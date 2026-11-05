import { UserProfileId } from '@consubov/contracts';

export interface RouteConfig {
  path: string;
  requiredProfile?: UserProfileId;
  titleKey: string;
  moduleId?: string;
  isPublic?: boolean;
}

export const SHELL_ROUTES: RouteConfig[] = [
  { path: '/login', isPublic: true, titleKey: 'shell.login.title' },
  { path: '/context-select', titleKey: 'shell.context.title' },
  { path: '/access-denied', titleKey: 'shell.denied.title' },
  { path: '/fazenda/gerente', requiredProfile: 'gerente', moduleId: 'gerente', titleKey: 'role.gerente' },
  { path: '/fazenda/capataz', requiredProfile: 'capataz', moduleId: 'capataz', titleKey: 'role.capataz' },
  { path: '/fazenda/escritorio', requiredProfile: 'escritorio', moduleId: 'escritorio', titleKey: 'role.escritorio' },
  { path: '/fazenda/fabrica', requiredProfile: 'fabrica', moduleId: 'fabrica', titleKey: 'role.fabrica' }
];

export function getRouteForProfile(profileId: UserProfileId): string {
  switch (profileId) {
    case 'gerente':
      return '/fazenda/gerente';
    case 'capataz':
      return '/fazenda/capataz';
    case 'escritorio':
      return '/fazenda/escritorio';
    case 'fabrica':
      return '/fazenda/fabrica';
    case 'administrador':
      return '/fazenda/gerente';
    default:
      return '/context-select';
  }
}
