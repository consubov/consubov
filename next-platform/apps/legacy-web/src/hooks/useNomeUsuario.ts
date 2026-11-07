import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  findUserDisplayName,
  normalizeUserDisplayName,
  type UserRoleTable,
} from "@/features/users/repositories/userNameRepository";

/**
 * Busca o nome real do usuário logado nas tabelas de papel informadas (na ordem).
 * NUNCA retorna e-mail: se nada for encontrado, retorna o fallback textual.
 */
export function useNomeUsuario(
  tabelas: UserRoleTable[],
  fallback = "Usuário",
) {
  const { user } = useAuth();
  const metaNome = normalizeUserDisplayName(
    (user?.user_metadata as any)?.nome,
  );
  const [nome, setNome] = useState<string>(metaNome || fallback);
  const key = tabelas.join(",");

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setNome(metaNome || fallback);
      return;
    }

    void findUserDisplayName(
      user.id,
      key.split(",") as UserRoleTable[],
    ).then((resolvedName) => {
      if (!cancelled) {
        setNome(resolvedName || metaNome || fallback);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, key, metaNome, fallback]);

  return nome;
}
