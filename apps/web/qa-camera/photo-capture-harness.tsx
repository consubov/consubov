import "../src/index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import SalgaForm from "../src/components/capataz/SalgaForm";
import type { LancamentoOffline } from "../src/lib/offlineDb";

declare global {
  interface Window {
    __photoHarnessSave?: Omit<LancamentoOffline, "id" | "data" | "status">;
  }
}

createRoot(document.getElementById("root")!).render(
  <SalgaForm
    pastoId="test-pasto"
    pastoNome="Pasto para teste"
    retiroNome="Retiro isolado de teste"
    cicloId="test-ciclo"
    tipo="salga"
    auditoriaExigida={true}
    exigirFotoCocho={true}
    numAnimais={0}
    sugestao={null}
    onBack={() => undefined}
    onSave={async (data) => { window.__photoHarnessSave = data; }}
  />
);
