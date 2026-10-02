import { describe, expect, test } from "bun:test";
import type { NotificationContent } from "../domain/notificacao";
import { FakeNotificationAdapter } from "./FakeNotificationAdapter";

const conteudo: NotificationContent = {
  titulo: "Olá",
  corpo: "Mundo",
  destinoUrl: "/",
};

describe("FakeNotificationAdapter", () => {
  test("registra o envio por destinatário", async () => {
    const adapter = new FakeNotificationAdapter();

    const result = await adapter.dispatch(conteudo, [
      { kind: "usuario", usuarioId: "user-1" },
    ]);

    expect(result).toEqual({
      total: 1,
      enviados: 1,
      resultados: [{ id: "user-1", ok: true }],
    });
    expect(adapter.getSentNotifications()).toHaveLength(1);
  });

  test("registra vários destinatários no mesmo envio", async () => {
    const adapter = new FakeNotificationAdapter();

    const result = await adapter.dispatch(conteudo, [
      { kind: "usuario", usuarioId: "user-1" },
      { kind: "usuario", usuarioId: "user-2" },
    ]);

    expect(result).toMatchObject({ total: 2, enviados: 2 });
    expect(adapter.getSentNotifications()[0]?.destinatarios).toHaveLength(2);
  });

  test("devolve o envio pulado sem registrar entrega", async () => {
    const adapter = new FakeNotificationAdapter();
    adapter.setNextSkipped({
      pulado: true,
      motivo: "notificacoes_globais_desativadas",
    });

    const result = await adapter.dispatch(conteudo, [
      { kind: "usuario", usuarioId: "user-1" },
    ]);

    expect(result).toEqual({
      pulado: true,
      motivo: "notificacoes_globais_desativadas",
    });
    expect(adapter.getSentNotifications()).toHaveLength(0);
  });
});
