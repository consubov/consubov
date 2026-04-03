import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface PainelPeriodo {
  mes: number;
  ano: number;
}

interface PainelPeriodoContextValue extends PainelPeriodo {
  setPeriodo: (mes: number, ano: number) => void;
}

const STORAGE_KEY = "consubov:painel-periodo";
const PainelPeriodoContext = createContext<PainelPeriodoContextValue | undefined>(undefined);

function getDefaultPeriodo(): PainelPeriodo {
  const now = new Date();
  return {
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
  };
}

function isValidMes(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function isValidAno(value: number) {
  return Number.isInteger(value) && value >= 2020 && value <= 2100;
}

function normalizePeriodo(mes: number, ano: number): PainelPeriodo | null {
  if (!isValidMes(mes) || !isValidAno(ano)) return null;
  return { mes, ano };
}

function readStoredPeriodo(): PainelPeriodo {
  if (typeof window === "undefined") return getDefaultPeriodo();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPeriodo();

    const parsed = JSON.parse(raw) as { mes?: number; ano?: number };
    return normalizePeriodo(Number(parsed.mes), Number(parsed.ano)) ?? getDefaultPeriodo();
  } catch {
    return getDefaultPeriodo();
  }
}

export function readPainelPeriodoFromSearchParams(searchParams: URLSearchParams): PainelPeriodo | null {
  return normalizePeriodo(Number(searchParams.get("mes")), Number(searchParams.get("ano")));
}

export function PainelPeriodoProvider({ children }: { children: React.ReactNode }) {
  const [periodo, setPeriodoState] = useState<PainelPeriodo>(() => readStoredPeriodo());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(periodo));
  }, [periodo]);

  const setPeriodo = useCallback((mes: number, ano: number) => {
    const nextPeriodo = normalizePeriodo(mes, ano);
    if (!nextPeriodo) return;

    setPeriodoState((current) => {
      if (current.mes === nextPeriodo.mes && current.ano === nextPeriodo.ano) {
        return current;
      }

      return nextPeriodo;
    });
  }, []);

  const value = useMemo(() => ({
    ...periodo,
    setPeriodo,
  }), [periodo, setPeriodo]);

  return <PainelPeriodoContext.Provider value={value}>{children}</PainelPeriodoContext.Provider>;
}

export function usePainelPeriodo() {
  const context = useContext(PainelPeriodoContext);

  if (!context) {
    throw new Error("usePainelPeriodo must be used within PainelPeriodoProvider");
  }

  return context;
}
