import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert }),
    storage: { from: () => ({
      upload: vi.fn(async () => ({ error: null })),
      getPublicUrl: (path: string) => ({ data: { publicUrl: "local-fixture:" + path } }),
    }) },
  },
}));

import { getPendingCount, saveChecklist, syncPendingChecklists, type ChecklistPayload } from "./conferenciaOffline";

const fakeChecklist = (): ChecklistPayload => ({
  fazenda_id: "fixture-fazenda", retiro_id: null, pasto_id: "fixture-pasto",
  user_id: "fixture-user", perfil: null,
  cocho_abastecido: false, cocho_parcial: false, cocho_vazio: false,
  cocho_danificado: false, placa_qr_presente: false, placa_qr_danificada: false,
  qtd_compativel: false, qtd_divergente: false, necessita_atencao: false,
  observacoes: null, fotosDataUrls: [],
});

let online = true;
const storage = new Map<string, string>();
const pending = () => JSON.parse(storage.get("pendingConferencias") ?? "[]") as Array<ChecklistPayload & { clientId: string }>;

beforeEach(() => {
  online = true;
  storage.clear();
  insert.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal("navigator", { get onLine() { return online; } });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("Conferencia legacy offline queue integrity", () => {
  it("retries a lost ACK using the original checklist ID", async () => {
    insert.mockImplementationOnce(async () => { throw Error("lost ACK"); });
    await expect(saveChecklist(fakeChecklist())).resolves.toEqual({ saved: true, queued: true });
    const queued = pending();
    const attemptedId = insert.mock.calls[0][0].id as string;
    expect(queued[0].clientId).toBe(attemptedId);
    expect(await syncPendingChecklists()).toBe(1);
    expect(insert.mock.calls[1][0].id).toBe(attemptedId);
    expect(getPendingCount()).toBe(0);
  });

  it("preserves a new offline entry made while another sync awaits ACK", async () => {
    online = false;
    await saveChecklist(fakeChecklist());
    online = true;
    let finish: (() => void) | undefined;
    insert.mockImplementation(() => new Promise(resolve => {
      finish = () => resolve({ error: null });
    }));
    const syncing = syncPendingChecklists();
    online = false;
    await saveChecklist({ ...fakeChecklist(), observacoes: "new-entry" });
    const newer = pending()[1].clientId;
    online = true;
    finish?.();
    expect(await syncing).toBe(1);
    expect(pending()).toHaveLength(1);
    expect(pending()[0].clientId).toBe(newer);
  });

  it("only sends once when two sync requests overlap", async () => {
    online = false;
    await saveChecklist(fakeChecklist());
    online = true;
    let finish: (() => void) | undefined;
    insert.mockImplementation(() => new Promise(resolve => {
      finish = () => resolve({ error: null });
    }));
    const first = syncPendingChecklists();
    const second = syncPendingChecklists();
    expect(first).toBe(second);
    expect(insert).toHaveBeenCalledTimes(1);
    finish?.();
    await expect(first).resolves.toBe(1);
    expect(pending()).toHaveLength(0);
  });

  it("preserves failed entries including the retry identifier", async () => {
    online = false;
    await saveChecklist(fakeChecklist());
    const before = structuredClone(pending());
    online = true;
    insert.mockResolvedValue({ error: new Error("temporarily unavailable") });
    await expect(syncPendingChecklists()).resolves.toBe(0);
    expect(pending()).toEqual(before);
  });

  it("refuses to overwrite an unreadable legacy queue", async () => {
    storage.set("pendingConferencias", "{truncated:");
    online = false;
    await expect(saveChecklist(fakeChecklist())).rejects.toThrow("dados anteriores preservados");
    expect(storage.get("pendingConferencias")).toBe("{truncated:");
  });
});
