import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import STATIC_EN from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const targetFiles = [
  "pages/SyncVetAgendaPage.tsx",
  "components/consultor/SyncQueueDialog.tsx",
  "components/ForcarSyncButton.tsx",
  "components/consultor/PhotoGrid.tsx",
  "components/UpdateBanner.tsx",
  "pages/RevisaoVisitaPage.tsx",
] as const;
const source = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

/** Only author-controlled user-interface strings; never interpret backend/user values. */
describe("I18N-012 — operational and offline interface copy", () => {
  it("translates reviewed SyncVet, offline and photo status messages", () => {
    const cases = [
      ["Erro ao carregar agenda", "Could not load schedule"],
      ["Manejo concluído", "Procedure completed"],
      ["Forçar sincronização", "Force synchronization"],
      ["Foto ainda não sincronizada", "Photo not synced yet"],
      ["Erro ao enviar sinal — tente novamente.", "Could not send sync signal — please try again."],
      ["Fotos sincronizadas.", "Photos synced."],
      ["Gerar mesmo assim", "Generate anyway"],
    ] as const;
    for (const [pt, en] of cases) {
      expect(translateStaticUiText("pt-BR", pt)).toBe(pt);
      expect(translateStaticUiText("en-US", pt)).toBe(en);
    }
  });

  it("requires a reviewed catalog entry for every literal uiText call in patched components", () => {
    let verified = 0;
    for (const file of targetFiles) {
      const code = source(file);
      const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === "uiText") {
          const arg = node.arguments[0];
          const values = arg && ts.isStringLiteral(arg) ? [arg.text]
            : arg && ts.isConditionalExpression(arg)
              ? [arg.whenTrue, arg.whenFalse].filter(ts.isStringLiteral).map(x => x.text)
              : [];
          for (const text of values) {
            expect(Object.prototype.hasOwnProperty.call(STATIC_EN, text), `${file}: ${text}`).toBe(true);
            verified++;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(verified).toBeGreaterThan(55);
  });

  it("prevents plain Portuguese toast literals from returning in operational screens", () => {
    for (const file of targetFiles.filter(x => x !== "components/UpdateBanner.tsx")) {
      const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const raw: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && /^toast\.(?:success|error|info|warning|loading)$/.test(node.expression.getText(ast))) {
          const arg = node.arguments[0];
          if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) raw.push(arg.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      expect(raw, file).toEqual([]);
    }
  });

  it("uses the selected locale for queue timestamps and reviewed photo accessibility labels", () => {
    const queue = source("components/consultor/SyncQueueDialog.tsx");
    expect(queue).toContain('new Date(item.data).toLocaleString(language)');
    expect(queue).toContain('new Date(item.oldestCreatedAt).toLocaleString(language)');
    expect(queue).toContain('uiText("data não identificada")');
    const photos = source("components/consultor/PhotoGrid.tsx");
    expect(photos).toContain('title={uiText("Foto ainda não sincronizada")}');
    expect(photos).toContain('title={uiText("Foto sincronizada")}');
    expect(photos).toContain('title={uiText("Cancelar envio")}');
    expect(source("components/UpdateBanner.tsx")).toContain('title={uiText("Atualizar app")}');
  });

  it("preserves API error, photo identity and animal names in dynamic messages", () => {
    const error = "R17: failed-to-sync";
    const farmerName = "Fazenda Nascente 17";
    const msg = `${translateStaticUiText("en-US", "Erro ao ler fila local: ")}${error}`;
    const signal = `${translateStaticUiText("en-US", "Sinal enviado ✓ — aguardando ")}${farmerName}...`;
    expect(msg).toBe(`Could not read local queue: ${error}`);
    expect(signal).toContain(farmerName);
    expect(translateStaticUiText("en-US", farmerName)).toBe(farmerName);
    expect(source("components/consultor/SyncQueueDialog.tsx")).toContain("${getErrorMessage(err)}");
    expect(source("components/ForcarSyncButton.tsx")).toContain("${targetName}");
    expect(source("components/consultor/PhotoGrid.tsx")).toContain("err?.message");
  });
});
