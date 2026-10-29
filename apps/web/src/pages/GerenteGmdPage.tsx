import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GerenteFazendaSelect, useGerenteFazendaAtiva } from "@/components/gerente/GerenteFazendaSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Pencil } from "lucide-react";
import { CATEGORIAS_PASTO } from "@/lib/categoriaPasto";
import { CircularMonthSelect } from "@/components/gerente/CircularMonthSelect";
import { assertMutation, expectedGmd, parseGmd, validateLoadedGmd, verifyGmdReadback, type GmdModo, type GmdRow, type GmdReadback } from "@/lib/gmdGuards";

// Fase de configuração apenas: grava em gmd_config e fazendas (gmd_modo, verao_mes_*).
// Não calcula peso projetado nem altera pastos/consumo.

type Modo = GmdModo;
const MODOS: { v: Modo; label: string }[] = [
  { v: "geral", label: "Geral" },
  { v: "categoria", label: "Por categoria" },
  { v: "retiro", label: "Por retiro" },
];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const GMD_MIN = -1;
const GMD_MAX = 3;

type CatForm = Record<string, string>;
const emptyCat = (): CatForm => Object.fromEntries(CATEGORIAS_PASTO.map((c) => [c, ""]));

const fmt = (n: number | null | undefined) => (n == null ? "" : Number(n).toFixed(3).replace(".", ","));

function modoDaLinha(r: GmdRow): Modo {
  if (r.retiro_id) return "retiro";
  return r.categoria ? "categoria" : "geral";
}

function catFromRows(rows: GmdRow[], retiroId: string | null): CatForm {
  const f = emptyCat();
  for (const r of rows) {
    if ((r.retiro_id ?? null) === retiroId && r.categoria && r.categoria in f) f[r.categoria] = fmt(r.gmd_kg);
  }
  return f;
}

function descreverInverno(ini: number | null, fim: number | null): string {
  if (!ini || !fim) return "Inverno: ano todo (verão não definido)";
  const start = (fim % 12) + 1;
  const end = ini === 1 ? 12 : ini - 1;
  if (start === ini) return "Inverno: nenhum mês (verão o ano todo)";
  return `Inverno: ${MESES[start - 1]} a ${MESES[end - 1]}`;
}

export default function GerenteGmdPage() {
  const navigate = useNavigate();
  const { roleData } = useAuth();
  const { fazendas, fazendaId, setFazendaId, carregado } = useGerenteFazendaAtiva();
  const [retiros, setRetiros] = useState<{ id: string; nome: string }[]>([]);
  const [rows, setRows] = useState<GmdRow[]>([]);
  const [modo, setModo] = useState<Modo | null>(null);
  const [verao, setVerao] = useState<{ ini: number | null; fim: number | null }>({ ini: null, fim: null });

  const [draftModo, setDraftModo] = useState<Modo | null>(null);
  const [draftVerao, setDraftVerao] = useState(verao);
  const [draftGeral, setDraftGeral] = useState({ verao: "", inverno: "" });
  const [draftCat, setDraftCat] = useState<Record<string, CatForm>>({});

  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadedFazendaId, setLoadedFazendaId] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const selectedFazendaRef = useRef(fazendaId);
  const saveInFlight = useRef(false);

  // A response belongs to the selected farm AND the latest request, otherwise discard it.
  useEffect(() => {
    selectedFazendaRef.current = fazendaId;
    if (!carregado) return;
    if (fazendaId) void load(fazendaId).catch(() => { /* load exposes a retry state */ });
    else { requestSeq.current++; setLoading(false); setLoadedFazendaId(null); setLoadError(false); }
    return () => { requestSeq.current++; };
  }, [carregado, fazendaId]);

  async function load(id: string, expected?: GmdReadback): Promise<boolean> {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(false);
    setLoadedFazendaId(null);
    setEditing(false);
    try {
      const [faz, ret, conf] = await Promise.all([
        supabase.from("fazendas").select("id, verao_mes_inicio, verao_mes_fim, gmd_modo" as any).eq("id", id).maybeSingle(),
        supabase.from("retiros").select("id, nome").eq("fazenda_id", id).eq("ativo", true).order("nome"),
        (supabase as any).from("gmd_config").select("id, fazenda_id, retiro_id, categoria, gmd_kg, gmd_verao_kg, gmd_inverno_kg").eq("fazenda_id", id),
      ]);
      if (seq !== requestSeq.current || selectedFazendaRef.current !== id) return false;
      if (faz.error || ret.error || conf.error || !faz.data || !Array.isArray(ret.data) || !Array.isArray(conf.data)) {
        throw new Error("Falha ao obter dados de GMD.");
      }
      const farm = faz.data as unknown as { id: string; gmd_modo: string | null; verao_mes_inicio: number | null; verao_mes_fim: number | null };
      const retreatRows = ret.data as { id: string; nome: string }[];
      const configRows = conf.data as GmdRow[];
      if (farm.id !== id || (farm.gmd_modo !== null && !MODOS.some((m) => m.v === farm.gmd_modo))) {
        throw new Error("Resposta GMD incompatível com a fazenda selecionada.");
      }
      validateLoadedGmd(configRows, id, retreatRows.map((r) => r.id));
      if (expected && !verifyGmdReadback(farm, configRows, expected)) {
        throw new Error("A gravação não corresponde ao estado confirmado pelo banco.");
      }
      setModo(farm.gmd_modo as Modo | null);
      setVerao({ ini: farm.verao_mes_inicio ?? null, fim: farm.verao_mes_fim ?? null });
      setRetiros(retreatRows);
      setRows(configRows);
      setLoadedFazendaId(id);
      return true;
    } catch (error) {
      if (seq === requestSeq.current && selectedFazendaRef.current === id) {
        setLoadError(true);
        setRows([]);
        setRetiros([]);
      }
      throw error;
    } finally {
      if (seq === requestSeq.current && selectedFazendaRef.current === id) setLoading(false);
    }
  }

  function chooseFarm(id: string) {
    if (saveInFlight.current) return;
    selectedFazendaRef.current = id;
    requestSeq.current++;
    setLoadedFazendaId(null);
    setFazendaId(id);
  }

  function startEdit(novoModo?: Modo) {
    if (saveInFlight.current || loadedFazendaId !== fazendaId || loadError) return;
    const geral = rows.find((x) => !x.retiro_id && !x.categoria);
    setDraftGeral({ verao: fmt(geral?.gmd_verao_kg), inverno: fmt(geral?.gmd_inverno_kg) });
    const cats: Record<string, CatForm> = { faz: catFromRows(rows, null) };
    for (const r of retiros) cats[r.id] = catFromRows(rows, r.id);
    setDraftCat(cats);
    setDraftVerao(verao);
    setDraftModo(novoModo ?? modo);
    setEditing(true);
  }

  function onEscolherModo(v: string) {
    if (saveInFlight.current || loadedFazendaId !== fazendaId || !MODOS.some((m) => m.v === v)) return;
    const m = v as Modo;
    if (!editing) startEdit(m);
    else setDraftModo(m);
  }

  const linhasOutroModo = (m: Modo) => rows.filter((r) => modoDaLinha(r) !== m);

  function pedirSalvar() {
    if (saveInFlight.current || loadedFazendaId !== fazendaId || loadError) return;
    if (!draftModo) { toast.error("Escolha como o GMD será definido nesta fazenda."); return; }
    if (draftModo === "geral") {
      if ((draftVerao.ini == null) !== (draftVerao.fim == null)) { toast.error("Informe o mês de início e o de fim do verão."); return; }
      if ([draftGeral.verao, draftGeral.inverno].some((v) => parseGmd(v) === "invalid")) {
        toast.error("GMD deve estar entre -1,000 e 3,000 kg/dia."); return;
      }
    } else {
      const chaves = draftModo === "categoria" ? ["faz"] : retiros.map((r) => r.id);
      for (const k of chaves) {
        if (Object.values(draftCat[k] ?? {}).some((v) => parseGmd(v) === "invalid")) {
          const nome = k === "faz" ? "Fazenda" : retiros.find((r) => r.id === k)?.nome;
          toast.error(`${nome}: GMD deve estar entre -1,000 e 3,000 kg/dia.`); return;
        }
      }
    }
    if (draftModo !== modo && linhasOutroModo(draftModo).length > 0) { setConfirmOpen(true); return; }
    void save();
  }

  async function save() {
    // ref guard is synchronous; React's `saving` flag alone allows double clicks before re-render.
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setConfirmOpen(false);
    const id = fazendaId;
    setSaving(true);
    const tbl = () => (supabase as any).from("gmd_config");
    let startedWrites = false;
    try {
      if (selectedFazendaRef.current !== id || loadedFazendaId !== id || loadError || !draftModo || !roleData?.roleId) {
        throw new Error("Dados da fazenda ou identificação do gerente indisponíveis.");
      }
      // Validate again here (not just in the confirmation button) and snapshot the intended outcome.
      const expected = expectedGmd(draftModo, draftVerao, draftGeral, draftCat, retiros.map((r) => r.id));
      const ensureFarm = () => {
        if (selectedFazendaRef.current !== id) throw new Error("A fazenda ativa mudou durante a gravação.");
      };
      const agora = new Date().toISOString();
      const por = roleData.roleId;
      const apagar = linhasOutroModo(draftModo).map((r) => r.id);
      ensureFarm();
      if (apagar.length) {
        startedWrites = true;
        const result = await tbl().delete().in("id", apagar).eq("fazenda_id", id).select("id");
        assertMutation(result, "Remoção de regras anteriores", apagar.length, apagar);
        ensureFarm();
      }
      const fazPatch: Record<string, string | number | null> = { gmd_modo: draftModo };
      if (draftModo === "geral") {
        fazPatch.verao_mes_inicio = draftVerao.ini;
        fazPatch.verao_mes_fim = draftVerao.fim;
      }
      startedWrites = true;
      const updatedFarm = await supabase.from("fazendas").update(fazPatch).eq("id", id).select("id");
      assertMutation(updatedFarm, "Configuração da fazenda", 1, [id]);
      ensureFarm();
      const upsertLinha = async (retiroId: string | null, categoria: string | null, campos: Record<string, number | null>) => {
        ensureFarm();
        const existente = rows.find((r) => (r.retiro_id ?? null) === retiroId && (r.categoria ?? null) === categoria);
        const tudoVazio = Object.values(campos).every((v) => v == null);
        if (tudoVazio) {
          if (existente) {
            startedWrites = true;
            const result = await tbl().delete().eq("id", existente.id).eq("fazenda_id", id).select("id");
            assertMutation(result, "Remoção de GMD vazio", 1, [existente.id]);
            ensureFarm();
          }
          return;
        }
        if (existente) {
          const mudou = Object.entries(campos).some(([k, v]) =>
            (existente as unknown as Record<string, number | null>)[k] == null ? v != null :
              Number((existente as unknown as Record<string, number | null>)[k]) !== v);
          if (!mudou) return;
          startedWrites = true;
          const result = await tbl().update({ ...campos, atualizado_em: agora, atualizado_por: por })
            .eq("id", existente.id).eq("fazenda_id", id).select("id");
          assertMutation(result, "Atualização de GMD", 1, [existente.id]);
          ensureFarm();
        } else {
          startedWrites = true;
          const result = await tbl().insert({ fazenda_id: id, retiro_id: retiroId, categoria,
            ...campos, atualizado_em: agora, atualizado_por: por }).select("id");
          assertMutation(result, "Criação de GMD", 1);
          ensureFarm();
        }
      };
      if (draftModo === "geral") {
        await upsertLinha(null, null, {
          gmd_verao_kg: parseGmd(draftGeral.verao) as number | null,
          gmd_inverno_kg: parseGmd(draftGeral.inverno) as number | null,
        });
      } else {
        const scope = draftModo === "categoria"
          ? [{ key: "faz", retreatId: null as string | null }]
          : retiros.map((r) => ({ key: r.id, retreatId: r.id as string | null }));
        for (const item of scope) {
          for (const category of CATEGORIAS_PASTO) {
            await upsertLinha(item.retreatId, category, {
              gmd_kg: parseGmd(draftCat[item.key][category]) as number | null,
            });
          }
        }
      }
      ensureFarm();
      if (!await load(id, expected)) throw new Error("Não foi possível confirmar a gravação.");
      toast.success("Configuração de GMD salva");
    } catch {
      toast.error(startedWrites
        ? "Gravação não confirmada. Algumas alterações podem ter sido aplicadas; confira os dados antes de tentar novamente."
        : "Configuração inválida ou indisponível. Nenhuma gravação foi iniciada.");
      if (selectedFazendaRef.current === id) {
        try { await load(id); } catch { /* leave the retry/error state visible */ }
      }
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  const modoAtual = editing ? draftModo : modo;
  const v = editing ? draftVerao : verao;

  const campo = (key: string, val: string, on: (s: string) => void, label: string) => {
    const inval = parseGmd(val) === "invalid";
    return (
      <div key={key} className="space-y-1">
        <label className="text-xs font-medium">{label}</label>
        <Input inputMode="decimal" placeholder="0,000" value={val} onChange={(e: { target: { value: string } }) => on(e.target.value)} className={inval ? "border-destructive" : ""} />
      </div>
    );
  };

  const renderCategorias = (key: string, retiroId: string | null) => {
    if (!editing) {
      const f = catFromRows(rows, retiroId);
      return (
        <div className="grid grid-cols-2 gap-1 text-sm">
          {CATEGORIAS_PASTO.map((c) => (
            <div key={c}>
              <span className="text-muted-foreground">{c}:</span>{" "}
              {f[c] ? `${f[c]} kg/dia` : <span className="text-muted-foreground italic">Sem GMD definido</span>}
            </div>
          ))}
        </div>
      );
    }
    const f = { ...emptyCat(), ...(draftCat[key] ?? {}) };
    return (
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIAS_PASTO.map((c) => campo(c, f[c] ?? "", (s) => setDraftCat((all) => ({ ...all, [key]: { ...f, [c]: s } })), c))}
      </div>
    );
  };

  const geralLido = rows.find((x) => !x.retiro_id && !x.categoria);
  const gV = editing ? draftGeral.verao : fmt(geralLido?.gmd_verao_kg);
  const gI = editing ? draftGeral.inverno : fmt(geralLido?.gmd_inverno_kg);
  const umSo = (!!gV.trim()) !== (!!gI.trim());

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gerente")} className="text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold">GMD</h1>
      </header>
      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        <GerenteFazendaSelect fazendas={fazendas} value={fazendaId} onChange={chooseFarm} dirty={editing || saving} />
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !fazendaId ? (
          <p className="text-sm text-muted-foreground">Nenhuma fazenda vinculada.</p>
        ) : loadError || loadedFazendaId !== fazendaId ? (
          <div className="space-y-3" role="alert">
            <p className="text-sm text-destructive">Não foi possível confirmar os dados de GMD desta fazenda. Nenhuma alteração pode ser feita.</p>
            <Button variant="outline" onClick={() => void load(fazendaId).catch(() => {})}>Tentar novamente</Button>
          </div>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Modo de GMD</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <RadioGroup value={modoAtual ?? ""} onValueChange={onEscolherModo} className="flex flex-wrap gap-4">
                  {MODOS.map((m) => (
                    <label key={m.v} className="flex items-center gap-2 text-sm cursor-pointer">
                      <RadioGroupItem value={m.v} /> {m.label}
                    </label>
                  ))}
                </RadioGroup>
                {!modoAtual && <p className="text-sm text-muted-foreground">Escolha como o GMD será definido nesta fazenda</p>}
              </CardContent>
            </Card>

            {modoAtual === "geral" && (
              <>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Estações</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {!editing ? (
                      <p>{v.ini && v.fim ? `Verão: ${MESES[v.ini - 1]} a ${MESES[v.fim - 1]}` : "Verão: não definido"}</p>
                    ) : (
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 whitespace-nowrap">
                        <span>Verão:</span>
                        <CircularMonthSelect
                          value={draftVerao.ini}
                          onChange={(ini: number | null) => setDraftVerao((d) => ({ ...d, ini }))}
                          ariaLabel="Mês de início do verão"
                        />
                        <span>até</span>
                        <CircularMonthSelect
                          value={draftVerao.fim}
                          onChange={(fim: number | null) => setDraftVerao((d) => ({ ...d, fim }))}
                          ariaLabel="Mês de fim do verão"
                        />
                      </div>
                    )}
                    <p className="text-muted-foreground">{descreverInverno(v.ini, v.fim)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">GMD Geral (kg/dia)</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {!editing ? (
                      <p className="text-sm">
                        {!gV && !gI ? <span className="text-muted-foreground italic">Sem GMD definido</span> : <>Verão {gV || "—"} · Inverno {gI || "—"} kg/dia</>}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {campo("v", draftGeral.verao, (s) => setDraftGeral((d) => ({ ...d, verao: s })), "Verão")}
                        {campo("i", draftGeral.inverno, (s) => setDraftGeral((d) => ({ ...d, inverno: s })), "Inverno")}
                      </div>
                    )}
                    {umSo && <p className="text-xs text-muted-foreground">Usado o ano todo</p>}
                  </CardContent>
                </Card>
              </>
            )}

            {modoAtual === "categoria" && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">GMD por categoria (kg/dia)</CardTitle></CardHeader>
                <CardContent>{renderCategorias("faz", null)}</CardContent>
              </Card>
            )}

            {modoAtual === "retiro" && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">GMD por retiro (kg/dia, por categoria)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {retiros.map((r) => {
                    const aberto = !!abertos[r.id];
                    const vazio = Object.values(catFromRows(rows, r.id)).every((x) => !x);
                    return (
                      <div key={r.id} className="border rounded-md">
                        <button className="w-full flex items-center justify-between p-2 text-sm font-medium" onClick={() => setAbertos((a) => ({ ...a, [r.id]: !aberto }))}>
                          <span>{r.nome}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground font-normal">
                            {!editing && vazio && "Sem GMD definido"}
                            {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                        </button>
                        {aberto && <div className="p-2 pt-0">{renderCategorias(r.id, r.id)}</div>}
                      </div>
                    );
                  })}
                  {retiros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retiro nesta fazenda.</p>}
                </CardContent>
              </Card>
            )}

            {editing && modoAtual && modoAtual !== "geral" && (
              <p className="text-xs text-muted-foreground">Valores entre -1,000 e 3,000. Campo vazio = sem regra.</p>
            )}

            {!editing ? (
              modo && <Button onClick={() => startEdit()} className="w-full gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" onClick={pedirSalvar} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
              </div>
            )}
          </>
        )}
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar o modo de GMD?</AlertDialogTitle>
            <AlertDialogDescription>As regras do modo anterior serão apagadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void save()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
