import { createModuleProjection, type CommandDefinition } from './shared';
import type { AtomicCommandEnvelope, LancamentoCochoPayload, LeituraPastoPayload, ContagemRebanhoPayload, FotoCochoPayload } from '@consubov/contracts';
export interface PhotoMetadata { attachment_id: string; dataUrl: string; originalSizeBytes: number; compressedSizeBytes: number; width: number; height: number; compressionRatioPct: number; mimeType: string; pastoId?: string; cochoId?: string; tipoRegistro?: string; createdAt: string; }
export interface PastoItem {
  pasto_id: string;
  nome_pasto: string;
  setor: string;
  qr_code_esperado: string;
  lote_id: string;
  lote_nome: string;
  cocho_id: string;
  status_cocho: 'limpo' | 'com_sobra' | 'lambido' | 'necessita_reparo';
  altura_media_cm: number;
}

export interface LoteItem {
  lote_id: string;
  nome_lote: string;
  categoria: string;
  quantidade_cabecas: number;
  peso_medio_kg: number;
}

export interface ProdutoNutricaoItem {
  produto_id: string;
  nome_produto: string;
  tipo: 'sal_mineral' | 'proteinado' | 'racao_terminacao';
  peso_saco_padrao_kg: number;
}

export interface LeituraCochoRecord {
  leitura_id: string;
  pasto_id: string;
  lote_id?: string;
  produto_id: string;
  escore_cocho: number;
  sacos_fornecidos: number;
  peso_saco_kg: number;
  cocho_limpo: boolean;
  foto_attachment_id?: string;
  justificativa_falha_qr?: string;
  observacao?: string;
  registrado_em: string;
}

export interface LeituraQrRecord {
  leitura_id: string;
  pasto_id: string;
  qr_code_lido: string;
  altura_media_cm: number;
  escore_massa_forragem?: number;
  condicao_aguada?: string;
  condicao_cocho?: string;
  justificativa_falha_qr?: string;
  data_leitura: string;
}

export interface ContagemRecord {
  contagem_id: string;
  pasto_id: string;
  lote_id: string;
  quantidade_cabecas: number;
  quantidade_bezerros: number;
  quantidade_mortos: number;
  causa_mortalidade?: string;
  observacoes?: string;
  data_contagem: string;
}

export interface CapatazConflictItem {
  command: AtomicCommandEnvelope<unknown>;
  detectedAt: string;
  reason: string;
  serverVersion?: number;
}

export interface CapatazState {
  pastos: PastoItem[];
  lotes: LoteItem[];
  produtos: ProdutoNutricaoItem[];
  leiturasCocho: LeituraCochoRecord[];
  leiturasQr: LeituraQrRecord[];
  contagens: ContagemRecord[];
  fotos: Record<string, PhotoMetadata>;
  outbox: AtomicCommandEnvelope<any>[];
  syncedCommands: { command_id: string; synced_at: string; command_type: string }[];
  conflitos: CapatazConflictItem[];
  isLeader: boolean;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  quotaExceededError: string | null;
  baseVersions: Record<string, number>;
  localRevision: number;
}


export function reduceCocho(next: CapatazState, p: LancamentoCochoPayload, c: AtomicCommandEnvelope<unknown>): void {
  next.leiturasCocho.unshift({ leitura_id: `leit-${c.command_id}`, pasto_id: p.pasto_id,
    lote_id: p.lote_id, produto_id: p.produto_id, escore_cocho: p.escore_cocho,
    sacos_fornecidos: p.sacos_fornecidos, peso_saco_kg: p.peso_saco_kg || 25,
    cocho_limpo: p.cocho_limpo ?? true, foto_attachment_id: p.foto_attachment_id,
    justificativa_falha_qr: p.justificativa_falha_qr, observacao: p.observacao,
    registrado_em: p.data_fornecimento ?? c.occurred_at_local });
  const pasto = next.pastos.find(pasto => pasto.pasto_id === p.pasto_id);
  if (pasto) pasto.status_cocho = p.escore_cocho === 0 ? 'lambido' : p.escore_cocho <= 2 ? 'limpo' : 'com_sobra';
}
export function reduceQr(next: CapatazState, p: LeituraPastoPayload, c: AtomicCommandEnvelope<unknown>): void {
  next.leiturasQr.unshift({ leitura_id: `qr-leit-${c.command_id}`, pasto_id: p.pasto_id,
    qr_code_lido: p.qr_code_lido, altura_media_cm: p.altura_media_cm,
    escore_massa_forragem: p.escore_massa_forragem, condicao_aguada: p.condicao_aguada,
    condicao_cocho: p.condicao_cocho, justificativa_falha_qr: p.justificativa_falha_qr,
    data_leitura: p.data_leitura });
  const pasto = next.pastos.find(pasto => pasto.pasto_id === p.pasto_id);
  if (pasto) pasto.altura_media_cm = p.altura_media_cm;
}
export function reduceContagem(next: CapatazState, p: ContagemRebanhoPayload, c: AtomicCommandEnvelope<unknown>): void {
  next.contagens.unshift({ contagem_id: `cont-${c.command_id}`, pasto_id: p.pasto_id,
    lote_id: p.lote_id, quantidade_cabecas: p.quantidade_cabecas,
    quantidade_bezerros: p.quantidade_bezerros || 0, quantidade_mortos: p.quantidade_mortos || 0,
    causa_mortalidade: p.causa_mortalidade, observacoes: p.observacoes, data_contagem: p.data_contagem });
  const lote = next.lotes.find(lote => lote.lote_id === p.lote_id);
  if (lote) lote.quantidade_cabecas = p.quantidade_cabecas;
}
export function reduceFoto(next: CapatazState, p: FotoCochoPayload): void {
  if (!p.photo_metadata) throw new Error('PHOTO_METADATA_REQUIRED');
  next.fotos[p.foto_attachment_id] = { ...p.photo_metadata, attachment_id: p.foto_attachment_id, dataUrl: '' };
}

const definitions: Record<string, CommandDefinition> = {
  'capataz.cocho.registrar_escore': { moduleId: 'capataz', aggregateType: 'cocho', idField: 'pasto_id', apply: (state, payload, command) => reduceCocho(state as CapatazState, payload as Parameters<typeof reduceCocho>[1], command) },
  'capataz.pasto.leitura_qr': { moduleId: 'capataz', aggregateType: 'pasto', idField: 'pasto_id', apply: (state, payload, command) => reduceQr(state as CapatazState, payload as Parameters<typeof reduceQr>[1], command) },
  'capataz.animais.contagem': { moduleId: 'capataz', aggregateType: 'lote', idField: 'lote_id', apply: (state, payload, command) => reduceContagem(state as CapatazState, payload as Parameters<typeof reduceContagem>[1], command) },
  'capataz.cocho.foto_adicionar': { moduleId: 'capataz', aggregateType: 'cocho', idField: 'pasto_id', apply: (state, payload, command) => reduceFoto(state as CapatazState, payload as Parameters<typeof reduceFoto>[1]) },
};
const aliases: Record<string, string> = {"capataz.salga.lancar": "capataz.cocho.registrar_escore", "lancamento_cocho": "capataz.cocho.registrar_escore", "contagem_rebanho": "capataz.animais.contagem", "leitura_pasto": "capataz.pasto.leitura_qr"};
export const SUPPORTED_COMMANDS: readonly string[] = Object.freeze([...Object.keys(definitions), ...Object.keys(aliases)]);
const apply = createModuleProjection('capataz', definitions, aliases);
export function applyModuleCommand<T extends object>(moduleId: 'capataz', current: T, command: AtomicCommandEnvelope<unknown>): T { return apply(current, command); }
