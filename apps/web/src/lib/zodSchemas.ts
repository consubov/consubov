import { z } from "zod";

// Contratos de entrada preservados da aplicacao pre-migracao (Zod 3).
export const leadSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(10, "Telefone inválido").max(20),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido").max(20),
  mensagem: z.string().trim().max(1000).optional(),
});

export const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  nome_fazenda: z.string().trim().max(120).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
});
