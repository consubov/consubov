import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import english from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const targets = [
  "components/eventos/ApartacaoFlowModal.tsx",
  "components/eventos/PesagemFlowModal.tsx",
  "components/consultor/VisitaTopicosSection.tsx",
  "components/consultor/CurralVisitaModal.tsx",
  "pages/SyncVetFazendasPage.tsx",
  "pages/SyncVetFazendaDetalhePage.tsx",
] as const;
const source = (f: string) => readFileSync(resolve(process.cwd(), "src", f), "utf8");

describe("I18N-020 — campo, apartação, pesagem e SyncVet", () => {
  it("translates fixed messages while retaining PT-BR source labels and user names", () => {
    const pairs = [
      ["Erro ao carregar pastos: ", "Failed to load pastures: "],
      ["Total de animais do pasto já atingido.", "The pasture animal limit has been reached."],
      ["Selecione destino para ", "Select a destination for "],
      ["Pesagem salva localmente. Sincronização pendente.", "Weighing saved locally. Sync pending."],
      ["Pesagem finalizada! ", "Weighing completed! "],
      [" animais, média ", " animals, average "],
      ["Tópico salvo off-line.", "Topic saved offline."],
      ["Remover este tópico?", "Remove this topic?"],
      ["Introdução", "Introduction"],
      ["Aparece na primeira página do PDF.", "Appears on the first page of the PDF."],
      ["Curral salvo off-line.", "Pen saved offline."],
      ["Informe o número do curral primeiro", "Enter the pen number first"],
      ["GPS não disponível", "GPS unavailable"],
      ["Fazenda cadastrada", "Ranch registered"],
      ["Estação criada", "Breeding season created"],
      ["Planejada", "Planned"],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Fazenda Capim Verde")).toBe("Fazenda Capim Verde");
  });

  it("catalogs all static uiText arguments and removes fixed Portuguese toast literals", () => {
    let checked = 0;
    for (const file of targets) {
      const code = source(file);
      const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      expect(code).toContain("useStaticUiText");
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(ast);
          const arg = node.arguments[0];
          if (/^toast\.(error|success|info|warning)$/.test(name)) {
            expect(arg && !ts.isStringLiteral(arg), file + ": direct " + name).toBeTruthy();
            expect(arg && !ts.isNoSubstitutionTemplateLiteral(arg), file + ": direct " + name).toBeTruthy();
          }
          if (name === "uiText" && arg) {
            const walkArg = (e: ts.Expression): void => {
              if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
                expect(Object.prototype.hasOwnProperty.call(english, e.text), file + ": " + e.text).toBe(true);
                checked++;
              } else if (ts.isConditionalExpression(e)) {
                walkArg(e.whenTrue);
                walkArg(e.whenFalse);
              }
            };
            walkArg(arg);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(checked).toBeGreaterThan(35);
  });

  it("keeps offline commands, lot names and category/status identifiers unchanged", () => {
    const sorting = source(targets[0]);
    const weighing = source(targets[1]);
    const topics = source(targets[2]);
    const pen = source(targets[3]);
    expect(sorting).toContain("nome_lote: lote.nome");
    expect(sorting).toContain("isCategoriaValida(r.categoria)");
    expect(sorting).toContain('toast.error(uiText(MSG_CATEGORIA_OBRIGATORIA))');
    expect(weighing).toContain("savePesagemPendente(pendente)");
    expect(weighing).toContain("pesos: [...pesos]");
    expect(topics).toContain('zona: TopicoZona');
    expect(topics).toContain("zona };");
    expect(pen).toContain("dieta_categoria: dietaCategoria || null");
    expect(pen).toContain("num_curral: numCurral.trim()");
  });

  it("changes SyncVet display labels and dates but not DB IDs or existing state values", () => {
    const farms = source(targets[4]);
    const details = source(targets[5]);
    expect(farms).toContain("uiText(MODELO_LABEL[f.modelo_cobranca])");
    expect(farms).toContain('value="protocolo_completo"');
    expect(farms).toContain('value="mao_obra_km"');
    expect(details).toContain('status: "planejada"');
    expect(details).toContain("uiText(STATUS_LABEL[e.status] ?? e.status)");
    expect(details).toContain("fmtDate(e.data_inicio, language)");
    expect(details).toContain('locale === "en-US"');
    expect(details).toContain('type="date" value={estIni}');
  });

  it("uses selected locale only for user-visible sorting date and weighing feedback", () => {
    const sorting = source(targets[0]);
    const weighing = source(targets[1]);
    expect(sorting).toContain('new Date().toLocaleDateString(language)');
    expect(sorting).toContain('toLocaleTimeString("pt-BR"');
    expect(weighing).toContain('(Math.round(mp * 10) / 10).toLocaleString(language)');
    expect(weighing).toContain("data_pesagem: now");
  });
});
