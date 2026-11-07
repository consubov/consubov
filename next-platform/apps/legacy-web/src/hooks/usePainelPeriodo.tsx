import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface PainelPeriodo {
  mes: number;
  ano: number;
}

interface PainelPeriodoContextValue extends PainelPeriodo {
  setPeriodo: (mes: number, ano: number) => void;
}

const PainelPeriodoContext = createContext<PainelPeriodoContextValue | undefined>(undefined);

export function getCurrentPainelPeriodo(): PainelPeriodo {
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

export function readPainelPeriodoFromSearchParams(searchParams: URLSearchParams): PainelPeriodo | null {
  return normalizePeriodo(Number(searchParams.get("mes")), Number(searchParams.get("ano")));
}

export function resolvePainelPeriodo(searchParams: URLSearchParams): PainelPeriodo {
  return readPainelPeriodoFromSearchParams(searchParams) ?? getCurrentPainelPeriodo();
}

export function PainelPeriodoProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodoState] = useState<PainelPeriodo>(() => getCurrentPainelPeriodo());

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
