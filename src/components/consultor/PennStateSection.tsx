import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, HelpCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { calcularPennState } from "@/lib/pennState";
import {
  excluirPennStateAnalise,
  listarDietas,
  listarPennStateAnalises,
  salvarPennStateAnalise,
} from "@/lib/pennStateStore";

const SUGESTOES = [
  "Linha 1", "Linha 2", "Linha 3",
  "Início do Cocho", "Meio do Cocho", "Final do Cocho", "Baia A",
];

const ORIENTACAO =
  "Use uma amostra representativa, com no mínimo 500g. Realize os movimentos padronizados de separação do PSPS antes de pesar cada fração.";

interface Dieta { id: string; nome: string; fdn_percentual: number | null }
interface Analise {
  id: string;
  nome: string;
  dieta_id: string | null;
  peso_amostra_g: number;
  peso_19mm_g: number;
  peso_8mm_g: number;
  peso_4mm_g: number;
  peso_fundo_g: number;
  fdn_percentual_usado: number | null;
  percentual_19mm: number;
  percentual_8mm: number;
  percentual_4mm: number;
  percentual_fundo: number;
  fef: number;
  peNDF: number | null;
  aviso_divergencia: string | null;
  ordem: number;
}

const numOrNull = (v: string): number | null => {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

interface Props {
  visitaId: string;
  fazendaConsultorId: string | null;
  readOnly?: boolean;
}

export default function PennStateSection({ visitaId, fazendaConsultorId, readOnly }: Props) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Analise | null>(null);
  const [excluir, setExcluir] = useState<Analise | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [ajudaOpen, setAjudaOpen] = useState(false);

  // form
  const [nome, setNome] = useState("");
  const [amostra, setAmostra] = useState("");
  const [p19, setP19] = useState("");
  const [p8, setP8] = useState("");
  const [p4, setP4] = useState("");
  const [pFundo, setPFundo] = useState("");
  const [dietaId, setDietaId] = useState<string>("nenhuma");
  const [fdnManual, setFdnManual] = useState("");
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listarPennStateAnalises(visitaId);
      setAnalises(rows as Analise[]);
      if (fazendaConsultorId) {
        const ds = await listarDietas(fazendaConsultorId);
        setDietas(ds as Dieta[]);
      }
    } catch (err) {
      console.error("[pennstate] load", err);
    } finally {
      setLoading(false);
    }
  }, [visitaId, fazendaConsultorId]);

  useEffect(() => { void load(); }, [load]);

  const fdnEfetivo = useMemo(() => {
    if (dietaId !== "nenhuma") {
      const d = dietas.find(x => x.id === dietaId);
      if (d?.fdn_percentual != null) return d.fdn_percentual;
    }
    return numOrNull(fdnManual);
  }, [dietaId, dietas, fdnManual]);

  const preview = useMemo(() => calcularPennState({
    peso_amostra_g: numOrNull(amostra) ?? 0,
    peso_19mm_g: numOrNull(p19) ?? 0,
    peso_8mm_g: numOrNull(p8) ?? 0,
    peso_4mm_g: numOrNull(p4) ?? 0,
    peso_fundo_g: numOrNull(pFundo) ?? 0,
    fdn_percentual: fdnEfetivo,
  }), [amostra, p19, p8, p4, pFundo, fdnEfetivo]);

  const temEntradas = (numOrNull(amostra) ?? 0) > 0;

  function abrirNova() {
    setEditing(null);
    setNome(""); setAmostra(""); setP19(""); setP8(""); setP4(""); setPFundo("");
    setDietaId("nenhuma"); setFdnManual("");
    if (analises.length === 0) setAjudaOpen(true);
    setOpen(true);
  }

  function abrirEdicao(a: Analise) {
    setEditing(a);
    setNome(a.nome || "");
    setAmostra(String(a.peso_amostra_g ?? ""));
    setP19(String(a.peso_19mm_g ?? ""));
    setP8(String(a.peso_8mm_g ?? ""));
    setP4(String(a.peso_4mm_g ?? ""));
    setPFundo(String(a.peso_fundo_g ?? ""));
    setDietaId(a.dieta_id || "nenhuma");
    setFdnManual(a.dieta_id ? "" : (a.fdn_percentual_usado != null ? String(a.fdn_percentual_usado) : ""));
    setOpen(true);
  }

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome do ponto de coleta."); return; }
    if (!temEntradas) { toast.error("Informe o peso da amostra."); return; }
    setSalvando(true);
    try {
      await salvarPennStateAnalise({
        id: editing?.id,
        visita_id: visitaId,
        dieta_id: dietaId !== "nenhuma" ? dietaId : null,
        nome: nome.trim(),
        peso_amostra_g: numOrNull(amostra) ?? 0,
        peso_19mm_g: numOrNull(p19) ?? 0,
        peso_8mm_g: numOrNull(p8) ?? 0,
        peso_4mm_g: numOrNull(p4) ?? 0,
        peso_fundo_g: numOrNull(pFundo) ?? 0,
        fdn_percentual: fdnEfetivo,
        ordem: editing?.ordem ?? analises.length,
      });
      toast.success(editing ? "Análise atualizada" : "Análise salva");
      setOpen(false);
      await load();
    } catch (err: any) {
      console.error("[pennstate] salvar", err);
      toast.error("Erro ao salvar: " + (err?.message || "desconhecido"));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluir) return;
    setExcluindo(true);
    try {
      await excluirPennStateAnalise(excluir.id);
      setExcluir(null);
      toast.success("Análise excluída");
      await load();
    } catch (err) {
      console.error("[pennstate] excluir", err);
      toast.error("Não foi possível excluir a análise.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          Análise Penn State ({analises.length})
          <button
            type="button"
            aria-label="Orientação de coleta"
            onClick={() => setAjudaOpen(true)}
            className="text-muted-foreground hover:text-primary"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </h2>
        {!readOnly && (
          <Button size="sm" onClick={abrirNova} className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova Análise
          </Button>
        )}
      </div>

      {loading ? (
        <Card className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></Card>
      ) : analises.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma análise Penn State nesta visita.
        </Card>
      ) : (
        <div className="space-y-2">
          {analises.map(a => (
            <Card key={a.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{a.nome}</div>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    <Badge variant="secondary" className="text-[10px]">fef: {fmt(a.fef)}%</Badge>
                    {a.peNDF != null && (
                      <Badge variant="secondary" className="text-[10px]">peNDF: {fmt(a.peNDF)}%</Badge>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar análise ${a.nome}`} onClick={() => abrirEdicao(a)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Excluir análise ${a.nome}`} onClick={() => setExcluir(a)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && analises.length >= 2 && (
        <Card className="p-3 space-y-2">
          <div className="text-sm font-semibold text-foreground">Comparação entre Pontos</div>
          <p className="text-[11px] text-muted-foreground">
            Compare a distribuição entre os pontos coletados para avaliar a uniformidade da mistura ao longo da distribuição do cocho.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left font-medium py-1.5 pr-2">Ponto</th>
                  <th className="text-right font-medium py-1.5 px-1.5">19mm</th>
                  <th className="text-right font-medium py-1.5 px-1.5">8mm</th>
                  <th className="text-right font-medium py-1.5 px-1.5">4mm</th>
                  <th className="text-right font-medium py-1.5 px-1.5">Fundo</th>
                  <th className="text-right font-medium py-1.5 px-1.5">fef</th>
                  {analises.some(a => a.peNDF != null) && (
                    <th className="text-right font-medium py-1.5 pl-1.5">peNDF</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {analises.map(a => (
                  <tr key={a.id} className="border-b border-border/50 last:border-0">
                    <td className="text-left py-1.5 pr-2 font-medium text-foreground max-w-[110px] truncate">{a.nome}</td>
                    <td className="text-right py-1.5 px-1.5 text-foreground">{fmt(a.percentual_19mm)}%</td>
                    <td className="text-right py-1.5 px-1.5 text-foreground">{fmt(a.percentual_8mm)}%</td>
                    <td className="text-right py-1.5 px-1.5 text-foreground">{fmt(a.percentual_4mm)}%</td>
                    <td className="text-right py-1.5 px-1.5 text-foreground">{fmt(a.percentual_fundo)}%</td>
                    <td className="text-right py-1.5 px-1.5 font-semibold text-primary">{fmt(a.fef)}%</td>
                    {analises.some(x => x.peNDF != null) && (
                      <td className="text-right py-1.5 pl-1.5 text-foreground">
                        {a.peNDF != null ? `${fmt(a.peNDF)}%` : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}


      {/* Orientação de campo */}
      <Dialog open={ajudaOpen} onOpenChange={setAjudaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Orientação de coleta</DialogTitle>
            <DialogDescription>{ORIENTACAO}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAjudaOpen(false)} className="bg-primary hover:bg-primary/90">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Análise Penn State" : "Nova Análise Penn State"}</DialogTitle>
            <DialogDescription>Pese cada fração retida nas peneiras e no fundo.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Linha 1" />
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {SUGESTOES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNome(s)}
                    className="px-2 py-0.5 rounded-full border border-border text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
                  >{s}</button>
                ))}
              </div>
            </div>

            <div>
              <Label>Peso da amostra (g)</Label>
              <Input inputMode="decimal" value={amostra} onChange={e => setAmostra(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label>19mm (g)</Label><Input inputMode="decimal" value={p19} onChange={e => setP19(e.target.value)} /></div>
              <div><Label>8mm (g)</Label><Input inputMode="decimal" value={p8} onChange={e => setP8(e.target.value)} /></div>
              <div><Label>4mm (g)</Label><Input inputMode="decimal" value={p4} onChange={e => setP4(e.target.value)} /></div>
              <div><Label>Fundo (g)</Label><Input inputMode="decimal" value={pFundo} onChange={e => setPFundo(e.target.value)} /></div>
            </div>

            <div>
              <Label>Dieta (opcional)</Label>
              <Select value={dietaId} onValueChange={setDietaId}>
                <SelectTrigger><SelectValue placeholder="Sem dieta vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Sem dieta vinculada</SelectItem>
                  {dietas.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}{d.fdn_percentual != null ? ` · FDN ${fmt(d.fdn_percentual)}%` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dietaId === "nenhuma" && (
              <div>
                <Label>FDN (%) — opcional</Label>
                <Input inputMode="decimal" value={fdnManual} onChange={e => setFdnManual(e.target.value)} placeholder="Sem FDN, a análise segue sem peNDF" />
              </div>
            )}

            {temEntradas && preview.aviso_divergencia && (
              <div className="flex gap-2 rounded-md border border-secondary/50 bg-secondary/10 p-2 text-xs text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-secondary" />
                <span>{preview.aviso_divergencia}</span>
              </div>
            )}

            {temEntradas && (
              <Card className="p-3 space-y-1.5 bg-muted/40">
                <div className="text-xs font-semibold text-muted-foreground">Resultado</div>
                <ResLinha label="19mm" v={preview.percentual_19mm} />
                <ResLinha label="8mm" v={preview.percentual_8mm} />
                <ResLinha label="4mm" v={preview.percentual_4mm} />
                <ResLinha label="Fundo" v={preview.percentual_fundo} />
                <div className="pt-1.5 mt-1 border-t border-border text-sm font-semibold text-primary">
                  Material fisicamente efetivo (≥4mm): {fmt(preview.fef)}%
                </div>
                {preview.peNDF != null && (
                  <div>
                    <div className="text-sm font-semibold text-foreground">peNDF: {fmt(preview.peNDF)}%</div>
                    <div className="text-[10px] text-muted-foreground">FDN fisicamente efetiva</div>
                  </div>
                )}
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando} className="bg-primary hover:bg-primary/90">
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Calcular e salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluir} onOpenChange={v => { if (!v) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir análise {excluir?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => { e.preventDefault(); void confirmarExclusao(); }}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ResLinha({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{fmt(v)}%</span>
    </div>
  );
}
