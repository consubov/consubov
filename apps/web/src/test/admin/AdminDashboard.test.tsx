import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import AdminDashboard from '@/pages/AdminDashboard';

// Supabase mock
const mockCounts = {
  fazendas: 5,
  retiros: 5,
  pastos: 5,
  produtos: 5,
  ciclos: 5,
  lancamentos: 5,
  fabricas: 5,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: (table: string) => {
      console.log('Supabase mock called:', table, { head: false }); // Simplified for mock
      return {
        select: (_cols: any, opts: any = {}) => {
          const isHead = opts && opts.head;
          if (isHead) {
            const result = { count: mockCounts[table] ?? 0 };
            return {
              eq: () => Promise.resolve(result),
              then: (resolve: any, _reject: any) => resolve(result),
            } as any;
          }
          if (table === 'pastos' && (_cols === 'num_animais' || (_cols && Array.isArray(_cols) && _cols.includes('num_animais')))) {
            const mockData = Array.from({ length: 10 }, (_, i) => ({ id: i, num_animais: 5 }));
            return {
              eq: () => Promise.resolve({ data: mockData }),
            };
          }
          return {
            eq: () => Promise.resolve({ count: mockCounts[table] ?? 0 }),
          };
        },
      };
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({}),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/components/admin/AdminListSection', () => ({
  default: () => null,
}));

describe('AdminDashboard component', () => {
  it('renders stats after data load', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Fazendas/i)).toBeInTheDocument();
      expect(screen.getAllByText('5')).toHaveLength(7);
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });
});