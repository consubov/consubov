import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { moduleSeedSnapshot } from '../harness/module-seed';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, captureSourceManifest, nextPlatformDir } from '../harness/workspace-baseline';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { installNetworkGuard, AntiEgressViolationError } from '../harness/network-guard';
import {
  LocalAuthService,
  SYNTHETIC_USERS,
  LAB_DEFAULT_PASSWORD,
  InMemorySessionStorage,
  canAccessModule,
  resolveActiveContext,
  ContextSelectionRequiredError,
  UnauthorizedContextError,
  signSyntheticJwt,
  buildPartitionKey,
  type SyntheticUserSession
} from '@consubov/auth-client';
import {
  atomicCommandEnvelopeSchema,
  ALLOWED_COMMAND_TYPES,
  isAllowedCommand,
  buildIdempotencyKey,
  createSyntheticCommandEnvelope
} from '../harness/synthetic-data';
import {
  CapatazStore,
  resetCapatazStoresForTesting,
  resolveDomainConflict,
  compressPhoto
} from '../../apps/fazenda/capataz/src';
import type { ModuleExecutionContext, ModuleLocalDataAPI, LocalSnapshot, LocalPendingCommand } from '@consubov/contracts';
import {
  ReleaseManager,
  RollbackManager,
  safeDynamicImport,
  isChunkLoadError,
  QuiescenceRegistry,
  ModuleArtifactRelease,
  ModuleArtifactReleaseSchema
} from '@consubov/module-release';
import { UpdateCoordinator } from '../../apps/fazenda/shell/src/pwa/UpdateCoordinator';
import {
  PORTABILITY_INVENTORY,
  getPortabilityItem,
  getApprovedPortabilityItems,
  getBlockedPortabilityItems
} from '../harness/portability-catalog';

const capatazTestPartitions = new Map<string, { snapshots: LocalSnapshot[]; commands: LocalPendingCommand[]; attachments: Map<string, { ref: any; blob: Blob }> }>();
function capatazTestContext(legacyKey: string): ModuleExecutionContext {
  const parts = legacyKey.split(':');
  if (parts[0] === 'consubov') parts.shift();
  const [tenantId, userId, farmId] = parts;
  if (!tenantId || !userId || !farmId) throw new Error(`Invalid test partition key: ${legacyKey}`);
  return { userId, tenantId, farmId, retreatId: null, moduleId: 'capataz', profileId: 'capataz', deviceId: 'device-q8-test', productId: 'consubov' };
}
function newCapatazStore(legacyKey: string): CapatazStore {
  const context = capatazTestContext(legacyKey);
  const key = JSON.stringify([context.productId, context.moduleId, context.userId, context.tenantId, context.farmId, context.retreatId]);
  let partition = capatazTestPartitions.get(key);
  if (!partition) {
    partition = { snapshots: [moduleSeedSnapshot('capataz')], commands: [], attachments: new Map() };
    capatazTestPartitions.set(key, partition);
  }
  const data: ModuleLocalDataAPI = {
    readSnapshot: async () => null,
    listSnapshots: async <T,>() => partition!.snapshots as LocalSnapshot<T>[],
    commitMutation: async mutation => {
      const index = partition!.snapshots.findIndex(snapshot => snapshot.aggregateType === mutation.snapshot.aggregateType && snapshot.aggregateId === mutation.snapshot.aggregateId);
      if (index >= 0) partition!.snapshots.splice(index, 1);
      partition!.snapshots.push(mutation.snapshot);
      partition!.commands.push({ command: mutation.command as unknown as LocalPendingCommand['command'], attachmentRefs: mutation.command.attachment_refs });
      for (const attachment of mutation.attachments) partition!.attachments.set(attachment.ref.attachment_id, attachment);
      return { commandId: mutation.command.command_id, committed: true };
    },
    readAttachment: async attachmentId => partition!.attachments.get(attachmentId) ?? null,
    listPendingCommands: async limit => partition!.commands.slice(0, limit),
    getCursor: async () => null,
    getSchemaVersion: async () => 1
  };
  return new CapatazStore(context, data);
}

describe('Gate Q8: Consolidação das Matrizes Normativas (ISO-001..010, LF-001..012, PORT-001..005)', () => {
  let canonicalBefore: ReturnType<typeof captureGitBaseline>;
  let worktreeBefore: ReturnType<typeof captureGitBaseline>;
  beforeAll(() => {
    canonicalBefore = captureGitBaseline(canonicalRepository());
    worktreeBefore = captureGitBaseline();
    assertOnlyNextPlatformChanges(worktreeBefore);
  });
  afterAll(() => {
    expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
    expect(captureGitBaseline()).toEqual(worktreeBefore);
  });

  let restoreNetwork: () => void;
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let storage: InMemorySessionStorage;
  let authService: LocalAuthService;
  let tokenCapataz: string;
  let tokenGerente: string;

  beforeAll(async () => {
    if (typeof (globalThis as any).localStorage === 'undefined') {
      const memoryStore = new Map<string, string>();
      (globalThis as any).localStorage = {
        getItem: (k: string) => memoryStore.get(k) ?? null,
        setItem: (k: string, v: string) => memoryStore.set(k, String(v)),
        removeItem: (k: string) => memoryStore.delete(k),
        clear: () => memoryStore.clear()
      };
    }

    restoreNetwork = installNetworkGuard();
    const port = await allocateAvailablePort(3620);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
    tokenCapataz = (await loginApi(baseUrl, 'capataz')).tokens.access_token;

    const ger = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
    tokenGerente = (await loginApi(baseUrl, 'gerente')).tokens.access_token;
  });

  afterAll(() => {
    if (apiInstance) apiInstance.stop();
    if (restoreNetwork) restoreNetwork();
  });

  beforeEach(() => {
    storage = new InMemorySessionStorage();
    authService = new LocalAuthService({ storage });
    resetCapatazStoresForTesting();
    capatazTestPartitions.clear();
  });

  // ==========================================================================
  // BLOCO 1: MATRIZ ISO-001 A ISO-010 (10 CRITÉRIOS DE INTEGRIDADE E ISOLAMENTO)
  // ==========================================================================
  describe('Bloco 1: Matriz ISO-001 a ISO-010 — Integridade, Isolamento e Governança', () => {
    it('ISO-001: Confinamento Git da raiz intocada e ausência de chamadas a endpoints remotos', async () => {
      expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
      expect(captureGitBaseline()).toEqual(worktreeBefore);

      // 4. Barreira anti-egress bloqueia conexões a endpoints remotos de produção
      let blockedSupabase = false;
      try {
        await fetch('https://consubov.supabase.co/rest/v1/health');
      } catch (err) {
        if (err instanceof AntiEgressViolationError) blockedSupabase = true;
      }
      expect(blockedSupabase).toBe(true);
    });

    it('ISO-002: Usuário com papel válido direcionado pelo Shell ao módulo autorizado na mesma origem', async () => {
      const makeContext = (profile_id: any): any => ({
        context_id: `ctx-${profile_id}`,
        tenant_id: 'tenant-lab-alpha',
        tenant_nome: 'Lab Fazenda',
        product_id: 'consubov',
        fazenda_id: 'fazenda-lab-01',
        fazenda_nome: 'Sede',
        retiro_id: null,
        retiro_nome: null,
        profile_id,
        capabilities: []
      });

      expect(canAccessModule(makeContext('gerente'), 'gerente')).toBe(true);
      expect(canAccessModule(makeContext('gerente'), 'admin')).toBe(false);

      expect(canAccessModule(makeContext('capataz'), 'capataz')).toBe(true);
      expect(canAccessModule(makeContext('capataz'), 'admin')).toBe(false);

      expect(canAccessModule(makeContext('escritorio'), 'escritorio')).toBe(true);
      expect(canAccessModule(makeContext('escritorio'), 'fabrica')).toBe(false);

      expect(canAccessModule(makeContext('fabrica'), 'fabrica')).toBe(true);
      expect(canAccessModule(makeContext('fabrica'), 'gerente')).toBe(false);

      expect(canAccessModule(makeContext('administrador'), 'admin')).toBe(true);
      expect(canAccessModule(null, 'gerente')).toBe(false);

      // Autenticação de credencial sintética local
      const loginRes = await authService.login({
        email: 'gerente.lab@consubov.local',
        password: LAB_DEFAULT_PASSWORD
      });
      expect(loginRes.success).toBe(true);
      expect(loginRes.session?.user_email).toBe('gerente.lab@consubov.local');
      const activeContext = resolveActiveContext(loginRes.session!, loginRes.session!.memberships[0]!.membership_id);
      expect(activeContext.profile_id).toBe('gerente');
    });

    it('ISO-003: Usuário sem vínculo/tenant recebe tela segura 403 fail-closed', async () => {
      // Usuário sem vínculos ativos
      const unlinkedSession: SyntheticUserSession = {
        session_id: 'sess-sem-vinculo',
        user_id: 'user-sem-vinculo',
        user_email: 'inativo@consubov.local',
        profile_id: 'capataz',
        user_name: 'Usuário Sem Vínculo',
        memberships: [],
        active_context: null,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        device_id: 'dev-001'
      };

      expect(() => resolveActiveContext(unlinkedSession)).toThrow(UnauthorizedContextError);

      // Chamada à API com token forjado de tenant inexistente
      const forgedToken = await signSyntheticJwt({
        user_id: 'user-forged',
        tenant_id: 'tenant-inexistente-invalido',
        fazenda_id: 'fazenda-fake',
        profile_id: 'capataz',
        roles: ['capataz']
      });

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedToken}`
        },
        body: JSON.stringify(createSyntheticCommandEnvelope({
          command_id: 'cmd-unauthorized-001',
          idempotency_key: 'idemp-unauth-test-12345',
          command_type: 'capataz.cocho.registrar_escore',
          aggregate_type: 'pasto',
          aggregate_id: 'pasto-01',
          tenant_id: 'tenant-diferente',
          user_id: 'user-forged',
          profile_id: 'capataz',
          occurred_at_local: new Date().toISOString(),
          base_version: 0,
          payload: { pasto_id: 'pasto-01', escore_cocho: 2, produto_id: 'prod-sal' }
        }))
      });

      // A valid envelope reaches grant authorization and is explicitly denied.
      expect(res.status).toBe(403);
      const rejection: any = await res.json();
      expect(rejection.security.error).toBe('FORBIDDEN_403');
    });

    it('ISO-004: Uma conta mantém um perfil e exige seleção explícita entre vínculos de fazenda', () => {
      const multiMembershipSession: SyntheticUserSession = {
        session_id: 'sess-multi',
        user_id: 'user-multi-fazenda',
        user_email: 'multi@consubov.local',
        profile_id: 'gerente',
        user_name: 'Operador Multi Fazenda',
        memberships: [
          {
            membership_id: 'memb-01',
            tenant_id: 'tenant-alpha',
            tenant_nome: 'Grupo Agro Alpha',
            fazenda_id: 'fazenda-norte',
            fazenda_nome: 'Fazenda Norte',
            retiro_id: null,
            retiro_nome: null,
            profile_id: 'capataz' as const,
            is_active: true
          },
          {
            membership_id: 'memb-02',
            tenant_id: 'tenant-alpha',
            tenant_nome: 'Grupo Agro Alpha',
            fazenda_id: 'fazenda-sul',
            fazenda_nome: 'Fazenda Sul',
            retiro_id: null,
            retiro_nome: null,
            profile_id: 'gerente' as const,
            is_active: true
          }
        ],
        active_context: null,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        device_id: 'dev-002'
      };

      // Sem seleção explícita, DEVE lançar ContextSelectionRequiredError (Anti-first-match)
      expect(() => resolveActiveContext(multiMembershipSession)).toThrow(ContextSelectionRequiredError);

      // Com seleção explícita de memb-02, resolve para a fazenda Sul como gerente
      const resolved = resolveActiveContext(multiMembershipSession, 'memb-02');
      expect(resolved.fazenda_id).toBe('fazenda-sul');
      expect(resolved.profile_id).toBe('gerente');
    });

    it('ISO-005: Contrato unitário de metadados independentes; builds reais são outro gate', () => {
      const releaseManager = new ReleaseManager();

      const modGerente: ModuleArtifactRelease = {
        module_id: 'gerente',
        version: '1.0.0',
        build_timestamp: '2026-11-05T08:00:00Z',
        commit_sha: 'sha-gerente-v1',
        entrypoint_path: '/modules/gerente/main.js',
        sri_hash: 'sha256-gerente-original-hash-11111111111111111111111111111111',
        chunk_hashes: { 'chunk1.js': 'hash-chunk-1' },
        min_contracts_version: '0.1.0'
      };

      const modCapataz: ModuleArtifactRelease = {
        module_id: 'capataz',
        version: '1.0.0',
        build_timestamp: '2026-11-05T08:00:00Z',
        commit_sha: 'sha-capataz-v1',
        entrypoint_path: '/modules/capataz/main.js',
        sri_hash: 'sha256-capataz-original-hash-22222222222222222222222222222222',
        chunk_hashes: { 'chunk1.js': 'hash-cap-1' },
        min_contracts_version: '0.1.0'
      };

      releaseManager.registerModuleWithFallback('gerente', modGerente, null);
      releaseManager.registerModuleWithFallback('capataz', modCapataz, null);

      // Publica atualização autônoma APENAS para capataz
      const modCapatazV2: ModuleArtifactRelease = {
        ...modCapataz,
        version: '1.1.0',
        commit_sha: 'sha-capataz-v2',
        sri_hash: 'sha256-capataz-novo-hash-9999999999999999999999999999999999999'
      };
      releaseManager.registerModuleWithFallback('capataz', modCapatazV2, modCapataz);

      // O hash de gerente permanece estritamente idêntico
      const currentGerente = releaseManager.getModule('gerente');
      expect(currentGerente?.sri_hash).toBe(modGerente.sri_hash);
      expect(currentGerente?.version).toBe('1.0.0');

      // Capataz foi atualizado independentemente
      const currentCapataz = releaseManager.getModule('capataz');
      expect(currentCapataz?.version).toBe('1.1.0');
      expect(currentCapataz?.sri_hash).toBe(modCapatazV2.sri_hash);
    });

    it('ISO-006: Rollback atômico em 404 sem tela branca (WSOD) e retenção vN-1', async () => {
      const rollbackManager = new RollbackManager();

      const vN: ModuleArtifactRelease = {
        module_id: 'escritorio',
        version: '2.0.0',
        build_timestamp: '2026-11-05T09:00:00Z',
        commit_sha: 'sha-v2',
        entrypoint_path: '/modules/escritorio/v2/main.js',
        sri_hash: 'sha256-sri-v2',
        chunk_hashes: { 'chunk-a.js': 'hash-a' },
        min_contracts_version: '0.1.0'
      };

      const vPrev: ModuleArtifactRelease = {
        module_id: 'escritorio',
        version: '1.9.0',
        build_timestamp: '2026-11-04T09:00:00Z',
        commit_sha: 'sha-v1',
        entrypoint_path: '/modules/escritorio/v1/main.js',
        sri_hash: 'sha256-sri-v1',
        chunk_hashes: { 'chunk-a.js': 'hash-a-prev' },
        min_contracts_version: '0.1.0'
      };

      rollbackManager.registerGenerations('escritorio', vN, vPrev);
      expect(rollbackManager.getActiveGeneration('escritorio')?.version).toBe('2.0.0');

      // Simula erro 404 de rede ao carregar chunk de v2
      const error404 = new Error('HTTP 404 Not Found: /chunks/escritorio-chunk-v2.js');
      expect(isChunkLoadError(error404)).toBe(true);

      const fallbackModule = { default: () => 'Escritorio V1.9.0 Fallback' };
      const loaded = await safeDynamicImport(
        async () => {
          throw error404;
        },
        {
          moduleId: 'escritorio',
          maxRetries: 0,
          fallbackImporter: async () => fallbackModule,
          rollbackManager
        }
      );

      expect(loaded.default()).toBe('Escritorio V1.9.0 Fallback');
      expect(rollbackManager.getActiveGeneration('escritorio')?.version).toBe('1.9.0');
    });

    it('ISO-007: Contrato em memória recupera fotos/outbox ao recriar store; sem prova de reinício real', async () => {
      const partitionKey = 'tenant-iso:user-capataz:fazenda-01:capataz';
      const store1 = newCapatazStore(partitionKey);

      // Comprime foto client-side e registra na store
      const photoResult = await compressPhoto(new Uint8Array(200000), {
        pastoId: 'pasto-01',
        tipoRegistro: 'leitura_matutina'
      });
      await store1.anexarFotoCocho(photoResult);

      // Registra leitura de cocho
      await store1.registrarLeituraCocho({
        pasto_id: 'pasto-01',
        produto_id: 'prod-sal-mineral-80',
        escore_cocho: 2,
        sacos_fornecidos: 4,
        foto_attachment_id: photoResult.attachment_id
      });

      await store1.ready;
      const stateBeforeRestart = store1.getState();
      expect(stateBeforeRestart.outbox.length).toBe(2); // Foto + Leitura
      expect(stateBeforeRestart.fotos[photoResult.attachment_id]).toBeDefined();

      // Recria um store sobre o mesmo Map; IndexedDB/reinício real exigem browser.
      const store2 = newCapatazStore(partitionKey);
      await store2.ready;
      const stateAfterRestart = store2.getState();

      expect(stateAfterRestart.outbox.length).toBe(2);
      expect(stateAfterRestart.fotos[photoResult.attachment_id]?.attachment_id).toBe(photoResult.attachment_id);
      expect(stateAfterRestart.leiturasCocho.length).toBe(1);
      expect(stateAfterRestart.leiturasCocho[0]?.escore_cocho).toBe(2);
    });

    it('ISO-008: Contrato de partição e API rejeita ADM tentando mutação de fazenda', async () => {
      // 1. Particionamento do storage do Capataz rejeita chaves sem os 4 segmentos canônicos
      const farmKey = buildPartitionKey('tenant-alfa', 'user-1', 'fazenda-norte', 'capataz');
      expect(farmKey).toBe('tenant-alfa:user-1:fazenda-norte:capataz');

      // Use a real selected-context grant to prove ADM cannot mutate farm data.
      const adminToken = (await loginApi(baseUrl, 'administrador')).tokens.access_token;

      // 3. Tentar executar comando operacional de campo com token de ADM resulta em 403 Forbidden
      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(authorizedEnvelope(adminToken, createSyntheticCommandEnvelope({
          command_id: 'cmd-adm-farm-violation',
          idempotency_key: 'idemp-adm-violation-12345',
          command_type: 'capataz.salga.lancar',
          aggregate_type: 'pasto',
          aggregate_id: 'pasto-01',
          tenant_id: 'system-global',
          user_id: 'admin-global-01',
          profile_id: 'administrador',
          occurred_at_local: new Date().toISOString(),
          base_version: 0,
          payload: { pasto_id: 'pasto-01', produto_id: 'prod-1', sacos_fornecidos: 2 }
        })))
      });

      expect(res.status).toBe(403);
      const rejection: any = await res.json();
      expect(rejection.security.error).toBe('FORBIDDEN_403');
    });

    it('ISO-009: Governança de shared packages compatíveis N/N-1', () => {
      // Envelopes gerados pela versão N e N-1 são validados pelo atomicCommandEnvelopeSchema
      const envelopeVersionN = createSyntheticCommandEnvelope({
        command_type: 'capataz.cocho.registrar_escore',
        schema_version: 2,
        base_version: 1
      });
      const parseN = atomicCommandEnvelopeSchema.safeParse(envelopeVersionN);
      expect(parseN.success).toBe(true);

      // Envelope com schema_version anterior (versão N-1)
      const envelopeVersionNMinus1 = createSyntheticCommandEnvelope({
        command_type: 'capataz.cocho.registrar_escore',
        schema_version: 1,
        base_version: 0
      });
      const parseNMinus1 = atomicCommandEnvelopeSchema.safeParse(envelopeVersionNMinus1);
      expect(parseNMinus1.success).toBe(true);
    });

    it('ISO-010: Encerramento auditável sem merge na main e com salvaguarda NO-GO', () => {
      expect(captureGitBaseline()).toEqual(worktreeBefore);
      expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
      const policy = readFileSync(resolve(nextPlatformDir, 'docs/f08-arquitetura-plataforma-isolada.md'), 'utf-8');
      expect(policy).toContain('PRODUÇÃO ESTRITAMENTE NO-GO');
    });
  });

  // ==========================================================================
  // BLOCO 2: MATRIZ LF-001 A LF-012 (12 CRITÉRIOS LOCAL-FIRST E BARREIRA API)
  // ==========================================================================
  describe('Bloco 2: Matriz LF-001 a LF-012 — Local-First, Resiliência e Barreira de API', () => {
    it('LF-001: Leitura de snapshots e gravação local sem falso ACK sob API offline', async () => {
      const store = newCapatazStore('tenant-lf001:user-1:fazenda-01:capataz');
      await store.ready;

      // Leitura de dados pré-carregados localmente sem rede
      const pastos = store.getState().pastos;
      expect(pastos.length).toBeGreaterThan(0);

      // Gravação local offline: status inicial deve ser pendente na outbox
      const { envelope } = await store.registrarLeituraCocho({
        pasto_id: pastos[0]!.pasto_id,
        produto_id: 'prod-sal-mineral-80',
        escore_cocho: 1,
        sacos_fornecidos: 2
      });

      expect(envelope.command_id).toBeDefined();
      const state = store.getState();
      expect(state.outbox.length).toBe(1);
      expect(state.syncedCommands.length).toBe(0); // Nenhum falso ACK gerado
    });

    it('LF-002: Sincronização de outbox com ACK único e cursor do servidor sem perda', async () => {
      const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
      const envelope = createSyntheticCommandEnvelope({
        tenant_id: cap.memberships[0]!.tenant_id,
        user_id: cap.user_id,
        fazenda_id: cap.memberships[0]!.fazenda_id,
        profile_id: 'capataz',
        command_type: 'capataz.cocho.registrar_escore', aggregate_type: 'cocho', aggregate_id: 'pasto-01', base_version: 1,
        payload: { pasto_id: 'pasto-01', escore_cocho: 2, sacos_fornecidos: 2, produto_id: 'prod-sal' }
      });

      const res = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCapataz}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
      });

      expect(res.status).toBe(200);
      const ack: any = await res.json();
      expect(ack.ack.command_id).toBe(envelope.command_id);
      expect(ack.ack.status).toBe('COMMITTED');
      expect(ack.ack.committed_at).toBeDefined();
      expect(ack.ack.aggregate_version).toBeDefined();
    });

    it('LF-003: Contrato em memória recupera fotos/outbox sem falso ACK', async () => {
      const partitionKey = 'tenant-lf003:user-1:fazenda-01:capataz';
      const store = newCapatazStore(partitionKey);

      // Gera foto sintética de 3.5MB
      const rawBytes = new Uint8Array(3670016);
      const photo = await compressPhoto(rawBytes, { pastoId: 'pasto-03' });

      // Anexa foto na store
      await store.anexarFotoCocho(photo);
      expect(photo.compressedSizeBytes).toBeLessThan(300 * 1024);

      // Reinício simulado
      const rebootedStore = newCapatazStore(partitionKey);
      await rebootedStore.ready;
      const rebootedState = rebootedStore.getState();

      expect(rebootedState.fotos[photo.attachment_id]?.attachment_id).toBe(photo.attachment_id);
      expect(rebootedState.outbox.length).toBe(1);
      expect(rebootedState.syncedCommands.length).toBe(0); // Sem falso ACK
    });

    it('LF-004: Comando forjado com adulteração de perfil/tenant barrado pela API com 400/401/403/422', async () => {
      // 1. Envelope com tenant adulterado em relação ao token
      const spoofedTenantEnvelope = createSyntheticCommandEnvelope({
        tenant_id: 'tenant-vitima-adulterado',
        user_id: 'user-capataz-lab-01',
        profile_id: 'capataz',
        command_type: 'capataz.cocho.registrar_escore'
      });

      const resSpoofed = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCapataz}`
        },
        body: JSON.stringify({ ...authorizedEnvelope(tokenCapataz, spoofedTenantEnvelope), tenant_id: 'tenant-vitima-adulterado' })
      });
      expect(resSpoofed.status).toBe(403);

      // 2. Comando fora da allowlist
      const notAllowedEnvelope = createSyntheticCommandEnvelope({
        tenant_id: 'tenant-lab-alpha',
        user_id: 'user-capataz-lab-01',
        profile_id: 'capataz',
        command_type: 'comando.malicioso.injetado' as any
      });

      const resNotAllowed = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCapataz}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenCapataz, notAllowedEnvelope))
      });
      expect([400, 422]).toContain(resNotAllowed.status);
    });

    it('LF-005: Reenvio de comando deduplicado por idempotency_key sem duplicar registros', async () => {
      const cap = SYNTHETIC_USERS['capataz.lab@consubov.local']!;
      const fixedIdempKey = 'idemp-matrix-test-dedup-99999999';
      const envelope = createSyntheticCommandEnvelope({
        command_id: 'cmd-dedup-unique-001',
        idempotency_key: fixedIdempKey,
        aggregate_id: 'pasto-dedup-unique-01',
        base_version: 1,
        tenant_id: cap.memberships[0]!.tenant_id,
        user_id: cap.user_id,
        fazenda_id: cap.memberships[0]!.fazenda_id,
        profile_id: 'capataz',
        command_type: 'capataz.cocho.registrar_escore',
        payload: { pasto_id: 'pasto-dedup-unique-01', escore_cocho: 3, sacos_fornecidos: 2, produto_id: 'prod-sal' }
      });

      // Primeiro envio: aceito e processado
      const res1 = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCapataz}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
      });
      expect(res1.status).toBe(200);
      const ack1: any = await res1.json();

      // Segundo envio com exatamente a mesma idempotency_key
      const res2 = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCapataz}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenCapataz, envelope))
      });
      expect(res2.status).toBe(200);
      const ack2: any = await res2.json();

      // O ACK retornado é deduplicado com o mesmo command_id
      expect(ack2.ack.command_id).toBe(ack1.ack.command_id);
      expect(ack2).toEqual(ack1);
    });

    it('LF-006: Conflito por base_version tratado por domínio (HTTP 409) sem LWW destrutivo', async () => {
      const ger = SYNTHETIC_USERS['gerente.lab@consubov.local']!;
      const aggregateId = `lote-occ-${Date.now()}`;

      // Passo 1: Cria comando com base_version: 0
      const cmd1 = createSyntheticCommandEnvelope({
        command_id: `cmd-occ-1-${Date.now()}`,
        idempotency_key: `idemp-occ-1-${Date.now()}`,
        aggregate_type: 'lote',
        aggregate_id: aggregateId,
        base_version: 0,
        tenant_id: ger.memberships[0]!.tenant_id,
        user_id: ger.user_id,
        fazenda_id: ger.memberships[0]!.fazenda_id,
        profile_id: 'gerente',
        command_type: 'gerente.metas.definir',
        payload: {
          lote_id: aggregateId,
          gmd_alvo_kg_dia: 0.85,
          peso_final_alvo_kg: 520,
          data_alvo_abate: new Date().toISOString()
        }
      });

      const res1 = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenGerente}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenGerente, cmd1))
      });
      expect(res1.status).toBe(200);

      // Passo 2: Segundo comando tenta alterar com base_version desatualizada (0 em vez de 1) e idempotency_key diferente
      const cmdConcorrente = createSyntheticCommandEnvelope({
        command_id: `cmd-occ-2-${Date.now()}`,
        idempotency_key: `idemp-occ-2-${Date.now()}`,
        aggregate_type: 'lote',
        aggregate_id: aggregateId,
        base_version: 0, // Versão defasada!
        tenant_id: ger.memberships[0]!.tenant_id,
        user_id: ger.user_id,
        fazenda_id: ger.memberships[0]!.fazenda_id,
        profile_id: 'gerente',
        command_type: 'gerente.metas.definir',
        payload: {
          lote_id: aggregateId,
          gmd_alvo_kg_dia: 0.95,
          peso_final_alvo_kg: 530,
          data_alvo_abate: new Date().toISOString()
        }
      });

      const resConcorrente = await fetch(`${baseUrl}/api/v1/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenGerente}`
        },
        body: JSON.stringify(authorizedEnvelope(tokenGerente, cmdConcorrente))
      });

      // API rejeita com OCC 409 Conflict
      expect(resConcorrente.status).toBe(409);

      // Domain resolver classifica como revisão explícita para evitar LWW cego
      const resolution = resolveDomainConflict(cmdConcorrente as any, {
        statusCode: 409,
        serverAggregateVersion: 1
      });
      expect(resolution.resolved).toBe(false);
      expect(resolution.strategy).toBe('OCC_CONFLICT_REVIEW');
    });

    it('LF-007: Worker verificado exige consentimento explícito e quiescência antes de ativar', async () => {
      const quiescence = new QuiescenceRegistry();
      const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
      Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://q8.test/') });
      let activated = false;
      const messages: string[] = [];
      const events = new EventTarget();
      const worker = {
        state: 'installed', scriptURL: 'https://q8.test/sw.js',
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        postMessage(msg: any, ports: MessagePort[]) {
          messages.push(msg.type);
          if (msg.type === 'VERIFY_WAITING_WORKER') ports[0]!.postMessage({ type: 'WAITING_WORKER_VERIFIED', version: 'q8-next', scriptURL: worker.scriptURL, pending: true, compatible: true, canActivate: true });
          if (msg.type === 'ACTIVATE_WITH_CONSENT') {
            activated = true; worker.state = 'activated';
            events.dispatchEvent(new Event('statechange'));
            ports[0]!.postMessage({ type: 'SHELL_ACTIVATION_ACCEPTED', accepted: true, version: 'q8-next' });
          }
        }
      };
      const registration = { waiting: worker, active: null, installing: null } as unknown as ServiceWorkerRegistration;
      const coordinator = new UpdateCoordinator({ quiescenceRegistry: quiescence, autoReloadOnQuiescent: false, checkIntervalMs: 0 });
      const releaseCam = quiescence.acquireLock('cam-lock-01', 'CAMERA_ACTIVE');
      try {
        coordinator.initialize(registration);
        await coordinator.handleWaitingWorker(worker as unknown as ServiceWorker);
        expect(coordinator.isPending()).toBe(true);
        expect(await coordinator.activateWaitingWorker()).toBe(false);
        expect(activated).toBe(false);
        releaseCam();
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(activated).toBe(false);
        expect(messages.every(type => type === 'VERIFY_WAITING_WORKER')).toBe(true);
        expect(await coordinator.activateWaitingWorker()).toBe(true);
        expect(activated).toBe(true);
        expect(messages.filter(type => type === 'ACTIVATE_WITH_CONSENT')).toHaveLength(1);
      } finally {
        releaseCam(); coordinator.destroy();
        if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
        else Reflect.deleteProperty(globalThis, 'location');
      }
    });

    it('LF-008: Chunk 404 aciona reversão atômica para geração N-1 sem quebra da UI', async () => {
      const rollback = new RollbackManager();
      const modV2: ModuleArtifactRelease = {
        module_id: 'gerente',
        version: '2.0.0',
        build_timestamp: '2026-11-05T08:00:00Z',
        commit_sha: 'sha-v2',
        entrypoint_path: '/modules/gerente/v2.js',
        sri_hash: 'sha256-sri-v2',
        chunk_hashes: { 'chunk.js': 'hash-v2' },
        min_contracts_version: '0.1.0'
      };

      const modV1: ModuleArtifactRelease = {
        module_id: 'gerente',
        version: '1.9.0',
        build_timestamp: '2026-11-04T08:00:00Z',
        commit_sha: 'sha-v1',
        entrypoint_path: '/modules/gerente/v1.js',
        sri_hash: 'sha256-sri-v1',
        chunk_hashes: { 'chunk.js': 'hash-v1' },
        min_contracts_version: '0.1.0'
      };

      rollback.registerGenerations('gerente', modV2, modV1);

      const loaded = await safeDynamicImport(
        async () => {
          throw new Error('Loading chunk 404 failed: /modules/gerente/v2.js');
        },
        {
          moduleId: 'gerente',
          maxRetries: 0,
          fallbackImporter: async () => ({ GerenteView: 'Componente Gerente v1.9.0 Seguro' }),
          rollbackManager: rollback
        }
      );

      expect(loaded.GerenteView).toBe('Componente Gerente v1.9.0 Seguro');
      expect(rollback.getActiveGeneration('gerente')?.version).toBe('1.9.0');
    });

    it('LF-009: Contrato unitário preserva metadados alheios; builds reais são outro gate', () => {
      const releaseMgr = new ReleaseManager();

      const fabV1: ModuleArtifactRelease = {
        module_id: 'fabrica',
        version: '1.0.0',
        build_timestamp: '2026-11-05T08:00:00Z',
        commit_sha: 'sha-fab-1',
        entrypoint_path: '/modules/fabrica/v1.js',
        sri_hash: 'sha256-hash-fabrica-1111111111111111111111111111111111111111111',
        chunk_hashes: { 'fab.js': 'fab-h1' },
        min_contracts_version: '0.1.0'
      };

      const capV1: ModuleArtifactRelease = {
        module_id: 'capataz',
        version: '1.0.0',
        build_timestamp: '2026-11-05T08:00:00Z',
        commit_sha: 'sha-cap-1',
        entrypoint_path: '/modules/capataz/v1.js',
        sri_hash: 'sha256-hash-capataz-2222222222222222222222222222222222222222222',
        chunk_hashes: { 'cap.js': 'cap-h1' },
        min_contracts_version: '0.1.0'
      };

      releaseMgr.registerModuleWithFallback('fabrica', fabV1, null);
      releaseMgr.registerModuleWithFallback('capataz', capV1, null);

      // Nova versão de fábrica publicada
      const fabV2: ModuleArtifactRelease = {
        ...fabV1,
        version: '1.1.0',
        sri_hash: 'sha256-hash-fabrica-novo-3333333333333333333333333333333333333'
      };
      releaseMgr.registerModuleWithFallback('fabrica', fabV2, fabV1);

      // Hash de capataz permanece estritamente intocado
      const latestCap = releaseMgr.getModule('capataz');
      expect(latestCap?.sri_hash).toBe(capV1.sri_hash);
      expect(latestCap?.version).toBe('1.0.0');
    });

    it('LF-010: Particionamento do contrato em memória impede acesso cruzado entre fazendas', async () => {
      const keyFazendaNorte = 'tenant-alfa:user-joao:fazenda-norte:capataz';
      const keyFazendaSul = 'tenant-alfa:user-joao:fazenda-sul:capataz';

      const storeNorte = newCapatazStore(keyFazendaNorte);
      const storeSul = newCapatazStore(keyFazendaSul);
      await Promise.all([storeNorte.ready, storeSul.ready]);

      await storeNorte.registrarLeituraCocho({
        pasto_id: 'pasto-norte-01',
        produto_id: 'prod-sal',
        escore_cocho: 2,
        sacos_fornecidos: 3
      });

      // O store da fazenda sul permanece completamente isolado
      expect(storeNorte.getState().outbox.length).toBe(1);
      expect(storeSul.getState().outbox.length).toBe(0);
      expect(storeSul.getState().leiturasCocho.length).toBe(0);
    });

    it('LF-011: Inspeção de fontes tracked/untracked contra SDK Supabase/PostgREST', () => {
      // Source inspection includes untracked files; bundle evidence is a separate gate.
      const sourceFiles = Object.keys(captureSourceManifest().files).filter(path =>
        /^(apps|packages)\//.test(path) && /\.[cm]?[jt]sx?$/.test(path) && !/\.(test|spec)\./.test(path));
      expect(sourceFiles.length).toBeGreaterThan(30);
      const violations: string[] = [];
      const forbidden = /@supabase\/supabase-js|\bcreateClient\s*\(|\bpostgrest\b/i;
      for (const path of sourceFiles) {
        // Scan every line, including executable code following comments. This
        // conservative inspection cannot silently drop a complete line.
        const lines = readFileSync(resolve(nextPlatformDir, path), 'utf-8').split('\n');
        lines.forEach((line, index) => { if (forbidden.test(line)) violations.push(`${path}:${index + 1}`); });
      }
      expect(violations).toEqual([]);
    });

    it('LF-012: Contrato em memória mantém fila sem SyncManager; browser real é outro gate', async () => {
      // Simula browser legados/iOS Safari sem suporte a SyncManager
      const hasSyncManager = typeof (globalThis as any).SyncManager !== 'undefined';
      expect(hasSyncManager).toBe(false);

      const store = newCapatazStore('tenant-safari:user-01:fazenda-01:capataz');
      await store.registrarLeituraCocho({
        pasto_id: 'pasto-01',
        produto_id: 'prod-sal',
        escore_cocho: 1,
        sacos_fornecidos: 2
      });

      // A fila local é mantida com 100% de integridade
      expect(store.getState().outbox.length).toBe(1);

      // Recria store no mesmo processo/Map; não demonstra reinício real.
      const recoveredStore = newCapatazStore('tenant-safari:user-01:fazenda-01:capataz');
      await recoveredStore.ready;
      expect(recoveredStore.getState().outbox.length).toBe(1);
    });
  });

  // ==========================================================================
  // BLOCO 3: MATRIZ PORT-001 A PORT-005 (5 CRITÉRIOS DE PORTABILIDADE CONTROLADA)
  // ==========================================================================
  describe('Bloco 3: Matriz PORT-001 a PORT-005 — Portabilidade Controlada e Governança', () => {
    it('PORT-001: Inventário completo de melhorias legadas com SHA, branch, PR e owner rastreáveis', () => {
      expect(PORTABILITY_INVENTORY.length).toBeGreaterThanOrEqual(8);

      for (const item of PORTABILITY_INVENTORY) {
        expect(item.id).toBeDefined();
        expect(item.legacy_ref).toBeDefined();
        expect(item.source_sha).toBeDefined();
        expect(item.owner).toBeDefined();
        expect(item.feature_name).toBeDefined();
        expect(item.status).toBeDefined();
      }

      const pr76 = getPortabilityItem('PORT-PR76');
      expect(pr76?.pr_number).toBe(76);
      expect(pr76?.source_sha).toBe('6ebaa4b0');
      expect(pr76?.status).toBe('HOMOLOGADO');

      const pr135 = getPortabilityItem('PORT-PR135');
      expect(pr135?.pr_number).toBe(135);
      expect(pr135?.status).toBe('HOMOLOGADO');
    });

    it('PORT-002: Funcionalidade portada com contrato, destino e testes definidos sem reatribuição indevida', () => {
      const approvedItems = getApprovedPortabilityItems();
      expect(approvedItems.length).toBeGreaterThanOrEqual(6);

      for (const item of approvedItems) {
        expect(item.target_module.startsWith('apps/') || item.target_module.startsWith('packages/')).toBe(true);
        expect(item.zod_schema_ref).toBeDefined();
        expect(item.test_suite_ref.endsWith('.test.ts')).toBe(true);
      }
    });

    it('PORT-003: Modificações restritas estritamente a next-platform/** (zero alteração em apps/web/)', () => {
      assertOnlyNextPlatformChanges();
      expect(captureGitBaseline()).toEqual(worktreeBefore);
      expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
    });

    it('PORT-004: Validação empírica de paridade comportamental por testes de regressão', async () => {
      // 1. Escala de escore de cocho (0, 1, 2, 3, 4)
      const pastoStore = newCapatazStore('tenant-port004:user-1:fazenda-01:capataz');
      const validEscores = [0, 1, 2, 3, 4] as const;

      for (const escore of validEscores) {
        const { envelope } = await pastoStore.registrarLeituraCocho({
          pasto_id: 'pasto-01',
          produto_id: 'prod-sal',
          escore_cocho: escore,
          sacos_fornecidos: 2
        });
        expect(envelope.payload.escore_cocho).toBe(escore);
      }

      // 2. Allowlist de comandos cobre todas as operações pecuárias portadas
      expect(isAllowedCommand('capataz.salga.lancar')).toBe(true);
      expect(isAllowedCommand('gerente.metas.definir')).toBe(true);
      expect(isAllowedCommand('fabrica.formulas.salvar')).toBe(true);
      expect(isAllowedCommand('escritorio.compras.criar_pedido')).toBe(true);
    });

    it('PORT-005: Regras de governança: funcionalidades inseguras mantidas como BLOQUEADO/PENDENTE', () => {
      const blockedItems = getBlockedPortabilityItems();
      expect(blockedItems.length).toBeGreaterThanOrEqual(2);

      const directDbItem = getPortabilityItem('PORT-LEGACY-DIRECT-DB');
      expect(directDbItem?.status).toBe('BLOQUEADO');
      expect(directDbItem?.target_module).toBe('REJEITADO_INSEGURO');
      expect(directDbItem?.governance_reason).toContain('API-Only');

      const anonymousUploadItem = getPortabilityItem('PORT-LEGACY-ANONYMOUS-UPLOAD');
      expect(anonymousUploadItem?.status).toBe('BLOQUEADO');
      expect(anonymousUploadItem?.target_module).toBe('REJEITADO_INSEGURO');
    });
  });
});
