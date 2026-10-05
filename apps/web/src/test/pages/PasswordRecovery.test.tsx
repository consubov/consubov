import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RecuperarSenhaPage from "@/pages/RecuperarSenhaPage";
import RedefinirSenhaPage from "@/pages/RedefinirSenhaPage";

const authMocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: authMocks },
}));

beforeEach(() => {
  authMocks.resetPasswordForEmail.mockReset();
  authMocks.updateUser.mockReset();
  authMocks.signOut.mockReset();
  authMocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  authMocks.updateUser.mockResolvedValue({ error: null });
  authMocks.signOut.mockResolvedValue({ error: null });
});

describe("recuperação de senha", () => {
  it("requests a provider recovery link without exposing whether the account exists", async () => {
    render(
      <MemoryRouter initialEntries={["/recuperar-senha"]}>
        <RecuperarSenhaPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "  pessoa@example.com  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    await waitFor(() => expect(authMocks.resetPasswordForEmail).toHaveBeenCalledTimes(1));
    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "pessoa@example.com",
      expect.objectContaining({ redirectTo: expect.stringMatching(/\/redefinir-senha$/) }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Solicitação enviada");
  });

  it("shows a generic recoverable error when the provider rejects the request", async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({ error: new Error("provider detail") });
    render(
      <MemoryRouter initialEntries={["/recuperar-senha"]}>
        <RecuperarSenhaPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "pessoa@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar instruções" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível solicitar a recuperação agora");
    expect(screen.queryByText("provider detail")).not.toBeInTheDocument();
  });

  it("rejects mismatched new passwords before calling the provider", async () => {
    render(
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <RedefinirSenhaPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "senha-a" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "senha-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("As senhas precisam ser iguais");
    expect(authMocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates the password, clears the recovery session and returns to login", async () => {
    render(
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <Routes>
          <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />
          <Route path="/login" element={<div>Login após redefinição</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: "nova-senha" } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: "nova-senha" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));

    await waitFor(() => expect(authMocks.updateUser).toHaveBeenCalledWith({ password: "nova-senha" }));
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Login após redefinição")).toBeInTheDocument();
  });
});
