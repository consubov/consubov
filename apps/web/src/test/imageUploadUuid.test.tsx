import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import ImageUploadField from "@/components/landing/ImageUploadField";

const { uploadMock, publicUrlMock, errorToast } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  publicUrlMock: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: uploadMock, getPublicUrl: publicUrlMock }) } },
}));
vi.mock("sonner", () => ({ toast: { error: errorToast } }));

describe("landing image storage filename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ error: null });
    publicUrlMock.mockImplementation((path: string) => ({ data: { publicUrl: `https://local.test/${path}` } }));
  });
  afterEach(() => vi.restoreAllMocks());

  it("uses a distinct cryptographic UUID for every uploaded image", async () => {
    const uuid = vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    const onChange = vi.fn();
    const { container } = render(<ImageUploadField label="Imagem" folder="landing/photos" multiple urls={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(["x"], "a.png", { type: "image/png" }), new File(["y"], "b.webp", { type: "image/webp" })] } });
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2));
    const paths = uploadMock.mock.calls.map(([path]) => path as string);
    expect(paths[0]).toMatch(/^landing\/photos\/\d+-11111111-1111-4111-8111-111111111111\.png$/);
    expect(paths[1]).toMatch(/^landing\/photos\/\d+-22222222-2222-4222-8222-222222222222\.webp$/);
    expect(paths[0]).not.toBe(paths[1]);
    expect(uuid).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(paths.map((path) => `https://local.test/${path}`)));
  });

  it("does not publish a URL when storage rejects the upload", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "storage unavailable" } });
    const onChange = vi.fn();
    const { container } = render(<ImageUploadField label="Imagem" folder="landing" urls={[]} onChange={onChange} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["x"], "a.png", { type: "image/png" })] } });
    await waitFor(() => expect(errorToast).toHaveBeenCalledWith("Erro ao enviar a.png"));
    expect(publicUrlMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([]));
  });
});
