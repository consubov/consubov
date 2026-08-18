/**
 * Conferência do Admin via QR Code.
 * Reaproveita a estrutura de visitas do módulo Consultor (visitas_tecnicas /
 * visita_pastos / visita_fotos) de forma ADITIVA: a visita é criada com
 * `administrador_id` preenchido e `consultor_id` nulo, tipo "conferencia_admin".
 * Nenhum fluxo do Consultor é alterado.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET_FOTOS = "visitas-consultor-fotos";
export const TIPO_CONFERENCIA_ADMIN = "conferencia_admin";

export interface ConferenciaVisita {
  id: string;
  hora_inicio: string;
  fazenda_id: string | null;
  fazenda_nome_override: string | null;
  status?: string | null;
  pdf_url?: string | null;
}

export interface ConferenciaPastoRegistro {
  id: string;
  ordem: number;
  letra: string;
  num_pasto: string | null;
  fazenda_nome: string | null;
  retiro_nome: string | null;
  categoria: string | null;
  sexo: string | null;
  peso_medio_kg: number | null;
  qtd_animais: number | null;
  consumo_medio_g: number | null;
  ultima_salga: string | null;
  ultima_salga_sacos: number | null;
  observacao: string | null;
  fotos: { id: string; url: string; ordem: number }[];
}

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letraFor = (i: number) => LETRAS[i % 26] + (i >= 26 ? String(Math.floor(i / 26) + 1) : "");

const SELECT_VISITA = "id, hora_inicio, fazenda_id, fazenda_nome_override, status, pdf_url";

/**
 * Busca a conferência ainda não encerrada (ou em revisão) do admin.
 * NÃO cria nada — o registro formal só nasce quando o admin decide registrar.
 */
export async function findConferenciaAtiva(administradorId: string): Promise<ConferenciaVisita | null> {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .select(SELECT_VISITA)
    .eq("administrador_id", administradorId)
    .eq("tipo", TIPO_CONFERENCIA_ADMIN)
    .in("status", ["em_andamento", "revisao"])
    .is("deleted_at", null)
    .order("hora_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any as ConferenciaVisita) ?? null;
}

/** Carrega uma conferência específica, inclusive quando já finalizada. */
export async function getConferenciaById(visitaId: string): Promise<ConferenciaVisita> {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .select(SELECT_VISITA)
    .eq("id", visitaId)
    .eq("tipo", TIPO_CONFERENCIA_ADMIN)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data as any as ConferenciaVisita;
}

/** Cria o registro formal da conferência (só após "Registrar Conferência"). */
export async function criarConferenciaVisita(
  administradorId: string,
  fazendaId: string | null,
  fazendaNome: string | null,
): Promise<ConferenciaVisita> {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .insert({
      administrador_id: administradorId,
      consultor_id: null,
      fazenda_consultor_id: null,
      fazenda_id: fazendaId,
      fazenda_nome_override: fazendaNome,
      tipo: TIPO_CONFERENCIA_ADMIN,
      status: "em_andamento",
    } as any)
    .select(SELECT_VISITA)
    .single();

  if (error) throw error;
  return data as any as ConferenciaVisita;
}

/** Busca a conferência ativa do admin ou cria uma nova (usado ao registrar). */
export async function getOrCreateConferenciaVisita(
  administradorId: string,
  fazendaId: string | null,
  fazendaNome: string | null,
): Promise<ConferenciaVisita> {
  const existing = await findConferenciaAtiva(administradorId);
  if (existing) return existing;
  return criarConferenciaVisita(administradorId, fazendaId, fazendaNome);
}

/** Qualquer edição em conferência finalizada invalida o PDF antigo (mesma regra do Relatto). */
export async function reabrirConferenciaSeFinalizada(visita: ConferenciaVisita | null): Promise<boolean> {
  if (!visita || visita.status !== "finalizada") return false;
  const { error } = await supabase
    .from("visitas_tecnicas")
    .update({ status: "revisao", pdf_url: null })
    .eq("id", visita.id);
  if (error) throw error;
  return true;
}

export interface ConferenciaHistoricoItem {
  id: string;
  hora_inicio: string;
  hora_fim: string | null;
  status: string;
  pdf_url: string | null;
  fazenda_nome: string | null;
}

export async function listConferenciasHistorico(administradorId: string): Promise<ConferenciaHistoricoItem[]> {
  const { data, error } = await supabase
    .from("visitas_tecnicas")
    .select("id, hora_inicio, hora_fim, status, pdf_url, fazenda_nome_override, fazendas(nome)")
    .eq("administrador_id", administradorId)
    .eq("tipo", TIPO_CONFERENCIA_ADMIN)
    .eq("status", "finalizada")
    .is("deleted_at", null)
    .order("hora_inicio", { ascending: false });
  if (error) throw error;

  const rows = (data as any[]) || [];
  const semNome = rows.filter(r => !r.fazendas?.nome && !r.fazenda_nome_override).map(r => r.id);
  const nomePorVisita: Record<string, string> = {};
  if (semNome.length > 0) {
    const { data: pastos, error: pastosError } = await supabase
      .from("visita_pastos")
      .select("visita_id, fazenda_nome, ordem")
      .in("visita_id", semNome)
      .not("fazenda_nome", "is", null)
      .order("ordem");
    if (pastosError) throw pastosError;
    for (const pasto of (pastos as any[]) || []) {
      if (pasto.fazenda_nome && !nomePorVisita[pasto.visita_id]) {
        nomePorVisita[pasto.visita_id] = pasto.fazenda_nome;
      }
    }
  }

  return rows.map(r => ({
    id: r.id,
    hora_inicio: r.hora_inicio,
    hora_fim: r.hora_fim ?? null,
    status: r.status,
    pdf_url: r.pdf_url ?? null,
    fazenda_nome: r.fazendas?.nome ?? r.fazenda_nome_override ?? nomePorVisita[r.id] ?? null,
  }));
}

export async function excluirConferencia(visitaId: string): Promise<void> {
  const { error } = await supabase
    .from("visitas_tecnicas")
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq("id", visitaId);
  if (error) throw error;
}

export async function listConferenciaPastos(visitaId: string): Promise<ConferenciaPastoRegistro[]> {
  const { data: pastos, error: pastosError } = await supabase
    .from("visita_pastos")
    .select("*")
    .eq("visita_id", visitaId)
    .order("ordem");
  if (pastosError) throw pastosError;

  const rows = (pastos as any[]) || [];
  if (rows.length === 0) return [];

  const { data: fotos, error: fotosError } = await supabase
    .from("visita_fotos")
    .select("id, url, ordem, visita_pasto_id")
    .in("visita_pasto_id", rows.map(r => r.id))
    .order("ordem");
  if (fotosError) throw fotosError;

  const byPasto: Record<string, { id: string; url: string; ordem: number }[]> = {};
  ((fotos as any[]) || []).forEach(f => {
    (byPasto[f.visita_pasto_id] ??= []).push({ id: f.id, url: f.url, ordem: f.ordem });
  });

  return rows.map(r => ({
    id: r.id,
    ordem: r.ordem,
    letra: r.letra,
    num_pasto: r.num_pasto ?? null,
    fazenda_nome: r.fazenda_nome ?? null,
    retiro_nome: r.retiro_nome ?? null,
    categoria: r.categoria ?? null,
    sexo: r.sexo ?? null,
    peso_medio_kg: r.peso_medio_kg ?? null,
    qtd_animais: r.qtd_animais ?? null,
    consumo_medio_g: r.consumo_medio_g ?? null,
    ultima_salga: r.ultima_salga ?? null,
    ultima_salga_sacos: (r as any).ultima_salga_sacos ?? null,
    observacao: r.observacao ?? null,
    fotos: byPasto[r.id] || [],
  }));
}

export interface SalvarPastoInput {
  visitaId: string;
  pasto_id: string;
  num_pasto: string;
  fazenda_nome: string | null;
  retiro_nome: string | null;
  categoria: string | null;
  sexo: string | null;
  peso_medio_kg: number | null;
  qtd_animais: number | null;
  consumo_medio_g: number | null;
  ultima_salga: string | null;
  ultima_salga_sacos?: number | null;
  observacao: string | null;
  fotosDataUrls: string[];
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Grava o pasto conferido na visita em andamento (novo registro por leitura de QR). */
export async function salvarPastoConferencia(input: SalvarPastoInput): Promise<string> {
  const { count } = await supabase
    .from("visita_pastos")
    .select("id", { count: "exact", head: true })
    .eq("visita_id", input.visitaId);
  const ordem = count ?? 0;

  const { data, error } = await supabase
    .from("visita_pastos")
    .insert({
      visita_id: input.visitaId,
      ordem,
      letra: letraFor(ordem),
      pasto_id: input.pasto_id,
      num_pasto: input.num_pasto,
      fazenda_nome: input.fazenda_nome,
      retiro_nome: input.retiro_nome,
      categoria: input.categoria,
      sexo: input.sexo,
      peso_medio_kg: input.peso_medio_kg,
      qtd_animais: input.qtd_animais,
      consumo_medio_g: input.consumo_medio_g,
      ultima_salga: input.ultima_salga,
      ultima_salga_sacos: input.ultima_salga_sacos ?? null,
      observacao: input.observacao,
    } as any)
    .select("id")
    .single();

  if (error) throw error;
  const registroId = (data as any).id as string;

  for (let i = 0; i < input.fotosDataUrls.slice(0, 5).length; i++) {
    const blob = await dataUrlToBlob(input.fotosDataUrls[i]);
    const path = `conferencia-admin/${input.visitaId}/${registroId}/${i}-${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (upErr) continue;
    await supabase.from("visita_fotos").insert({
      visita_pasto_id: registroId,
      url: path,
      ordem: i,
    });
  }

  return registroId;
}

export interface AtualizarPastoInput {
  registroId: string;
  observacao: string | null;
  qtd_animais: number | null;
  peso_medio_kg: number | null;
  consumo_medio_g: number | null;
  /** Fotos existentes que devem ser removidas. */
  fotosRemovidas: { id: string; url: string }[];
  /** Novas fotos (dataURL) a anexar. */
  novasFotosDataUrls: string[];
  visitaId: string;
}

/** Edita um pasto já registrado na conferência (dados, observação e fotos). */
export async function atualizarPastoConferencia(input: AtualizarPastoInput): Promise<void> {
  const { error } = await supabase
    .from("visita_pastos")
    .update({
      observacao: input.observacao,
      qtd_animais: input.qtd_animais,
      peso_medio_kg: input.peso_medio_kg,
      consumo_medio_g: input.consumo_medio_g,
    } as any)
    .eq("id", input.registroId);
  if (error) throw error;

  if (input.fotosRemovidas.length) {
    const paths = input.fotosRemovidas.map(f => f.url).filter(Boolean);
    if (paths.length) {
      try { await supabase.storage.from(BUCKET_FOTOS).remove(paths); } catch { /* ignora */ }
    }
    await supabase.from("visita_fotos").delete().in("id", input.fotosRemovidas.map(f => f.id));
  }

  if (input.novasFotosDataUrls.length) {
    const { data: existentes } = await supabase
      .from("visita_fotos")
      .select("ordem")
      .eq("visita_pasto_id", input.registroId);
    let ordem = ((existentes as any[]) || []).reduce((m, r) => Math.max(m, (r.ordem ?? 0) + 1), 0);
    for (const dataUrl of input.novasFotosDataUrls.slice(0, 5)) {
      const blob = await dataUrlToBlob(dataUrl);
      const path = `conferencia-admin/${input.visitaId}/${input.registroId}/${ordem}-${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
      if (upErr) continue;
      await supabase.from("visita_fotos").insert({
        visita_pasto_id: input.registroId,
        url: path,
        ordem,
      });
      ordem++;
    }
  }
}

/** Remove por completo um pasto registrado na conferência (fotos incluídas). */
export async function excluirPastoConferencia(registro: ConferenciaPastoRegistro, visitaId: string): Promise<void> {
  const paths = registro.fotos.map(f => f.url).filter(Boolean);
  if (paths.length) {
    try { await supabase.storage.from(BUCKET_FOTOS).remove(paths); } catch { /* ignora */ }
  }
  if (registro.fotos.length) {
    await supabase.from("visita_fotos").delete().in("id", registro.fotos.map(f => f.id));
  }
  const { error } = await supabase.from("visita_pastos").delete().eq("id", registro.id);
  if (error) throw error;

  // Renumera ordem/letra dos remanescentes para manter a sequência A, B, C…
  const { data: restantes } = await supabase
    .from("visita_pastos")
    .select("id, ordem")
    .eq("visita_id", visitaId)
    .order("ordem");
  const rows = ((restantes as any[]) || []);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].ordem === i) continue;
    await supabase.from("visita_pastos").update({ ordem: i, letra: letraFor(i) } as any).eq("id", rows[i].id);
  }
}

export async function encerrarConferenciaVisita(visitaId: string, pdfUrl: string | null) {
  await supabase
    .from("visitas_tecnicas")
    .update({ status: "finalizada", hora_fim: new Date().toISOString(), pdf_url: pdfUrl })
    .eq("id", visitaId);
}

/** Numeração sequencial contínua de fotos ao longo de toda a visita. */
export function numeroMapConferencia(pastos: ConferenciaPastoRegistro[]): Record<string, number> {
  const map: Record<string, number> = {};
  let n = 1;
  for (const p of pastos) {
    for (const f of [...p.fotos].sort((a, b) => a.ordem - b.ordem)) map[f.id] = n++;
  }
  return map;
}

