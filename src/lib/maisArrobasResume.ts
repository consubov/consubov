/**
 * Retomada de pesagem em andamento (Mais Arrobas) após recarga da tela.
 * Guarda no aparelho qual pesagem está aberta e, para lotes sem
 * identificação (que não gravam peso a peso no servidor), a lista da tela.
 */
export type PesagemAtiva = {
  tipo: "pesador" | "pecuarista";
  pesagemId: string;
  path: string;
  label: string;
  updatedAt: string;
};

const KEY_ATIVA = "ma_pesagem_ativa";
const semKey = (pesagemId: string) => `ma_linhas_sem_${pesagemId}`;

export function getPesagemAtiva(): PesagemAtiva | null {
  try {
    const raw = localStorage.getItem(KEY_ATIVA);
    return raw ? (JSON.parse(raw) as PesagemAtiva) : null;
  } catch {
    return null;
  }
}

export function setPesagemAtiva(p: Omit<PesagemAtiva, "updatedAt">) {
  try {
    localStorage.setItem(KEY_ATIVA, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
  } catch { /* ignore */ }
}

export function clearPesagemAtiva(pesagemId?: string) {
  try {
    const a = getPesagemAtiva();
    if (!pesagemId || a?.pesagemId === pesagemId) localStorage.removeItem(KEY_ATIVA);
  } catch { /* ignore */ }
}

export function saveLinhasSem<T>(pesagemId: string, linhas: T[]) {
  try {
    localStorage.setItem(semKey(pesagemId), JSON.stringify(linhas));
  } catch { /* ignore */ }
}

export function loadLinhasSem<T>(pesagemId: string): T[] {
  try {
    const raw = localStorage.getItem(semKey(pesagemId));
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export function clearLinhasSem(pesagemId: string) {
  try {
    localStorage.removeItem(semKey(pesagemId));
  } catch { /* ignore */ }
}
