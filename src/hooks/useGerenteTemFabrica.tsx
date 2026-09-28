import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Gerente tem fábrica vinculada quando alguma fábrica tem como destino
 * (fabrica_destinos) uma das fazendas do gerente — o mesmo vínculo que faz
 * as transferências de fábrica chegarem a ele. Sempre consulta o banco ao
 * montar (sem cache), então mudanças do Admin valem na próxima abertura.
 * Retorna null enquanto carrega.
 */
export function useGerenteTemFabrica(): boolean | null {
  const { roleData } = useAuth();
  const role = roleData.role;
  const [tem, setTem] = useState<boolean | null>(null);

  useEffect(() => {
    if (role !== "gerente") { setTem(role ? true : null); return; }
    if (!roleData.roleId) return;
    let cancel = false;
    (async () => {
      const { data: vinc } = await supabase
        .from("gerentes_fazendas").select("fazenda_id").eq("gerente_id", roleData.roleId);
      const ids = new Set<string>((vinc ?? []).map((v: any) => v.fazenda_id).filter(Boolean));
      if (roleData.fazendaId) ids.add(roleData.fazendaId);
      if (ids.size === 0) { if (!cancel) setTem(false); return; }
      const { count, error } = await supabase
        .from("fabrica_destinos").select("id", { count: "exact", head: true })
        .in("fazenda_id", Array.from(ids));
      if (!cancel) setTem(!error && (count ?? 0) > 0);
    })();
    return () => { cancel = true; };
  }, [role, roleData.roleId, roleData.fazendaId]);

  return tem;
}

/** Bloqueia as rotas de matérias-primas para gerente sem fábrica vinculada. */
export function GerenteFabricaGuard({ children }: { children: React.ReactNode }) {
  const tem = useGerenteTemFabrica();
  if (tem === null) return null;
  if (!tem) return <Navigate to="/gerente" replace />;
  return <>{children}</>;
}
