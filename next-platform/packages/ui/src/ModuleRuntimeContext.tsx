import React, { createContext, useContext, useEffect, useRef } from 'react';
import type { ModuleLocalDataAPI } from '@consubov/contracts';

const ModuleLocalDataContext = createContext<ModuleLocalDataAPI | null>(null);
const ModuleHealthContext = createContext<(() => void) | undefined>(undefined);

export function ModuleRuntimeProvider({ children, localData, onHealthy }: { children?: React.ReactNode; localData: ModuleLocalDataAPI; onHealthy?: () => void }) {
  return <ModuleHealthContext.Provider value={onHealthy}><ModuleLocalDataContext.Provider value={localData}>{children}</ModuleLocalDataContext.Provider></ModuleHealthContext.Provider>;
}

export function useReportModuleHealth(ready: boolean, error: unknown): void {
  const report = useContext(ModuleHealthContext);
  useEffect(() => { if (ready && !error) report?.(); }, [ready, error, report]);
}

export function useLocalData(): ModuleLocalDataAPI {
  const value = useContext(ModuleLocalDataContext);
  if (!value) throw new Error('LocalDataAPI só está disponível dentro do runtime autorizado do módulo.');
  return value;
}

/** Refresh projections without remounting forms or presenting transport state. */
export function useLocalDataChanges(store: { refreshFromLocalData(): Promise<void> }, onResult: (error: unknown | null) => void): void {
  const localData = useLocalData();
  const result = useRef(onResult);
  result.current = onResult;
  useEffect(() => {
    let active = true;
    const unsubscribe = localData.subscribeToChanges?.(() => {
      void store.refreshFromLocalData().then(
        () => { if (active) result.current(null); },
        error => { if (active) result.current(error); }
      );
    });
    return () => { active = false; unsubscribe?.(); };
  }, [localData, store]);
}
