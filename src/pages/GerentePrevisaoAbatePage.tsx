import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GerenteFazendaSelect, useGerenteFazendaAtiva } from "@/components/gerente/GerenteFazendaSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronRight, Loader2, Pencil } from "lucide-react";

interface CfgRow { id: string; fazenda_id: string; retiro_id: string | null; peso_alvo_kg: number; janela_dias: number; }
interface Prev {
  pasto_id: string; pasto: string; retiro: string; categoria: string | null; num_animais: number | null;
  peso_atual: number | null; peso_alvo: number | null; janela_dias: number | null; gmd_hoje: number | null;
  dias_para_alvo: number | null; data_prevista: string | null;
}
type Form = { peso: string; dias: string };

const nf = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const toStr = (r?: CfgRow): Form => ({
  peso: r ? String(r.peso_alvo_kg).replace(".", ",") : "",
  dias: r ? String(r.janela_dias) : "",
});
const fmtData = (s: string | null) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

function validar(f: Form): { peso: number; dias: number } | null | string {
  const p = f.peso.trim(), d = f.dias.trim();
  if (!p && !d) return null;
  if (!p || !d) return "Preencha peso-alvo e dias juntos.";
  const peso = Number(p.replace(",", "."));
  const dias = Number(d);
  if (!Number.isFinite(peso) || peso < 100 || peso > 1200) return "Peso-alvo deve estar entre 100 e 1200 kg.";
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) return "Dias deve ser um número inteiro entre 1 e 365.";
  return { peso: Math.round(peso * 100) / 100, dias };
}

export default function GerentePrevisaoAbatePage() {
  const navigate = useNavigate();
  const { roleData } = useAuth();
  const { fazendas, fazendaId, setFazendaId, carregado } = useGerenteFazendaAtiva();
  const [retiros, setRetiros] = useState<{ id: string; nome: string }[]>([]);
  const [cfg, setCfg] = useState<CfgRow[]>([]);
  const [prev, setPrev] = useState<Prev[]>([]);
  const [temGmd, setTemGmd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, Form>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  // Fazenda ativa compartilhada com o Painel do Gerente.
  useEffect(() => { if (carregado && !fazendaId) setLoading(false); }, [carregado, fazendaId]);

  async function load(id: string) {
    setLoading(true);
    const [{ data: r }, { data: c }, { data: p, error: pe }, { data: f }, { data: g }] = await Promise.all([
      supabase.from("retiros").select("id, nome").eq("fazenda_id", id).eq("ativo", true).order("nome"),
      (supabase as any).from("abate_config").select("id, fazenda_id, retiro_id, peso_alvo_kg, janela_dias").eq("fazenda_id", id),
      (supabase as any).rpc("previsao_abate", { p_fazenda: id }),
      supabase.from("fazendas").select("gmd_modo" as any).eq("id", id).maybeSingle(),
      (supabase as any).from("gmd_config").select("id").eq("fazenda_id", id).limit(1),
    ]);
    if (pe) toast.error("Erro ao calcular previsão: " + pe.message);
    setRetiros((r ?? []) as any);
    setCfg((c ?? []) as CfgRow[]);
    const lista = ((p ?? []) as Prev[]).slice().sort((a, b) => (a.dias_para_alvo ?? 1e9) - (b.dias_para_alvo ?? 1e9));
    setPrev(lista);
    setTemGmd(!!(f as any)?.gmd_modo && ((g ?? []) as any[]).length > 0);
    setEditing(false);
    setLoading(false);
  }

  useEffect(() => { if (fazendaId) void load(fazendaId); }, [fazendaId]);

  const linha = (retiroId: string | null) => cfg.find((x) => (x.retiro_id ?? null) === retiroId);

  function startEdit() {
    const d: Record<string, Form> = { faz: toStr(linha(null)) };
    for (const r of retiros) d[r.id] = toStr(linha(r.id));
    setDraft(d);
    setEditing(true);
  }

  async function save() {
    const escopos: { key: string; retiroId: string | null; nome: string }[] = [
      { key: "faz", retiroId: null, nome: "Fazenda" },
      ...retiros.map((r) => ({ key: r.id, retiroId: r.id, nome: r.nome })),
    ];
    const vals: Record<string, { peso: number; dias: number } | null> = {};
    for (const e of escopos) {
      const v = validar(draft[e.key] ?? { peso: "", dias: "" });
      if (typeof v === "string") { toast.error(`${e.nome}: ${v}`); return; }
      vals[e.key] = v;
    }
    setSaving(true);
    const tbl = () => (supabase as any).from("abate_config");
    const agora = new Date().toISOString();
    const por = roleData?.roleId ?? null;
    try {
      for (const e of escopos) {
        const v = vals[e.key];
        const ex = linha(e.retiroId);
        if (!v) {
          if (ex) { const { error } = await tbl().delete().eq("id", ex.id); if (error) throw error; }
          continue;
        }
        if (ex) {
          if (Number(ex.peso_alvo_kg) === v.peso && Number(ex.janela_dias) === v.dias) continue;
          const { error } = await tbl().update({ peso_alvo_kg: v.peso, janela_dias: v.dias, atualizado_em: agora, atualizado_por: por }).eq("id", ex.id);
          if (error) throw error;
        } else {
          const { error } = await tbl().insert({ fazenda_id: fazendaId, retiro_id: e.retiroId, peso_alvo_kg: v.peso, janela_dias: v.dias, atualizado_em: agora, atualizado_por: por });
          if (error) throw error;
        }
      }
      toast.success("Configuração de abate salva");
      await load(fazendaId);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  const campos = (key: string) => {
    const f = draft[key] ?? { peso: "", dias: "" };
    const set = (patch: Partial<Form>) => setDraft((d) => ({ ...d, [key]: { ...f, ...patch } }));
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <label className="block text-xs font-medium whitespace-nowrap leading-none">Peso-alvo (kg)</label>
            <Input inputMode="decimal" placeholder="Ex.: 540" className="h-9 w-full" value={f.peso} onChange={(e) => set({ peso: e.target.value })} />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <label className="block text-xs font-medium whitespace-nowrap leading-none">Janela (dias)</label>
            <Input inputMode="numeric" placeholder="Ex.: 60" className="h-9 w-full" value={f.dias} onChange={(e) => set({ dias: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-snug">O lote aparece na previsão quando faltar até esse número de dias para atingir o peso-alvo.</p>
      </div>
    );
  };

  const leitura = (r?: CfgRow, vazio = "Não definido") =>
    r ? <span>{nf(r.peso_alvo_kg, 0)} kg · até {r.janela_dias} dias</span> : <span className="text-muted-foreground italic">{vazio}</span>;

  const totalAnimais = prev.reduce((s, p) => s + (p.num_animais ?? 0), 0);
  const dias = (p: Prev) =>
    p.dias_para_alvo === 0 ? <Badge className="bg-primary text-primary-foreground">Pronto</Badge> : <span>{nf(p.dias_para_alvo)}</span>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gerente")} className="text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold">Previsão de Abate</h1>
      </header>
      <main className="p-4 space-y-4 max-w-4xl mx-auto">
        <GerenteFazendaSelect fazendas={fazendas} value={fazendaId} onChange={setFazendaId} dirty={editing} />
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !fazendaId ? (
          <p className="text-sm text-muted-foreground">Nenhuma fazenda vinculada.</p>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Configuração</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Fazenda</p>
                  {editing ? campos("faz") : <p className="text-sm">{leitura(linha(null))}</p>}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Por retiro</p>
                  {retiros.map((r) => {
                    const aberto = !!abertos[r.id];
                    return (
                      <div key={r.id} className="border rounded-md">
                        <button className="w-full flex items-center justify-between p-2 text-sm font-medium" onClick={() => setAbertos((a) => ({ ...a, [r.id]: !aberto }))}>
                          <span>{r.nome}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                            {!editing && (linha(r.id) ? leitura(linha(r.id)) : "Seguindo a fazenda")}
                            {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                        </button>
                        {aberto && (
                          <div className="p-2 pt-0 text-sm">
                            {editing ? campos(r.id) : leitura(linha(r.id), "Seguindo a fazenda")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {retiros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retiro nesta fazenda.</p>}
                </div>
                {editing && <p className="text-xs text-muted-foreground">Peso entre 100 e 1200 kg; dias entre 1 e 365. Retiro com campos vazios segue a fazenda.</p>}
                {!editing ? (
                  <Button onClick={startEdit} className="w-full gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                    <Button className="flex-1" onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {!temGmd && (
              <div className="flex items-start gap-2 rounded-md border border-secondary bg-secondary/10 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-secondary shrink-0" />
                <div className="flex-1">
                  Esta fazenda não tem GMD configurado, então a previsão não pode ser calculada.
                  <Button variant="link" className="h-auto p-0 ml-1" onClick={() => navigate("/gerente/gmd")}>Configurar GMD</Button>
                </div>
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Previsão</CardTitle>
                <p className="text-xs text-muted-foreground">{prev.length} pasto(s) · {nf(totalAnimais)} animais</p>
              </CardHeader>
              <CardContent>
                {prev.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum lote atinge o peso-alvo dentro da janela configurada.</p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-muted-foreground text-left">
                          <tr>
                            <th className="py-2 pr-2">Pasto</th><th className="pr-2">Retiro</th><th className="pr-2">Categoria</th>
                            <th className="pr-2 text-right">Animais</th><th className="pr-2 text-right">Peso atual</th>
                            <th className="pr-2 text-right">Peso-alvo</th><th className="pr-2 text-right">GMD</th>
                            <th className="pr-2 text-right">Dias restantes</th><th className="text-right">Data prevista</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prev.map((p) => (
                            <tr key={p.pasto_id} className="border-t">
                              <td className="py-2 pr-2 font-medium">{p.pasto}</td>
                              <td className="pr-2">{p.retiro}</td>
                              <td className="pr-2">{p.categoria ?? "—"}</td>
                              <td className="pr-2 text-right">{nf(p.num_animais)}</td>
                              <td className="pr-2 text-right">{nf(p.peso_atual, 1)} kg</td>
                              <td className="pr-2 text-right">{nf(p.peso_alvo, 0)} kg</td>
                              <td className="pr-2 text-right">{nf(p.gmd_hoje, 3)}</td>
                              <td className="pr-2 text-right">{dias(p)}</td>
                              <td className="text-right">{fmtData(p.data_prevista)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="md:hidden space-y-2">
                      {prev.map((p) => (
                        <div key={p.pasto_id} className="border rounded-md p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{p.pasto}</span>
                            {dias(p)}
                          </div>
                          <p className="text-xs text-muted-foreground">{p.retiro} · {p.categoria ?? "—"} · {nf(p.num_animais)} animais</p>
                          <div className="grid grid-cols-2 gap-x-3 text-xs">
                            <span>Peso: {nf(p.peso_atual, 1)} → {nf(p.peso_alvo, 0)} kg</span>
                            <span>GMD: {nf(p.gmd_hoje, 3)}</span>
                            <span>Dias: {p.dias_para_alvo === 0 ? "0" : nf(p.dias_para_alvo)}</span>
                            <span>Data: {fmtData(p.data_prevista)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
