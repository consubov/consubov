/**
 * Store Durável Particionado do Módulo Capataz (Local-First + Offline)
 * Particionado estritamente pela chave canônica:
 *   ${tenantId}:${userId}:${fazendaId}:${profileId}
 * Gerencia pastos, cochos, lotes, fotos locais dissociadas, contagens,
 * outbox append-only com Web Locks, Circuit Breaker e resolução de conflitos sem LWW.
 */

import {
  AtomicCommandEnvelope,
  AttachmentRef,
  LancamentoCochoPayload,
  ContagemRebanhoPayload,
  LeituraPastoPayload,
  FotoCochoPayload,
  UserProfileId,
  ProductId
} from '@consubov/contracts';
import {
  startLeaderElection,
  LeaderElectionController
} from '../sync/outboxLeader';
import {
  createSyncMessagingChannel,
  SyncChannelController,
  SyncMessage
} from '../sync/syncMessaging';
import {
  SyncCircuitBreaker,
  CircuitState
} from '../sync/circuitBreaker';
import {
  CompressedPhotoResult
} from '../sync/photoCompression';
import {
  resolveDomainConflict
} from '../sync/conflictResolver';

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
  command: AtomicCommandEnvelope<any>;
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
  fotos: Record<string, CompressedPhotoResult>;
  outbox: AtomicCommandEnvelope<any>[];
  syncedCommands: { command_id: string; synced_at: string; command_type: string }[];
  conflitos: CapatazConflictItem[];
  isLeader: boolean;
  circuitState: CircuitState;
  quotaExceededError: string | null;
  baseVersions: Record<string, number>;
}

export class StorageQuotaExceededError extends Error {
  constructor(message = 'Quota de armazenamento local excedida. Libere espaço no dispositivo.') {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

export class CapatazStore {
  private partitionKey: string;
  private storageKey: string;
  private state: CapatazState;
  private leaderController: LeaderElectionController | null = null;
  private syncChannel: SyncChannelController | null = null;
  private circuitBreaker: SyncCircuitBreaker;
  private listeners: Set<() => void> = new Set();
  private simulateQuotaFailure = false;

  constructor(partitionKey = 'consubov:tenant-default:user-capataz:fazenda-01:capataz') {
    this.partitionKey = partitionKey;
    this.storageKey = `consubov:capataz:${partitionKey}`;
    this.circuitBreaker = new SyncCircuitBreaker({
      failureThreshold: 1,
      cooldownPeriodMs: 15000,
      onStateChange: (newState) => {
        this.state.circuitState = newState;
        this.notify();
      }
    });

    this.state = this.loadInitialState();
    this.initCrossTabCoordination();
  }

  private initCrossTabCoordination() {
    // 1. Eleição de Líder via Web Locks
    this.leaderController = startLeaderElection(this.partitionKey, (isLeader) => {
      this.state.isLeader = isLeader;
      this.notify();
    });

    // 2. Canal de Mensageria Cross-Tab via BroadcastChannel
    this.syncChannel = createSyncMessagingChannel(this.partitionKey);
    this.syncChannel.onMessage((msg: SyncMessage) => {
      if (msg.type === 'OUTBOX_UPDATED' || msg.type === 'SYNC_COMPLETED') {
        // Recarrega estado persistido por outra aba
        const refreshed = this.loadFromStorage();
        if (refreshed) {
          this.state = {
            ...refreshed,
            isLeader: this.state.isLeader,
            circuitState: this.circuitBreaker.getState()
          };
          this.notify();
        }
      }
    });
  }

  private loadInitialState(): CapatazState {
    const loaded = this.loadFromStorage();
    if (loaded) {
      return loaded;
    }

    return {
      pastos: [
        {
          pasto_id: 'pasto-01',
          nome_pasto: 'Pasto 01 - Mombaça Sede',
          setor: 'Sede',
          qr_code_esperado: 'PASTO-01-MOMBACA-SEDE',
          lote_id: 'lote-recria-01',
          lote_nome: 'Lote Recria 01 (Nelore)',
          cocho_id: 'cocho-pasto-01',
          status_cocho: 'limpo',
          altura_media_cm: 65
        },
        {
          pasto_id: 'pasto-02',
          nome_pasto: 'Pasto 02 - Braquiária Baixada',
          setor: 'Baixada',
          qr_code_esperado: 'PASTO-02-BRAQUIARIA-BX',
          lote_id: 'lote-terminacao-02',
          lote_nome: 'Lote Terminação 02 (Cruzamento Industrial)',
          cocho_id: 'cocho-pasto-02',
          status_cocho: 'com_sobra',
          altura_media_cm: 38
        },
        {
          pasto_id: 'pasto-03',
          nome_pasto: 'Pasto 03 - Piatã Piquete Sul',
          setor: 'Retiro Sul',
          qr_code_esperado: 'PASTO-03-PIATA-SUL',
          lote_id: 'lote-novilhas-03',
          lote_nome: 'Lote Novilhas 03 (Fêmeas Precoces)',
          cocho_id: 'cocho-pasto-03',
          status_cocho: 'limpo',
          altura_media_cm: 45
        },
        {
          pasto_id: 'pasto-04',
          nome_pasto: 'Pasto 04 - Mombaça Confinamento',
          setor: 'Confinamento',
          qr_code_esperado: 'PASTO-04-MOMBACA-CONF',
          lote_id: 'lote-boi-gordo-04',
          lote_nome: 'Lote Boi Gordo 04 (Giro Rápido)',
          cocho_id: 'cocho-pasto-04',
          status_cocho: 'limpo',
          altura_media_cm: 72
        }
      ],
      lotes: [
        {
          lote_id: 'lote-recria-01',
          nome_lote: 'Lote Recria 01 (Nelore)',
          categoria: 'Garrotes Nelore',
          quantidade_cabecas: 120,
          peso_medio_kg: 345
        },
        {
          lote_id: 'lote-terminacao-02',
          nome_lote: 'Lote Terminação 02 (Cruzamento Industrial)',
          categoria: 'Bois Angus x Nelore',
          quantidade_cabecas: 95,
          peso_medio_kg: 480
        },
        {
          lote_id: 'lote-novilhas-03',
          nome_lote: 'Lote Novilhas 03 (Fêmeas Precoces)',
          categoria: 'Novilhas Nelore',
          quantidade_cabecas: 80,
          peso_medio_kg: 310
        },
        {
          lote_id: 'lote-boi-gordo-04',
          nome_lote: 'Lote Boi Gordo 04 (Giro Rápido)',
          categoria: 'Boi Gordo 18+',
          quantidade_cabecas: 110,
          peso_medio_kg: 535
        }
      ],
      produtos: [
        {
          produto_id: 'prod-sal-mineral-80',
          nome_produto: 'Sal Mineral Fosfatado 80',
          tipo: 'sal_mineral',
          peso_saco_padrao_kg: 25
        },
        {
          produto_id: 'prod-proteinado-aguas',
          nome_produto: 'Suplemento Proteinado Águas 0.1%',
          tipo: 'proteinado',
          peso_saco_padrao_kg: 30
        },
        {
          produto_id: 'prod-racao-terminacao-22',
          nome_produto: 'Ração de Terminação Alta Energia 22%',
          tipo: 'racao_terminacao',
          peso_saco_padrao_kg: 40
        }
      ],
      leiturasCocho: [],
      leiturasQr: [],
      contagens: [],
      fotos: {},
      outbox: [],
      syncedCommands: [],
      conflitos: [],
      isLeader: false,
      circuitState: 'CLOSED',
      quotaExceededError: null,
      baseVersions: {
        'pasto-01': 1,
        'pasto-02': 1,
        'pasto-03': 1,
        'pasto-04': 1
      }
    };
  }

  private loadFromStorage(): CapatazState | null {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch {
        // Fallback
      }
    }
    return null;
  }

  private saveToStorage(): void {
    if (this.simulateQuotaFailure) {
      this.state.quotaExceededError = 'StorageQuotaExceededError: Espaço de disco local esgotado (LF-003).';
      this.notify();
      throw new StorageQuotaExceededError('Erro simulado de quota de armazenamento local esgotada.');
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.state));
        this.state.quotaExceededError = null;
      } catch (err: any) {
        if (
          err?.name === 'QuotaExceededError' ||
          err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err?.message?.includes('quota')
        ) {
          this.state.quotaExceededError = 'StorageQuotaExceededError: Limite de armazenamento local atingido.';
          this.notify();
          throw new StorageQuotaExceededError();
        }
      }
    }
  }

  getState(): CapatazState {
    return this.state;
  }

  getPartitionKey(): string {
    return this.partitionKey;
  }

  getCircuitBreaker(): SyncCircuitBreaker {
    return this.circuitBreaker;
  }

  isLeader(): boolean {
    return this.state.isLeader;
  }

  injectQuotaFailure(shouldFail = true): void {
    this.simulateQuotaFailure = shouldFail;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch {
        // Silencia erros de listeners
      }
    });
  }

  private parsePartitionClaims() {
    const parts = this.partitionKey.split(':');
    return {
      tenant_id: parts[0] || 'tenant-default',
      user_id: parts[1] || 'user-capataz',
      fazenda_id: parts[2] || 'fazenda-01',
      profile_id: (parts[3] || 'capataz') as UserProfileId
    };
  }

  private createEnvelope<T>(
    commandType: string,
    aggregateType: string,
    aggregateId: string,
    payload: T,
    attachmentRefs: AttachmentRef[] = []
  ): AtomicCommandEnvelope<T> {
    const claims = this.parsePartitionClaims();
    const currentVersion = this.state.baseVersions[aggregateId] ?? 1;
    const commandId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const idempotencyKey = `idemp-${commandId}-${Date.now()}`;
    const now = new Date().toISOString();

    const envelope: AtomicCommandEnvelope<T> = {
      command_id: commandId,
      idempotency_key: idempotencyKey,
      command_type: commandType,
      aggregate_type: aggregateType,
      aggregate_id: aggregateId,
      base_version: currentVersion,
      user_id: claims.user_id,
      tenant_id: claims.tenant_id,
      product_id: 'consubov' as ProductId,
      fazenda_id: claims.fazenda_id,
      retiro_id: null,
      profile_id: claims.profile_id,
      device_id: 'device-capataz-pwa',
      schema_version: 1,
      payload,
      correlation_id: commandId,
      attachment_refs: attachmentRefs,
      occurred_at_local: now,
      status: 'PENDENTE',
      attempts: 0,
      last_attempt_at: null,
      error_message: null
    };

    this.state.baseVersions[aggregateId] = currentVersion + 1;
    this.state.outbox.push(envelope);
    return envelope;
  }

  /**
   * 1. REGISTRAR RONDA / LEITURA DE COCHO
   */
  registrarLeituraCocho(params: {
    pasto_id: string;
    lote_id?: string;
    produto_id: string;
    escore_cocho: number;
    sacos_fornecidos: number;
    peso_saco_kg?: number;
    cocho_limpo?: boolean;
    foto_attachment_id?: string;
    justificativa_falha_qr?: string;
    observacao?: string;
  }): { envelope: AtomicCommandEnvelope<LancamentoCochoPayload>; leitura: LeituraCochoRecord } {
    const now = new Date().toISOString();

    const payload: LancamentoCochoPayload = {
      pasto_id: params.pasto_id,
      lote_id: params.lote_id,
      produto_id: params.produto_id,
      escore_cocho: params.escore_cocho,
      sacos_fornecidos: params.sacos_fornecidos,
      peso_saco_kg: params.peso_saco_kg || 25,
      cocho_limpo: params.cocho_limpo,
      foto_attachment_id: params.foto_attachment_id,
      justificativa_falha_qr: params.justificativa_falha_qr,
      data_fornecimento: now,
      observacao: params.observacao
    };

    const attachmentRefs: AttachmentRef[] = [];
    if (params.foto_attachment_id) {
      attachmentRefs.push({
        attachment_id: params.foto_attachment_id,
        mime_type: 'image/jpeg',
        size_bytes: 150000,
        hash_sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        local_blob_ref: `local-blob-${params.foto_attachment_id}`
      });
    }

    const envelope = this.createEnvelope<LancamentoCochoPayload>(
      'capataz.cocho.registrar_escore',
      'cocho',
      params.pasto_id,
      payload,
      attachmentRefs
    );

    const leitura: LeituraCochoRecord = {
      leitura_id: `leit-${Date.now()}`,
      pasto_id: params.pasto_id,
      lote_id: params.lote_id,
      produto_id: params.produto_id,
      escore_cocho: params.escore_cocho,
      sacos_fornecidos: params.sacos_fornecidos,
      peso_saco_kg: params.peso_saco_kg || 25,
      cocho_limpo: params.cocho_limpo ?? true,
      foto_attachment_id: params.foto_attachment_id,
      justificativa_falha_qr: params.justificativa_falha_qr,
      observacao: params.observacao,
      registrado_em: now
    };

    this.state.leiturasCocho.unshift(leitura);

    // Atualiza status do pasto local
    const pasto = this.state.pastos.find(p => p.pasto_id === params.pasto_id);
    if (pasto) {
      pasto.status_cocho = params.escore_cocho === 0 ? 'lambido' : params.escore_cocho <= 2 ? 'limpo' : 'com_sobra';
    }

    this.saveToStorage();
    this.syncChannel?.postMessage('OUTBOX_UPDATED', { pendingCount: this.state.outbox.length, command_id: envelope.command_id });
    this.notify();

    return { envelope, leitura };
  }

  /**
   * 2. REGISTRAR LEITURA DE QR CODE DE PASTO
   */
  registrarLeituraQrPasto(params: {
    pasto_id: string;
    altura_media_cm: number;
    qr_code_lido: string;
    escore_massa_forragem?: number;
    condicao_aguada?: 'otima' | 'boa' | 'regular' | 'ruim' | 'seca';
    condicao_cocho?: 'otimo' | 'bom' | 'danificado' | 'precisa_reparo';
    justificativa_falha_qr?: string;
    foto_attachment_id?: string;
  }): { envelope: AtomicCommandEnvelope<LeituraPastoPayload>; leitura: LeituraQrRecord } {
    const now = new Date().toISOString();

    const payload: LeituraPastoPayload = {
      pasto_id: params.pasto_id,
      altura_media_cm: params.altura_media_cm,
      escore_massa_forragem: params.escore_massa_forragem || 3,
      condicao_aguada: params.condicao_aguada || 'boa',
      condicao_cocho: params.condicao_cocho || 'bom',
      qr_code_lido: params.qr_code_lido,
      data_leitura: now,
      foto_attachment_id: params.foto_attachment_id
    };

    const attachmentRefs: AttachmentRef[] = [];
    if (params.foto_attachment_id) {
      attachmentRefs.push({
        attachment_id: params.foto_attachment_id,
        mime_type: 'image/jpeg',
        size_bytes: 150000,
        hash_sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        local_blob_ref: `local-blob-${params.foto_attachment_id}`
      });
    }

    const envelope = this.createEnvelope<LeituraPastoPayload>(
      'capataz.pasto.leitura_qr',
      'pasto',
      params.pasto_id,
      payload,
      attachmentRefs
    );

    const leitura: LeituraQrRecord = {
      leitura_id: `qr-leit-${Date.now()}`,
      pasto_id: params.pasto_id,
      qr_code_lido: params.qr_code_lido,
      altura_media_cm: params.altura_media_cm,
      escore_massa_forragem: params.escore_massa_forragem,
      condicao_aguada: params.condicao_aguada,
      condicao_cocho: params.condicao_cocho,
      justificativa_falha_qr: params.justificativa_falha_qr,
      data_leitura: now
    };

    this.state.leiturasQr.unshift(leitura);

    const pasto = this.state.pastos.find(p => p.pasto_id === params.pasto_id);
    if (pasto) {
      pasto.altura_media_cm = params.altura_media_cm;
    }

    this.saveToStorage();
    this.syncChannel?.postMessage('OUTBOX_UPDATED', { pendingCount: this.state.outbox.length, command_id: envelope.command_id });
    this.notify();

    return { envelope, leitura };
  }

  /**
   * 3. REGISTRAR CONTAGEM DE REBANHO
   */
  registrarContagemRebanho(params: {
    pasto_id: string;
    lote_id: string;
    quantidade_cabecas: number;
    quantidade_bezerros?: number;
    quantidade_mortos?: number;
    causa_mortalidade?: string;
    observacoes?: string;
  }): { envelope: AtomicCommandEnvelope<ContagemRebanhoPayload>; contagem: ContagemRecord } {
    const now = new Date().toISOString();

    const payload: ContagemRebanhoPayload = {
      pasto_id: params.pasto_id,
      lote_id: params.lote_id,
      quantidade_cabecas: params.quantidade_cabecas,
      quantidade_bezerros: params.quantidade_bezerros || 0,
      quantidade_mortos: params.quantidade_mortos || 0,
      causa_mortalidade: params.causa_mortalidade,
      data_contagem: now,
      observacoes: params.observacoes
    };

    const envelope = this.createEnvelope<ContagemRebanhoPayload>(
      'capataz.animais.contagem',
      'lote',
      params.lote_id,
      payload
    );

    const contagem: ContagemRecord = {
      contagem_id: `cont-${Date.now()}`,
      pasto_id: params.pasto_id,
      lote_id: params.lote_id,
      quantidade_cabecas: params.quantidade_cabecas,
      quantidade_bezerros: params.quantidade_bezerros || 0,
      quantidade_mortos: params.quantidade_mortos || 0,
      causa_mortalidade: params.causa_mortalidade,
      observacoes: params.observacoes,
      data_contagem: now
    };

    this.state.contagens.unshift(contagem);

    const lote = this.state.lotes.find(l => l.lote_id === params.lote_id);
    if (lote) {
      lote.quantidade_cabecas = params.quantidade_cabecas;
    }

    this.saveToStorage();
    this.syncChannel?.postMessage('OUTBOX_UPDATED', { pendingCount: this.state.outbox.length, command_id: envelope.command_id });
    this.notify();

    return { envelope, contagem };
  }

  /**
   * 4. ANEXAR FOTO DE COCHO DISSOCIADA
   */
  anexarFotoCocho(photo: CompressedPhotoResult): { envelope: AtomicCommandEnvelope<FotoCochoPayload> } {
    const now = new Date().toISOString();

    // 1. Armazena a imagem comprimida no store de fotos local
    this.state.fotos[photo.attachment_id] = photo;

    // 2. Cria comando de metadados dissociado
    const payload: FotoCochoPayload = {
      pasto_id: photo.pastoId || 'pasto-01',
      cocho_id: photo.cochoId || 'cocho-pasto-01',
      foto_attachment_id: photo.attachment_id,
      tipo_registro: (photo.tipoRegistro as any) || 'leitura_matutina',
      escore_estimado: 2,
      registrado_em: now
    };

    const attachmentRefs: AttachmentRef[] = [
      {
        attachment_id: photo.attachment_id,
        mime_type: photo.mimeType,
        size_bytes: photo.compressedSizeBytes,
        hash_sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        local_blob_ref: `local-blob-${photo.attachment_id}`
      }
    ];

    const envelope = this.createEnvelope<FotoCochoPayload>(
      'capataz.cocho.foto_adicionar',
      'cocho',
      photo.pastoId || 'pasto-01',
      payload,
      attachmentRefs
    );

    this.saveToStorage();
    this.syncChannel?.postMessage('OUTBOX_UPDATED', { pendingCount: this.state.outbox.length, command_id: envelope.command_id });
    this.notify();

    return { envelope };
  }

  /**
   * 5. SINCRONIZAR FILA OUTBOX (COM WEB LOCKS E CIRCUIT BREAKER)
   */
  async sincronizarFila(
    apiEndpoint = '/api/v1/commands',
    fetchFn?: typeof fetch
  ): Promise<{ syncedCount: number; errorsCount: number; conflictCount: number }> {
    // 1. Proteção: Apenas a aba Líder sincroniza
    if (!this.state.isLeader) {
      return { syncedCount: 0, errorsCount: 0, conflictCount: 0 };
    }

    // 2. Proteção: Circuit Breaker
    if (!this.circuitBreaker.canAttemptSync()) {
      return { syncedCount: 0, errorsCount: 1, conflictCount: 0 };
    }

    const actualFetch = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!actualFetch) {
      return { syncedCount: 0, errorsCount: 0, conflictCount: 0 };
    }

    let syncedCount = 0;
    let errorsCount = 0;
    let conflictCount = 0;

    this.syncChannel?.postMessage('SYNC_STARTED', { pendingCount: this.state.outbox.length });

    const commandsQueue = [...this.state.outbox];

    for (const cmd of commandsQueue) {
      try {
        const response = await actualFetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer mock-token-${this.partitionKey}`
          },
          body: JSON.stringify(cmd)
        });

        if (response.ok) {
          // Sucesso 200 OK
          this.state.outbox = this.state.outbox.filter(c => c.command_id !== cmd.command_id);
          this.state.syncedCommands.unshift({
            command_id: cmd.command_id,
            synced_at: new Date().toISOString(),
            command_type: cmd.command_type
          });
          syncedCount += 1;
          this.circuitBreaker.recordSuccess();
        } else if (response.status === 409) {
          // Conflito de Concorrência OCC 409
          conflictCount += 1;
          const conflictData = await response.json().catch(() => ({}));
          const resolution = resolveDomainConflict(cmd, {
            statusCode: 409,
            serverAggregateVersion: conflictData.server_version,
            message: conflictData.message
          });

          if (resolution.strategy === 'ADDITIVE_MERGE' && resolution.resolved) {
            // Merge Aditivo para Cocho: resolvido automaticamente sem LWW
            this.state.outbox = this.state.outbox.filter(c => c.command_id !== cmd.command_id);
            this.state.syncedCommands.unshift({
              command_id: cmd.command_id,
              synced_at: new Date().toISOString(),
              command_type: cmd.command_type
            });
            syncedCount += 1;
          } else {
            // OCC físico: move para lista de conflitos retidos
            this.state.outbox = this.state.outbox.filter(c => c.command_id !== cmd.command_id);
            this.state.conflitos.push({
              command: cmd,
              detectedAt: new Date().toISOString(),
              reason: resolution.message,
              serverVersion: conflictData.server_version
            });
            this.syncChannel?.postMessage('CONFLICT_DETECTED', {
              commandId: cmd.command_id,
              error: resolution.message
            });
          }
        } else if (response.status >= 500 || response.status === 0) {
          // Falha do servidor ou rede: aciona Circuit Breaker e interrompe drenagem imediatamente
          errorsCount += 1;
          this.circuitBreaker.recordFailure({ status: response.status, message: 'Falha na resposta do servidor' });
          break; // INTERROMPE O LOOP NO PRIMEIRO ERRO
        } else {
          // Erro de cliente 4xx
          errorsCount += 1;
        }
      } catch (err: any) {
        // Falha de rede / timeout: aciona Circuit Breaker e interrompe drenagem imediatamente
        errorsCount += 1;
        this.circuitBreaker.recordFailure(err);
        break; // INTERROMPE O LOOP NO PRIMEIRO ERRO
      }
    }

    this.saveToStorage();
    this.syncChannel?.postMessage('SYNC_COMPLETED', { syncedCount });
    this.notify();

    return { syncedCount, errorsCount, conflictCount };
  }

  /**
   * 6. RESOLUÇÃO EXPLÍCITA DE CONFLITO OCC (DECISÃO DO USUÁRIO)
   */
  resolverConflito(commandId: string, decisao: 'manter_local' | 'aceitar_servidor'): void {
    const conflictIndex = this.state.conflitos.findIndex(c => c.command.command_id === commandId);
    if (conflictIndex === -1) return;

    const item = this.state.conflitos[conflictIndex];
    if (!item) return;

    if (decisao === 'manter_local') {
      // Re-enfileira na outbox com base_version atualizada
      const recalculated: AtomicCommandEnvelope<any> = {
        ...item.command,
        base_version: (item.serverVersion ?? 1) + 1,
        idempotency_key: `${item.command.idempotency_key}-recalc-${Date.now()}`
      };
      this.state.outbox.push(recalculated);
    }

    // Remove da lista de conflitos pendentes
    this.state.conflitos.splice(conflictIndex, 1);
    this.saveToStorage();
    this.notify();
  }

  destroy(): void {
    this.leaderController?.release();
    this.syncChannel?.close();
    this.listeners.clear();
  }
}

// Singleton Map de stores por partição
const storesMap: Map<string, CapatazStore> = new Map();

export function getCapatazStore(
  partitionKey = 'consubov:tenant-default:user-capataz:fazenda-01:capataz'
): CapatazStore {
  if (!storesMap.has(partitionKey)) {
    storesMap.set(partitionKey, new CapatazStore(partitionKey));
  }
  return storesMap.get(partitionKey)!;
}

export function resetCapatazStoresForTesting(): void {
  storesMap.forEach(s => s.destroy());
  storesMap.clear();
}
