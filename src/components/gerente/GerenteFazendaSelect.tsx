import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Fazenda "ativa" do Gerente, compartilhada entre o Painel do Gerente e as
 * telas de configuração (GMD, Intervalo e Auditoria, Previsão de Abate, Produtos).
 * Guarda no mesmo registro de sessão usado pelo Painel ("consubov:gerente-filtros").
 */
const KEY = "consubov:gerente-filtros";
export interface FazendaOpcao { id: string; nome: string }

function lerFazendaAtiva(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw)?.fazenda || null) : null;
  } catch { return null; }
}

function gravarFazendaAtiva(id: string) {
  try {
    const raw = sessionStorage.getItem(KEY);
    const atual = raw ? JSON.parse(raw) : null;
    const hoje = new Date();
    const mudou = atual?.fazenda !== id;
    sessionStorage.setItem(KEY, JSON.stringify({
      fazenda: id,
      // Retiro/produto são da fazenda anterior: voltam para "todos".
      retiro: mudou ? "todos" : (atual?.retiro ?? "todos"),
      produto: mudou ? "todos" : (atual?.produto ?? "todos"),
      mes: typeof atual?.mes === "number" ? atual.mes : hoje.getMonth() + 1,
      ano: typeof atual?.ano === "number" ? atual.ano : hoje.getFullYear(),
    }));
  } catch { /* ignore */ }
}

/** Fazendas do gerente (gerentes_fazendas; reserva: fazenda principal) + fazenda ativa. */
export function useGerenteFazendaAtiva() {
  const { roleData } = useAuth();
  const [fazendas, setFazendas] = useState<FazendaOpcao[]>([]);
  const [fazendaId, setFazendaIdState] = useState("");
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const gerenteId = roleData?.roleId;
    if (!gerenteId) return;
    let vivo = true;
    (async () => {
      const { data } = await supabase.from("gerentes_fazendas").select("fazenda_id, fazendas(id, nome)").eq("gerente_id", gerenteId);
      let ops: FazendaOpcao[] = ((data ?? []) as any[]).flatMap((it) => {
        const f = Array.isArray(it.fazendas) ? it.fazendas[0] : it.fazendas;
        return f?.id ? [{ id: f.id as string, nome: f.nome as string }] : [];
      });
      if (ops.length === 0 && roleData?.fazendaId) {
        const { data: f } = await supabase.from("fazendas").select("id, nome").eq("id", roleData.fazendaId).maybeSingle();
        ops = f ? [f as FazendaOpcao] : [];
      }
      if (!vivo) return;
      const salva = lerFazendaAtiva();
      const inicial = ops.find((o) => o.id === salva)?.id
        ?? ops.find((o) => o.id === roleData?.fazendaId)?.id
        ?? ops[0]?.id ?? "";
      setFazendas(ops);
      setFazendaIdState(inicial);
      if (inicial && inicial !== salva) gravarFazendaAtiva(inicial);
      setCarregado(true);
    })();
    return () => { vivo = false; };
  }, [roleData?.roleId, roleData?.fazendaId]);

  const setFazendaId = useCallback((id: string) => {
    setFazendaIdState((atual) => {
      if (!fazendas.some((f) => f.id === id)) return atual;
      gravarFazendaAtiva(id);
      return id;
    });
  }, [fazendas]);

  return { fazendas, fazendaId, setFazendaId, carregado };
}

/** Seletor "Fazenda" com o mesmo visual do Painel do Gerente. Só aparece com 2+ fazendas. */
export function GerenteFazendaSelect({ fazendas, value, onChange, dirty = false }: {
  fazendas: FazendaOpcao[]; value: string; onChange: (id: string) => void; dirty?: boolean;
}) {
  if (fazendas.length <= 1) return null;
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === value) return;
        if (dirty && !window.confirm("Descartar alterações não salvas?")) return;
        onChange(v);
      }}
    >
      <SelectTrigger className="h-9 w-full max-w-[190px]" aria-label="Selecionar fazenda">
        <SelectValue placeholder="Fazenda" />
      </SelectTrigger>
      <SelectContent>
        {fazendas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
