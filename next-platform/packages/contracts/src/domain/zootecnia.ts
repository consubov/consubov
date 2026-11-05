import { EntityMetadata } from './common';

export interface Pasto extends EntityMetadata {
  id: string;
  fazenda_id: string;
  retiro_id: string | null;
  codigo: string;
  area_ha: number;
  capacidade_cabecas: number;
  qr_code: string;
}

export interface Lote extends EntityMetadata {
  id: string;
  fazenda_id: string;
  pasto_id: string;
  nome: string;
  categoria: 'bezerro' | 'novilha' | 'garrote' | 'boi' | 'vaca';
  quantidade_cabecas: number;
  peso_medio_kg: number;
}

export interface CochoRegistro extends EntityMetadata {
  id: string;
  pasto_id: string;
  escore: 0 | 1 | 2 | 3 | 4;
  sacos_fornecidos: number;
  foto_attachment_id?: string;
  observacao?: string;
}
