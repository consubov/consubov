import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { AppLanguageProvider, useTranslation } from "@/hooks/useTranslation";
import { LocalizedText, translateStaticUiText, useStaticUiText } from "@/components/i18n/LocalizedText";
import STATIC_UI_EN from "@/lib/staticUiEnglish.json";

const coveredFiles = [
  "pages/GerenteDashboard.tsx",
  "pages/CapatazDashboard.tsx",
  "pages/ConsultorFazendasPage.tsx",
  "pages/ConfiguracoesGeraisPage.tsx",
  "pages/ProdutosPage.tsx",
  "pages/LancamentoManualPage.tsx",
  "pages/QrCodesPage.tsx",
  "pages/TransferenciaRetiroPage.tsx",
  "pages/AdminSyncVetOnboardingPage.tsx",
  "pages/ConferenciaPage.tsx",
  "pages/PastoDetailPage.tsx",
  "pages/SyncVetNovoManejoPage.tsx",
  "pages/PecuaristaFazendaDetalhePage.tsx",
  "pages/PecuaristaHistoricoPage.tsx",
  "pages/PesadorPesagemExecPage.tsx",
  "pages/PesadorPesagemPage.tsx",
  "pages/SyncVetEquipePage.tsx",
  "pages/ConsultoresPage.tsx",
  "pages/OperadoresFabricaPage.tsx",
  "components/admin/CriarAdminModal.tsx",
  "components/admin/CriarEscritorioModal.tsx",
  "components/capataz/ObservacaoModal.tsx",
  "components/capataz/MortalidadeModal.tsx",
  "components/capataz/EntradaAnimaisModal.tsx",
  "components/capataz/TransferenciaModal.tsx",
  "components/conferencia/ConferenciaChecklist.tsx",
  "components/consultor/PastoVisitaModal.tsx",
  "components/consultor/CurralVisitaModal.tsx",
  "components/consultor/PennStateSection.tsx",
  "components/consultor/VisitaTopicosSection.tsx",
  "components/eventos/SanitarioFormModal.tsx",
  "components/mapa/MapaEditor.tsx",
  "components/mapa/MapaEntradaAnimaisModal.tsx"
] as const;
const coveredLabelFiles = [
  "pages/AdminFazendaPainelPage.tsx",
  "pages/AdminRetiroPainelPage.tsx",
  "pages/PecuaristaDashboard.tsx",
  "pages/PesadorDashboard.tsx",
  "pages/ConsultorPainelPage.tsx",
  "pages/FabricaDashboard.tsx",
  "pages/SyncVetEmpresaPage.tsx",
  "pages/RevisaoVisitaPage.tsx",
  "components/conferencia/ConferenciaResultado.tsx",
  "components/eventos/DetalhesLoteModal.tsx",
  "components/consultor/ConfinamentoRevisaoView.tsx",
  "components/consultor/ConfinamentoVisitaView.tsx",
  "components/consultor/PastoVisitaModal.tsx",
  "components/consultor/CurralVisitaModal.tsx",
  "components/mapa/MapaTransferenciaModal.tsx",
  "components/capataz/TransferenciaModal.tsx"
] as const;

function FieldPreview() {
  const uiText = useStaticUiText();
  const { setLanguage } = useTranslation();
  return (
    <div>
      <button onClick={() => setLanguage("en-US")}>Switch to English</button>
      <button onClick={() => setLanguage("pt-BR")}>Voltar ao português</button>
      <input aria-label={uiText("Selecionar retiro")} placeholder={uiText("Selecione o pasto")} />
      <button title={uiText("Restaurar padrão")}>Action</button>
      <p><LocalizedText source="Senha de acesso *" /></p>
    </div>
  );
}

describe("I18N-004 — static form fields and accessibility copy", () => {
  beforeEach(() => localStorage.clear());

  it("switches placeholders, aria labels, titles and new manager fields immediately, without changing site language", () => {
    localStorage.setItem("consubov:site-language", "pt-BR");
    render(<AppLanguageProvider><FieldPreview /></AppLanguageProvider>);
    expect(screen.getByPlaceholderText("Selecione o pasto")).toHaveAttribute("aria-label", "Selecionar retiro");
    expect(screen.getByText("Senha de acesso *")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(screen.getByPlaceholderText("Select a pasture")).toHaveAttribute("aria-label", "Select ranch unit");
    expect(screen.getByRole("button", { name: "Action" })).toHaveAttribute("title", "Restore default");
    expect(screen.getByText("Access password *")).toBeInTheDocument();
    expect(localStorage.getItem("consubov:app-language")).toBe("en-US");
    expect(localStorage.getItem("consubov:site-language")).toBe("pt-BR");
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao português" }));
    expect(screen.getByPlaceholderText("Selecione o pasto")).toHaveAttribute("aria-label", "Selecionar retiro");
  });

  it("never substitutes operational user values or unknown labels", () => {
    expect(translateStaticUiText("en-US", "Fazenda do João - Lote 100")).toBe("Fazenda do João - Lote 100");
    expect(translateStaticUiText("en-US", "ex: eficiencia_nutricional")).toBe("e.g., eficiencia_nutricional");
    expect(translateStaticUiText("en-US", "Total Animais")).toBe("Total Animals");
    expect(translateStaticUiText("en-US", "Total (R$)")).toBe("Total (BRL)");
    expect(translateStaticUiText("pt-BR", "ex: eficiencia_nutricional")).toBe("ex: eficiencia_nutricional");
    expect(translateStaticUiText("en-US", "consumo_real_kg / (num_animais * dias_intervalo)"))
      .toBe("consumo_real_kg / (num_animais * dias_intervalo)");
  });

  it("translates safe manager creation errors without echoing server-provided details", () => {
    const managerErrors = [
      "Este e-mail já está cadastrado. Use um e-mail exclusivo para o novo gerente.",
      "Dados inválidos. Confira o e-mail e a senha.",
      "Sua sessão expirou. Entre novamente como administrador.",
      "Sua conta não tem permissão para cadastrar usuários.",
      "Cadastro já existente. Verifique antes de tentar novamente.",
      "Muitas tentativas. Aguarde antes de tentar novamente.",
      "Serviço de cadastro indisponível. Confirme o estado do usuário antes de repetir.",
      "Cadastro não concluído. Verifique a conexão antes de tentar novamente.",
    ];
    for (const message of managerErrors) {
      expect(translateStaticUiText("en-US", message)).not.toBe(message);
      expect(translateStaticUiText("pt-BR", message)).toBe(message);
    }
    expect(translateStaticUiText("en-US", "secret server debug: private data"))
      .toBe("secret server debug: private data");
  });

  it("keeps a reviewed English catalog entry for every migrated static JSX attribute", () => {
    let migratedCount = 0;
    for (const file of new Set([...coveredFiles, ...coveredLabelFiles])) {
      const path = resolve(process.cwd(), "src", file);
      const src = readFileSync(path, "utf8");
      const tree = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node): void {
        if (ts.isJsxAttribute(node) && ["placeholder", "aria-label", "title", "label"].includes(node.name.getText(tree))
          && node.initializer && ts.isJsxExpression(node.initializer)) {
          const call = node.initializer.expression;
          if (call && ts.isCallExpression(call) && ts.isIdentifier(call.expression)
            && call.expression.text === "uiText") {
            const value = call.arguments[0];
            // This test covers static literals; dynamic enum labels are checked by their own module tests.
            if (value && ts.isStringLiteral(value)) {
              expect(Object.prototype.hasOwnProperty.call(STATIC_UI_EN, value.text), `${file}: ${value.text}`).toBe(true);
              expect(translateStaticUiText("en-US", value.text)).not.toBe(value.text);
              migratedCount++;
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
    expect(migratedCount).toBeGreaterThanOrEqual(219);
  });
});
