import { applyModuleCommand } from '@consubov/domain-projection/capataz';
/**
 * Store Durável Particionado do Módulo Capataz (Local-First + Offline)
 * Particionado pelo ModuleExecutionContext e pelo LocalDataAPI autorizado do Shell.
 * Gerencia pastos, cochos, lotes, fotos locais dissociadas, contagens,
 * outbox append-only com Web Locks, Circuit Breaker e resolução de conflitos sem LWW.
 */

import {
  AtomicCommandEnvelope,
  LancamentoCochoPayload,
  ContagemRebanhoPayload,
  LeituraPastoPayload,
  FotoCochoPayload,
  type AttachmentRef,
  type LocalMutation,
  type ModuleExecutionContext,
  type ModuleLocalDataAPI
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
  localRevision: number;
}

export class StorageQuotaExceededError extends Error {
  constructor(message = 'Quota de armazenamento local excedida. Libere espaço no dispositivo.') {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

export class CapatazStore {
  private partitionKey: string;
  private context: ModuleExecutionContext;
  private localData: ModuleLocalDataAPI;
  private state: CapatazState;
  private mutationQueue: Promise<void> = Promise.resolve();
  public readonly ready: Promise<void>;
  private hydrationFailed = false;
  private leaderController: LeaderElectionController | null = null;
  private syncChannel: SyncChannelController | null = null;
  private circuitBreaker: SyncCircuitBreaker;
  private listeners: Set<() => void> = new Set();
  private simulateQuotaFailure = false;

  constructor(context: ModuleExecutionContext, localData: ModuleLocalDataAPI) {
    this.context = context;
    this.localData = localData;
    this.partitionKey = getCapatazPartitionKey(context);
    this.circuitBreaker = new SyncCircuitBreaker({
      failureThreshold: 1,
      cooldownPeriodMs: 15000,
      onStateChange: (newState) => {
        this.state.circuitState = newState;
        this.notify();
      }
    });

    this.state = this.createInitialState();
    this.ready = this.hydrate().catch(error => {
      this.reportStorageError(error);
      throw error;
    });
    // Keep the rejection available to callers without letting a startup read failure
    // become an unhandled rejection before the view or first mutation awaits `ready`.
    void this.ready.catch(() => undefined);
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
        // Queue cross-tab reads with local writes so an older snapshot cannot replace
        // state committed by a mutation in this tab.
        this.enqueueHydration();
      }
    });
  }

  private enqueueHydration(): void {
    const operation = this.mutationQueue.then(async () => {
      await this.ready;
      await this.hydrate();
    });
    this.mutationQueue = operation.then(
      () => undefined,
      error => {
        this.reportStorageError(error);
      }
    );
  }

  private createInitialState(): CapatazState {
    return {
      pastos: [], lotes: [], produtos: [], leiturasCocho: [], leiturasQr: [], contagens: [], fotos: {},
      outbox: [], syncedCommands: [], conflitos: [], isLeader: false, circuitState: 'CLOSED',
      quotaExceededError: null, localRevision: 0, baseVersions: {}
    };
  }

  private async hydrate(): Promise<void> {
    try {
      const [snapshots, pending] = await Promise.all([
        this.localData.listSnapshots(),
        this.localData.listPendingCommands(500)
      ]);
      const loaded = snapshots
        .map(snapshot => snapshot.data as Partial<CapatazState>)
        .filter((data): data is CapatazState => Array.isArray(data.pastos) && Array.isArray(data.lotes) && Array.isArray(data.produtos) &&
          Array.isArray(data.leiturasCocho) && Array.isArray(data.leiturasQr) && Array.isArray(data.contagens) &&
          Array.isArray(data.syncedCommands) && Array.isArray(data.conflitos) &&
          Boolean(data.fotos && typeof data.fotos === 'object') && Boolean(data.baseVersions && typeof data.baseVersions === 'object') && Number.isSafeInteger(data.localRevision) && Number(data.localRevision) >= 0)
        .sort((a, b) => b.localRevision - a.localRevision)[0];
      if (loaded && Array.isArray(loaded.pastos) && Array.isArray(loaded.lotes)) {
        const fotos = { ...loaded.fotos };
        for (const [attachmentId, metadata] of Object.entries(fotos)) {
          const stored = await this.localData.readAttachment(attachmentId);
          if (!stored) throw new Error(`Foto ${attachmentId} referencia um anexo ausente no armazenamento local.`);
          fotos[attachmentId] = { ...metadata, blob: stored.blob, dataUrl: '' };
        }
        this.state = {
          ...this.state,
          ...loaded,
          fotos,
          outbox: pending.map(item => item.command),
          isLeader: this.state.isLeader,
          circuitState: this.circuitBreaker.getState(),
          quotaExceededError: null
        };
      } else {
        throw new Error('Dados locais ausentes ou inválidos. Conecte-se e autentique-se novamente para preparar o aplicativo.');
      }
      this.notify();
      this.hydrationFailed = false;
    } catch (error) {
      this.hydrationFailed = true;
      this.state = this.createInitialState();
      this.notify();
      throw error;
    }
  }

  private async commitCommand<T>(command: AtomicCommandEnvelope<T>, attachments: LocalMutation<T>['attachments'] = []): Promise<void> {
    if (this.simulateQuotaFailure) throw new StorageQuotaExceededError('Erro simulado de quota de armazenamento local esgotada.');
    const { fotos, ...snapshotState } = this.state;
    const persistedPhotos = Object.fromEntries(Object.entries(fotos).map(([id, photo]) => {
      const { blob: _blob, dataUrl: _dataUrl, ...metadata } = photo;
      return [id, metadata];
    }));
    const persistedState = { ...snapshotState, fotos: persistedPhotos, outbox: [] };
    const mutation: LocalMutation<T> = {
      expectedModuleRevision: this.state.localRevision - 1,
      command,
      snapshot: {
        aggregateType: command.aggregate_type,
        aggregateId: command.aggregate_id,
        version: command.base_version + 1,
        data: persistedState,
        modifiedAt: command.occurred_at_local
      },
      attachments
    };
    await this.localData.commitMutation(mutation);
  }

  private reportStorageError(error: unknown): void {
    const name = error instanceof Error ? error.name : 'LocalDataError';
    const message = error instanceof Error ? error.message : String(error);
    const quotaFailure = name === 'QuotaExceededError' || name === 'StorageQuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(message);
    this.state.quotaExceededError = quotaFailure
      ? `StorageQuotaExceededError: ${message || 'Limite de armazenamento local atingido.'}`
      : `Falha ao salvar dados locais (${name}): ${message}`;
    this.notify();
  }

  private mutate<T, P>(action: () => Promise<{ result: T; command: AtomicCommandEnvelope<P>; attachments?: LocalMutation<P>['attachments'] }> | { result: T; command: AtomicCommandEnvelope<P>; attachments?: LocalMutation<P>['attachments'] }): Promise<T> {
    const operation = this.mutationQueue.then(async () => {
      await this.ready;
      if (this.hydrationFailed) throw new Error('Dados locais indisponíveis; alteração não gravada.');
      const previous = this.state;
      this.state = structuredClone(previous);
      try {
        const mutation = await action();
        this.state.localRevision = previous.localRevision + 1;
        await this.commitCommand(mutation.command, mutation.attachments as LocalMutation<P>['attachments'] | undefined);
        this.state.quotaExceededError = null;
        this.notify();
        this.syncChannel?.postMessage('OUTBOX_UPDATED', { pendingCount: this.state.outbox.length, command_id: mutation.command.command_id });
        return mutation.result;
      } catch (error) {
        this.state = previous;
        if (error instanceof Error && /Estado local desatualizado/.test(error.message)) await this.hydrate();
        this.reportStorageError(error);
        throw error;
      }
    });
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
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

  public refreshFromLocalData(): Promise<void> {
    const operation = this.mutationQueue.then(() => this.hydrate());
    this.mutationQueue = operation.then(() => undefined, () => undefined);
    return operation;
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
    return {
      tenant_id: this.context.tenantId,
      user_id: this.context.userId,
      fazenda_id: this.context.farmId,
      profile_id: this.context.profileId
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
      product_id: this.context.productId,
      fazenda_id: claims.fazenda_id,
      retiro_id: this.context.retreatId,
      profile_id: claims.profile_id,
      device_id: this.context.deviceId,
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
  }): Promise<{ envelope: AtomicCommandEnvelope<LancamentoCochoPayload>; leitura: LeituraCochoRecord }> {
    return this.mutate(async () => {
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

    const storedAttachment = params.foto_attachment_id ? await this.localData.readAttachment(params.foto_attachment_id) : null;
    if (params.foto_attachment_id && !storedAttachment) throw new Error('A foto vinculada não está disponível no armazenamento local.');
    const attachmentRefs: AttachmentRef[] = storedAttachment ? [storedAttachment.ref] : [];

    const envelope = this.createEnvelope<LancamentoCochoPayload>(
      'capataz.cocho.registrar_escore',
      'cocho',
      params.pasto_id,
      payload,
      attachmentRefs
    );

    this.state = applyModuleCommand('capataz', this.state, envelope);
    const leitura = this.state.leiturasCocho[0]!;

    return {
      result: { envelope, leitura },
      command: envelope,
      attachments: storedAttachment ? [{ ref: storedAttachment.ref, blob: storedAttachment.blob }] : []
    };
    });
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
  }): Promise<{ envelope: AtomicCommandEnvelope<LeituraPastoPayload>; leitura: LeituraQrRecord }> {
    return this.mutate(async () => {
    const now = new Date().toISOString();

    const payload: LeituraPastoPayload = {
      pasto_id: params.pasto_id,
      altura_media_cm: params.altura_media_cm,
      escore_massa_forragem: params.escore_massa_forragem || 3,
      condicao_aguada: params.condicao_aguada || 'boa',
      condicao_cocho: params.condicao_cocho || 'bom',
      qr_code_lido: params.qr_code_lido,
      justificativa_falha_qr: params.justificativa_falha_qr,
      data_leitura: now,
      foto_attachment_id: params.foto_attachment_id
    };

    const storedAttachment = params.foto_attachment_id ? await this.localData.readAttachment(params.foto_attachment_id) : null;
    if (params.foto_attachment_id && !storedAttachment) throw new Error('A foto vinculada não está disponível no armazenamento local.');
    const attachmentRefs: AttachmentRef[] = storedAttachment ? [storedAttachment.ref] : [];

    const envelope = this.createEnvelope<LeituraPastoPayload>(
      'capataz.pasto.leitura_qr',
      'pasto',
      params.pasto_id,
      payload,
      attachmentRefs
    );

    this.state = applyModuleCommand('capataz', this.state, envelope);
    const leitura = this.state.leiturasQr[0]!;

    return {
      result: { envelope, leitura },
      command: envelope,
      attachments: storedAttachment ? [{ ref: storedAttachment.ref, blob: storedAttachment.blob }] : []
    };
    });
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
  }): Promise<{ envelope: AtomicCommandEnvelope<ContagemRebanhoPayload>; contagem: ContagemRecord }> {
    return this.mutate(async () => {
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

    this.state = applyModuleCommand('capataz', this.state, envelope);
    const contagem = this.state.contagens[0]!;

    return { result: { envelope, contagem }, command: envelope };
    });
  }

  /**
   * 4. ANEXAR FOTO DE COCHO DISSOCIADA
   */
  anexarFotoCocho(photo: CompressedPhotoResult): Promise<{ envelope: AtomicCommandEnvelope<FotoCochoPayload> }> {
    return this.mutate(async () => {
    const now = new Date().toISOString();
    if (!photo.blob) throw new Error('A foto comprimida não possui dados binários para armazenamento.');
    const hashBuffer = await crypto.subtle.digest('SHA-256', await photo.blob.arrayBuffer());
    const hashSha256 = Array.from(new Uint8Array(hashBuffer), byte => byte.toString(16).padStart(2, '0')).join('');

    // Binary bytes and durable compression metadata commit with the same command.
    const payload: FotoCochoPayload = {
      pasto_id: photo.pastoId || 'pasto-01',
      cocho_id: photo.cochoId || 'cocho-pasto-01',
      foto_attachment_id: photo.attachment_id,
      photo_metadata: {
        originalSizeBytes: photo.originalSizeBytes, compressedSizeBytes: photo.compressedSizeBytes,
        width: photo.width, height: photo.height, compressionRatioPct: photo.compressionRatioPct,
        mimeType: photo.mimeType, pastoId: photo.pastoId, cochoId: photo.cochoId,
        tipoRegistro: photo.tipoRegistro, createdAt: photo.createdAt
      },
      tipo_registro: (photo.tipoRegistro as any) || 'leitura_matutina',
      escore_estimado: 2,
      registrado_em: now
    };

    const attachmentRefs: AttachmentRef[] = [
      {
        attachment_id: photo.attachment_id,
        mime_type: photo.blob.type || photo.mimeType,
        size_bytes: photo.blob.size,
        hash_sha256: hashSha256,
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

    this.state = applyModuleCommand('capataz', this.state, envelope);
    this.state.fotos[photo.attachment_id]!.blob = photo.blob;
    this.state.fotos[photo.attachment_id]!.dataUrl = photo.dataUrl;
    const attachmentRef = attachmentRefs[0]!;
    return { result: { envelope }, command: envelope, attachments: [{ ref: attachmentRef, blob: photo.blob }] };
    });
  }

  /**
   * 5. SINCRONIZAR FILA OUTBOX (COM WEB LOCKS E CIRCUIT BREAKER)
   */
  async sincronizarFila(
    apiEndpoint = '/api/v1/commands',
    fetchFn?: typeof fetch
  ): Promise<{ syncedCount: number; errorsCount: number; conflictCount: number }> {
    await this.ready;
    await this.mutationQueue;
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
          // A resposta HTTP do módulo não confirma o ACK durável do shell.
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
            // O comando permanece pendente até o ACK persistente do shell.
          } else {
            // A avaliação do conflito não confirma a remoção da outbox local.
            if (!this.state.conflitos.some(item => item.command.command_id === cmd.command_id)) {
              this.state.conflitos.push({
                command: cmd,
                detectedAt: new Date().toISOString(),
                reason: resolution.message,
                serverVersion: conflictData.server_version
              });
            }
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

function getCapatazPartitionKey(context: ModuleExecutionContext): string {
  return JSON.stringify([
    context.productId,
    context.moduleId,
    context.profileId,
    context.userId,
    context.tenantId,
    context.farmId,
    context.retreatId,
    context.deviceId
  ]);
}

export function getCapatazStore(
  context: ModuleExecutionContext,
  localData: ModuleLocalDataAPI
): CapatazStore {
  const partitionKey = getCapatazPartitionKey(context);
  if (!storesMap.has(partitionKey)) {
    storesMap.set(partitionKey, new CapatazStore(context, localData));
  }
  return storesMap.get(partitionKey)!;
}

export function resetCapatazStoresForTesting(): void {
  storesMap.forEach(s => s.destroy());
  storesMap.clear();
}
