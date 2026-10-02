import type {
  InAppNotificationRecord,
  NotificationContent,
  NotificationDestinatario,
  NotificationDispatchResult,
  NotificationSkipped,
} from "./notificacao";

/**
 * Envio de notificação a destinatários já resolvidos. A porta não autoriza e
 * não conhece escopo: quem decide o alvo é o chamador, e a autorização por
 * escopo permanece onde já está, em `integrations`.
 */
export interface NotificationPort {
  dispatch(
    content: NotificationContent,
    destinatarios: readonly NotificationDestinatario[],
  ): Promise<NotificationDispatchResult | NotificationSkipped>;
}

/**
 * Leitura dos avisos dentro do aplicativo. A tabela `notificacoes` não tem coluna
 * de dono, então esta porta não recebe principal e qualquer filtragem por usuário
 * depende de regra que ainda não existe.
 */
export interface InAppNotificationReaderPort {
  list(): Promise<readonly InAppNotificationRecord[]>;
  markAsRead(id: string): Promise<void>;
}
