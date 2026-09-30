import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, PenLine, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface ConferenciaAssinante {
  id: string;
  nome: string;
  cargo_funcao: string;
  ordem: number;
}

/**
 * Assinaturas da Conferência do Admin (módulo Admin QR Conference).
 * Usa a tabela `visita_assinantes` vinculada à visita de conferência,
 * de forma independente do fluxo offline do módulo Consultor.
 */
export default function ConferenciaAssinaturasSection({
  visitaId, nomePadrao, onChange,
}: {
  visitaId: string;
  nomePadrao: string;
  onChange?: (list: ConferenciaAssinante[]) => void;
}) {
  const [list, setList] = useState<ConferenciaAssinante[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("visita_assinantes")
        .select("id, nome, cargo_funcao, ordem")
        .eq("visita_id", visitaId)
        .order("ordem", { ascending: true });
      if (cancelled) return;
      let rows = (data as ConferenciaAssinante[]) || [];
      if (rows.length === 0 && nomePadrao) {
        // Usuário logado entra automaticamente como assinante padrão.
        const { data: novo } = await (supabase as any)
          .from("visita_assinantes")
          .insert({ visita_id: visitaId, nome: nomePadrao, cargo_funcao: "Responsável Técnico", ordem: 1 })
          .select("id, nome, cargo_funcao, ordem")
          .maybeSingle();
        if (novo) rows = [novo as ConferenciaAssinante];
      }
      if (cancelled) return;
      setList(rows);
      onChange?.(rows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitaId, nomePadrao]);

  const update = (next: ConferenciaAssinante[]) => { setList(next); onChange?.(next); };

  async function add() {
    const ordem = list.reduce((m, a) => Math.max(m, a.ordem), 0) + 1;
    const { data, error } = await (supabase as any)
      .from("visita_assinantes")
      .insert({ visita_id: visitaId, nome: "", cargo_funcao: "Consultor Técnico", ordem })
      .select("id, nome, cargo_funcao, ordem")
      .maybeSingle();
    if (error || !data) { toast.error("Não foi possível adicionar o assinante."); return; }
    update([...list, data as ConferenciaAssinante]);
  }

  async function saveField(id: string, field: "nome" | "cargo_funcao", value: string) {
    update(list.map(a => (a.id === id ? { ...a, [field]: value } : a)));
    await (supabase as any).from("visita_assinantes").update({ [field]: value }).eq("id", id);
  }

  async function remove(id: string) {
    if (list.length <= 1) { toast.error("É necessário ao menos 1 assinante."); return; }
    update(list.filter(a => a.id !== id));
    await (supabase as any).from("visita_assinantes").delete().eq("id", id);
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-primary" />
        <div className="text-[11px] uppercase tracking-wide font-bold text-primary">Assinaturas</div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((a, idx) => (
            <AssinanteRow
              key={a.id}
              assinante={a}
              index={idx}
              canRemove={list.length > 1}
              onSave={(f, v) => void saveField(a.id, f, v)}
              onRemove={() => void remove(a.id)}
            />
          ))}
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => void add()} className="gap-1.5">
        <Plus className="w-4 h-4" /> Adicionar Consultor
      </Button>
    </div>
  );
}

function AssinanteRow({
  assinante, index, canRemove, onSave, onRemove,
}: {
  assinante: ConferenciaAssinante;
  index: number;
  canRemove: boolean;
  onSave: (field: "nome" | "cargo_funcao", value: string) => void;
  onRemove: () => void;
}) {
  const [nome, setNome] = useState(assinante.nome);
  const [cargo, setCargo] = useState(assinante.cargo_funcao);
  useEffect(() => {
    setNome(assinante.nome);
    setCargo(assinante.cargo_funcao);
  }, [assinante.nome, assinante.cargo_funcao]);

  return (
    <div className="rounded-md border p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
          Assinante {index + 1}
        </div>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 px-2 text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5 text-muted-foreground">Nome</div>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            onBlur={() => { if (nome !== assinante.nome) onSave("nome", nome); }}
            className="h-8 text-sm"
            placeholder="Nome completo"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5 text-muted-foreground">Cargo / Função</div>
          <Input
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            onBlur={() => { if (cargo !== assinante.cargo_funcao) onSave("cargo_funcao", cargo); }}
            className="h-8 text-sm"
            placeholder="Consultor Técnico"
          />
        </div>
      </div>
    </div>
  );
}
