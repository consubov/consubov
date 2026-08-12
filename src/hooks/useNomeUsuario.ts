import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Tabela = "capatazes" | "gerentes" | "administradores" | "operadores_fabrica";

const semEmail = (n?: string | null) => (n && !n.includes("@") ? n : null);

/**
 * Busca o nome real do usuário logado nas tabelas de papel informadas (na ordem).
 * NUNCA retorna e-mail: se nada for encontrado, retorna o fallback textual.
 */
export function useNomeUsuario(tabelas: Tabela[], fallback = "Usuário") {
  const { user } = useAuth();
  const metaNome = semEmail((user?.user_metadata as any)?.nome);
  const [nome, setNome] = useState<string>(metaNome || fallback);
  const key = tabelas.join(",");

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setNome(metaNome || fallback);
      return;
    }
    (async () => {
      for (const tabela of key.split(",") as Tabela[]) {
        const { data } = await (supabase as any)
          .from(tabela)
          .select("nome")
          .eq("user_id", user.id)
          .maybeSingle();
        const n = semEmail(data?.nome);
        if (n) {
          if (!cancelled) setNome(n);
          return;
        }
      }
      if (!cancelled) setNome(metaNome || fallback);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, key, metaNome, fallback]);

  return nome;
}
