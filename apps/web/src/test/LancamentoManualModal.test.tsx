import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const calls = vi.hoisted(() => ({ header: vi.fn(), items: vi.fn(), response: vi.fn(), rollback: vi.fn(), error: vi.fn(), success: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "solicitacoes_lancamento_manual") {
        return {
          select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
          insert: (v: unknown) => { calls.header(v); return { select: () => ({ single: async () => ({ data: { id: "sol-fixture" }, error: null }) }) }; },
          delete: () => ({ eq: (k: string, v: string) => { calls.rollback(k,v); return Promise.resolve({error:null}); } }),
        };
      }
      if (table === "solicitacoes_lancamento_itens") return { insert: (rows: unknown) => { calls.items(rows); return calls.response(); } };
      throw new Error("Unexpected table " + table);
    },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-fixture" } }) }));
vi.mock("@/hooks/useNomeUsuario", () => ({ useNomeUsuario: () => "Capataz" }));
vi.mock("@/components/i18n/LocalizedText", () => ({ LocalizedText: ({ source }: { source: string }) => source, useStaticUiText: () => (source: string) => source }));
vi.mock("@/lib/pushService", () => ({ sendPush: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: calls.error, success: calls.success } }));

import LancamentoManualModal from "@/components/capataz/LancamentoManualModal";

function mount() {
  render(<LancamentoManualModal open onOpenChange={vi.fn()} retiroId="ret" fazendaId="faz" pastos={[
    { id:"a", nome:"A", num_animais:10 }, { id:"b", nome:"B", num_animais:11 }, {id:"c", nome:"C", num_animais:12}
  ]}/>);
}
const geral = (v:string) => fireEvent.change(screen.getByRole("textbox", { name: "Motivo geral do lançamento manual" }),{target:{value:v}});
const sacos = (p:string,v:string) => fireEvent.change(screen.getByRole("spinbutton",{name:"Quantidade de sacos de "+p}),{target:{value:v}});
const enviar = () => fireEvent.click(screen.getByRole("button",{name:"Enviar Solicitação"}));
beforeEach(() => {vi.clearAllMocks();calls.response.mockResolvedValue({error:null});});
describe("Lançamento manual multipastos no formulário", () => {
  it("replica motivo geral entre pastos em um só pedido",async () => {
    mount(); geral("QR danificado");sacos("A","2");sacos("B","3");enviar();
    await waitFor(()=>expect(calls.items).toHaveBeenCalledTimes(1));
    expect(calls.header).toHaveBeenCalledWith(expect.objectContaining({total_sacos:5,status:"pendente",retiro_id:"ret"}));
    expect(calls.items).toHaveBeenCalledWith([
      expect.objectContaining({pasto_id:"a",num_sacos:2,motivo:"QR danificado"}),
      expect.objectContaining({pasto_id:"b",num_sacos:3,motivo:"QR danificado"}),
    ]);
  });
  it("prioriza específico, e preserva zero no cocho cheio",async () => {
    mount();geral("QR danificado");sacos("A","2");sacos("B","3");
    fireEvent.change(screen.getByRole("textbox",{name:"Motivo específico de B"}),{target:{value:"Celular sem bateria"}});
    fireEvent.click(screen.getAllByRole("switch")[2]);enviar();
    await waitFor(()=>expect(calls.items).toHaveBeenCalledTimes(1));
    expect(calls.items).toHaveBeenCalledWith([
      expect.objectContaining({pasto_id:"a",num_sacos:2,motivo:"QR danificado"}),
      expect.objectContaining({pasto_id:"b",num_sacos:3,motivo:"Celular sem bateria"}),
      expect.objectContaining({pasto_id:"c",num_sacos:0,cocho_cheio:true,motivo:"QR danificado"}),
    ]);
  });
  it("bloqueia motivo ausente sem enviar dados",async () => {
    mount();sacos("A","2");enviar();
    await waitFor(()=>expect(calls.error).toHaveBeenCalled());
    expect(calls.items).not.toHaveBeenCalled();
    expect(calls.header).not.toHaveBeenCalled();
  });
  it("mantém o motivo geral fora da rolagem e mostra um único alerta apenas após enviar",async () => {
    mount();
    const geralFixo = screen.getByTestId("motivo-geral-fixo");
    const rolagem = screen.getByTestId("pastos-scroll");
    const input = screen.getByRole("textbox", { name: "Motivo geral do lançamento manual" });
    expect(geralFixo).toContainElement(input);
    expect(rolagem).not.toContainElement(input);
    fireEvent.click(screen.getAllByRole("switch")[0]);
    fireEvent.click(screen.getAllByRole("switch")[1]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    enviar();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(input).toHaveFocus();
    expect(calls.header).not.toHaveBeenCalled();
    geral("QR danificado");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    enviar();
    await waitFor(()=>expect(calls.items).toHaveBeenCalledTimes(1));
    expect(calls.items).toHaveBeenCalledWith([
      expect.objectContaining({ pasto_id:"a", num_sacos:0, cocho_cheio:true, motivo:"QR danificado" }),
      expect.objectContaining({ pasto_id:"b", num_sacos:0, cocho_cheio:true, motivo:"QR danificado" }),
    ]);
  });
  it("foca o motivo específico quando preenchido mas curto",async () => {
    mount();
    geral("QR danificado");
    sacos("A","2");
    fireEvent.change(screen.getByRole("textbox", { name:"Motivo específico de A" }), { target:{value:"abc"} });
    enviar();
    expect(screen.getByRole("textbox", { name:"Motivo específico de A" })).toHaveFocus();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(calls.header).not.toHaveBeenCalled();
  });
  it("rollback em falha dos itens sem limpar os campos",async () => {
    calls.response.mockResolvedValueOnce({error:{message:"Falha simulada"}});
    mount();geral("QR danificado");sacos("A","2");enviar();
    await waitFor(()=>expect(calls.rollback).toHaveBeenCalledWith("id","sol-fixture"));
    expect(calls.error).toHaveBeenCalledWith("Falha simulada");
    expect(screen.getByRole("textbox",{name:"Motivo geral do lançamento manual"})).toHaveValue("QR danificado");
    expect(screen.getByRole("spinbutton",{name:"Quantidade de sacos de A"})).toHaveValue(2);
  });
});
