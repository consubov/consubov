import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Pencil } from "lucide-react";
import { CATEGORIAS_PASTO } from "@/lib/categoriaPasto";

// Fase de configuração apenas: grava em gmd_config e fazendas.verao_mes_*.
// Não calcula peso projetado nem altera pastos/consumo.

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const GMD_MIN = -1;
const GMD_MAX = 3;

interface GmdRow {
  id: string; fazenda_id: string; retiro_id: string | null; categoria: string | null;
  gmd_kg: number | null; gmd_verao_kg: number | null; gmd_inverno_kg: number | null;
}

// Valores de formulário (texto) por escopo
interface ScopeForm { verao: string; inverno: string; cat: Record<string, string> }

const emptyForm = (): ScopeForm => ({ verao: "", inverno: "", cat: Object.fromEntries(CATEGORIAS_PASTO.map((c) => [c, ""])) });

const fmt = (n: number | null | undefined) => (n == null ? "" : Number(n).toFixed(3).replace(".", ","));

function parseGmd(s: string): number | null | "invalid" {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < GMD_MIN || n > GMD_MAX) return "invalid";
  return Math.round(n * 1000) / 1000;
}

function formFromRows(rows: GmdRow[], retiroId: string | null): ScopeForm {
  const f = emptyForm();
  for (const r of rows.filter((x) => (x.retiro_id ?? null) === retiroId)) {
    if (!r.categoria) { f.verao = fmt(r.gmd_verao_kg); f.inverno = fmt(r.gmd_inverno_kg); }
    else if (r.categoria in f.cat) f.cat[r.categoria] = fmt(r.gmd_kg);
  }
  return f;
}

const formVazio = (f: ScopeForm) => !f.verao.trim() && !f.inverno.trim() && Object.values(f.cat).every((v) => !v.trim());

function descreverInverno(ini: number | null, fim: number | null): string {
  if (!ini || !fim) return "Inverno: ano todo (verão não definido)";
  const inv: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const noVerao = ini <= fim ? m >= ini && m <= fim : m >= ini || m <= fim;
    if (!noVerao) inv.push(m);
  }
  if (inv.length === 0) return "Inverno: nenhum mês (verão o ano todo)";
  // início do inverno = mês seguinte ao fim do verão
  const start = (fim % 12) + 1;
  const end = ini === 1 ? 12 : ini - 1;
  return `Inverno: ${MESES[start - 1]} a ${MESES[end - 1]}`;
}

export default function GerenteGmdPage() {
  const navigate = useNavigate();
  const { roleData } = useAuth();
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [fazendaId, setFazendaId] = useState("");
  const [retiros, setRetiros] = useState<{ id: string; nome: string }[]>([]);
  const [rows, setRows] = useState<GmdRow[]>([]);
  const [verao, setVerao] = useState<{ ini: number | null; fim: number | null }>({ ini: null, fim: null });
  const [draftVerao, setDraftVerao] = useState(verao);
  const [forms, setForms] = useState<Record<string, ScopeForm>>({});
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mesma fonte do seletor de fazenda do Painel do Gerente (gerentes_fazendas).
  useEffect(() => {
    (async () => {
      const gerenteId = roleData?.roleId;
      if (!gerenteId) return;
      const { data } = await supabase.from("gerentes_fazendas").select("fazenda_id, fazendas(id, nome)").eq("gerente_id", gerenteId);
      let opcoes = ((data ?? []) as any[]).flatMap((it) => {
        const f = Array.isArray(it.fazendas) ? it.fazendas[0] : it.fazendas;
        return f?.id ? [{ id: f.id as string, nome: f.nome as string }] : [];
      });
      if (opcoes.length === 0 && roleData?.fazendaId) {
        const { data: f } = await supabase.from("fazendas").select("id, nome").eq("id", roleData.fazendaId).maybeSingle();
        opcoes = f ? [f as any] : [];
      }
      setFazendas(opcoes);
      if (opcoes[0]) setFazendaId(opcoes[0].id);
      else setLoading(false);
    })();
  }, [roleData?.roleId, roleData?.fazendaId]);

  async function load(id: string) {
    setLoading(true);
    const [{ data: f }, { data: r }, { data: g }] = await Promise.all([
      supabase.from("fazendas").select("verao_mes_inicio, verao_mes_fim" as any).eq("id", id).maybeSingle(),
      supabase.from("retiros").select("id, nome").eq("fazenda_id", id).eq("ativo", true).order("nome"),
      (supabase as any).from("gmd_config").select("id, fazenda_id, retiro_id, categoria, gmd_kg, gmd_verao_kg, gmd_inverno_kg").eq("fazenda_id", id),
    ]);
    setVerao({ ini: (f as any)?.verao_mes_inicio ?? null, fim: (f as any)?.verao_mes_fim ?? null });
    setRetiros((r ?? []) as any);
    setRows((g ?? []) as GmdRow[]);
    setEditing(false);
    setLoading(false);
  }

  useEffect(() => { if (fazendaId) void load(fazendaId); }, [fazendaId]);

  function startEdit() {
    const fs: Record<string, ScopeForm> = { faz: formFromRows(rows, null) };
    for (const r of retiros) fs[r.id] = formFromRows(rows, r.id);
    setForms(fs);
    setDraftVerao(verao);
    setEditing(true);
  }

  async function save() {
    if ((draftVerao.ini == null) !== (draftVerao.fim == null)) {
      toast.error("Informe o mês de início e o de fim do verão.");
      return;
    }
    // Validação de todos os campos
    const escopos: { key: string; retiroId: string | null; nome: string }[] = [
      { key: "faz", retiroId: null, nome: "Fazenda" },
      ...retiros.map((r) => ({ key: r.id, retiroId: r.id, nome: r.nome })),
    ];
    for (const e of escopos) {
      const f = forms[e.key];
      const vals = [f.verao, f.inverno, ...Object.values(f.cat)];
      if (vals.some((v) => parseGmd(v) === "invalid")) {
        toast.error(`${e.nome}: GMD deve estar entre -1,000 e 3,000 kg/dia.`);
        return;
      }
    }

    setSaving(true);
    const agora = new Date().toISOString();
    const por = roleData?.roleId ?? null;
    try {
      const { error: ef } = await supabase.from("fazendas")
        .update({ verao_mes_inicio: draftVerao.ini, verao_mes_fim: draftVerao.fim } as any).eq("id", fazendaId);
      if (ef) throw ef;

      const tbl = () => (supabase as any).from("gmd_config");
      const upsertLinha = async (retiroId: string | null, categoria: string | null, campos: Record<string, number | null>) => {
        const existente = rows.find((x) => (x.retiro_id ?? null) === retiroId && (x.categoria ?? null) === categoria);
        const tudoVazio = Object.values(campos).every((v) => v == null);
        if (tudoVazio) {
          if (existente) {
            const { error } = await tbl().delete().eq("id", existente.id);
            if (error) throw error;
          }
          return;
        }
        if (existente) {
          const mudou = Object.entries(campos).some(([k, v]) => (existente as any)[k] == null ? v != null : Number((existente as any)[k]) !== v);
          if (!mudou) return;
          const { error } = await tbl().update({ ...campos, atualizado_em: agora, atualizado_por: por }).eq("id", existente.id);
          if (error) throw error;
        } else {
          const { error } = await tbl().insert({ fazenda_id: fazendaId, retiro_id: retiroId, categoria, ...campos, atualizado_em: agora, atualizado_por: por });
          if (error) throw error;
        }
      };

      for (const e of escopos) {
        const f = forms[e.key];
        await upsertLinha(e.retiroId, null, {
          gmd_verao_kg: parseGmd(f.verao) as number | null,
          gmd_inverno_kg: parseGmd(f.inverno) as number | null,
        });
        for (const c of CATEGORIAS_PASTO) {
          await upsertLinha(e.retiroId, c, { gmd_kg: parseGmd(f.cat[c]) as number | null });
        }
      }
      toast.success("Configuração de GMD salva");
      await load(fazendaId);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  const v = editing ? draftVerao : verao;

  const renderEscopo = (key: string, retiroId: string | null) => {
    if (!editing) {
      const f = formFromRows(rows, retiroId);
      if (retiroId && formVazio(f)) return <p className="text-sm text-muted-foreground">Seguindo a fazenda</p>;
      const umSo = (!!f.verao) !== (!!f.inverno);
      return (
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">GMD Geral: </span>
            {!f.verao && !f.inverno ? <span className="text-muted-foreground">não definido</span> : (
              <span>Verão {f.verao || "—"} · Inverno {f.inverno || "—"} kg/dia{umSo && <span className="text-muted-foreground"> (usado o ano todo)</span>}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {CATEGORIAS_PASTO.map((c) => (
              <div key={c}><span className="text-muted-foreground">{c}:</span> {f.cat[c] ? `${f.cat[c]} kg/dia` : "—"}</div>
            ))}
          </div>
        </div>
      );
    }
    const f = forms[key];
    const upd = (patch: Partial<ScopeForm>) => setForms((all) => ({ ...all, [key]: { ...all[key], ...patch } }));
    const umSo = (!!f.verao.trim()) !== (!!f.inverno.trim());
    const campo = (val: string, on: (s: string) => void, label: string) => {
      const inval = parseGmd(val) === "invalid";
      return (
        <div className="space-y-1">
          <label className="text-xs font-medium">{label}</label>
          <Input inputMode="decimal" placeholder="0,000" value={val} onChange={(e) => on(e.target.value)} className={inval ? "border-destructive" : ""} />
        </div>
      );
    };
    return (
      <div className="space-y-3">
        <div>
          <div className="text-xs font-semibold mb-1">GMD Geral (kg/dia)</div>
          <div className="grid grid-cols-2 gap-2">
            {campo(f.verao, (s) => upd({ verao: s }), "Verão")}
            {campo(f.inverno, (s) => upd({ inverno: s }), "Inverno")}
          </div>
          {umSo && <p className="text-xs text-muted-foreground mt-1">Usado o ano todo</p>}
        </div>
        <div>
          <div className="text-xs font-semibold mb-1">GMD por categoria (kg/dia)</div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIAS_PASTO.map((c) => campo(f.cat[c], (s) => upd({ cat: { ...f.cat, [c]: s } }), c))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Valores entre -1,000 e 3,000. Campo vazio = sem regra.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gerente")} className="text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold">GMD</h1>
      </header>
      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        {fazendas.length > 1 && (
          <Select value={fazendaId} onValueChange={setFazendaId} disabled={editing}>
            <SelectTrigger><SelectValue placeholder="Fazenda" /></SelectTrigger>
            <SelectContent>{fazendas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !fazendaId ? (
          <p className="text-sm text-muted-foreground">Nenhuma fazenda vinculada.</p>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Estações</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!editing ? (
                  <p>{v.ini && v.fim ? `Verão: ${MESES[v.ini - 1]} a ${MESES[v.fim - 1]}` : "Verão: não definido"}</p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>Verão: de</span>
                    <Select value={draftVerao.ini ? String(draftVerao.ini) : ""} onValueChange={(x) => setDraftVerao((d) => ({ ...d, ini: Number(x) }))}>
                      <SelectTrigger className="w-32"><SelectValue placeholder="mês" /></SelectTrigger>
                      <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <span>até</span>
                    <Select value={draftVerao.fim ? String(draftVerao.fim) : ""} onValueChange={(x) => setDraftVerao((d) => ({ ...d, fim: Number(x) }))}>
                      <SelectTrigger className="w-32"><SelectValue placeholder="mês" /></SelectTrigger>
                      <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <p className="text-muted-foreground">{descreverInverno(v.ini, v.fim)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">GMD da fazenda</CardTitle></CardHeader>
              <CardContent>{renderEscopo("faz", null)}</CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">GMD por retiro</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {retiros.map((r) => {
                  const aberto = !!abertos[r.id];
                  return (
                    <div key={r.id} className="border rounded-md">
                      <button className="w-full flex items-center justify-between p-2 text-sm font-medium" onClick={() => setAbertos((a) => ({ ...a, [r.id]: !aberto }))}>
                        <span>{r.nome}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                          {!editing && formVazio(formFromRows(rows, r.id)) && "Seguindo a fazenda"}
                          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                      </button>
                      {aberto && <div className="p-2 pt-0">{renderEscopo(r.id, r.id)}</div>}
                    </div>
                  );
                })}
                {retiros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retiro nesta fazenda.</p>}
              </CardContent>
            </Card>

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
      </main>
    </div>
  );
}
