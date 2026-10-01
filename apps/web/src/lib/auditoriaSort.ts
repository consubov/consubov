/**
 * Audit photo lottery logic — Fisher-Yates shuffle to determine
 * which salga positions within a block of 10 require mandatory photos.
 */

import { getConfig, setConfig } from './offlineDb';

export interface SorteioBloco {
  retiro_id: string;
  fazenda_id: string;
  bloco: number;
  posicoes_com_foto: number[];
  gerado_em: string;
}

/** Fisher-Yates shuffle of [1..10], return first N */
function sortearPosicoes(n: number): number[] {
  const arr = Array.from({ length: 10 }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n).sort((a, b) => a - b);
}

function configKey(retiroId: string) {
  return `auditoria_sorteio_${retiroId}`;
}

function contadorKey(retiroId: string) {
  return `auditoria_contador_${retiroId}`;
}

/** Get total salga count for this retiro from IndexedDB */
export async function getSalgaContador(retiroId: string): Promise<number> {
  const val = await getConfig(contadorKey(retiroId));
  return val ? parseInt(val, 10) || 0 : 0;
}

/** Increment salga counter and return new value */
export async function incrementSalgaContador(retiroId: string): Promise<number> {
  const current = await getSalgaContador(retiroId);
  const next = current + 1;
  await setConfig(contadorKey(retiroId), String(next));
  return next;
}

/** Get or create sorteio for the current block */
export async function getSorteioAtual(
  retiroId: string,
  fazendaId: string,
  fotosPorBloco: number,
): Promise<SorteioBloco> {
  const contador = await getSalgaContador(retiroId);
  const blocoAtual = Math.floor(contador / 10);

  const saved = await getConfig(configKey(retiroId));
  if (saved) {
    try {
      const parsed: SorteioBloco = JSON.parse(saved);
      if (parsed.bloco === blocoAtual) {
        return parsed;
      }
    } catch { /* regenerate */ }
  }

  // Generate new sorteio for current block
  return gerarSorteio(retiroId, fazendaId, blocoAtual, fotosPorBloco);
}

/** Generate a new sorteio and persist to IndexedDB */
export async function gerarSorteio(
  retiroId: string,
  fazendaId: string,
  bloco: number,
  fotosPorBloco: number,
): Promise<SorteioBloco> {
  const clamped = Math.max(0, Math.min(10, fotosPorBloco));
  const posicoes = clamped === 0 ? [] : clamped >= 10 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : sortearPosicoes(clamped);

  const sorteio: SorteioBloco = {
    retiro_id: retiroId,
    fazenda_id: fazendaId,
    bloco,
    posicoes_com_foto: posicoes,
    gerado_em: new Date().toISOString(),
  };

  await setConfig(configKey(retiroId), JSON.stringify(sorteio));
  return sorteio;
}

/** Check if current salga position requires a photo */
export async function verificarFotoObrigatoria(
  retiroId: string,
  fazendaId: string,
  fotosPorBloco: number,
): Promise<boolean> {
  if (fotosPorBloco >= 10) return true;
  if (fotosPorBloco <= 0) return false;

  const sorteio = await getSorteioAtual(retiroId, fazendaId, fotosPorBloco);
  const contador = await getSalgaContador(retiroId);
  const posicaoNoBloco = (contador % 10) + 1; // 1-based position

  return sorteio.posicoes_com_foto.includes(posicaoNoBloco);
}

/** After saving a salga, increment counter and regenerate block if needed */
export async function registrarSalgaAuditoria(
  retiroId: string,
  fazendaId: string,
  fotosPorBloco: number,
): Promise<void> {
  const novoContador = await incrementSalgaContador(retiroId);

  // If we just completed a block (counter is multiple of 10), generate next block
  if (novoContador % 10 === 0) {
    const proximoBloco = novoContador / 10;
    await gerarSorteio(retiroId, fazendaId, proximoBloco, fotosPorBloco);
  }
}

/** Sync sorteio to Supabase (fire and forget) */
export async function syncSorteioToSupabase(
  supabaseClient: any,
  sorteio: SorteioBloco,
): Promise<void> {
  try {
    await supabaseClient
      .from('audit_sorteios')
      .upsert({
        retiro_id: sorteio.retiro_id,
        fazenda_id: sorteio.fazenda_id,
        bloco: sorteio.bloco,
        posicoes_com_foto: sorteio.posicoes_com_foto,
        gerado_em: sorteio.gerado_em,
      }, { onConflict: 'retiro_id,bloco' });
  } catch {
    // Offline — will be synced later
  }
}
