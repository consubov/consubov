import { describe, it, expect } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthContext, AuthContextValue } from './AuthContext';
import { GerenteView } from '@consubov/fazenda-gerente';
import { CapatazView } from '@consubov/fazenda-capataz';
import { EscritorioView } from '@consubov/fazenda-escritorio';
import { FabricaView } from '@consubov/fazenda-fabrica';
import { UserProfileId, type FazendaModuleId, type ModuleExecutionContext, type ModuleLocalDataAPI } from '@consubov/contracts';
import { ModuleRuntimeProvider } from '@consubov/ui';

const inaccessibleLocalData = new Proxy({}, {
  get: () => async () => { throw new Error('LocalDataAPI não deve ser chamado pelo teste de bloqueio.'); }
}) as ModuleLocalDataAPI;
const inertLocalData: ModuleLocalDataAPI = {
  readSnapshot: async () => null,
  listSnapshots: async () => [],
  commitMutation: async mutation => ({ commandId: mutation.command.command_id, committed: true }),
  readAttachment: async () => null,
  listPendingCommands: async () => [],
  getCursor: async () => null,
  getSchemaVersion: async () => 1
};

function executionContext(moduleId: FazendaModuleId): ModuleExecutionContext {
  return {
    userId: 'test-user', tenantId: 'test-tenant', farmId: 'test-farm', retreatId: null,
    moduleId, profileId: moduleId, deviceId: 'test-device', productId: 'consubov'
  };
}

function renderProtected(auth: AuthContextValue, requiredProfile: UserProfileId, child: React.ReactNode, localData = inaccessibleLocalData): string {
  return renderToString(
    <AuthContext.Provider value={auth}>
      <ModuleRuntimeProvider localData={localData}>
        <ProtectedRoute requiredProfile={requiredProfile}>{child}</ProtectedRoute>
      </ModuleRuntimeProvider>
    </AuthContext.Provider>
  );
}

function createMockAuthContext(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    session: null,
    activeContext: null,
    tokens: null,
    isAuthenticated: false,
    requiresContextSelection: false,
    availableMemberships: [],
    isLoading: false,
    login: async () => ({ success: true }),
    selectContext: async () => ({ success: true }),
    switchContext: async () => ({ success: true }),
    logout: () => {},
    authService: {} as any,
    ...overrides
  };
}

describe('Adversarial Security: Ataque 1 — Bypass de RBAC em Rotas e Vazamento de Dados', () => {
  it('ADV-1.1: Deve barrar capataz tentando montar rota de gerente sem vazar NENHUM dado do gerente', () => {
    const mockCapatazContext = createMockAuthContext({
      isAuthenticated: true,
      requiresContextSelection: false,
      activeContext: {
        context_id: 'tenant-lab-01:fazenda-01:capataz',
        tenant_id: 'tenant-lab-01',
        tenant_nome: 'Fazenda Modelo',
        product_id: 'consubov',
        fazenda_id: 'fazenda-01',
        fazenda_nome: 'Fazenda Modelo',
        retiro_id: 'retiro-01',
        retiro_nome: 'Retiro Sede',
        profile_id: 'capataz',
        capabilities: ['capataz.operar_offline']
      }
    });

    // Tentativa de invasão forçando a montagem de GerenteView dentro de rota protegida para gerente
    const html = renderProtected(mockCapatazContext, 'gerente', <GerenteView context={executionContext('gerente')} />);

    // 1. Deve exibir tela de Acesso Não Autorizado
    expect(html).toContain('Acesso N'); // Acesso Não Autorizado
    expect(html).toContain('Capataz');
    expect(html).toContain('Gerente');

    // 2. Comprovação Forense de NÃO-VAZAMENTO: nenhum elemento ou dado sensível do GerenteView foi emitido
    expect(html).not.toContain('gerente-module-view');
    expect(html).not.toContain('1.45 kg/dia');
    expect(html).not.toContain('Ganho M'); // Ganho Médio Diário
    expect(html).not.toContain('3.420 cabe');
    expect(html).not.toContain('Meta: 1.35 kg/dia');
    expect(html).not.toContain('Escore de Cocho');
    expect(html).not.toContain('Curvas de peso');
  });

  it('ADV-1.2: Deve barrar todas as combinações de acesso lateral cruzado entre perfis', () => {
    const profiles: UserProfileId[] = ['gerente', 'capataz', 'escritorio', 'fabrica'];

    const componentsByProfile: Record<UserProfileId, React.ReactElement> = {
      gerente: <GerenteView context={executionContext('gerente')} />,
      capataz: <CapatazView context={executionContext('capataz')} />,
      escritorio: <EscritorioView context={executionContext('escritorio')} />,
      fabrica: <FabricaView context={executionContext('fabrica')} />,
      administrador: <div data-testid="admin-secret">Admin Secret</div>
    };

    const secretMarkerByProfile: Record<UserProfileId, string> = {
      gerente: 'gerente-module-view',
      capataz: 'capataz-module-view',
      escritorio: 'escritorio-module-view',
      fabrica: 'fabrica-module-view',
      administrador: 'admin-secret'
    };

    for (const activeProfile of profiles) {
      for (const targetProfile of profiles) {
        if (activeProfile === targetProfile) continue;

        const authValue = createMockAuthContext({
          isAuthenticated: true,
          requiresContextSelection: false,
          activeContext: {
            context_id: `t:f:${activeProfile}`,
            tenant_id: 't',
            tenant_nome: 'T',
            product_id: 'consubov',
            fazenda_id: 'f',
            fazenda_nome: 'F',
            retiro_id: 'r',
            retiro_nome: 'R',
            profile_id: activeProfile,
            capabilities: []
          }
        });

        const html = renderProtected(authValue, targetProfile, componentsByProfile[targetProfile]);

        // Deve barrar o acesso
        expect(html).toContain('Acesso N');
        // Não pode vazar o marcador do módulo alvo
        expect(html).not.toContain(secretMarkerByProfile[targetProfile]);
      }
    }
  });

  it('ADV-1.3: Administrador deve possuir acesso universal sem bloqueio', () => {
    const adminContext = createMockAuthContext({
      isAuthenticated: true,
      requiresContextSelection: false,
      activeContext: {
        context_id: 't:f:administrador',
        tenant_id: 't',
        tenant_nome: 'T',
        product_id: 'consubov',
        fazenda_id: 'f',
        fazenda_nome: 'F',
        retiro_id: 'r',
        retiro_nome: 'R',
        profile_id: 'administrador',
        capabilities: []
      }
    });

    const html = renderProtected(adminContext, 'gerente', <GerenteView context={executionContext('gerente')} />, inertLocalData);

    // Administrador deve renderizar diretamente o GerenteView
    expect(html).toContain('gerente-module-view');
    expect(html).not.toContain('Acesso N');
  });

  it('ADV-1.4: Usuário não autenticado deve receber LoginView e nunca o módulo protegido', () => {
    const unauthenticatedContext = createMockAuthContext({
      isAuthenticated: false,
      activeContext: null
    });

    const html = renderProtected(unauthenticatedContext, 'gerente', <GerenteView context={executionContext('gerente')} />);

    expect(html).not.toContain('gerente-module-view');
    // LoginView deve renderizar o formulário de login real com o botão traduzido
    expect(html).toContain('Entrar no Sistema');
    expect(html).toContain('CONSUBOV Fazendas');
  });

  it('ADV-1.5: Usuário autenticado sem contexto (ISO-004) deve receber ContextSelectorView sem vazar módulo', () => {
    const pendingContext = createMockAuthContext({
      isAuthenticated: true,
      requiresContextSelection: true,
      activeContext: null
    });

    const html = renderProtected(pendingContext, 'gerente', <GerenteView context={executionContext('gerente')} />);

    expect(html).not.toContain('gerente-module-view');
    expect(html).toContain('Selecione o Contexto Operacional');
    expect(html).toContain('ISO-004');
  });

  it('ADV-1.6: Injeção de perfil desconhecido / malicioso em requiredProfile deve aplicar Fail-Closed', () => {
    const capatazContext = createMockAuthContext({
      isAuthenticated: true,
      requiresContextSelection: false,
      activeContext: {
        context_id: 't:f:capataz',
        tenant_id: 't',
        tenant_nome: 'T',
        product_id: 'consubov',
        fazenda_id: 'f',
        fazenda_nome: 'F',
        retiro_id: 'r',
        retiro_nome: 'R',
        profile_id: 'capataz',
        capabilities: []
      }
    });

    // Injeção de perfil arbitrário/malicioso
    const html = renderToString(
      <AuthContext.Provider value={capatazContext}>
        <ProtectedRoute requiredProfile={'__proto__' as any}>
          <div data-testid="exploit-payload">Exploit Payload</div>
        </ProtectedRoute>
      </AuthContext.Provider>
    );

    expect(html).toContain('Acesso N');
    expect(html).not.toContain('exploit-payload');
  });
});
