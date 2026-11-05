import { EntityMetadata } from './common';

export interface FormulaRacao extends EntityMetadata {
  id: string;
  tenant_id: string;
  nome: string;
  ingredientes: Array<{
    materia_prima_id: string;
    porcentagem: number;
  }>;
}

export interface BatidaOrdem extends EntityMetadata {
  id: string;
  formula_id: string;
  quantidade_kg: number;
  status: 'planejada' | 'iniciada' | 'concluida' | 'cancelada';
}
