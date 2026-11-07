import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CapatazCameraCapture from "./CapatazCameraCapture";

const stop = vi.fn();
const getUserMedia = vi.fn();
const onClose = vi.fn();
const onPhoto = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true, value: { getUserMedia },
  });
  const track = { stop };
  getUserMedia.mockResolvedValue({ getTracks: () => [track] });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true, get: () => 4,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true, get: () => 640,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true, get: () => 480,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) => callback(new Blob(["jpeg-bytes"], { type: "image/jpeg" })));
  onPhoto.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const readyCamera = async () => {
  const video = await screen.findByLabelText("Imagem ao vivo da câmera");
  await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
  fireEvent.loadedData(video);
  await waitFor(() => expect((screen.getByRole("button", { name: "Capturar foto" }) as HTMLButtonElement).disabled).toBe(false));
};

describe("CapatazCameraCapture - foto diretamente pelo vídeo", () => {
  it("solicita câmera traseira, sem input de galeria", async () => {
    render(<CapatazCameraCapture label="auditoria" onClose={onClose} onPhoto={onPhoto} />);
    await readyCamera();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: false, video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
    }));
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/galeria/i)).toBeNull();
  });

  it("ocupa todo o viewport e mostra somente X e check como controles da câmera pronta", async () => {
    render(<CapatazCameraCapture label="auditoria" onClose={onClose} onPhoto={onPhoto} />);
    await readyCamera();
    const dialog = screen.getByRole("dialog", { name: /Câmera — auditoria/ });
    expect(dialog.style.inset).toBe("0");
    expect(dialog.style.width).toBe("100vw");
    expect(dialog.className).toContain("!h-[100dvh]");
    expect(screen.getByTestId("camera-fullscreen-preview")).toBeDefined();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Capturar foto" })).toBeDefined();
    expect(dialog.querySelectorAll("button")).toHaveLength(2);
    expect(screen.queryByText(/galeria/i)).toBeNull();
  });

  it("captura JPEG do frame, aguarda onPhoto e só então fecha", async () => {
    render(<CapatazCameraCapture label="auditoria" onClose={onClose} onPhoto={onPhoto} />);
    await readyCamera();
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(onPhoto).toHaveBeenCalledTimes(1));
    const jpegFrame = onPhoto.mock.calls[0][0] as Blob;
    expect(jpegFrame).toBeInstanceOf(Blob);
    expect(jpegFrame.type).toBe("image/jpeg");
    expect(jpegFrame.size).toBeGreaterThan(0);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("acesso negado informa erro e impede fotografar", async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException("Permission denied", "NotAllowedError"));
    render(<CapatazCameraCapture label="auditoria" onClose={onClose} onPhoto={onPhoto} />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/CAM01/));
    expect((screen.getByRole("button", { name: "Capturar foto" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeDefined();
  });

  it("cancelar fecha câmera, para tracks e não salva foto", async () => {
    render(<CapatazCameraCapture label="cocho" onClose={onClose} onPhoto={onPhoto} />);
    await readyCamera();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    cleanup();
    expect(stop).toHaveBeenCalled();
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it("falha de processamento não fecha câmera; operador pode repetir", async () => {
    onPhoto.mockRejectedValueOnce(new Error("Não foi possível carregar a imagem"));
    render(<CapatazCameraCapture label="auditoria" onClose={onClose} onPhoto={onPhoto} />);
    await readyCamera();
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Não foi possível carregar/));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Capturar foto" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onPhoto).toHaveBeenCalledTimes(2);
  });

  it("libera tracks quando o componente é desmontado", async () => {
    const view = render(<CapatazCameraCapture label="auditoria" onClose={onClose} onPhoto={onPhoto} />);
    await readyCamera();
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
