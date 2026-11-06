import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import type { ReactNode } from "react";
import { AppLanguageProvider, useTranslation } from "@/hooks/useTranslation";
import { translateStaticUiText, useStaticUiText } from "@/components/i18n/LocalizedText";
import STATIC_UI_EN from "@/lib/staticUiEnglish.json";

const affectedModules = [
  "pages/ProdutosPage.tsx", "pages/ConfiguracoesGeraisPage.tsx", "pages/CapatazDashboard.tsx",
  "pages/GerenteDashboard.tsx", "pages/LancamentoManualPage.tsx", "pages/ConsultorFazendasPage.tsx",
  "pages/TransferenciaRetiroPage.tsx", "pages/PecuaristaFazendaDetalhePage.tsx", "pages/PastoDetailPage.tsx",
  "pages/SyncVetNovoManejoPage.tsx", "pages/QrCodesPage.tsx", "pages/PecuaristaHistoricoPage.tsx",
  "pages/ConferenciaPage.tsx", "components/capataz/MortalidadeModal.tsx",
  "components/capataz/ObservacaoModal.tsx", "components/capataz/EntradaAnimaisModal.tsx",
  "components/capataz/TransferenciaModal.tsx", "components/conferencia/ConferenciaChecklist.tsx",
  "components/consultor/PastoVisitaModal.tsx", "components/eventos/SanitarioFormModal.tsx",
] as const;

const wrapper = ({ children }: { children: ReactNode }) => <AppLanguageProvider>{children}</AppLanguageProvider>;

describe("I18N-005 — notifications and confirmation messages", () => {
  it("keeps translator references stable in memoized offline handlers while updating the selected language", () => {
    localStorage.removeItem("consubov:app-language");
    const { result } = renderHook(() => ({ uiText: useStaticUiText(), setLanguage: useTranslation().setLanguage }), { wrapper });
    const originalCallback = result.current.uiText;
    expect(originalCallback("✅ Salvo offline")).toBe("✅ Salvo offline");
    act(() => result.current.setLanguage("en-US"));
    expect(result.current.uiText).toBe(originalCallback);
    expect(originalCallback("✅ Salvo offline")).toBe("✅ Saved offline");
    expect(originalCallback("Sem conexão")).toBe("No connection");
    act(() => result.current.setLanguage("pt-BR"));
    expect(originalCallback("Sem conexão")).toBe("Sem conexão");
  });

  it("translates only explicit UI copy, without altering user names, server details or technical identifiers", () => {
    expect(translateStaticUiText("en-US", "Nome do produto é obrigatório.")).toBe("Product name is required.");
    expect(translateStaticUiText("en-US", "Conferência salva offline. Será sincronizada ao reconectar."))
      .toBe("Inspection saved offline. It will sync when reconnected.");
    expect(translateStaticUiText("en-US", "Informe a categoria do pasto (Engorda, Recria 1, Recria 2 ou Cria) antes de salvar."))
      .toContain("pasture category");
    expect(translateStaticUiText("en-US", "Fazenda Santa Helena — lote B17"))
      .toBe("Fazenda Santa Helena — lote B17");
    expect(translateStaticUiText("en-US", "ERR_DB_23505")).toBe("ERR_DB_23505");
  });

  it("requires localized static first-argument notifications and a reviewed catalog for their expressions", () => {
    let migratedCalls = 0;
    for (const file of affectedModules) {
      const abs = resolve(process.cwd(), "src", file);
      const source = readFileSync(abs, "utf8");
      const tree = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function walk(node: ts.Node): void {
        if (ts.isCallExpression(node) && node.arguments.length > 0) {
          const expression = node.expression;
          const isToast = ts.isPropertyAccessExpression(expression)
            && ts.isIdentifier(expression.expression) && expression.expression.text === "toast"
            && ["error", "success", "warning", "info", "message"].includes(expression.name.text);
          const isConfirm = ts.isIdentifier(expression) && ["confirm", "alert"].includes(expression.text);
          if (isToast || isConfirm) {
            expect(ts.isStringLiteral(node.arguments[0]), `${file}: untranslated notification`).toBe(false);
            if (node.getText(tree).includes("uiText(")) migratedCalls++;
          }
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "uiText") {
          const first = node.arguments[0];
          if (first && ts.isStringLiteral(first)) {
            expect(Object.prototype.hasOwnProperty.call(STATIC_UI_EN, first.text), `${file}: missing ${first.text}`)
              .toBe(true);
          }
        }
        ts.forEachChild(node, walk);
      }
      walk(tree);
    }
    expect(migratedCalls).toBeGreaterThanOrEqual(115);
  });
});
