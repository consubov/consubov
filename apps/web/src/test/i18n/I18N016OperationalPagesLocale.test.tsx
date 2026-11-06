import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import english from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const files = [
  "pages/SyncVetEstacaoDetalhePage.tsx",
  "pages/SyncVetServicoNovoPage.tsx",
  "pages/PesadorClientesPage.tsx",
  "pages/EscritorioLayout.tsx",
] as const;
const source = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

const translations = [
  ["Remover esta estação e todos os seus vínculos?", "Remove this breeding station and all its links?"],
  ["Ciclo criado — agenda calculada", "Cycle created — schedule calculated"],
  ["Planejada", "Planned"],
  ["Concluída", "Completed"],
  ["Modelo de cobrança:", "Billing model:"],
  ["Estação de Monta (opcional)", "Breeding Station (optional)"],
  ["Vencimento (opcional)", "Due date (optional)"],
  ["Unitário", "Unit price"],
  [" item(ns) sugerido(s). ", " item(s) suggested. "],
  ["Nenhum cliente encontrado para a busca.", "No clients match your search."],
  ["cliente cadastrado", "registered client"],
  ["clientes cadastrados", "registered clients"],
  ["QR Codes da Fazenda", "Ranch QR Codes"],
  ["Filtrar por retiro", "Filter by ranch unit"],
] as const;

describe("I18N-016 — SyncVet station/service, Weigher clients and Office", () => {
  it("uses reviewed English labels and preserves the PT-BR default and user content", () => {
    for (const [pt, en] of translations) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Touro do Cliente 72")).toBe("Touro do Cliente 72");
    expect(translateStaticUiText("en-US", "Fazenda Particular 3")).toBe("Fazenda Particular 3");
  });

  it("maps literal static UI hooks and all static LocalizedText nodes in modified pages", () => {
    let mapped = 0;
    for (const file of files) {
      const parsed = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const inspect = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === "uiText") {
          const arg = node.arguments[0];
          const values = arg && ts.isStringLiteral(arg) ? [arg.text]
            : arg && ts.isConditionalExpression(arg)
              ? [arg.whenTrue, arg.whenFalse].filter(ts.isStringLiteral).map(x => x.text)
              : [];
          for (const text of values) {
            expect(Object.prototype.hasOwnProperty.call(english, text), `${file}: ${text}`).toBe(true);
            mapped++;
          }
        }
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(parsed) === "LocalizedText") {
          const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(parsed) === "source");
          if (attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) {
            const value = attr.initializer.expression;
            if (value && ts.isStringLiteral(value)) {
              expect(Object.prototype.hasOwnProperty.call(english, value.text), `${file}: ${value.text}`).toBe(true);
              mapped++;
            }
          }
        }
        ts.forEachChild(node, inspect);
      };
      inspect(parsed);
    }
    expect(mapped).toBeGreaterThan(100);
  });

  it("has no direct Portuguese toast or confirmation literals in station/service/office", () => {
    for (const file of files.filter(x => x !== "pages/PesadorClientesPage.tsx")) {
      const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const raw: string[] = [];
      const scan = (node: ts.Node) => {
        if (ts.isCallExpression(node) && /^(?:confirm|toast\.(?:error|success|warning|info))$/.test(node.expression.getText(ast))) {
          const arg = node.arguments[0];
          if (arg && ts.isStringLiteral(arg)) raw.push(arg.text);
        }
        ts.forEachChild(node, scan);
      };
      scan(ast);
      expect(raw, file).toEqual([]);
    }
  });

  it("localizes validation and notifications while preserving client records and offline queue", () => {
    const clients = source("pages/PesadorClientesPage.tsx");
    expect(clients).toContain('title: uiText("Dados inválidos")');
    expect(clients).toContain('description: uiText(parsed.error.issues[0]?.message ?? "Verifique os campos.")');
    expect(clients).toContain('title: uiText("Não é possível apagar")');
    expect(clients).toContain('placeholder={uiText("Buscar por nome do produtor...")}');
    expect(clients).toContain('uiText(clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados")');
    expect(clients).toContain('enqueueMa(id, { kind: "insert", table: "clientes_pesador", row: novo })');
    expect(clients).toContain('.eq("pesador_id", pesadorId)');
    expect(clients).toContain('nome: parsed.data.nome');
    expect(clients).toContain('description: error.message');
  });

  it("preserves SyncVet status codes and PDF inputs while translating only labels", () => {
    const station = source("pages/SyncVetEstacaoDetalhePage.tsx");
    const service = source("pages/SyncVetServicoNovoPage.tsx");
    expect(station).toContain('em_andamento: "Em andamento"');
    expect(station).toContain('concluido: "Concluído"');
    expect(station).toContain('.update({ status: statusVal })');
    expect(station).toContain('status: cicloStatus');
    expect(station).toContain('protocolo_id: addProtoId');
    expect(station).toContain('uiText(ESTACAO_STATUS[estacao.status] ?? estacao.status)');
    expect(station).toContain('uiText(CICLO_STATUS[k])');
    expect(service).toContain('modelo_cobranca: "protocolo_completo" | "mao_obra_km"');
    expect(service).toContain('status: "pendente"');
    expect(service).toContain('tipo_item: it.tipo_item');
    expect(service).toContain('language,');
    expect(service).toContain('descricao: it.descricao || it.tipo_item');
    expect(service).toContain('toLocaleString(language, { style: "currency", currency: "BRL" })');
  });

  it("formats station calendar and office dates with the chosen language without changing database ISO dates", () => {
    const station = source("pages/SyncVetEstacaoDetalhePage.tsx");
    const office = source("pages/EscritorioLayout.tsx");
    expect(station).toContain('Date.UTC(y, m - 1, day)');
    expect(station).toContain('toLocaleDateString(language, { timeZone: "UTC" })');
    expect(station).toContain('return dt.toISOString().slice(0, 10);');
    expect(office).toContain('<QrCodePrintPDF items={items} language={language} />');
    expect(office).toContain('new Date(selected.data).toLocaleString(language, { dateStyle: "short", timeStyle: "short" })');
    expect(office).toContain('uiText(notificacoes.length === 1 ? "alerta não lido" : "alertas não lidos")');
    expect(office).toContain('title={uiText("Marcar como lida")}');
    expect(office).toContain('{selected.observacao}');
  });
});
