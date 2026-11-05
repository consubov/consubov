import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const compression = vi.hoisted(() => ({
  fromFile: vi.fn(),
  fromUrl: vi.fn(),
}));
vi.mock("@/lib/imageCompression", () => ({
  compressImageFileToDataUrl: compression.fromFile,
  compressImageDataUrl: compression.fromUrl,
}));

import { prepareCapatazPhoto, prepareCapatazCameraBlob } from "./capatazPhoto";

const jpeg = "data:image/jpeg;base64,Zm90bw==";
const realImage = globalThis.Image;

describe("prepareCapatazPhoto - retorno da câmera PWA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class SuccessfulImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", SuccessfulImage);
    compression.fromFile.mockResolvedValue(jpeg);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa compressão direta com arquivo e verifica a prévia", async () => {
    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    expect(await prepareCapatazPhoto(file)).toBe(jpeg);
    expect(compression.fromFile).toHaveBeenCalledWith(file);
  });

  it("rejeita fotografia vazia e arquivo não-imagem", async () => {
    await expect(prepareCapatazPhoto(new File([], "vazia.jpg", { type: "image/jpeg" }))).rejects.toThrow(/\[F01\]/);
    await expect(prepareCapatazPhoto(new File(["abc"], "dados.txt", { type: "text/plain" }))).rejects.toThrow(/\[F02\]/);
  });

  it("rejeita imagens que o dispositivo não consegue pré-visualizar", async () => {
    class BrokenImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal("Image", BrokenImage);
    await expect(prepareCapatazPhoto(new File(["x"], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow(/exibir a foto/);
  });

  it("rejeita saída grande que poderia estourar armazenamento offline", async () => {
    compression.fromFile.mockResolvedValueOnce("data:image/jpeg;base64," + "x".repeat(1_600_000));
    await expect(prepareCapatazPhoto(new File(["x"], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow(/preparar a foto/);
  });

  it("permite fallback FileReader quando processamento moderno falha", async () => {
    compression.fromFile.mockRejectedValueOnce(new Error("createImageBitmap unsupported"));
    compression.fromUrl.mockResolvedValueOnce(jpeg);
    const file = new File(["abc"], "foto.jpg", { type: "image/jpeg" });
    expect(await prepareCapatazPhoto(file)).toBe(jpeg);
    expect(compression.fromUrl).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/jpeg;base64,/));
  });
});

describe("prepareCapatazPhoto - arquivos retornados por câmeras nativas sem MIME", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class PreviewImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", PreviewImage);
    compression.fromFile.mockResolvedValue(jpeg);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reconhece JPEG por assinatura quando câmera não fornece MIME", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46]);
    const file = new File([bytes], "camera", { type: "" });
    expect(await prepareCapatazPhoto(file)).toBe(jpeg);
    expect(compression.fromFile).toHaveBeenCalledWith(expect.objectContaining({
      name: "camera", type: "image/jpeg",
    }));
  });

  it("reconhece PNG vindo de content URI com MIME octet-stream", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const file = new File([bytes], "IMG_CAMERA", { type: "application/octet-stream" });
    expect(await prepareCapatazPhoto(file)).toBe(jpeg);
    expect(compression.fromFile).toHaveBeenCalledWith(expect.objectContaining({
      type: "image/png",
    }));
  });

  it("falha sem aceitar arquivo sem assinatura de imagem", async () => {
    const file = new File(["nao-imagem"], "saida", { type: "" });
    await expect(prepareCapatazPhoto(file)).rejects.toThrow(/\[F03\]/);
    expect(compression.fromFile).not.toHaveBeenCalled();
  });

  it("FileReader de fallback preserva MIME JPEG recuperado do conteúdo", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x4a, 0x46, 0x49, 0x46]);
    const file = new File([bytes], "camera", { type: "" });
    compression.fromFile.mockRejectedValueOnce(new Error("Bitmap falhou"));
    compression.fromUrl.mockResolvedValueOnce(jpeg);
    expect(await prepareCapatazPhoto(file)).toBe(jpeg);
    expect(compression.fromUrl).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/jpeg;base64,/));
  });
});

describe("prepareCapatazCameraBlob - caminho FileReader igual ao legado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class SupportedImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", SupportedImage);
    compression.fromUrl.mockResolvedValue(jpeg);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lê Blob JPEG por FileReader e comprime sem createImageBitmap/File", async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
    expect(await prepareCapatazCameraBlob(blob)).toBe(jpeg);
    expect(compression.fromUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/jpeg;base64,/),
      { maxBytes: 380_000, maxDimension: 960, quality: 0.68 },
    );
    expect(compression.fromFile).not.toHaveBeenCalled();
  });

  it("não aceita frame vazio ou um Blob que não seja JPEG", async () => {
    await expect(prepareCapatazCameraBlob(new Blob([], { type: "image/jpeg" }))).rejects.toThrow(/\[CAM08\]/);
    await expect(prepareCapatazCameraBlob(new Blob(["x"], { type: "image/png" }))).rejects.toThrow(/\[CAM08\]/);
  });

  it("não habilita foto quando o resultado excede o limite offline", async () => {
    compression.fromUrl.mockResolvedValue("data:image/jpeg;base64," + "x".repeat(1_600_000));
    await expect(prepareCapatazCameraBlob(new Blob(["x"], { type: "image/jpeg" }))).rejects.toThrow(/\[CAM09\]/);
  });

  it("não aceita foto não renderizável pela miniatura", async () => {
    class UnsupportedImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal("Image", UnsupportedImage);
    await expect(prepareCapatazCameraBlob(new Blob(["x"], { type: "image/jpeg" }))).rejects.toThrow(/exibir a foto/);
  });
});
