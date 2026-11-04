import { ProductId, UserProfileId } from '../envelope';
import { EntityMetadata } from './common';

export interface Tenant extends EntityMetadata {
  id: string;
  nome: string;
  cnpj: string;
  plano: 'basico' | 'profissional' | 'enterprise';
  status: 'ativo' | 'suspenso' | 'cancelado';
}

export interface Fazenda extends EntityMetadata {
  id: string;
  tenant_id: string;
  nome: string;
  municipio: string;
  uf: string;
  area_total_ha: number;
}

export interface Retiro extends EntityMetadata {
  id: string;
  fazenda_id: string;
  nome: string;
  responsavel_nome?: string;
}

export interface Usuario extends EntityMetadata {
  id: string;
  email: string;
  nome: string;
  is_ativo: boolean;
}
