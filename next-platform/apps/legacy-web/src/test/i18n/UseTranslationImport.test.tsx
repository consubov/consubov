import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTranslation } from "@/hooks/useTranslation";

describe("useTranslation — contexto padrão", () => {
  it("usa pt-BR por padrão e mantém fallback para chave sem tradução", () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.language).toBe("pt-BR");
    expect(result.current.t("campo_desconhecido")).toBe("campo_desconhecido");
  });
});
