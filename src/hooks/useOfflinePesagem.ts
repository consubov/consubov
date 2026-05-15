import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  savePesagemPendente,
  getPesagensPendentes,
  countPesagensPendentes,
  markPesagemSincronizada,
  getSyncQueueItems,
  deleteSyncQueueItem,
  type PesagemPendente,
} from "@/lib/offlineDb";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflinePesagemSync(onSynced?: () => void, enabled = true) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    if (!enabled) {
      setPendingCount(0);
      return 0;
    }
    const count = await countPesagensPendentes();
    setPendingCount(count);
    return count;
  }, [enabled]);

  const syncAll = useCallback(async () => {
    if (!enabled || syncingRef.current || !isOnline) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const pendentes = await getPesagensPendentes();
      for (const p of pendentes) {
        try {
          await syncOnePesagem(p);
          await markPesagemSincronizada(p.id);
        } catch (err: any) {
          console.error("Sync pesagem failed:", p.id, err);
        }
      }

      // Process sync queue (e.g., offline PDF uploads)
      await processSyncQueue();

      const remaining = await countPesagensPendentes();
      setPendingCount(remaining);

      if (remaining === 0 && pendentes.length > 0) {
        toast.success("Pesagens offline sincronizadas com sucesso!");
      }
      onSynced?.();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [enabled, isOnline, onSynced]);

  // Sync de pesagens offline NÃO roda automaticamente ao ficar online.
  // Só dispara quando o capataz/gerente acionar manualmente via syncAll().


  // Initial count
  useEffect(() => {
    if (!enabled) {
      setPendingCount(0);
      return;
    }
    refreshCount();
  }, [enabled, refreshCount]);

  return { pendingCount, syncing, syncAll, refreshCount, isOnline };
}

async function processSyncQueue() {
  try {
    const items = await getSyncQueueItems();
    for (const item of items) {
      if (item.type === "upload_pdf_pesagem") {
        try {
          const { pesagemId, fazendaId, fileName, blobBase64 } = item.payload;
          const byteCharacters = atob(blobBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/pdf" });

          const storagePath = `pesagens/${fazendaId}/${pesagemId}/${fileName}`;
          const { error } = await supabase.storage
            .from("relatorios")
            .upload(storagePath, blob, { upsert: true, contentType: "application/pdf" });

          if (error) throw error;
          await deleteSyncQueueItem(item.id);
        } catch (err) {
          console.error("Sync queue item failed:", item.id, err);
        }
      }
    }
  } catch (err) {
    console.error("processSyncQueue error:", err);
  }
}

async function syncOnePesagem(p: PesagemPendente) {
  const now = p.data_pesagem;
  const mp = p.media_calculada;
  const tipo = p.sanitario_data ? "pesagem_sanitario" : "pesagem";

  // 1. Create evento_lote
  const { data: evento, error: evErr } = await (supabase.from("eventos_lote") as any)
    .insert({
      lote_id: p.lote_id,
      tipo,
      usuario_id: p.usuario_id,
      data_evento: now,
      dados: {
        pesos: p.pesos,
        total_pesado: p.total_pesado,
        media: Math.round(mp * 10) / 10,
        peso_aplicado: p.peso_medio_aplicado,
        offline: true,
        ...(p.sanitario_data ? { sanitario: p.sanitario_data } : {}),
      },
    })
    .select("id")
    .single();

  if (evErr) throw evErr;

  // 2. Insert pesagem
  const { error: pesErr } = await (supabase.from("pesagens") as any).insert({
    evento_id: evento.id,
    lote_id: p.lote_id,
    total_pesado: p.total_pesado,
    pesos: p.pesos as any,
    media_calculada: Math.round(mp * 10) / 10,
    peso_medio_aplicado: p.peso_medio_aplicado,
    data_pesagem: now,
    usuario_id: p.usuario_id,
  });

  if (pesErr) throw pesErr;

  // 3. Recalc weight – fetch current pasto for fresh data
  const { data: pasto } = await supabase.from("pastos").select("num_animais, peso_medio_kg").eq("id", p.lote_id).single();

  let pesoAplicado = p.peso_medio_aplicado;
  if (pasto) {
    const totalAnimais = pasto.num_animais;
    const pesoAtual = pasto.peso_medio_kg;
    if (p.total_pesado >= totalAnimais || !pesoAtual || pesoAtual <= 0) {
      pesoAplicado = Math.round(mp * 10) / 10;
    } else {
      pesoAplicado = Math.round(((pesoAtual * totalAnimais + mp * p.total_pesado) / totalAnimais) * 10) / 10;
    }
  }

  const pastoUpdate: any = {
    peso_medio_kg: pesoAplicado,
    ultima_pesagem_em: now,
  };

  // 4. If sanitario combined
  if (p.sanitario_data) {
    const sd = p.sanitario_data;
    const dataFimCarencia =
      sd.tem_carencia && sd.dias_carencia > 0
        ? new Date(new Date(now).getTime() + sd.dias_carencia * 86400000).toISOString().slice(0, 10)
        : null;

    const { data: sanEvento, error: sanErr } = await (supabase.from("eventos_sanitarios") as any)
      .insert({
        evento_id: evento.id,
        lote_id: p.lote_id,
        categoria: sd.categoria,
        medicamento: sd.medicamento,
        dose: sd.dose,
        lote_completo: sd.lote_completo,
        quantidade_tratada: sd.quantidade_tratada,
        tem_carencia: sd.tem_carencia,
        dias_carencia: sd.dias_carencia,
        data_fim_carencia: dataFimCarencia,
        aplicador_id: p.usuario_id,
        data_aplicacao: now,
      })
      .select("id")
      .single();

    if (sanErr) throw sanErr;
    pastoUpdate.ultimo_evento_sanitario_id = sanEvento.id;
    if (dataFimCarencia) pastoUpdate.data_fim_carencia = dataFimCarencia;
  }

  await supabase.from("pastos").update(pastoUpdate).eq("id", p.lote_id);
}
