import { describe, expect, test } from "bun:test";
import {
  AUDITORIA_FOTOS_PADRAO,
  INTERVALO_PADRAO_DIAS,
  resolverAuditoria,
  resolverIntervaloEfetivoDias,
} from "./configuracao";

describe("intervalo efetivo de salgas", () => {
  test("nível 1: valor do próprio pasto vence", () => {
    expect(
      resolverIntervaloEfetivoDias({ pasto: 7, retiro: 5, fazenda: 4 }),
    ).toBe(7);
  });

  test("nível 2: sem valor no pasto, usa o retiro", () => {
    expect(
      resolverIntervaloEfetivoDias({ pasto: null, retiro: 5, fazenda: 4 }),
    ).toBe(5);
    expect(
      resolverIntervaloEfetivoDias({ pasto: undefined, retiro: 5, fazenda: 4 }),
    ).toBe(5);
  });

  test("nível 3: sem pasto nem retiro, usa a fazenda", () => {
    expect(
      resolverIntervaloEfetivoDias({ pasto: null, retiro: null, fazenda: 4 }),
    ).toBe(4);
  });

  test("nível 4: sem nenhuma fonte, cai no padrão 3", () => {
    expect(
      resolverIntervaloEfetivoDias({
        pasto: null,
        retiro: null,
        fazenda: null,
      }),
    ).toBe(3);
    expect(INTERVALO_PADRAO_DIAS).toBe(3);
  });

  test("zero explícito no pasto é respeitado (não é ausência)", () => {
    expect(
      resolverIntervaloEfetivoDias({ pasto: 0, retiro: 5, fazenda: 4 }),
    ).toBe(0);
  });
});

describe("auditoria de fotos da saída", () => {
  test("prioridade retiro → fazenda → padrão", () => {
    expect(
      resolverAuditoria(
        { auditoria_fotos_por_bloco: 1, exigir_foto_cocho: false },
        { auditoria_fotos_por_bloco: 7, exigir_foto_cocho: true },
      ),
    ).toEqual({ fotosPorBloco: 1, exigirFotoCocho: false });
  });

  test("usa a fazenda quando o retiro não define nada", () => {
    expect(
      resolverAuditoria(
        { auditoria_fotos_por_bloco: null, exigir_foto_cocho: null },
        { auditoria_fotos_por_bloco: 7, exigir_foto_cocho: false },
      ),
    ).toEqual({ fotosPorBloco: 7, exigirFotoCocho: false });
  });

  test("usa o padrão quando nenhum nível define", () => {
    expect(resolverAuditoria(null, null)).toEqual({
      fotosPorBloco: AUDITORIA_FOTOS_PADRAO,
      exigirFotoCocho: true,
    });
    expect(AUDITORIA_FOTOS_PADRAO).toBe(3);
  });

  test("campos são resolvidos de forma independente", () => {
    expect(
      resolverAuditoria(
        { auditoria_fotos_por_bloco: 2 },
        { exigir_foto_cocho: false },
      ),
    ).toEqual({ fotosPorBloco: 2, exigirFotoCocho: false });
  });

  test("zero fotos no retiro significa dispensa, não ausência", () => {
    expect(
      resolverAuditoria({ auditoria_fotos_por_bloco: 0 }, {
        auditoria_fotos_por_bloco: 7,
      }),
    ).toEqual({ fotosPorBloco: 0, exigirFotoCocho: true });
  });
});
