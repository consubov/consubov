import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/hooks/useAuth';
import PastoDetailPage from '@/pages/PastoDetailPage';

const state = vi.hoisted(() => ({
  fazenda: { id: 'faz-1', nome: 'Fazenda Teste', ativo: true },
  retiro: { id: 'ret-1', nome: 'Retiro Teste', fazenda_id: 'faz-1', ativo: true, produto_id: null },
  pasto: {
    id: 'pas-1',
    nome: 'Pasto Teste',
    retiro_id: 'ret-1',
    fazenda_id: 'faz-1',
    num_animais: 10,
    categoria: 'A',
    sexo: 'M',
    peso_medio_kg: 300,
    produto_id: null,
    ativo: true,
  },
  produtos: [{ id: 'prod-1', nome: 'Produto Teste', ativo: true, marca: 'Marca' }],
}));

vi.mock('@/integrations/supabase/client', () => {
  function queryFor(table: string) {
    const filters = new Map<string, unknown>();

    const listResult = () => {
      if (table === 'produtos') return { data: state.produtos, error: null };
      if (table === 'pastos' && filters.get('retiro_id') === state.retiro.id) {
        return { data: [state.pasto], error: null };
      }
      return { data: [], error: null };
    };

    const singleResult = () => {
      if (table === 'pastos' && filters.get('id') === state.pasto.id) return { data: state.pasto, error: null };
      if (table === 'retiros' && filters.get('id') === state.retiro.id) return { data: state.retiro, error: null };
      if (table === 'fazendas' && filters.get('id') === state.fazenda.id) return { data: state.fazenda, error: null };
      return { data: null, error: { message: 'not found' } };
    };

    const query: any = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.set(column, value);
        return query;
      },
      in: () => query,
      order: () => query,
      single: () => Promise.resolve(singleResult()),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(listResult()).then(resolve, reject),
    };

    return query;
  }

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
      from: (table: string) => queryFor(table),
      channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/lib/produtosFazenda', () => ({
  fetchProdutoIdsDaFazenda: vi.fn().mockResolvedValue([]),
  MSG_FAZENDA_SEM_PRODUTO: 'Nenhum produto vinculado a esta fazenda',
}));

function renderHierarchy(path = '/admin/fazendas/faz-1/retiros/ret-1/pastos/pas-1') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/admin/fazendas/:fazendaId/retiros/:retiroId/pastos/:pastoId"
            element={<PastoDetailPage />}
          />
          <Route path="/admin/fazendas/:fazendaId" element={<div>Retorno para fazenda</div>} />
          <Route path="/admin/fazendas" element={<div>Lista de fazendas</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

afterEach(() => {
  state.fazenda = { id: 'faz-1', nome: 'Fazenda Teste', ativo: true };
  state.retiro = { id: 'ret-1', nome: 'Retiro Teste', fazenda_id: 'faz-1', ativo: true, produto_id: null };
  state.pasto = {
    id: 'pas-1',
    nome: 'Pasto Teste',
    retiro_id: 'ret-1',
    fazenda_id: 'faz-1',
    num_animais: 10,
    categoria: 'A',
    sexo: 'M',
    peso_medio_kg: 300,
    produto_id: null,
    ativo: true,
  };
});

describe('PastoDetailPage hierarchy', () => {
  it('renders the real page when fazenda, retiro and pasto ancestry matches the route', async () => {
    renderHierarchy();

    expect((await screen.findAllByText('Fazenda Teste')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Retiro Teste')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('Pasto Teste')).length).toBeGreaterThan(0);
  });

  it('does not render mixed ancestry when retiro belongs to another fazenda', async () => {
    state.retiro = { ...state.retiro, fazenda_id: 'faz-other' };

    renderHierarchy();

    await waitFor(() => {
      expect(screen.getByText('Retorno para fazenda')).toBeInTheDocument();
    });
    expect(screen.queryByText('Pasto Teste')).not.toBeInTheDocument();
  });
});
