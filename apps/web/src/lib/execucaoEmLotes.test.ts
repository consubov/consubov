import { describe, expect, it, vi } from "vitest";
import { executarEmLotes } from "./execucaoEmLotes";

describe("executarEmLotes: limite e integridade das gravações", () => {
  it("processa todos os registros, com no máximo 4 gravações simultâneas", async () => {
    let ativos = 0;
    let maximo = 0;
    const gravados: number[] = [];
    await executarEmLotes(Array.from({ length: 17 }, (_, i) => i), async (id) => {
      ativos++;
      maximo = Math.max(maximo, ativos);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        gravados.push(id);
      } finally {
        ativos--;
      }
    });
    expect(gravados.sort((a, b) => a - b)).toEqual(Array.from({ length: 17 }, (_, i) => i));
    expect(maximo).toBe(4);
    expect(ativos).toBe(0);
  });

  it("só inicia o próximo lote após conclusão do lote atual", async () => {
    const trace: string[] = [];
    await executarEmLotes([1, 2, 3, 4, 5, 6], async (id) => {
      trace.push(`start-${id}`);
      await Promise.resolve();
      trace.push(`end-${id}`);
    });
    expect(trace.slice(0, 4)).toEqual(["start-1", "start-2", "start-3", "start-4"]);
    expect(trace.indexOf("start-5")).toBeGreaterThan(trace.indexOf("end-4"));
    expect(trace.indexOf("start-6")).toBeGreaterThan(trace.indexOf("end-4"));
  });

  it("espera todas as gravações iniciadas terminarem após falha e não executa novos lotes", async () => {
    const inicio: number[] = [];
    const termino: number[] = [];
    const falha = new Error("retiro não foi salvo");
    await expect(executarEmLotes([0, 1, 2, 3, 4, 5], async (id) => {
      inicio.push(id);
      if (id === 1) throw falha;
      await new Promise((resolve) => setTimeout(resolve, 5));
      termino.push(id);
    })).rejects.toBe(falha);
    expect(inicio).toEqual([0, 1, 2, 3]);
    expect(termino.sort()).toEqual([0, 2, 3]);
  });

  it("protege o mesmo fluxo quando a função falha de forma síncrona", async () => {
    const inicio: number[] = [];
    const falha = new Error("não autorizado");
    await expect(executarEmLotes([0, 1, 2, 3, 4], (id) => {
      inicio.push(id);
      if (id === 0) throw falha;
      return Promise.resolve();
    })).rejects.toBe(falha);
    expect(inicio).toEqual([0, 1, 2, 3]);
  });

  it("não faz requisições quando não há alterações", async () => {
    const gravar = vi.fn(async (_id: number) => {});
    await executarEmLotes([], gravar);
    expect(gravar).not.toHaveBeenCalled();
  });
});
