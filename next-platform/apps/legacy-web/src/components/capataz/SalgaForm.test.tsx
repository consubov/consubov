import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SalgaForm from "./SalgaForm";
import { prepareCapatazCameraBlob } from "@/lib/capatazPhoto";

vi.mock("@/lib/capatazPhoto", () => ({ prepareCapatazCameraBlob: vi.fn() }));

// Form-level tests isolate the camera; real video/canvas is exercised in the browser suite.
vi.mock("./CapatazCameraCapture", () => ({
  default: ({ label, onPhoto, onClose }: {
    label: string;
    onPhoto: (blob: Blob) => Promise<void>;
    onClose: () => void;
  }) => (
    <section role="dialog" aria-label={`Câmera — ${label}`}>
      <button onClick={() => {
        void onPhoto(new Blob(["photo"], { type: "image/jpeg" }))
          .then(onClose).catch(() => undefined);
      }}>Capturar foto</button>
      <button onClick={onClose}>Cancelar</button>
    </section>
  ),
}));

const props = {
  pastoId: "pasto-qr-1",
  pastoNome: "FS-10",
  retiroNome: "Retiro Sossego",
  fazendaNome: "FAZENDA SOSSEGO",
  cicloId: "ciclo-1",
  tipo: "salga" as const,
  auditoriaExigida: false,
  onSave: vi.fn().mockResolvedValue(undefined),
  onBack: vi.fn(),
  sugestao: null,
};
const photo = "data:image/jpeg;base64,Zm90bw==";
const mockedPrepare = vi.mocked(prepareCapatazCameraBlob);
const redButton = () => screen.getByRole("button", { name: "Tirar foto (obrigatório)" });

afterEach(() => {
  cleanup();
  mockedPrepare.mockReset();
});

describe("SalgaForm - captura obrigatória somente pela câmera", () => {
  it("mantém zero real, sem inventar cadastro incompleto", () => {
    render(<SalgaForm {...props} numAnimais={0} />);
    expect(screen.getByText(/Animais:\s*0 cab/)).toBeDefined();
    expect(screen.queryByText(/Confirme se ainda est[aá] em configura[cç][aã]o/i)).toBeNull();
  });

  it("mantém número de animais com dados existentes", () => {
    render(<SalgaForm {...props} numAnimais={37} />);
    expect(screen.getByText(/Animais:\s*37 cab/)).toBeDefined();
  });

  it("restaura botão vermelho e não oferece seleção de galeria ou input de arquivo", () => {
    render(<SalgaForm {...props} auditoriaExigida numAnimais={0} />);
    expect(redButton().className).toMatch(/bg-destructive/);
    expect(screen.queryByText(/galeria/i)).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect((screen.getByRole("button", { name: "Salvar Salga" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("somente captura direta gera miniatura e habilita salvar", async () => {
    mockedPrepare.mockResolvedValue(photo);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SalgaForm {...props} auditoriaExigida onSave={onSave} numAnimais={0} />);
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "2" } });
    fireEvent.click(redButton());
    expect(screen.getByRole("dialog", { name: /Câmera — auditoria/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByAltText("Foto de auditoria capturada")).toBeDefined());
    expect((screen.getByRole("button", { name: "Salvar Salga" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Salvar Salga" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      pasto_id: props.pastoId, sacos: 2, foto_auditoria_url: photo,
      foto_auditoria_exigida: true,
    })));
  });

  it("erro na foto mantém Salvar desabilitado e não apaga os sacos", async () => {
    mockedPrepare.mockRejectedValue(new Error("Foto inválida [CAM07]"));
    render(<SalgaForm {...props} auditoriaExigida numAnimais={37} />);
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "3" } });
    fireEvent.click(redButton());
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/CAM07/));
    expect(screen.queryByAltText("Foto de auditoria capturada")).toBeNull();
    expect((screen.getByRole("button", { name: "Salvar Salga" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText("0") as HTMLInputElement).value).toBe("3");
  });

  it("permite nova foto depois de falha, mantendo os dados", async () => {
    mockedPrepare.mockRejectedValueOnce(new Error("Primeira captura falhou")).mockResolvedValueOnce(photo);
    render(<SalgaForm {...props} auditoriaExigida numAnimais={0} />);
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "4" } });
    fireEvent.click(redButton());
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByAltText("Foto de auditoria capturada")).toBeDefined());
    expect((screen.getByPlaceholderText("0") as HTMLInputElement).value).toBe("4");
    expect((screen.getByRole("button", { name: "Salvar Salga" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("cancelar câmera não libera Salvar e não perde a quantidade digitada", () => {
    render(<SalgaForm {...props} auditoriaExigida numAnimais={0} />);
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "5" } });
    fireEvent.click(redButton());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByRole("button", { name: "Salvar Salga" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByPlaceholderText("0") as HTMLInputElement).value).toBe("5");
  });

  it("observação adiciona foto diretamente da câmera, sem galeria", async () => {
    mockedPrepare.mockResolvedValue(photo);
    render(<SalgaForm {...props} auditoriaExigida numAnimais={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Observação" }));
    expect(screen.getByRole("dialog", { name: /Câmera — observação/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByAltText("Foto de observação capturada")).toBeDefined());
    expect(screen.queryByText(/galeria/i)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Descrição (opcional)"), { target: { value: "Cocho limpo" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(screen.getByAltText("Foto de observação 1")).toBeDefined();
  });

  it("cocho cheio exige fotografia direta antes de salvar", async () => {
    mockedPrepare.mockResolvedValue(photo);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<SalgaForm {...props} onSave={onSave} exigirFotoCocho numAnimais={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Cocho Cheio/ }));
    expect(redButton().className).toMatch(/bg-destructive/);
    expect((screen.getByRole("button", { name: "Salvar Cocho Cheio" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(redButton());
    expect(screen.getByRole("dialog", { name: /Câmera — cocho/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByAltText("Foto do cocho capturada")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Salvar Cocho Cheio" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      cocho_cheio: true, foto_cocho_url: photo, sacos: 0,
    })));
  });
});
