import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { V2MigrationConsentDialog } from "./V2MigrationConsentDialog";
import type { OneTouchMigrationFlow } from "./oneTouchMigrationFlow";

function stubFlow(result: unknown): { flow: OneTouchMigrationFlow; run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async () => result);
  return { run, flow: { run } as unknown as OneTouchMigrationFlow };
}

describe("Single invitation, explicit one-tap consent", () => {
  it("does not start migration when the notification opens", () => {
    const { flow, run } = stubFlow({ ok: false, code: "OFFLINE", message: "Sem conexão." });
    render(
      <V2MigrationConsentDialog
        open
        migration={flow}
        onDismiss={vi.fn()}
        onOpenNewApp={vi.fn()}
      />,
    );
    expect(screen.getByText("Atualização CONSUBOV 2.0")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Autorizo a transferência/i })).toBeTruthy();
    expect(run).not.toHaveBeenCalled();
  });

  it("starts the flow with consent from exactly one primary button", async () => {
    const url = "https://app.consubov.com.br/baixar#migration=safe";
    const { flow, run } = stubFlow({ ok: true, url, migrationId: "migration-1" });
    const onOpen = vi.fn();
    render(
      <V2MigrationConsentDialog
        open
        migration={flow}
        onDismiss={vi.fn()}
        onOpenNewApp={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Autorizo a transferência/i }));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(url));
    expect(run).toHaveBeenCalledWith(true, expect.any(Function));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("keeps the old app open and displays a simple error when transfer fails", async () => {
    const { flow } = stubFlow({
      ok: false,
      code: "SERVER_ACK_INCOMPLETE",
      message: "Seus dados continuam na versão atual.",
    });
    const onOpen = vi.fn();
    render(
      <V2MigrationConsentDialog
        open
        migration={flow}
        onDismiss={vi.fn()}
        onOpenNewApp={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Autorizo a transferência/i }));
    await waitFor(() => expect(screen.getByText("Seus dados continuam na versão atual.")).toBeTruthy());
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("allows declining without recording consent or reading offline data", () => {
    const { flow, run } = stubFlow({ ok: true, url: "", migrationId: "" });
    const onDismiss = vi.fn();
    render(
      <V2MigrationConsentDialog
        open
        migration={flow}
        onDismiss={onDismiss}
        onOpenNewApp={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });
});
