import { describe, it, expect } from 'bun:test';
import { FAZENDA_MODULES } from '../../apps/fazenda/shell/src/router/moduleRegistry';
import { SHELL_ROUTES, getRouteForProfile } from '../../apps/fazenda/shell/src/router/routes.config';
import { canAccessModule, buildPartitionKey, parsePartitionKey } from '@consubov/auth-client';
import { scanFazendaModules } from '../harness/ast-literal-guard';
import { resolve } from 'path';

describe('Q4.4: Roteamento Lazy no Shell, Registro de Módulos, RBAC e Barreira AST Multidomínio', () => {
  it('Q4.4.1: deve carregar dinamicamente (lazy import) todos os módulos de domínio da fazenda', async () => {
    // 1. Módulo Gerente
    const gerenteMod = await FAZENDA_MODULES.gerente.loader();
    expect(gerenteMod).toBeDefined();
    expect(typeof gerenteMod.default).toBe('function');

    // 2. Módulo Capataz
    const capatazMod = await FAZENDA_MODULES.capataz.loader();
    expect(capatazMod).toBeDefined();
    expect(typeof capatazMod.default).toBe('function');

    // 3. Módulo Escritório
    const escritorioMod = await FAZENDA_MODULES.escritorio.loader();
    expect(escritorioMod).toBeDefined();
    expect(typeof escritorioMod.default).toBe('function');

    // 4. Módulo Fábrica
    const fabricaMod = await FAZENDA_MODULES.fabrica.loader();
    expect(fabricaMod).toBeDefined();
    expect(typeof fabricaMod.default).toBe('function');

    // 5. Módulo Administrador Global (deve rejeitar carregamento em shell local de fazenda)
    await expect(FAZENDA_MODULES.administrador.loader()).rejects.toThrow();
  });

  it('Q4.4.2: getRouteForProfile deve direcionar cada perfil para sua respectiva rota canônica', () => {
    expect(getRouteForProfile('gerente')).toBe('/fazenda/gerente');
    expect(getRouteForProfile('capataz')).toBe('/fazenda/capataz');
    expect(getRouteForProfile('escritorio')).toBe('/fazenda/escritorio');
    expect(getRouteForProfile('fabrica')).toBe('/fazenda/fabrica');
    expect(getRouteForProfile('administrador')).toBe('/fazenda/gerente');

    // Assegura que todas as rotas de domínio requerem perfil adequado
    const domainRoutes = SHELL_ROUTES.filter(r => r.moduleId);
    expect(domainRoutes.length).toBe(4);
    for (const r of domainRoutes) {
      expect(r.requiredProfile).toBeDefined();
      expect(r.isPublic).toBeFalsy();
    }
  });

  it('Q4.4.3: RBAC fail-closed — cada perfil só pode acessar seu próprio módulo sem permissão cruzada', () => {
    // Gerente
    expect(canAccessModule({ profile_id: 'gerente' } as any, 'gerente')).toBe(true);
    expect(canAccessModule({ profile_id: 'gerente' } as any, 'capataz')).toBe(false);
    expect(canAccessModule({ profile_id: 'gerente' } as any, 'escritorio')).toBe(false);
    expect(canAccessModule({ profile_id: 'gerente' } as any, 'fabrica')).toBe(false);

    // Capataz
    expect(canAccessModule({ profile_id: 'capataz' } as any, 'capataz')).toBe(true);
    expect(canAccessModule({ profile_id: 'capataz' } as any, 'gerente')).toBe(false);
    expect(canAccessModule({ profile_id: 'capataz' } as any, 'escritorio')).toBe(false);
    expect(canAccessModule({ profile_id: 'capataz' } as any, 'fabrica')).toBe(false);

    // Escritório
    expect(canAccessModule({ profile_id: 'escritorio' } as any, 'escritorio')).toBe(true);
    expect(canAccessModule({ profile_id: 'escritorio' } as any, 'gerente')).toBe(false);
    expect(canAccessModule({ profile_id: 'escritorio' } as any, 'capataz')).toBe(false);
    expect(canAccessModule({ profile_id: 'escritorio' } as any, 'fabrica')).toBe(false);

    // Fábrica
    expect(canAccessModule({ profile_id: 'fabrica' } as any, 'fabrica')).toBe(true);
    expect(canAccessModule({ profile_id: 'fabrica' } as any, 'gerente')).toBe(false);
    expect(canAccessModule({ profile_id: 'fabrica' } as any, 'capataz')).toBe(false);
    expect(canAccessModule({ profile_id: 'fabrica' } as any, 'escritorio')).toBe(false);
  });

  it('Q4.4.4: Particionamento estrito de cache e estado por Tenant, Usuário, Fazenda e Perfil', () => {
    const keyGerente = buildPartitionKey('tenant-lab-01', 'usr-001', 'faz-01', 'gerente');
    const keyEscritorio = buildPartitionKey('tenant-lab-01', 'usr-002', 'faz-01', 'escritorio');
    const keyFabrica = buildPartitionKey('tenant-lab-01', 'usr-003', 'faz-01', 'fabrica');

    expect(keyGerente).not.toBe(keyEscritorio);
    expect(keyEscritorio).not.toBe(keyFabrica);

    const parsed = parsePartitionKey(keyFabrica);
    expect(parsed).toEqual({
      tenantId: 'tenant-lab-01',
      userId: 'usr-003',
      fazendaId: 'faz-01',
      profileId: 'fabrica'
    });
  });

  it('Q4.4.5: AST Guard Multidomínio — todos os módulos (shell, capataz, gerente, escritorio, fabrica) devem possuir ZERO violações de literais JSX', () => {
    const fazendaRoot = resolve(import.meta.dir, '../../apps/fazenda');
    const modules = ['shell', 'capataz', 'gerente', 'escritorio', 'fabrica'];
    const results = scanFazendaModules(modules, fazendaRoot);

    const totalFiles = results.reduce((acc, r) => acc + r.filesCount, 0);
    const allViolations = results.flatMap(r => r.violations);

    expect(totalFiles).toBeGreaterThanOrEqual(25);
    expect(results.map(r => r.module)).toEqual(modules);

    if (allViolations.length > 0) {
      console.error(`\n❌ [AST GUARD MULTIDOMÍNIO] ${allViolations.length} violações detectadas:`);
      for (const v of allViolations) {
        console.error(`  - [${v.kind}] ${v.file}:${v.line} -> "${v.text}"`);
      }
    }

    expect(allViolations.length).toBe(0);
    expect(allViolations).toEqual([]);
  });
});
