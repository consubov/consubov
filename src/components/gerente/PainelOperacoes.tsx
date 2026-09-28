import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  fazendaId: string;
  retiros: Array<{ id: string; nome: string }>;
}

type Estado =
  | { k: "nao" }
  | { k: "fin"; t: string; por: string }
  | { k: "and"; desde: string; pend: number | null };

interface Evento { user_id: string; retiro_id: string; tipo: string; pendentes: number | null; ocorrido_em: string; capataz_nome: string | null }
interface Lanc { retiro_id: string; criado_por: string | null; created_at: string }
interface Cap { nome: string; user_id: string | null }

const CINCO_MIN = 5 * 60_000;
const DOZE_H = 12 * 3600_000;
const TZ = "America/Sao_Paulo";
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const diaBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ });

/** Calcula o status de um capataz num retiro a partir dos eventos (ordem crescente). */
function calcularEstado(base: Estado, evs: Evento[], lancs: Lanc[], userId: string, agora: number): Estado {
  let st: Estado = base;
  let antes: Estado = base; // status anterior ao último 'iniciou'
  for (const ev of evs) {
    if (ev.tipo === "iniciou") {
      if (st.k !== "and") antes = st;
      st = { k: "and", desde: ev.ocorrido_em, pend: st.k === "and" ? st.pend : null };
    } else if (ev.tipo === "sincronizou") {
      if ((ev.pendentes ?? 0) === 0) st = { k: "fin", t: ev.ocorrido_em, por: ev.capataz_nome || "Capataz" };
      else st = { k: "and", desde: st.k === "and" ? st.desde : ev.ocorrido_em, pend: ev.pendentes };
    } else if (ev.tipo === "cancelou" && st.k === "and") {
      const desde = st.desde;
      const salvouLocal = (ev.pendentes ?? 0) > 0;
      const salvouServidor = lancs.some((l) => l.criado_por === userId && l.created_at >= desde && l.created_at <= ev.ocorrido_em);
      if (!salvouLocal && !salvouServidor && st.pend == null) st = antes;
    }
  }
  // Menos de 5 min desde o 'iniciou' (sem sync parcial): ainda mostra o anterior.
  if (st.k === "and" && st.pend == null && agora - new Date(st.desde).getTime() < CINCO_MIN) return antes;
  return st;
}

function peso(e: Estado) { return e.k === "and" ? 0 : e.k === "fin" ? 1 : 2; }

export default function PainelOperacoes({ fazendaId, retiros }: Props) {
  const [aberto, setAberto] = useState(true);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<{
    caps: Record<string, Cap[]>;
    eventos: Evento[];
    lancs: Lanc[];
    syncOk: Record<string, string>;
    nomePorUser: Record<string, string>;
  } | null>(null);
  const [agora, setAgora] = useState(Date.now());

  const retiroIds = useMemo(() => retiros.map((r) => r.id), [retiros]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!fazendaId || retiroIds.length === 0) { setDados(null); return; }
    if (!silencioso) setLoading(true);
    try {
      const [crRes, capRes, evRes, lRes] = await Promise.all([
        supabase.from("capatazes_retiros").select("retiro_id, capatazes(id, nome, user_id, ativo)").in("retiro_id", retiroIds),
        supabase.from("capatazes").select("id, nome, user_id, retiro_id, ativo").in("retiro_id", retiroIds),
        supabase.from("operacoes_capataz" as any)
          .select("user_id, retiro_id, tipo, pendentes, ocorrido_em, capataz_nome")
          .eq("fazenda_id", fazendaId).order("ocorrido_em", { ascending: false }).limit(1000),
        supabase.from("lancamentos").select("retiro_id, criado_por, created_at")
          .in("retiro_id", retiroIds).order("created_at", { ascending: false }).limit(1000),
      ]);
      const caps: Record<string, Cap[]> = {};
      const nomePorUser: Record<string, string> = {};
      const add = (rid: string, c: any) => {
        if (!c || c.ativo === false) return;
        const l = (caps[rid] ??= []);
        if (!l.some((x) => (x.user_id && x.user_id === c.user_id) || x.nome === c.nome)) l.push({ nome: c.nome, user_id: c.user_id });
        if (c.user_id) nomePorUser[c.user_id] = c.nome;
      };
      for (const r of (crRes.data ?? []) as any[]) add(r.retiro_id, r.capatazes);
      for (const c of (capRes.data ?? []) as any[]) add(c.retiro_id, c);
      const userIds = Object.keys(nomePorUser);
      const syncOk: Record<string, string> = {};
      if (userIds.length) {
        const { data } = await supabase.from("sync_log").select("user_id, last_success").in("user_id", userIds);
        for (const s of (data ?? []) as any[]) if (s.last_success) syncOk[s.user_id] = s.last_success;
      }
      const eventos = ((evRes.data ?? []) as unknown as Evento[]).slice().reverse();
      setDados({ caps, eventos, lancs: (lRes.data ?? []) as Lanc[], syncOk, nomePorUser });
    } finally {
      setLoading(false);
      setAgora(Date.now());
    }
  }, [fazendaId, retiroIds]);

  useEffect(() => { void carregar(); }, [carregar]);
  // Atualização automática a cada 60 s, sem recarregar a tela (reserva caso o Realtime caia).
  useEffect(() => {
    const iv = setInterval(() => { void carregar(true); }, 60_000);
    return () => clearInterval(iv);
  }, [carregar]);
  // Realtime: qualquer evento na tabela operacoes_capataz atualiza na hora (RLS filtra o que chega).
  useEffect(() => {
    if (!fazendaId) return;
    const channel = supabase
      .channel(`operacoes-capataz-${fazendaId}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "operacoes_capataz" }, () => {
        void carregar(true);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fazendaId, carregar]);

  const linhas = useMemo(() => {
    if (!dados) return [];
    return retiros.map((r) => {
      const lancsR = dados.lancs.filter((l) => l.retiro_id === r.id);
      const ultLanc = lancsR[0];
      const caps = dados.caps[r.id] ?? [];
      const todos = caps.map((c) => {
        const evs = c.user_id ? dados.eventos.filter((e) => e.user_id === c.user_id && e.retiro_id === r.id) : [];
        // Estreia: somente a sincronização/salga do próprio capataz.
        let base: Estado = { k: "nao" };
        const ok = c.user_id ? dados.syncOk[c.user_id] : undefined;
        const ultDele = c.user_id ? lancsR.find((l) => l.criado_por === c.user_id) : undefined;
        if (ok) base = { k: "fin", t: ok, por: c.nome };
        else if (ultDele) base = { k: "fin", t: ultDele.created_at, por: c.nome };
        const firstT = evs[0]?.ocorrido_em;
        if (base.k === "fin" && firstT && base.t > firstT) base = { k: "nao" };
        return { nome: c.nome, st: c.user_id ? calcularEstado(base, evs, lancsR, c.user_id, agora) : base };
      });
      const fins = todos.filter((i) => i.st.k === "fin").map((i) => i.st as Extract<Estado, { k: "fin" }>);
      const ultFin = fins.length ? fins.slice().sort((a, b) => b.t.localeCompare(a.t))[0] : null;
      const diaUlt = ultFin ? diaBR(ultFin.t) : null;
      const itens = todos.filter((i) => i.st.k === "and" || (i.st.k === "fin" && diaBR(i.st.t) === diaUlt));
      let geral: Estado = { k: "nao" };
      if (itens.some((i) => i.st.k === "and")) {
        const ands = itens.filter((i) => i.st.k === "and").map((i) => i.st as Extract<Estado, { k: "and" }>);
        geral = ands.sort((a, b) => a.desde.localeCompare(b.desde))[0];
      } else if (ultFin) {
        geral = ultFin;
      } else if (caps.length === 0 && ultLanc) {
        geral = { k: "fin", t: ultLanc.created_at, por: "—" };
      }
      return { id: r.id, nome: r.nome, itens, geral, semCaps: caps.length === 0 };
    }).sort((a, b) => {
      const d = peso(a.geral) - peso(b.geral);
      if (d) return d;
      if (a.geral.k === "fin" && b.geral.k === "fin") return b.geral.t.localeCompare(a.geral.t);
      return a.nome.localeCompare(b.nome);
    });
  }, [dados, retiros, agora]);

  const emAndamento = linhas.filter((l) => l.geral.k === "and").length;

  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between text-left">
          <CardTitle className="text-sm">
            Painel de Operações
            {emAndamento > 0 && <span className="ml-2 text-xs font-normal text-primary">{emAndamento} em andamento</span>}
          </CardTitle>
          {aberto ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {aberto && (
        <CardContent className="p-3 pt-0 space-y-2">
          {loading && !dados ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : linhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum retiro nesta fazenda.</p>
          ) : (
            linhas.map((l) => (
              <div key={l.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{l.nome}</span>
                  <StatusTag st={l.geral} agora={agora} compacto />
                </div>
                {l.itens.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">Sem capataz vinculado</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {l.itens.map((i) => (
                      <li key={i.nome} className="flex flex-wrap items-center justify-between gap-x-2 text-xs">
                        <span className="text-foreground">{i.nome}</span>
                        <StatusTag st={i.st} agora={agora} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StatusTag({ st, agora, compacto }: { st: Estado; agora: number; compacto?: boolean }) {
  if (st.k === "nao") return <span className="text-xs text-muted-foreground">Não iniciado</span>;
  if (st.k === "fin") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        {compacto ? `Finalizado ${fmtDataHora(st.t)}` : `${fmtDataHora(st.t)} · sincronizado por ${st.por}`}
      </span>
    );
  }
  const decorrido = agora - new Date(st.desde).getTime();
  const alerta = decorrido > DOZE_H;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", alerta ? "text-secondary-foreground" : "text-primary")}>
      <span className={cn("h-2.5 w-2.5 rounded-full animate-pulse", alerta ? "bg-secondary" : "bg-primary")} />
      {alerta ? `Em andamento há ${Math.floor(decorrido / 3600_000)}h` : `Em andamento desde ${fmtHora(st.desde)}`}
      {st.pend != null && st.pend > 0 && <span className="text-muted-foreground">· {st.pend} pendente{st.pend > 1 ? "s" : ""}</span>}
    </span>
  );
}
