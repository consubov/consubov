import { UserProfileId } from '@consubov/contracts';
export { default, CapatazView } from './CapatazView';
export * from './store';
export * from './sync';
export * from './components/CapatazCochoTab';
export * from './components/CapatazQrTab';
export * from './components/CapatazContagemTab';
export * from './components/CapatazFotosTab';
export * from './components/CapatazHistoricoTab';

export const CAPATAZ_MODULE_DESCRIPTOR = {
  moduleId: 'capataz',
  profileId: 'capataz' as UserProfileId,
  title: 'Módulo Capataz (Campo & Offline)',
  version: '0.1.0'
};
