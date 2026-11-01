import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  queries: [] as string[],
  maxRows: 1000,
  maxInIds: 10000,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const predicates: Array<(row: Record<string, unknown>) => boolean> = [];
      let ordering: { field: string; ascending: boolean } | null = null;
      const q = {
        select: (_columns: string) => q,
        eq: (column: string, value: unknown) => { predicates.push(row => row[column] === value); return q; },
        gte: (column: string, value: string) => { predicates.push(row => String(row[column]) >= value); return q; },
        lte: (column: string, value: string) => { predicates.push(row => String(row[column]) <= value); return q; },
        in: (column: string, values: unknown[]) => {
          if (values.length > fixture.maxInIds) throw new Error("simulated URL filter limit");
          predicates.push(row => values.includes(row[column]));
          return q;
        },
        order: (field: string, opts: { ascending: boolean }) => { ordering = { field, ascending: opts.ascending }; return q; },
        then: (
          fulfilled: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
          rejected?: (reason: unknown) => unknown,
        ) => {
          fixture.queries.push(table);
          let rows = (fixture.rows[table] ?? []).filter(row => predicates.every(predicate => predicate(row)));
          if (ordering) {
            const { field, ascending } = ordering;
            rows = rows.sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (ascending ? 1 : -1));
          }
          return Promise.resolve({ data: rows.slice(0, fixture.maxRows), error: null }).then(fulfilled, rejected);
        },
      };
      return q;
    },
  },
}));

import { fetchNotaCochoConsultor } from "./scoreCapataz";

const start = new Date("2026-10-01T00:00:00.000Z");
const end = new Date("2026-11-01T00:00:00.000Z");
const visit = (id: string, day: number) => ({ id, fazenda_id: "farm-a", hora_inicio: `2026-10-${String(day).padStart(2, "0")}T12:00:00.000Z`, created_at: null });

beforeEach(() => {
  fixture.rows = {};
  fixture.queries = [];
  fixture.maxRows = 1000;
  fixture.maxInIds = 10000;
});

describe("fetchNotaCochoConsultor - batched queries preserve visit semantics", () => {
  it("returns the latest visit with positive scores from both sources", async () => {
    fixture.rows.visitas_tecnicas = [visit("old", 19), visit("new", 20)];
    fixture.rows.visita_pastos = [{ id: "p-new", visita_id: "new" }, { id: "p-old", visita_id: "old" }];
    fixture.rows.visita_currais = [{ id: "c-new", visita_id: "new" }];
    fixture.rows.avaliacoes_score = [
      { visita_pasto_id: "p-new", nota: "2" },
      { visita_curral_id: "c-new", nota: 4 },
      { visita_pasto_id: "p-old", nota: 5 },
    ];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 3, dataVisita: visit("new", 20).hora_inicio });
    expect(fixture.queries).toHaveLength(5);
  });

  it("skips visits with no positive or finite notes, then returns an older valid visit", async () => {
    fixture.rows.visitas_tecnicas = [visit("old", 19), visit("new", 20)];
    fixture.rows.visita_pastos = [{ id: "p-new", visita_id: "new" }, { id: "p-old", visita_id: "old" }];
    fixture.rows.avaliacoes_score = [
      { visita_pasto_id: "p-new", nota: 0 },
      { visita_pasto_id: "p-new", nota: "invalid" },
      { visita_pasto_id: "p-old", nota: 4 },
    ];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 4, dataVisita: visit("old", 19).hora_inicio });
  });

  it("makes bounded queries for 50 visits instead of N+1", async () => {
    fixture.rows.visitas_tecnicas = Array.from({ length: 50 }, (_, i) => ({ ...visit(`v${i}`, 20), hora_inicio: `2026-10-20T12:${String(i).padStart(2, "0")}:00.000Z` }));
    fixture.rows.visita_pastos = [{ id: "p-last", visita_id: "v0" }];
    fixture.rows.avaliacoes_score = [{ visita_pasto_id: "p-last", nota: 5 }];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 5, dataVisita: "2026-10-20T12:00:00.000Z" });
    expect(fixture.queries.length).toBeLessThanOrEqual(5);
  });

  it("never loses a recent note when a batched response is limited to 1000 rows", async () => {
    fixture.rows.visitas_tecnicas = [visit("old", 19), visit("new", 20)];
    fixture.rows.visita_pastos = [
      ...Array.from({ length: 1000 }, (_, i) => ({ id: `p-old-${i}`, visita_id: "old" })),
      { id: "p-new", visita_id: "new" },
    ];
    fixture.rows.avaliacoes_score = [
      ...Array.from({ length: 1000 }, (_, i) => ({ visita_pasto_id: `p-old-${i}`, nota: 1 })),
      { visita_pasto_id: "p-new", nota: 5 },
    ];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 5, dataVisita: visit("new", 20).hora_inicio });
  });

  it("does not turn a large visit filter into a failed URL-sized request", async () => {
    fixture.maxInIds = 50;
    fixture.rows.visitas_tecnicas = Array.from({ length: 51 }, (_, i) => ({ ...visit(`v${i}`, 20), hora_inicio: `2026-10-20T12:${String(i).padStart(2, "0")}:00.000Z` }));
    fixture.rows.visita_pastos = [{ id: "p-last", visita_id: "v0" }];
    fixture.rows.avaliacoes_score = [{ visita_pasto_id: "p-last", nota: 5 }];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 5, dataVisita: "2026-10-20T12:00:00.000Z" });
  });

  it("does not omit the newest score when the evaluations response reaches 1000 rows", async () => {
    fixture.rows.visitas_tecnicas = [visit("old", 19), visit("new", 20)];
    fixture.rows.visita_pastos = [{ id: "p-old", visita_id: "old" }, { id: "p-new", visita_id: "new" }];
    fixture.rows.avaliacoes_score = [
      ...Array.from({ length: 1000 }, () => ({ visita_pasto_id: "p-old", nota: 1 })),
      { visita_pasto_id: "p-new", nota: 5 },
    ];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 5, dataVisita: visit("new", 20).hora_inicio });
  });

  it("preserves original read semantics when the score filter would contain over 100 ids", async () => {
    fixture.rows.visitas_tecnicas = [visit("new", 20)];
    fixture.rows.visita_pastos = Array.from({ length: 101 }, (_, i) => ({ id: `p-${i}`, visita_id: "new" }));
    fixture.rows.avaliacoes_score = [{ visita_pasto_id: "p-100", nota: 4 }];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toEqual({ nota: 4, dataVisita: visit("new", 20).hora_inicio });
  });

  it("returns null if there is no visit in the farm/period", async () => {
    fixture.rows.visitas_tecnicas = [{ ...visit("outside", 10), fazenda_id: "farm-b" }];
    await expect(fetchNotaCochoConsultor("farm-a", start, end)).resolves.toBeNull();
    expect(fixture.queries).toEqual(["visitas_tecnicas"]);
  });
});
