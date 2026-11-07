import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import EN from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");
const cmsSource = "pages/LandingPageConfigPage.tsx";
const partnersSource = "components/landing/ParceirosEditor.tsx";
const pushSource = "components/UserNotificationToggle.tsx";

/** Static CMS schema describes author-controlled labels; values stored in the database are not copy. */
describe("I18N-013 — CMS metadata and push controls", () => {
  it("provides reviewed English copy for both landing editor schemas", () => {
    const src = read(cmsSource);
    const ast = ts.createSourceFile(cmsSource, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const end = src.indexOf("/* ------------------- Helpers ------------------- */");
    const unchanged = new Set(["", "CONSUBOV", "MANIFESTO", "(63) 99113-6071", "2026"]);
    let fields = 0;
    const walk = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.getStart(ast) < end &&
          ["title", "label", "description", "help", "placeholder"].includes(node.name.getText(ast)) &&
          ts.isStringLiteral(node.initializer)) {
        const literal = node.initializer.text;
        if (!unchanged.has(literal)) {
          expect(Object.prototype.hasOwnProperty.call(EN, literal), `Missing EN: ${literal}`).toBe(true);
          fields++;
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(ast);
    expect(fields).toBeGreaterThan(100);
    expect(translateStaticUiText("en-US", "1. Hero (topo da página)")).toBe("1. Hero (top of page)");
    expect(translateStaticUiText("en-US", "Campos do formulário")).toBe("Form fields");
    expect(translateStaticUiText("pt-BR", "Campos do formulário")).toBe("Campos do formulário");
  });

  it("localizes labels and examples only on render, without altering saved CMS content", () => {
    const src = read(cmsSource);
    expect(src).toContain("{uiText(section.title)}");
    expect(src).toContain("{uiText(field.label)}");
    expect(src).toContain("{uiText(f.label)}");
    expect(src).toContain("placeholder={field.placeholder ? uiText(field.placeholder) : undefined}");
    expect(src).toContain('valor: values[f.key] ?? ""');
    expect(src).toContain("setField(field.key, JSON.stringify(arr))");
    expect(src).toContain("value={values[field.key] || \"\"}");
    expect(translateStaticUiText("en-US", "CONSUBOV")) .toBe("CONSUBOV");
    expect(translateStaticUiText("en-US", "fazenda-própria-17")).toBe("fazenda-própria-17");
  });

  it("translates editor upload/save feedback but retains server errors and storage metadata", () => {
    const src = read(cmsSource);
    expect(src).toContain('`${uiText("Erro ao salvar ")}${row.chave}: ${error.message}`');
    expect(src).toContain('`${uiText("Erro ao enviar imagem: ")}${error.message}`');
    expect(src).toContain('`${uiText("Todas as alterações foram salvas (")}${okCount}${uiText(" campos).")}`');
    expect(src).toContain('onConflict: "landing_slug,chave"');
    expect(src).toContain('landing_slug: landingSlug');
    expect(translateStaticUiText("en-US", "Substituir")).toBe("Replace");
    expect(translateStaticUiText("pt-BR", "Salvar seção")).toBe("Salvar seção");
  });

  it("localizes partner editor labels without translating names or database status", () => {
    const src = read(partnersSource);
    expect(src).toContain('value={p.nome || ""}');
    expect(src).toContain('patch(p.id, { nome: e.target.value })');
    expect(src).toContain('patch(p.id, { ativo: !p.ativo })');
    expect(src).toContain('uiText(p.ativo ? "Ativo" : "Inativo")');
    expect(src).toContain('placeholder={uiText("Nome do parceiro")}');
    expect(translateStaticUiText("en-US", "Adicionar parceiro")).toBe("Add partner");
    expect(translateStaticUiText("en-US", "Inativo")).toBe("Inactive");
  });

  it("translates device-specific push feedback and accessible control labels without altering permission logic", () => {
    const src = read(pushSource);
    expect(src).toContain('body: uiText("Notificações ativadas com sucesso ✓")');
    expect(src).toContain('aria-label={uiText(visual.label)}');
    expect(src).toContain('title={uiText(visual.label)}');
    expect(src).toContain('if (perm !== "granted")');
    expect(src).toContain('setStoredPushEnabledPreference(novo)');
    expect(src).toContain('savePushSubscription(user.id, sub, enabled)');
    expect(translateStaticUiText("en-US", "Notificações ativadas")).toBe("Notifications enabled");
    expect(translateStaticUiText("en-US", "Permissão não concedida")).toBe("Permission not granted");
    expect(translateStaticUiText("en-US", "Bloqueadas — libere nas permissões do app")).toBe("Blocked — allow notifications in app permissions");
  });
});
