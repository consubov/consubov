/**
 * Eventos de operação do Capataz (iniciou / cancelou / sincronizou) para o
 * Painel de Operações do Gerente.
 *
 * Enviar-e-esquecer: `reportOperacao` NUNCA lança erro, nunca é aguardada e
 * não toca na salga, na fila offline nem na sincronização. Os eventos ficam
 * numa fila própria (localStorage) e são reenviados ao abrir o app, quando a
 * internet volta, ao voltar para o app e a cada 2 minutos.
 * Reenvio duplicado (23505 em evento_id) conta como sucesso.
 */
import { supabase } from "@/integrations/supabase/client";

export type TipoOperacao = "iniciou" | "cancelou" | "sincronizou";

interface EventoFila {
  evento_id: string;
  user_id: string;
  capataz_nome: string | null;
  fazenda_id: string | null;
  retiro_id: string;
  tipo: TipoOperacao;
  pendentes: number | null;
  ocorrido_em: string;
  tries: number;
}

const KEY = "consubov:operacoes-capataz-fila";
const MAX_FILA = 50;
let enviando = false;

function ler(): EventoFila[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function gravar(l: EventoFila[]) {
  try { localStorage.setItem(KEY, JSON.stringify(l.slice(-MAX_FILA))); } catch { /* ignore */ }
}

function uuid() {
  try { return crypto.randomUUID(); } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

async function enviarFila() {
  if (enviando) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  enviando = true;
  try {
    for (const ev of ler()) {
      try {
        let fazendaId = ev.fazenda_id;
        if (!fazendaId) {
          const { data } = await supabase.from("retiros").select("fazenda_id").eq("id", ev.retiro_id).maybeSingle();
          fazendaId = (data as any)?.fazenda_id ?? null;
          if (!fazendaId) throw new Error("sem fazenda");
        }
        const { tries: _t, ...rest } = ev;
        const { error } = await supabase.from("operacoes_capataz" as any).insert({ ...rest, fazenda_id: fazendaId } as any);
        if (error && (error as any).code !== "23505") throw error;
        gravar(ler().filter((x) => x.evento_id !== ev.evento_id));
      } catch {
        const l = ler();
        const i = l.findIndex((x) => x.evento_id === ev.evento_id);
        if (i >= 0) {
          l[i].tries += 1;
          // Nunca fica preso para sempre: descarta após muitas tentativas.
          if (l[i].tries > 200) l.splice(i, 1);
          gravar(l);
        }
      }
    }
  } finally {
    enviando = false;
  }
}

export function reportOperacao(
  tipo: TipoOperacao,
  dados: { userId?: string | null; retiroId?: string | null; fazendaId?: string | null; capatazNome?: string | null; pendentes?: number | null },
): void {
  try {
    if (!dados.userId || !dados.retiroId) return;
    const l = ler();
    l.push({
      evento_id: uuid(),
      user_id: dados.userId,
      capataz_nome: dados.capatazNome ?? null,
      fazenda_id: dados.fazendaId || null,
      retiro_id: dados.retiroId,
      tipo,
      pendentes: dados.pendentes ?? null,
      ocorrido_em: new Date().toISOString(),
      tries: 0,
    });
    gravar(l);
    void enviarFila().catch(() => {});
  } catch { /* nunca propaga */ }
}

export function iniciarFilaOperacoes(): () => void {
  const run = () => { void enviarFila().catch(() => {}); };
  const onVis = () => { if (document.visibilityState === "visible") run(); };
  const t = setTimeout(run, 5_000);
  const iv = setInterval(run, 2 * 60_000);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", onVis);
  return () => {
    clearTimeout(t);
    clearInterval(iv);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", onVis);
  };
}
