import { z } from 'zod';

export const lancamentoCochoPayloadSchema = z.object({
  pasto_id: z.string().min(1),
  produto_id: z.string().min(1),
  sacos_fornecidos: z.number().nonnegative(),
  escore_cocho: z.number().int().min(0).max(4),
  observacao: z.string().optional()
});

export const pesagemAnimalPayloadSchema = z.object({
  animal_id: z.string().min(1),
  peso_kg: z.number().positive('Peso deve ser positivo'),
  data_pesagem: z.string().datetime(),
  lote_id: z.string().min(1)
});

export const definirMetasPayloadSchema = z.object({
  lote_id: z.string().min(1),
  gmd_alvo_kg_dia: z.number().positive(),
  peso_final_alvo_kg: z.number().positive(),
  data_alvo_abate: z.string().datetime()
});
