import { UserProfileId } from '@consubov/contracts';
export { default, FabricaView } from './FabricaView';

export const FABRICA_MODULE_DESCRIPTOR = {
  moduleId: 'fabrica',
  profileId: 'fabrica' as UserProfileId,
  title: 'Módulo Fábrica (Nutrição & Batidas)',
  version: '0.1.0'
};
