import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Pencil } from "lucide-react";

/**
 * Intervalo entre salgas com MODO ÚNICO por fazenda (mesmo padrão da tela de GMD).
 * Regra efetiva no banco: pasto → retiro → fazenda (intervalo_do_pasto).
 */
type Modo = "fazenda" | "retiro" | "pasto";
const MODOS: { v: Modo; label: string }[] = [
  { v: "fazenda", label: "Fazenda" },
  { v: "retiro", label: "Por retiro" },
  { v: "pasto", label: "Por pasto" },
];
const MIN = 1;
const MAX = 60;

interface Ret { id: string; nome: string; intervalo: number | null }
interface Pas { id: string; nome: string; retiro_id: string; intervalo: number | null }

const txtDias = (n: number) => `${n} dia${n === 1 ? "" : "s"}`;
const valido = (v: string) => { const n = Number(v); return Number.isInteger(n) && n >= MIN && n <= MAX; };

export default function IntervaloSalgasCard({ fazendaId, onEditingChange }: { fazendaId: string; onEditingChange?: (e: boolean) => void }) {
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<Modo>("fazenda");
  const [fazInt, setFazInt] = useState<number>(4);
  const [retiros, setRetiros] = useState<Ret[]>([]);
  const [pastos, setPastos] = useState<Pas[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dModo, setDModo] = useState<Modo>("fazenda");
  const [dFaz, setDFaz] = useState("");
  const [dRet, setDRet] = useState<Record<string, string>>({});
  const [dPas, setDPas] = useState<Record<string, string>>({});
  const [aplicar, setAplicar] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [confirmModo, setConfirmModo] = useState<Modo | null>(null);

  useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);

  async function load() {
    setLoading(true);
    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from("fazendas").select("intervalo_padrao_dias, intervalo_modo" as any).eq("id", fazendaId).maybeSingle(),
      supabase.from("retiros").select("id, nome, intervalo_padrao_dias" as any).eq("fazenda_id", fazendaId).order("nome"),
    ]);
    const rets = ((r ?? []) as any[]).map((x) => ({ id: x.id, nome: x.nome, intervalo: x.intervalo_padrao_dias ?? null }));
    let pas: Pas[] = [];
    if (rets.length) {
      const { data: p } = await supabase.from("pastos").select("id, nome, retiro_id, intervalo_padrao_dias" as any)
        .in("retiro_id", rets.map((x) => x.id)).eq("ativo", true).order("nome");
      pas = ((p ?? []) as any[]).map((x) => ({ id: x.id, nome: x.nome, retiro_id: x.retiro_id, intervalo: x.intervalo_padrao_dias ?? null }));
    }
    const m = (f as any)?.intervalo_modo;
    setModo(m === "retiro" || m === "pasto" ? m : "fazenda");
    setFazInt(Number((f as any)?.intervalo_padrao_dias ?? 4));
    setRetiros(rets);
    setPastos(pas);
    setEditing(false);
    setLoading(false);
  }

  useEffect(() => { if (fazendaId) void load(); }, [fazendaId]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit() {
    setDModo(modo);
    setDFaz(String(fazInt));
    setDRet(Object.fromEntries(retiros.map((r) => [r.id, r.intervalo != null ? String(r.intervalo) : ""])));
    setDPas(Object.fromEntries(pastos.map((p) => [p.id, p.intervalo != null ? String(p.intervalo) : ""])));
    setAplicar({});
    setEditing(true);
  }

  function escolherModo(v: string) {
    const novo = v as Modo;
    if (novo === dModo) return;
    const temAntigos = (dModo === "retiro" && Object.values(dRet).some((x) => x !== ""))
      || (dModo === "pasto" && Object.values(dPas).some((x) => x !== ""))
      || (modo === "retiro" && retiros.some((r) => r.intervalo != null) && novo !== "retiro")
      || (modo === "pasto" && pastos.some((p) => p.intervalo != null) && novo !== "pasto");
    if (temAntigos) setConfirmModo(novo);
    else setDModo(novo);
  }

  function confirmarTroca() {
    if (!confirmModo) return;
    if (confirmModo !== "retiro") setDRet((d) => Object.fromEntries(Object.keys(d).map((k) => [k, ""])));
    if (confirmModo !== "pasto") setDPas((d) => Object.fromEntries(Object.keys(d).map((k) => [k, ""])));
    setDModo(confirmModo);
    setConfirmModo(null);
  }

  async function save() {
    if (!valido(dFaz)) { toast.error(`O intervalo da fazenda deve ser de ${MIN} a ${MAX} dias.`); return; }
    const ruinsR = dModo === "retiro" && Object.values(dRet).some((v) => v !== "" && !valido(v));
    const ruinsP = dModo === "pasto" && Object.values(dPas).some((v) => v !== "" && !valido(v));
    if (ruinsR || ruinsP) { toast.error(`Os intervalos devem ser de ${MIN} a ${MAX} dias.`); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("fazendas").update({ intervalo_padrao_dias: Number(dFaz), intervalo_modo: dModo } as any).eq("id", fazendaId);
      if (error) throw error;
      const retIds = retiros.map((r) => r.id);
      // Limpa os valores que não pertencem ao novo modo (só desta fazenda).
      if (dModo !== "retiro" && retiros.some((r) => r.intervalo != null)) {
        const { error: e } = await supabase.from("retiros").update({ intervalo_padrao_dias: null } as any).eq("fazenda_id", fazendaId);
        if (e) throw e;
      }
      if (dModo !== "pasto" && retIds.length) {
        const { error: e } = await supabase.from("pastos").update({ intervalo_padrao_dias: null } as any)
          .in("retiro_id", retIds).not("intervalo_padrao_dias" as any, "is", null);
        if (e) throw e;
      }
      if (dModo === "retiro") {
        for (const r of retiros) {
          const novo = dRet[r.id] === "" ? null : Number(dRet[r.id]);
          if (novo === r.intervalo) continue;
          const { error: e } = await supabase.from("retiros").update({ intervalo_padrao_dias: novo } as any).eq("id", r.id);
          if (e) throw e;
        }
      }
      if (dModo === "pasto") {
        for (const p of pastos) {
          const novo = dPas[p.id] === "" ? null : Number(dPas[p.id]);
          if (novo === p.intervalo) continue;
          const { error: e } = await supabase.from("pastos").update({ intervalo_padrao_dias: novo } as any).eq("id", p.id);
          if (e) throw e;
        }
      }
      toast.success("Intervalo salvo");
      await load();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  const modoAtual = editing ? dModo : modo;
  const fazBase = editing && valido(dFaz) ? Number(dFaz) : fazInt;
  const usandoPadrao = <span className="text-xs text-muted-foreground">Usando padrão da fazenda ({txtDias(fazBase)})</span>;

  const campoNum = (value: string, onChange: (v: string) => void, placeholder = "") => (
    <Input type="number" inputMode="numeric" min={MIN} max={MAX} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)} className="h-9 w-24" />
  );

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Intervalo entre salgas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <RadioGroup value={modoAtual} onValueChange={escolherModo} disabled={!editing} className="flex flex-wrap gap-4">
              {MODOS.map((m) => (
                <label key={m.v} className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value={m.v} /> {m.label}
                </label>
              ))}
            </RadioGroup>

            <div className="flex items-center justify-between gap-2 border rounded-md p-2">
              <span className="text-sm font-medium">{modoAtual === "fazenda" ? "Intervalo (dias)" : "Padrão da fazenda"}</span>
              {editing ? campoNum(dFaz, setDFaz) : <span className="text-sm">{txtDias(fazInt)}</span>}
            </div>

            {modoAtual === "retiro" && (
              <div className="space-y-2">
                {retiros.map((r) => {
                  const v = editing ? dRet[r.id] ?? "" : r.intervalo != null ? String(r.intervalo) : "";
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.nome}</p>
                        {v === "" && usandoPadrao}
                      </div>
                      {editing ? campoNum(v, (x) => setDRet((d) => ({ ...d, [r.id]: x }))) : v !== "" && <span className="text-sm">{txtDias(Number(v))}</span>}
                    </div>
                  );
                })}
                {retiros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retiro nesta fazenda.</p>}
              </div>
            )}

            {modoAtual === "pasto" && (
              <div className="space-y-2">
                {retiros.map((r) => {
                  const ps = pastos.filter((p) => p.retiro_id === r.id);
                  const aberto = !!abertos[r.id];
                  return (
                    <div key={r.id} className="border rounded-md">
                      <button type="button" onClick={() => setAbertos((a) => ({ ...a, [r.id]: !aberto }))}
                        className="w-full flex items-center gap-2 p-2 text-left">
                        {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="text-sm font-medium flex-1">{r.nome}</span>
                        <span className="text-xs text-muted-foreground">{ps.length} pastos</span>
                      </button>
                      {aberto && (
                        <div className="border-t p-2 space-y-2">
                          {editing && ps.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {campoNum(aplicar[r.id] ?? "", (x) => setAplicar((a) => ({ ...a, [r.id]: x })), "dias")}
                              <Button type="button" size="sm" variant="outline"
                                onClick={() => {
                                  const v = aplicar[r.id] ?? "";
                                  if (v !== "" && !valido(v)) { toast.error(`Use de ${MIN} a ${MAX} dias.`); return; }
                                  setDPas((d) => ({ ...d, ...Object.fromEntries(ps.map((p) => [p.id, v])) }));
                                }}>
                                Aplicar a todos os pastos deste retiro
                              </Button>
                            </div>
                          )}
                          {ps.map((p) => {
                            const v = editing ? dPas[p.id] ?? "" : p.intervalo != null ? String(p.intervalo) : "";
                            return (
                              <div key={p.id} className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm truncate">{p.nome}</p>
                                  {v === "" && usandoPadrao}
                                </div>
                                {editing ? campoNum(v, (x) => setDPas((d) => ({ ...d, [p.id]: x }))) : v !== "" && <span className="text-sm">{txtDias(Number(v))}</span>}
                              </div>
                            );
                          })}
                          {ps.length === 0 && <p className="text-xs text-muted-foreground">Nenhum pasto ativo.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!editing ? (
              <Button onClick={startEdit} className="w-full gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmModo !== null} onOpenChange={(o) => { if (!o) setConfirmModo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o modo do intervalo?</AlertDialogTitle>
            <AlertDialogDescription>Os intervalos do modo anterior serão apagados ao salvar. O valor da fazenda é mantido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTroca}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
