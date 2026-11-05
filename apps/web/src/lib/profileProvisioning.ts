import { supabase } from "@/integrations/supabase/client";
import { createUserErrorMessage } from "@/lib/edgeFunctionUserError";

export const MIN_PROFILE_PASSWORD_LENGTH = 12;

export class ProfileProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileProvisioningError";
  }
}

export const UNCONFIRMED_PROFILE_MESSAGE =
  "A conta de acesso pode ter sido criada, mas o perfil não foi confirmado. Verifique o cadastro antes de tentar novamente.";

export const PARTIAL_PROFILE_MESSAGE =
  "Conta de acesso criada, mas o perfil ou seus vínculos não foram confirmados. Verifique antes de tentar novamente.";

type NewProfileUser = {
  email: string;
  senha: string;
  role: "usuario" | "administrador";
  nome?: string;
  telefone?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Single safe boundary for all profile creation flows.
 * Never retries creation, never reuses an existing Auth identity, and never
 * treats missing success/user ID as a successful provisioning operation.
 */
export async function provisionProfileUser(input: NewProfileUser): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ProfileProvisioningError("Informe um e-mail válido.");
  }
  if (input.senha.length < MIN_PROFILE_PASSWORD_LENGTH) {
    throw new ProfileProvisioningError("A senha deve ter pelo menos 12 caracteres.");
  }
  if (input.role === "administrador" && !input.nome?.trim()) {
    throw new ProfileProvisioningError("O nome do administrador é obrigatório.");
  }

  let response: Awaited<ReturnType<typeof supabase.functions.invoke>>;
  try {
    response = await supabase.functions.invoke("create-user", {
      body: {
        email,
        senha: input.senha,
        role: input.role,
        ...(input.nome?.trim() ? { nome: input.nome.trim() } : {}),
        ...(input.telefone?.trim() ? { telefone: input.telefone.trim() } : {}),
      },
    });
  } catch {
    throw new ProfileProvisioningError(UNCONFIRMED_PROFILE_MESSAGE);
  }

  if (response.error) {
    throw new ProfileProvisioningError(await createUserErrorMessage(response.error));
  }

  const data: unknown = response.data;
  if (!isRecord(data) || data.success !== true || !isRecord(data.user) ||
    typeof data.user.id !== "string" || !data.user.id.trim()) {
    throw new ProfileProvisioningError(UNCONFIRMED_PROFILE_MESSAGE);
  }
  return data.user.id;
}
