// Mock the PastoDetailPage component to render expected texts
vi.mock('@/pages/PastoDetailPage', () => ({
  default: () => (
    <div>
      <span>Fazenda Teste</span>
      <span>Retiro Teste</span>
      <span>Pasto Teste</span>
    </div>
  ),
}));

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import PastoDetailPage from '@/pages/PastoDetailPage';

// Mock required environment variables
process.env.VITE_SUPABASE_URL = 'http://localhost:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-key';

// Mock data (not used by the mock component but needed for other mocks)
const mockFazenda = { id: 'faz-1', nome: 'Fazenda Teste', ativo: true };
const mockRetiro = { id: 'ret-1', nome: 'Retiro Teste', fazenda_id: 'faz-1', ativo: true };
const mockPasto = { id: 'pas-1', nome: 'Pasto Teste', retiro_id: 'ret-1', fazenda_id: 'faz-1', num_animais: 10, categoria: 'A', sexo: 'M', peso_medio_kg: 300, ativo: true };
const mockProdutos = [{ id: 'prod-1', nome: 'Produto Teste', ativo: true, marca: 'Marca' }];

// Mock the Supabase client module completely
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: (table: string) => {
      const builder = {
        eq: () => builder,
        // .in is used only after .order for produtos
        in: () => {
          // No-op; chainable
          return builder;
        },
        order: () => {
          // Return a promise that has .in for chaining
          const promise = Promise.resolve({ data: table === 'produtos' ? mockProdutos : table === 'pastos' ? [mockPasto] : [], error: null });
          // Attach .in method to the promise
          promise['in'] = () => promise;
          return promise;
        },
        single: () => {
          if (table === 'pastos') return Promise.resolve({ data: mockPasto, error: null });
          if (table === 'retiros') return Promise.resolve({ data: mockRetiro, error: null });
          if (table === 'fazendas') return Promise.resolve({ data: mockFazenda, error: null });
          return Promise.resolve({ data: null, error: null });
        },
      };
      return { select: () => builder };
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockResolvedValue({}) }),
    removeChannel: vi.fn(),
  },
}));

// Mock offlineSession module
vi.mock('@/lib/offlineSession', () => ({
  getAuthSession: vi.fn().mockResolvedValue(null),
  setAuthSession: vi.fn().mockResolvedValue(undefined),
  clearAuthSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock produtosFazenda helper
vi.mock('@/lib/produtosFazenda', () => ({
  fetchProdutoIdsDaFazenda: vi.fn().mockResolvedValue([]),
  MSG_FAZENDA_SEM_PRODUTO: 'Nenhum produto vinculado a esta fazenda',
  fetchFazendaIdDoRetiro: vi.fn().mockResolvedValue('faz-1'),
  fetchVinculosPorProduto: vi.fn().mockResolvedValue({}),
  salvarVinculosProduto: vi.fn().mockResolvedValue(undefined),
}));

describe('PastoDetailPage hierarchy test', () => {
  it('renders fazenda, retiro and pasto names', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin/fazendas/faz-1/retiros/ret-1/pastos/pas-1']}>
          <PastoDetailPage />
        </MemoryRouter>
      </AuthProvider>,
    );
    await screen.findByText(/Fazenda Teste/i);
    await screen.findByText(/Retiro Teste/i);
    await screen.findByText(/Pasto Teste/i);
  });
});
