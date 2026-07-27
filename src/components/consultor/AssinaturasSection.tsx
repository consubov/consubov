import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { offlineUpsert, offlineUpdate, offlineDelete, patchSnapshot, loadSnapshot } from "@/lib/consultorOffline/snapshotStore";

export interface Assinante {
  id: string;
  visita_id: string;
  nome: string;
  cargo_funcao: string;
  ordem: number;
}

export async function fetchAssinantes(visitaId: string): Promise<Assinante[]> {
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (online) {
    const { data } = await (supabase as any)
      .from("visita_assinantes")
      .select("*")
      .eq("visita_id", visitaId)
      .order("ordem", { ascending: true });
    if (data && data.length) return data as Assinante[];
  }
  const snap = await loadSnapshot(visitaId);
  return ((snap as any)?.assinantes as Assinante[]) || [];
}

export default function AssinaturasSection({
  visitaId, onNotifyEdit, onChange,
}: {
  visitaId: string;
  onNotifyEdit?: () => void | Promise<void>;
  onChange?: (list: Assinante[]) => void;
}) {
  const [list, setList] = useState<Assinante[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [visitaId]);

  async function load() {
    setLoading(true);
    const data = await fetchAssinantes(visitaId);
    setList(data);
    onChange?.(data);
    setLoading(false);
  }

  function applySnapshot(next: Assinante[]) {
    return patchSnapshot(visitaId, (curr) => ({ ...curr, assinantes: next as any })).catch(() => {});
  }

  async function addAssinante() {
    await onNotifyEdit?.();
    const rowId = crypto.randomUUID();
    const maxOrdem = list.reduce((m, a) => Math.max(m, a.ordem), 0);
    const payload = { visita_id: visitaId, nome: "", cargo_funcao: "Consultor Técnico", ordem: maxOrdem + 1 };
    const next = [...list, { id: rowId, ...payload }];
    setList(next);
    onChange?.(next);
    await applySnapshot(next);
    await offlineUpsert({ visitaId, table: "visita_assinantes", rowId, payload });
  }

  async function saveField(id: string, field: "nome" | "cargo_funcao", value: string) {
    await onNotifyEdit?.();
    const next = list.map(a => a.id === id ? { ...a, [field]: value } : a);
    setList(next);
    onChange?.(next);
    await applySnapshot(next);
    await offlineUpdate({ visitaId, table: "visita_assinantes", rowId: id, patch: { [field]: value } });
  }

  async function remove(id: string) {
    if (list.length <= 1) { toast.error("É necessário ao menos 1 assinante."); return; }
    await onNotifyEdit?.();
    const next = list.filter(a => a.id !== id);
    setList(next);
    onChange?.(next);
    await applySnapshot(next);
    await offlineDelete({ visitaId, table: "visita_assinantes", rowId: id });
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3" style={{ borderColor: "#E7E3D6" }}>
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4" style={{ color: "#14432B" }} />
        <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
          Assinaturas
        </div>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Carregando…</div>
      ) : list.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nenhum assinante adicionado ainda.</div>
      ) : (
        <div className="space-y-2">
          {list.map((a, idx) => (
            <AssinanteRow
              key={a.id}
              assinante={a}
              canRemove={list.length > 1}
              onSave={(f, v) => saveField(a.id, f, v)}
              onRemove={() => remove(a.id)}
              index={idx}
            />
          ))}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" onClick={addAssinante} className="gap-1.5">
        <Plus className="w-4 h-4" /> Adicionar Consultor
      </Button>
    </div>
  );
}

function AssinanteRow({
  assinante, canRemove, onSave, onRemove, index,
}: {
  assinante: Assinante;
  canRemove: boolean;
  onSave: (field: "nome" | "cargo_funcao", value: string) => void;
  onRemove: () => void;
  index: number;
}) {
  const [nome, setNome] = useState(assinante.nome);
  const [cargo, setCargo] = useState(assinante.cargo_funcao);
  useEffect(() => { setNome(assinante.nome); setCargo(assinante.cargo_funcao); }, [assinante.nome, assinante.cargo_funcao]);
  return (
    <div className="rounded-md border p-2 space-y-1.5" style={{ borderColor: "#E7E3D6" }}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>
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
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: "#767066" }}>Nome</div>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            onBlur={() => { if (nome !== assinante.nome) onSave("nome", nome); }}
            className="h-8 text-sm"
            placeholder="Nome completo"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: "#767066" }}>Cargo / Função</div>
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
