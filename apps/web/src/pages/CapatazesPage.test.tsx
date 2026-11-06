import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CapatazesPage from "./CapatazesPage";

const mocks = vi.hoisted(() => ({
  provision: vi.fn(),
  insertedCapataz: vi.fn(),
  insertedVinculo: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock("@/lib/profileProvisioning", () => ({
  provisionProfileUser: mocks.provision,
  PARTIAL_PROFILE_MESSAGE: "Conta criada sem vínculo confirmado",
  ProfileProvisioningError: class ProfileProvisioningError extends Error {},
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.errorToast, success: vi.fn() },
}));

vi.mock("@/components/i18n/LocalizedText", () => ({
  LocalizedText: ({ source }: { source: string }) => <>{source}</>,
  useStaticUiText: () => (source: string) => source,
}));

vi.mock("@/components/ForcarSyncButton", () => ({
  ForcarSyncButton: () => null,
}));

vi.mock("@/components/produtos/FazendasMultiSelect", () => ({
  default: ({ onChange }: { onChange: (ids: string[]) => void }) =>
    <button type="button" onClick={() => onChange(["retiro-1"])}>Escolher retiro</button>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const data = table === "retiros"
        ? [{ id: "retiro-1", nome: "Retiro de teste", fazenda_id: "fazenda-1" }]
        : table === "fazendas"
          ? [{ id: "fazenda-1", nome: "Fazenda de teste" }]
          : [];
      const response = { data, error: null };
      const query = {
        eq: () => query,
        order: async () => response,
        then: (resolve: (result: typeof response) => unknown) => Promise.resolve(response).then(resolve),
      };
      return {
        select: () => query,
        insert: (value: unknown) => {
          if (table === "capatazes") {
            mocks.insertedCapataz(value);
            return { select: () => ({ single: async () => ({ data: { id: "capataz-1" }, error: null }) }) };
          }
          mocks.insertedVinculo(value);
          return Promise.resolve({ error: null });
        },
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  },
}));

async function openForm() {
  render(<CapatazesPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Novo Capataz" }));
  const textboxes = screen.getAllByRole("textbox");
  fireEvent.change(textboxes[0], { target: { value: "Capataz Teste" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Email *" }), {
    target: { value: "capataz.novo@example.test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Escolher retiro" }));
}

describe("CapatazesPage profile creation", () => {
  beforeEach(() => {
    mocks.provision.mockReset();
    mocks.insertedCapataz.mockReset();
    mocks.insertedVinculo.mockReset();
    mocks.errorToast.mockReset();
  });

  it("does not attempt provisioning without a distinct confirmed password", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.errorToast).toHaveBeenCalledWith(expect.stringContaining("12 caracteres"));
  });

  it("blocks profile writes when Auth rejects the email", async () => {
    mocks.provision.mockRejectedValueOnce(new Error("Este e-mail já está cadastrado"));
    await openForm();
    fireEvent.change(document.querySelector("#capataz-password")!, {
      target: { value: "unique-credential-123" },
    });
    fireEvent.change(document.querySelector("#capataz-confirm-password")!, {
      target: { value: "unique-credential-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.provision).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.errorToast).toHaveBeenCalled());
    expect(mocks.insertedCapataz).not.toHaveBeenCalled();
  });

  it("links a confirmed Auth identity to the new capataz, never a null ID", async () => {
    mocks.provision.mockResolvedValueOnce("auth-user-id");
    await openForm();
    fireEvent.change(document.querySelector("#capataz-password")!, {
      target: { value: "unique-credential-123" },
    });
    fireEvent.change(document.querySelector("#capataz-confirm-password")!, {
      target: { value: "unique-credential-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(mocks.insertedCapataz).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "auth-user-id" }),
    ));
    expect(mocks.provision).toHaveBeenCalledWith(expect.objectContaining({
      role: "usuario", email: "capataz.novo@example.test",
    }));
  });
});
