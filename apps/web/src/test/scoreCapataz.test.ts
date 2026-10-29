import { fetchNotaCochoConsultor } from '../lib/scoreCapataz';
import { supabase } from '../integrations/supabase/client';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn()
    }
  };
});

describe('fetchNotaCochoConsultor', () => {
  let fromMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    const buildChain = (data: any) => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data }),
      };

      chain.order = vi.fn().mockResolvedValue({ data });
      return chain;
    };

    fromMock = vi.fn().mockImplementation((table) => {
        if (table === "visitas_tecnicas") return buildChain([{ id: 'v1', hora_inicio: '2023-01-01', created_at: '2023-01-01' }]);
        if (table === "visita_pastos") return buildChain([{ id: 'vp1', visita_id: 'v1' }, { id: 'vp2', visita_id: 'v1' }]);
        if (table === "visita_currais") return buildChain([{ id: 'vc1', visita_id: 'v1' }, { id: 'vc2', visita_id: 'v1' }]);
        if (table === "avaliacoes_score") {
            const chain = buildChain([]);
            chain.in = vi.fn().mockImplementation((col) => {
                if (col === "visita_pasto_id") {
                    return Promise.resolve({ data: [{ nota: 4, visita_pasto_id: 'vp1' }] });
                }
                if (col === "visita_curral_id") {
                    return Promise.resolve({ data: [{ nota: 5, visita_curral_id: 'vc1' }] });
                }
                return Promise.resolve({ data: [] });
            });
            return chain;
        }
        return buildChain([]);
    });

    (supabase.from as any) = fromMock;
  });

  it('calculates average score efficiently', async () => {
    const start = performance.now();
    const result = await fetchNotaCochoConsultor('fazenda-123', new Date('2023-01-01'), new Date('2023-12-31'));
    const end = performance.now();

    console.log(`Time taken: ${end - start}ms`);
    expect(result).not.toBeNull();
    if (result) {
        expect(result.nota).toBe(4.5);
    }
  });
});
