import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Baby, Settings2, Plus, Trash2 } from "lucide-react";
import { calcularPartosPrevistos, RACAS_PADRAO, type PartoPrevisto } from "@/lib/syncvetPartos";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

type Raca = { id: string; raca: string; dias_gestacao: number };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function SyncVetPartosPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;

  const [loading, setLoading] = useState(true);
  const [partos, setPartos] = useState<PartoPrevisto[]>([]);
  const [racas, setRacas] = useState<Raca[]>([]);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [novoRaca, setNovoRaca] = useState("");
  const [novoDias, setNovoDias] = useState<number>(285);

  const load = useCallback(async () => {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: cfg } = await supabase
        .from("syncvet_racas_gestacao")
        .select("id, raca, dias_gestacao")
        .eq("empresa_id", empresaId)
        .order("raca");
      let arr = (cfg as Raca[]) || [];
      if (arr.length === 0) {
        // Seed defaults
        const rows = RACAS_PADRAO.map(r => ({ empresa_id: empresaId, ...r }));
        const { data: seeded } = await supabase.from("syncvet_racas_gestacao").insert(rows).select("id, raca, dias_gestacao");
        arr = (seeded as Raca[]) || [];
      }
      setRacas(arr);
      const p = await calcularPartosPrevistos(empresaId);
      setPartos(p);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar partos");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { void load(); }, [load]);

  const porMes = useMemo(() => {
    const map = new Map<string, PartoPrevisto[]>();
    for (const p of partos) {
      const key = p.data_prevista_parto.slice(0, 7); // yyyy-mm
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [partos]);

  async function updateRaca(r: Raca, dias: number) {
    const { error } = await supabase.from("syncvet_racas_gestacao").update({ dias_gestacao: dias }).eq("id", r.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setRacas(prev => prev.map(x => x.id === r.id ? { ...x, dias_gestacao: dias } : x));
  }
  async function removeRaca(r: Raca) {
    if (!confirm(`Remover raça ${r.raca}?`)) return;
    const { error } = await supabase.from("syncvet_racas_gestacao").delete().eq("id", r.id);
    if (error) { toast.error("Erro ao remover"); return; }
    setRacas(prev => prev.filter(x => x.id !== r.id));
  }
  async function addRaca() {
    if (!empresaId || !novoRaca.trim()) return;
    const { data, error } = await supabase
      .from("syncvet_racas_gestacao")
      .insert({ empresa_id: empresaId, raca: novoRaca.trim(), dias_gestacao: novoDias })
      .select("id, raca, dias_gestacao").single();
    if (error) { toast.error("Erro (raça duplicada?)"); return; }
    setRacas(prev => [...prev, data as Raca].sort((a, b) => a.raca.localeCompare(b.raca)));
    setNovoRaca(""); setNovoDias(285);
    void load();
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-primary flex items-center gap-2">
          <Baby className="w-5 h-5" /> Calendário de Partos
        </h1>
        <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)}>
          <Settings2 className="w-3.5 h-3.5 mr-1" /> Raças
        </Button>
      </div>

      {porMes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma IATF concluída ainda. Conclua manejos de IATF para ver os partos previstos.
        </Card>
      ) : (
        <div className="space-y-2">
          {porMes.map(([mes, lista]) => {
            const [y, m] = mes.split("-").map(Number);
            const total = lista.reduce((s, p) => s + (p.quantidade_animais || 1), 0);
            return (
              <Card key={mes} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-primary">{MESES[m - 1]} de {y}</div>
                  <Badge className="bg-primary text-primary-foreground">{total} partos previstos</Badge>
                </div>
                <div className="space-y-1">
                  {lista.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs border-t border-border/40 pt-1.5">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.fazenda_nome} • {p.lote_nome}</div>
                        <div className="text-muted-foreground">
                          IATF: {p.data_iatf.split("-").reverse().join("/")} • {p.raca} ({p.dias_gestacao}d)
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-primary">{p.data_prevista_parto.split("-").reverse().join("/")}</div>
                        <div className="text-[10px] text-muted-foreground">{p.quantidade_animais} animais</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Dias de Gestação por Raça</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {racas.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <div className="flex-1 text-sm font-medium">{r.raca}</div>
                <Input
                  type="number"
                  className="w-24"
                  value={r.dias_gestacao}
                  onChange={(e) => updateRaca(r, Number(e.target.value))}
                />
                <span className="text-xs text-muted-foreground">dias</span>
                <Button variant="ghost" size="icon" onClick={() => removeRaca(r)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs">Adicionar raça</Label>
            <div className="flex gap-2">
              <Input placeholder="Nome da raça" value={novoRaca} onChange={(e) => setNovoRaca(e.target.value)} />
              <Input type="number" className="w-24" value={novoDias} onChange={(e) => setNovoDias(Number(e.target.value))} />
              <Button onClick={addRaca}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => { setCfgOpen(false); void load(); }}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
