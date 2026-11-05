import { UserProfileId } from '@consubov/contracts';
export { default, EscritorioView } from './EscritorioView';

export const ESCRITORIO_MODULE_DESCRIPTOR = {
  moduleId: 'escritorio',
  profileId: 'escritorio' as UserProfileId,
  title: 'Módulo Escritório (Compras & Lotes)',
  version: '0.1.0'
};
