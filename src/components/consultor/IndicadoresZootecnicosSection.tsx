import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  hasPendingLocalChanges,
  loadSnapshot,
  offlineUpsert,
  patchSnapshot,
} from "@/lib/consultorOffline/snapshotStore";

export const INDICADORES_FAIXAS = [
  { key: "1-20", label: "1-20", ordem: 1 },
  { key: "21-40", label: "21-40", ordem: 2 },
  { key: "41-60", label: "41-60", ordem: 3 },
  { key: "61-80", label: "61-80", ordem: 4 },
  { key: "81-100", label: "81-100", ordem: 5 },
  { key: "101-120", label: "101-120", ordem: 6 },
  { key: "121+", label: "121>>", ordem: 7 },
] as const;

export type IndicadorFaixaKey = typeof INDICADORES_FAIXAS[number]["key"];

export interface IndicadorRow {
  id: string;
  currais_ocupados: number | null;
  animais_ativos: number | null;
}
export interface IndicadorFaixaRow {
  id: string;
  faixa: IndicadorFaixaKey;
  quantidade_animais: number | null;
  consumo_medio_pv: number | null;
  ordem: number;
}

const parseIntOrNull = (v: string): number | null => {
  const s = v.trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
const parseNumOrNull = (v: string): number | null => {
  const s = v.trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export async function fetchIndicadoresParaPdf(visitaId: string): Promise<{
  indicador: IndicadorRow | null;
  faixas: IndicadorFaixaRow[];
} | null> {
  try {
    const { data: ind } = await (supabase as any)
      .from("indicadores_zootecnicos")
      .select("*")
      .eq("visita_id", visitaId)
      .maybeSingle();
    if (!ind) {
      const snap = await loadSnapshot(visitaId);
      const snapInd = snap?.indicadores_zootecnicos || null;
      const snapFaixas = (snap?.indicadores_zootecnicos_faixas as IndicadorFaixaRow[]) || [];
      return snapInd
        ? { indicador: snapInd, faixas: snapFaixas }
        : snapFaixas.length
          ? { indicador: null, faixas: snapFaixas }
          : null;
    }
    const { data: fx } = await (supabase as any)
      .from("indicadores_zootecnicos_faixa")
      .select("*")
      .eq("indicadores_zootecnicos_id", ind.id);
    return {
      indicador: {
        id: ind.id,
        currais_ocupados: ind.currais_ocupados ?? null,
        animais_ativos: ind.animais_ativos ?? null,
      },
      faixas: ((fx as IndicadorFaixaRow[]) || []).sort((a, b) => a.ordem - b.ordem),
    };
  } catch {
    const snap = await loadSnapshot(visitaId);
    const snapInd = snap?.indicadores_zootecnicos || null;
    const snapFaixas = (snap?.indicadores_zootecnicos_faixas as IndicadorFaixaRow[]) || [];
    return snapInd || snapFaixas.length ? { indicador: snapInd, faixas: snapFaixas } : null;
  }
}

export default function IndicadoresZootecnicosSection({
  visitaId,
  readOnly,
}: {
  visitaId: string;
  readOnly?: boolean;
}) {
  const [indicador, setIndicador] = useState<IndicadorRow | null>(null);
  const [faixas, setFaixas] = useState<Record<IndicadorFaixaKey, IndicadorFaixaRow>>(() => {
    const init = {} as Record<IndicadorFaixaKey, IndicadorFaixaRow>;
    for (const f of INDICADORES_FAIXAS) {
      init[f.key] = {
        id: crypto.randomUUID(),
        faixa: f.key,
        quantidade_animais: null,
        consumo_medio_pv: null,
        ordem: f.ordem,
      };
    }
    return init;
  });
  const [ready, setReady] = useState(0);

  const load = useCallback(async () => {
    const snap = await loadSnapshot(visitaId);
    const online = typeof navigator === "undefined" || navigator.onLine;
    const preferLocal = !!(snap?.indicadores_zootecnicos || snap?.indicadores_zootecnicos_faixas)
      && await hasPendingLocalChanges(visitaId);
    let indRow: any = null;
    let faixasRows: any[] = [];
    if (online && !preferLocal) {
      const { data: ind } = await (supabase as any)
        .from("indicadores_zootecnicos")
        .select("*")
        .eq("visita_id", visitaId)
        .maybeSingle();
      indRow = ind;
      if (ind) {
        const { data: fx } = await (supabase as any)
          .from("indicadores_zootecnicos_faixa")
          .select("*")
          .eq("indicadores_zootecnicos_id", ind.id);
        faixasRows = fx || [];
      }
    }
    if (!indRow) indRow = snap?.indicadores_zootecnicos || null;
    if (!faixasRows.length) faixasRows = snap?.indicadores_zootecnicos_faixas || [];

    if (indRow) {
      setIndicador({
        id: indRow.id,
        currais_ocupados: indRow.currais_ocupados ?? null,
        animais_ativos: indRow.animais_ativos ?? null,
      });
    }
    if (faixasRows.length) {
      setFaixas(prev => {
        const next = { ...prev };
        for (const f of INDICADORES_FAIXAS) {
          const found = faixasRows.find((r: any) => r.faixa === f.key);
          if (found) {
            next[f.key] = {
              id: found.id,
              faixa: f.key,
              quantidade_animais: found.quantidade_animais ?? null,
              consumo_medio_pv: found.consumo_medio_pv ?? null,
              ordem: f.ordem,
            };
          }
        }
        return next;
      });
    }
    if (!preferLocal && (indRow || faixasRows.length)) {
      void patchSnapshot(visitaId, curr => ({
        ...curr,
        indicadores_zootecnicos: indRow || curr.indicadores_zootecnicos,
        indicadores_zootecnicos_faixas: faixasRows.length
          ? faixasRows
          : curr.indicadores_zootecnicos_faixas,
      }));
    }
    setReady(r => r + 1);
  }, [visitaId]);

  useEffect(() => { void load(); }, [load]);

  const ensuringRef = useRef<Promise<string> | null>(null);
  async function ensureIndicador(): Promise<string> {
    if (indicador?.id) return indicador.id;
    if (ensuringRef.current) return ensuringRef.current;
    const id = crypto.randomUUID();
    ensuringRef.current = (async () => {
      setIndicador({ id, currais_ocupados: null, animais_ativos: null });
      await offlineUpsert({
        visitaId,
        table: "indicadores_zootecnicos",
        rowId: id,
        payload: { visita_id: visitaId, currais_ocupados: null, animais_ativos: null },
        onConflict: "visita_id",
        applyToSnapshot: (curr, p) => ({
          ...curr,
          indicadores_zootecnicos: { id, ...p },
        }),
      });
      return id;
    })();
    try { return await ensuringRef.current; }
    finally { ensuringRef.current = null; }
  }

  async function saveIndicador(patch: Partial<Omit<IndicadorRow, "id">>) {
    const id = await ensureIndicador();
    setIndicador(prev => ({
      id,
      currais_ocupados: patch.currais_ocupados !== undefined ? patch.currais_ocupados : prev?.currais_ocupados ?? null,
      animais_ativos: patch.animais_ativos !== undefined ? patch.animais_ativos : prev?.animais_ativos ?? null,
    }));
    await offlineUpsert({
      visitaId,
      table: "indicadores_zootecnicos",
      rowId: id,
      payload: { visita_id: visitaId, ...patch },
      onConflict: "visita_id",
      applyToSnapshot: (curr, p) => ({
        ...curr,
        indicadores_zootecnicos: {
          ...(curr.indicadores_zootecnicos || {}),
          id,
          visita_id: visitaId,
          ...p,
        },
      }),
    });
  }

  async function saveFaixa(key: IndicadorFaixaKey, patch: Partial<Pick<IndicadorFaixaRow, "quantidade_animais" | "consumo_medio_pv">>) {
    const indId = await ensureIndicador();
    const current = faixas[key];
    const next = { ...current, ...patch };
    setFaixas(prev => ({ ...prev, [key]: next }));
    const meta = INDICADORES_FAIXAS.find(f => f.key === key)!;
    await offlineUpsert({
      visitaId,
      table: "indicadores_zootecnicos_faixa",
      rowId: current.id,
      payload: {
        indicadores_zootecnicos_id: indId,
        faixa: key,
        ordem: meta.ordem,
        quantidade_animais: next.quantidade_animais,
        consumo_medio_pv: next.consumo_medio_pv,
      },
      onConflict: "id",
      applyToSnapshot: (curr, p) => {
        const arr = ((curr.indicadores_zootecnicos_faixas as any[]) || []).filter(x => x.id !== current.id);
        return {
          ...curr,
          indicadores_zootecnicos_faixas: [...arr, { id: current.id, ...p }],
        };
      },
    });
  }

  // Debounce for autosave.
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function debounced(key: string, fn: () => void, ms = 600) {
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(fn, ms);
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3" style={{ borderColor: "#E7E3D6" }}>
      <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
        Indicadores Zootécnicos
      </div>
      <div className="text-[11px] text-muted-foreground -mt-1">
        Preencha somente o que tiver dado. Campos vazios não aparecem no PDF.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Currais Ocupados</Label>
          <Input
            key={`co-${ready}`}
            type="number"
            inputMode="numeric"
            disabled={readOnly}
            defaultValue={indicador?.currais_ocupados ?? ""}
            onChange={e => {
              const v = parseIntOrNull(e.target.value);
              debounced("co", () => void saveIndicador({ currais_ocupados: v }));
            }}
          />
        </div>
        <div>
          <Label className="text-xs">Animais Ativos</Label>
          <Input
            key={`aa-${ready}`}
            type="number"
            inputMode="numeric"
            disabled={readOnly}
            defaultValue={indicador?.animais_ativos ?? ""}
            onChange={e => {
              const v = parseIntOrNull(e.target.value);
              debounced("aa", () => void saveIndicador({ animais_ativos: v }));
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left py-1 pr-2 font-semibold">Dias</th>
              <th className="text-left py-1 pr-2 font-semibold">Qtd. Animais</th>
              <th className="text-left py-1 font-semibold">Consumo %PV</th>
            </tr>
          </thead>
          <tbody>
            {INDICADORES_FAIXAS.map(f => {
              const row = faixas[f.key];
              return (
                <tr key={f.key} className="border-t" style={{ borderColor: "#E7E3D6" }}>
                  <td className="py-1 pr-2 font-medium whitespace-nowrap">{f.label}</td>
                  <td className="py-1 pr-2">
                    <Input
                      key={`q-${f.key}-${ready}`}
                      type="number"
                      inputMode="numeric"
                      className="h-8"
                      disabled={readOnly}
                      defaultValue={row.quantidade_animais ?? ""}
                      onChange={e => {
                        const v = parseIntOrNull(e.target.value);
                        debounced(`q-${f.key}`, () => void saveFaixa(f.key, { quantidade_animais: v }));
                      }}
                    />
                  </td>
                  <td className="py-1">
                    <Input
                      key={`c-${f.key}-${ready}`}
                      type="text"
                      inputMode="decimal"
                      className="h-8"
                      disabled={readOnly}
                      defaultValue={row.consumo_medio_pv ?? ""}
                      placeholder="ex: 1,94"
                      onChange={e => {
                        const v = parseNumOrNull(e.target.value);
                        debounced(`c-${f.key}`, () => void saveFaixa(f.key, { consumo_medio_pv: v }));
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
