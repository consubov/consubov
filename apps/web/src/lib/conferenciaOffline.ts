import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "pendingConferencias";
const BUCKET = "mapas";

export interface ChecklistPayload {
  fazenda_id: string | null;
  retiro_id: string | null;
  pasto_id: string | null;
  user_id: string;
  perfil: string | null;
  cocho_abastecido: boolean;
  cocho_parcial: boolean;
  cocho_vazio: boolean;
  cocho_danificado: boolean;
  placa_qr_presente: boolean;
  placa_qr_danificada: boolean;
  qtd_compativel: boolean;
  qtd_divergente: boolean;
  necessita_atencao: boolean;
  observacoes: string | null;
  fotosDataUrls: string[];
}

interface QueuedItem extends ChecklistPayload {
  queuedAt: string;
  clientId: string;
}

function readQueue(): QueuedItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function uploadFotos(userId: string, checklistId: string, dataUrls: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const blob = await dataUrlToBlob(dataUrls[i]);
    const path = `conferencias/${userId}/${checklistId}/${i}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

export async function saveChecklist(payload: ChecklistPayload): Promise<{ saved: boolean; queued: boolean }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const queue = readQueue();
    queue.push({ ...payload, queuedAt: new Date().toISOString(), clientId: crypto.randomUUID() });
    writeQueue(queue);
    return { saved: true, queued: true };
  }

  try {
    const checklistId = crypto.randomUUID();
    const fotos = payload.fotosDataUrls.length > 0
      ? await uploadFotos(payload.user_id, checklistId, payload.fotosDataUrls)
      : [];

    const { error } = await supabase.from("conferencias_checklist").insert({
      id: checklistId,
      fazenda_id: payload.fazenda_id,
      retiro_id: payload.retiro_id,
      pasto_id: payload.pasto_id,
      user_id: payload.user_id,
      perfil: payload.perfil,
      cocho_abastecido: payload.cocho_abastecido,
      cocho_parcial: payload.cocho_parcial,
      cocho_vazio: payload.cocho_vazio,
      cocho_danificado: payload.cocho_danificado,
      placa_qr_presente: payload.placa_qr_presente,
      placa_qr_danificada: payload.placa_qr_danificada,
      qtd_compativel: payload.qtd_compativel,
      qtd_divergente: payload.qtd_divergente,
      necessita_atencao: payload.necessita_atencao,
      observacoes: payload.observacoes,
      fotos,
    });
    if (error) throw error;
    return { saved: true, queued: false };
  } catch (err) {
    // Falha de rede → enfileirar
    const queue = readQueue();
    queue.push({ ...payload, queuedAt: new Date().toISOString(), clientId: crypto.randomUUID() });
    writeQueue(queue);
    return { saved: true, queued: true };
  }
}

export async function syncPendingChecklists(): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const queue = readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedItem[] = [];
  let synced = 0;
  for (const item of queue) {
    try {
      const checklistId = crypto.randomUUID();
      const fotos = item.fotosDataUrls.length > 0
        ? await uploadFotos(item.user_id, checklistId, item.fotosDataUrls)
        : [];
      const { error } = await supabase.from("conferencias_checklist").insert({
        id: checklistId,
        fazenda_id: item.fazenda_id,
        retiro_id: item.retiro_id,
        pasto_id: item.pasto_id,
        user_id: item.user_id,
        perfil: item.perfil,
        cocho_abastecido: item.cocho_abastecido,
        cocho_parcial: item.cocho_parcial,
        cocho_vazio: item.cocho_vazio,
        cocho_danificado: item.cocho_danificado,
        placa_qr_presente: item.placa_qr_presente,
        placa_qr_danificada: item.placa_qr_danificada,
        qtd_compativel: item.qtd_compativel,
        qtd_divergente: item.qtd_divergente,
        necessita_atencao: item.necessita_atencao,
        observacoes: item.observacoes,
        fotos,
      });
      if (error) throw error;
      synced++;
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
  return synced;
}

export function getPendingCount(): number {
  return readQueue().length;
}
