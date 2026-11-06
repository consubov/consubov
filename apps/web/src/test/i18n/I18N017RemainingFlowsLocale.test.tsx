import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), "src", path), "utf8");
}

describe("I18N-017 — operational flows", () => {
  it("translates reviewed field and visit messages without touching user data", () => {
    expect(translateStaticUiText("en-US", "Conecte à internet e sincronize antes de gerar o PDF."))
      .toBe("Connect to the internet and sync before generating the PDF.");
    expect(translateStaticUiText("en-US", "Capataz atualizado!"))
      .toBe("Ranch foreman updated!");
    expect(translateStaticUiText("en-US", "Erro ao adicionar amostra"))
      .toBe("Could not add sample");
    expect(translateStaticUiText("pt-BR", "Erro ao adicionar amostra"))
      .toBe("Erro ao adicionar amostra");
    expect(translateStaticUiText("en-US", "Fazenda João 17"))
      .toBe("Fazenda João 17");
  });
  it("uses the selected locale for previous weighing date", () => {
    const exec = source("pages/PecuaristaPesagemExecPage.tsx");
    expect(exec).toContain("new Date(prev.data_anterior).toLocaleString(language)");
    expect(exec).not.toContain('new Date(prev.data_anterior).toLocaleString("pt-BR")');
  });
  it("localizes repeated animal headings in weighing and sorting", () => {
    for (const path of ["pages/PecuaristaApartacaoPage.tsx", "pages/PecuaristaPesagemExecPage.tsx"]) {
      const page = source(path);
      expect(page).not.toContain("Animal {animalNum}");
      expect(page).toContain('{uiText("Animal ")}{animalNum}');
    }
  });
  it("keeps credential lifecycle out of scope while localizing non-sensitive foreman messages", () => {
    const page = source("pages/CapatazesPage.tsx");
    expect(page).toContain('toast.error(uiText("Nome e email são obrigatórios"))');
    expect(page).toContain('confirm(uiText("Excluir este capataz?"))');
    expect(page).toContain('title={uiText("Redefinir Senha")}');
    expect(page).toContain('label={uiText("Retiros *")}');
  });
});
