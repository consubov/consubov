import type { TenantExecutionContext } from "../../identity-tenancy";
import type {
  NotificationContent,
  NotificationDestinatario,
  NotificationDispatchResult,
  NotificationSkipped,
} from "../domain/notificacao";
import type { NotificationPort } from "../domain/ports";

/** Adaptador em memória para teste: registra os envios sem transporte real. */
export class FakeNotificationAdapter implements NotificationPort {
  private readonly entregas: Array<{
    content: NotificationContent;
    destinatarios: readonly NotificationDestinatario[];
  }> = [];

  private proximoPulado: NotificationSkipped | null = null;

  async dispatch(
    content: NotificationContent,
    destinatarios: readonly NotificationDestinatario[],
    context: TenantExecutionContext,
  ): Promise<NotificationDispatchResult | NotificationSkipped> {
    void context;
    if (this.proximoPulado) {
      const pulado = this.proximoPulado;
      this.proximoPulado = null;

      return pulado;
    }

    this.entregas.push({ content, destinatarios });

    return {
      total: destinatarios.length,
      enviados: destinatarios.length,
      resultados: destinatarios.map((d) => ({ id: d.usuarioId, ok: true })),
    };
  }

  /** Configura a próxima resposta como envio pulado pelo interruptor global. */
  setNextSkipped(value: NotificationSkipped): void {
    this.proximoPulado = value;
  }

  getSentNotifications(): ReadonlyArray<{
    content: NotificationContent;
    destinatarios: readonly NotificationDestinatario[];
  }> {
    return this.entregas;
  }

  clear(): void {
    this.entregas.length = 0;
  }
}
