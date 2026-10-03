import type { TenantExecutionContext } from "../../identity-tenancy";
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
    context: TenantExecutionContext,
  ): Promise<NotificationDispatchResult | NotificationSkipped>;
}

/**
 * Leitura dos avisos dentro do aplicativo. A tabela `notificacoes` não tem coluna
 * de dono, então o contexto de tenant é obrigatório na fronteira, mas não inventa
 * uma regra de ownership por usuário que ainda não existe.
 */
export interface InAppNotificationReaderPort {
  list(context: TenantExecutionContext): Promise<readonly InAppNotificationRecord[]>;
  markAsRead(id: string, context: TenantExecutionContext): Promise<void>;
}
