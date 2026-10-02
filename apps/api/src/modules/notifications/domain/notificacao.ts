/**
 * Contrato da notificação: o que é a mensagem, para quem ela é endereçada e o
 * que o despachante responde.
 *
 * O alvo por escopo (fazenda, fábrica, administradores, lista de usuários), a
 * normalização do payload, a identidade do chamador e o rate limit ficam em
 * `integrations`, que é a fronteira com a função legada já endurecida na FASE 1
 * (supabase/functions/send-push-notification/index.ts). Aqui não há regra de
 * autorização: destino é sempre um usuário já resolvido.
 *
 * Formato dos avisos dentro do aplicativo
 * (supabase/migrations/20260402204726_*.sql:46-54):
 * `notificacoes(id, tipo default 'lead', titulo, mensagem, dados jsonb, lida,
 * criado_em)`. A tabela não tem coluna de dono: filtrar avisos por usuário não
 * tem prova no legado.
 */

export type NotificationId = string & { readonly __brand: "NotificationId" };

export type NotificationContent = {
  readonly titulo: string;
  readonly corpo: string;
  /** Rota interna de destino, conforme apps/web/src/lib/pushService.ts:20. */
  readonly destinoUrl: string;
};

export type NotificationDestinatario = {
  readonly kind: "usuario";
  readonly usuarioId: string;
};

/** Resposta de sucesso do despachante
 * (supabase/functions/send-push-notification/index.ts:652-660,676). */
export type NotificationDispatchResult = {
  readonly total: number;
  readonly enviados: number;
  readonly resultados: readonly {
    readonly id: string;
    readonly ok: boolean;
    readonly status?: number;
  }[];
};

/** Resposta quando o envio é desligado globalmente
 * (supabase/functions/send-push-notification/index.ts:583-598). */
export type NotificationSkipped = {
  readonly pulado: true;
  readonly motivo: "notificacoes_globais_desativadas";
};

export type InAppNotificationRecord = {
  readonly id: NotificationId;
  readonly tipo: string;
  readonly titulo: string;
  readonly mensagem: string;
  readonly dados: Readonly<Record<string, unknown>> | null;
  readonly lida: boolean;
  readonly criadoEm: string;
};
