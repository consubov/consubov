import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Camera, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, MessageSquare, PackageOpen, Skull, X } from "lucide-react";
import { getScreenCache, screenCacheKey, setScreenCache, useScreenCacheInvalidation } from "@/lib/screenCache";

type Tipo = "auditoria" | "cocho" | "observacao" | "mortalidade";
type Periodo = "hoje" | "7d" | "30d" | "mes";

interface Item {
  key: string;
  tipo: Tipo;
  id: string; // id do registro de origem (fotos_salga.id, lancamentos.id, observacoes.id, mortalidades.id)
  data: string;
  pastoId: string | null;
  retiroId: string | null;
  capataz: string;
  caminho?: string;
  sacos?: number | null;
  consumo?: number | null;
  texto?: string | null;
}

const PAGE = 30;
const TIPO_INFO: Record<Tipo, { label: string; icon: typeof Camera; cls: string }> = {
  auditoria: { label: "Auditoria", icon: ClipboardCheck, cls: "bg-primary/15 text-primary" },
  cocho: { label: "Cocho Cheio", icon: PackageOpen, cls: "bg-secondary/25 text-secondary-foreground" },
  observacao: { label: "Observação", icon: MessageSquare, cls: "bg-accent text-accent-foreground" },
  mortalidade: { label: "Mortalidade", icon: Skull, cls: "bg-destructive/15 text-destructive" },
};

// Fotos já abertas nesta sessão (reabrir sem baixar de novo).
const fotoMem = new Map<string, string[]>();

interface Props {
  fazendaId: string;
  retiros: Array<{ id: string; nome: string }>;
  mes: number;
  ano: number;
}

function faixa(periodo: Periodo, mes: number, ano: number) {
  const now = new Date();
  const hoje0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periodo === "hoje") return { ini: hoje0, fim: null as Date | null };
  if (periodo === "7d") return { ini: new Date(hoje0.getTime() - 6 * 86400000), fim: null };
  if (periodo === "30d") return { ini: new Date(hoje0.getTime() - 29 * 86400000), fim: null };
  return { ini: new Date(ano, mes - 1, 1), fim: new Date(ano, mes, 1) };
}

function rotuloDia(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const k = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (k(d) === k(now)) return "Hoje";
  const ontem = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (k(d) === k(ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const hora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AuditoriaFotosTab({ fazendaId, retiros, mes, ano }: Props) {
  const [tipo, setTipo] = useState<"todas" | Tipo>("todas");
  const [retiroId, setRetiroId] = useState("todos");
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [limite, setLimite] = useState(PAGE);
  const [pastos, setPastos] = useState<Record<string, { nome: string; retiro_id: string }>>({});
  const [capatazes, setCapatazes] = useState<{ porUser: Record<string, string>; porRetiro: Record<string, string> }>({ porUser: {}, porRetiro: {} });
  const [itens, setItens] = useState<Item[]>([]);
  const [temMais, setTemMais] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  useEffect(() => { setLimite(PAGE); }, [tipo, retiroId, periodo, mes, ano, fazendaId]);
  useEffect(() => { setRetiroId("todos"); }, [fazendaId]);

  const retiroIds = useMemo(() => retiros.map((r) => r.id), [retiros]);
  const retiroNome = useMemo(() => Object.fromEntries(retiros.map((r) => [r.id, r.nome])), [retiros]);

  // Pastos e capatazes (somente texto).
  useEffect(() => {
    if (!retiroIds.length) return;
    const key = screenCacheKey("auditoriaRef", [fazendaId, retiroIds.join(",")]);
    const c = getScreenCache<{ p: typeof pastos; c: typeof capatazes }>(key);
    if (c) { setPastos(c.p); setCapatazes(c.c); }
    (async () => {
      const [{ data: ps }, { data: cr }] = await Promise.all([
        supabase.from("pastos").select("id, nome, retiro_id").in("retiro_id", retiroIds),
        supabase.from("capatazes_retiros").select("retiro_id, principal, capatazes(nome, user_id)").in("retiro_id", retiroIds),
      ]);
      const p: typeof pastos = {};
      (ps || []).forEach((x: any) => { p[x.id] = { nome: x.nome, retiro_id: x.retiro_id }; });
      const porUser: Record<string, string> = {};
      const porRetiro: Record<string, string> = {};
      (cr || []).forEach((x: any) => {
        const cap = x.capatazes;
        if (!cap?.nome) return;
        if (cap.user_id) porUser[cap.user_id] = cap.nome;
        if (x.principal || !porRetiro[x.retiro_id]) porRetiro[x.retiro_id] = cap.nome;
      });
      setPastos(p); setCapatazes({ porUser, porRetiro });
      setScreenCache(key, { p, c: { porUser, porRetiro } });
    })();
  }, [fazendaId, retiroIds]);

  const listKey = screenCacheKey("auditoriaFotos", [fazendaId, retiroId, tipo, periodo, periodo === "mes" ? mes : "", periodo === "mes" ? ano : "", limite]);

  const carregar = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);
    try {
      const { ini, fim } = faixa(periodo, mes, ano);
      const iniIso = ini.toISOString();
      const fimIso = fim?.toISOString();
      const n = limite + 1;
      const quer = (t: Tipo) => tipo === "todas" || tipo === t;
      const pastosDoRetiro = retiroId !== "todos"
        ? Object.entries(pastos).filter(([, v]) => v.retiro_id === retiroId).map(([k]) => k)
        : null;
      const out: Item[] = [];
      const jobs: Promise<void>[] = [];

      if (quer("auditoria") && (!pastosDoRetiro || pastosDoRetiro.length)) {
        jobs.push((async () => {
          let q = supabase.from("fotos_salga" as any).select("id, lancamento_id, pasto_id, caminho, tirada_em, criado_em, enviado_por")
            .eq("fazenda_id", fazendaId).gte("tirada_em", iniIso).order("tirada_em", { ascending: false }).limit(n);
          if (fimIso) q = q.lt("tirada_em", fimIso);
          if (pastosDoRetiro) q = q.in("pasto_id", pastosDoRetiro);
          const { data } = await q;
          const rows = (data || []) as any[];
          const ids = rows.map((r) => r.lancamento_id);
          const lmap: Record<string, any> = {};
          if (ids.length) {
            const { data: ls } = await supabase.from("lancamentos").select("id, retiro_id, num_sacos, consumo_g_cab_dia, criado_por, origem, observacao").in("id", ids);
            (ls || []).forEach((l: any) => { lmap[l.id] = l; });
          }
          rows.forEach((r) => {
            const l = lmap[r.lancamento_id];
            const ret = l?.retiro_id ?? pastos[r.pasto_id]?.retiro_id ?? null;
            out.push({
              key: `a-${r.id}`, tipo: "auditoria", id: r.id, data: r.tirada_em || r.criado_em,
              pastoId: r.pasto_id, retiroId: ret, caminho: r.caminho,
              capataz: capatazes.porUser[l?.criado_por || r.enviado_por] || (ret ? capatazes.porRetiro[ret] : "") || "—",
              sacos: l?.num_sacos ?? null, consumo: l?.consumo_g_cab_dia ?? null,
              texto: l?.origem === "manual" ? l?.observacao ?? null : null,
            });
          });
        })());
      }
      if (quer("cocho")) {
        jobs.push((async () => {
          let q = supabase.from("lancamentos").select("id, pasto_id, retiro_id, created_at, num_sacos, consumo_g_cab_dia, criado_por, origem, observacao")
            .eq("fazenda_id", fazendaId).eq("cocho_cheio", true).not("foto_cocho_url", "is", null)
            .gte("created_at", iniIso).order("created_at", { ascending: false }).limit(n);
          if (fimIso) q = q.lt("created_at", fimIso);
          if (retiroId !== "todos") q = q.eq("retiro_id", retiroId);
          const { data } = await q;
          (data || []).forEach((r: any) => out.push({
            key: `c-${r.id}`, tipo: "cocho", id: r.id, data: r.created_at, pastoId: r.pasto_id, retiroId: r.retiro_id,
            capataz: capatazes.porUser[r.criado_por] || capatazes.porRetiro[r.retiro_id] || "—",
            sacos: r.num_sacos, consumo: r.consumo_g_cab_dia,
            texto: r.origem === "manual" ? r.observacao ?? null : null,
          }));
        })());
      }
      if (quer("observacao")) {
        jobs.push((async () => {
          let q = supabase.from("observacoes").select("id, pasto_id, retiro_id, capataz_nome, descricao, criado_em")
            .eq("fazenda_id", fazendaId).not("foto_url", "is", null).neq("foto_url", "")
            .gte("criado_em", iniIso).order("criado_em", { ascending: false }).limit(n);
          if (fimIso) q = q.lt("criado_em", fimIso);
          if (retiroId !== "todos") q = q.eq("retiro_id", retiroId);
          const { data } = await q;
          (data || []).forEach((r: any) => out.push({
            key: `o-${r.id}`, tipo: "observacao", id: r.id, data: r.criado_em, pastoId: r.pasto_id, retiroId: r.retiro_id,
            capataz: r.capataz_nome || capatazes.porRetiro[r.retiro_id] || "—", texto: r.descricao,
          }));
        })());
      }
      if (quer("mortalidade")) {
        jobs.push((async () => {
          let q = supabase.from("mortalidades").select("id, pasto_id, retiro_id, usuario_id, observacao, data, created_at")
            .eq("fazenda_id", fazendaId).or("foto_url.not.is.null,foto_brinco_url.not.is.null")
            .gte("data", iniIso).order("data", { ascending: false }).limit(n);
          if (fimIso) q = q.lt("data", fimIso);
          if (retiroId !== "todos") q = q.eq("retiro_id", retiroId);
          const { data } = await q;
          (data || []).forEach((r: any) => out.push({
            key: `m-${r.id}`, tipo: "mortalidade", id: r.id, data: r.data || r.created_at, pastoId: r.pasto_id, retiroId: r.retiro_id,
            capataz: capatazes.porUser[r.usuario_id] || capatazes.porRetiro[r.retiro_id] || "—", texto: r.observacao,
          }));
        })());
      }
      await Promise.all(jobs);
      out.sort((a, b) => b.data.localeCompare(a.data));
      const pagina = out.slice(0, limite);
      const mais = out.length > limite;
      setItens(pagina); setTemMais(mais);
      setScreenCache(listKey, { itens: pagina, mais });
    } finally {
      setLoading(false);
    }
  }, [fazendaId, periodo, mes, ano, limite, tipo, retiroId, pastos, capatazes, listKey]);

  useEffect(() => {
    const c = getScreenCache<{ itens: Item[]; mais: boolean }>(listKey);
    if (c) { setItens(c.itens); setTemMais(c.mais); }
    void carregar();
  }, [carregar, listKey]);
  useScreenCacheInvalidation(() => { void carregar(); });

  // Paginação ao rolar
  const sentinela = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinela.current;
    if (!el || !temMais) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting && !loading) setLimite((l) => l + PAGE);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [temMais, loading]);

  const grupos = useMemo(() => {
    const g: Array<{ dia: string; itens: Array<{ it: Item; idx: number }> }> = [];
    itens.forEach((it, idx) => {
      const dia = rotuloDia(it.data);
      const last = g[g.length - 1];
      if (last && last.dia === dia) last.itens.push({ it, idx });
      else g.push({ dia, itens: [{ it, idx }] });
    });
    return g;
  }, [itens]);

  const nomePasto = (id: string | null) => (id && pastos[id]?.nome) || "—";
  const nomeRetiro = (id: string | null) => (id && retiroNome[id]) || "—";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="auditoria">Auditoria</SelectItem>
            <SelectItem value="cocho">Cocho Cheio</SelectItem>
            <SelectItem value="observacao">Observação</SelectItem>
            <SelectItem value="mortalidade">Mortalidade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={retiroId} onValueChange={setRetiroId}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos retiros</SelectItem>
            {retiros.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7d">7 dias</SelectItem>
            <SelectItem value="30d">30 dias</SelectItem>
            <SelectItem value="mes">Mês do painel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!loading && itens.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-10">Nenhuma foto neste período.</p>
      )}

      {grupos.map((g) => (
        <div key={g.dia}>
          <p className="text-xs font-semibold text-muted-foreground mb-1 mt-2">{g.dia}</p>
          <div className="rounded-lg border bg-card divide-y">
            {g.itens.map(({ it, idx }) => {
              const info = TIPO_INFO[it.tipo];
              const Icon = info.icon;
              return (
                <button key={it.key} onClick={() => setAberto(idx)} className="w-full flex items-center gap-3 px-3 py-2 text-left active:bg-muted">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${info.cls}`}><Icon className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{nomePasto(it.pastoId)} · {nomeRetiro(it.retiroId)}</span>
                    <span className="block text-xs text-muted-foreground truncate">{info.label} · {it.capataz} · {new Date(it.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                  <Camera className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div ref={sentinela} />
      {loading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}

      {aberto !== null && itens[aberto] && (
        <FotoViewer
          item={itens[aberto]}
          pasto={nomePasto(itens[aberto].pastoId)}
          retiro={nomeRetiro(itens[aberto].retiroId)}
          onClose={() => setAberto(null)}
          onPrev={aberto > 0 ? () => setAberto(aberto - 1) : undefined}
          onNext={aberto < itens.length - 1 ? () => setAberto(aberto + 1) : undefined}
        />
      )}
    </div>
  );
}

async function buscarFoto(it: Item): Promise<string[]> {
  const mem = fotoMem.get(it.key);
  if (mem) return mem;
  let urls: string[] = [];
  if (it.tipo === "auditoria" && it.caminho) {
    const { data, error } = await supabase.storage.from("fotos-salga").createSignedUrl(it.caminho, 300);
    if (error) throw error;
    // Baixa uma vez e guarda em memória (URL assinada expira).
    const blob = await fetch(data.signedUrl).then((r) => { if (!r.ok) throw new Error("falha ao baixar"); return r.blob(); });
    urls = [URL.createObjectURL(blob)];
  } else if (it.tipo === "cocho") {
    const { data, error } = await supabase.from("lancamentos").select("foto_cocho_url").eq("id", it.id).maybeSingle();
    if (error) throw error;
    urls = [(data as any)?.foto_cocho_url].filter(Boolean);
  } else if (it.tipo === "observacao") {
    const { data, error } = await supabase.from("observacoes").select("foto_url").eq("id", it.id).maybeSingle();
    if (error) throw error;
    urls = [(data as any)?.foto_url].filter(Boolean);
  } else if (it.tipo === "mortalidade") {
    const { data, error } = await supabase.from("mortalidades").select("foto_url, foto_brinco_url").eq("id", it.id).maybeSingle();
    if (error) throw error;
    urls = [(data as any)?.foto_url, (data as any)?.foto_brinco_url].filter(Boolean);
  }
  fotoMem.set(it.key, urls);
  return urls;
}

function FotoViewer({ item, pasto, retiro, onClose, onPrev, onNext }: {
  item: Item; pasto: string; retiro: string; onClose: () => void; onPrev?: () => void; onNext?: () => void;
}) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let vivo = true;
    setUrls(null); setErro(null); setIdx(0);
    buscarFoto(item).then((u) => { if (vivo) setUrls(u); }).catch((e) => { if (vivo) setErro(e?.message || "Falha ao abrir a foto"); });
    return () => { vivo = false; };
  }, [item]);

  const info = TIPO_INFO[item.tipo];
  return (
    <div className="fixed inset-0 z-50 bg-foreground flex flex-col">
      <div className="bg-card text-card-foreground px-3 py-2 flex items-start gap-2">
        <div className="flex-1 min-w-0 text-xs space-y-0.5">
          <p className="text-sm font-semibold">{info.label} · {pasto}</p>
          <p className="text-muted-foreground">{retiro} · {item.capataz} · {hora(item.data)}</p>
          {(item.tipo === "auditoria" || item.tipo === "cocho") && (
            <p>Sacos: {item.sacos ?? "—"} · Consumo: {item.consumo != null ? `${Math.round(item.consumo)} g/cab/dia` : "—"}</p>
          )}
          {(item.tipo === "auditoria" || item.tipo === "cocho") && item.texto && <p>Motivo (manual): {item.texto}</p>}
          {item.tipo === "observacao" && item.texto && <p>{item.texto}</p>}
          {item.tipo === "mortalidade" && item.texto && <p>Causa: {item.texto}</p>}
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar"><X className="w-5 h-5" /></Button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {!urls && !erro && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-background" /></div>}
        {erro && <p className="absolute inset-0 flex items-center justify-center text-background text-sm p-6 text-center">{erro}</p>}
        {urls && urls.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-background text-sm">Foto indisponível.</p>}
        {urls && urls[idx] && <ZoomImage key={`${item.key}-${idx}`} src={urls[idx]} />}
        {onPrev && <button onClick={onPrev} aria-label="Anterior" className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center"><ChevronLeft className="w-6 h-6" /></button>}
        {onNext && <button onClick={onNext} aria-label="Próxima" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/80 flex items-center justify-center"><ChevronRight className="w-6 h-6" /></button>}
      </div>
      {urls && urls.length > 1 && (
        <div className="bg-card flex justify-center gap-2 p-2">
          {urls.map((_, i) => (
            <Button key={i} size="sm" variant={i === idx ? "default" : "outline"} onClick={() => setIdx(i)}>{i === 0 ? "Animal" : "Brinco"}</Button>
          ))}
        </div>
      )}
    </div>
  );
}

function ZoomImage({ src }: { src: string }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const g = useRef<{ d0: number; s0: number; px: number; py: number; x0: number; y0: number } | null>(null);
  const dist = (e: React.TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ touchAction: "none" }}
      onTouchStart={(e) => {
        if (e.touches.length === 2) g.current = { d0: dist(e), s0: t.s, px: 0, py: 0, x0: t.x, y0: t.y };
        else if (e.touches.length === 1) g.current = { d0: 0, s0: t.s, px: e.touches[0].clientX, py: e.touches[0].clientY, x0: t.x, y0: t.y };
      }}
      onTouchMove={(e) => {
        const s = g.current; if (!s) return;
        if (e.touches.length === 2 && s.d0) setT((p) => ({ ...p, s: Math.min(5, Math.max(1, s.s0 * dist(e) / s.d0)) }));
        else if (e.touches.length === 1 && t.s > 1) setT((p) => ({ ...p, x: s.x0 + e.touches[0].clientX - s.px, y: s.y0 + e.touches[0].clientY - s.py }));
      }}
      onTouchEnd={() => { g.current = null; setT((p) => (p.s <= 1.02 ? { s: 1, x: 0, y: 0 } : p)); }}
      onDoubleClick={() => setT((p) => (p.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 }))}
    >
      <img src={src} alt="Foto" className="max-w-full max-h-full select-none" draggable={false}
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: g.current ? "none" : "transform .15s" }} />
    </div>
  );
}
