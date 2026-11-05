import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import translations from "@/lib/staticUiEnglish.json";
import { translateStaticUiText } from "@/components/i18n/LocalizedText";

const targets = [
  "pages/PesadoresPage.tsx",
  "pages/OperadoresFabricaPage.tsx",
  "pages/ConsultoresPage.tsx",
  "pages/NotificacoesPage.tsx",
  "components/gerente/GerenteNotificacoesBell.tsx",
  "components/consultor/PennStateSection.tsx",
  "pages/PesadorPesagemPage.tsx",
] as const;

const src = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

describe("I18N-019 — operational profiles, notifications and field analysis", () => {
  it("translates the reviewed vocabulary to English, with Portuguese fallback", () => {
    const pairs = [
      ["Nome da empresa é obrigatório", "Company name is required"],
      ["Senha mínima de 6 caracteres", "Password must have at least 6 characters"],
      ["Pesador criado!", "Weighing operator created!"],
      ["Pecuarista criado!", "Rancher created!"],
      ["Excluir este pesador?", "Delete this weighing operator?"],
      ["Operador atualizado!", "Operator updated!"],
      ["Consultor criado!", "Adviser created!"],
      ["Zootecnista", "Animal scientist"],
      ["Médico(a) Veterinário(a)", "Veterinarian"],
      ["Informe o título do aviso.", "Enter a notification title."],
      ["novas", "new"],
      ["Recusar esta transferência? Os sacos voltam para o estoque da fábrica.", "Decline this transfer? The bags will return to the feed mill stock."],
      ["Informe o nome do ponto de coleta.", "Enter the sampling point name."],
      ["Análise excluída", "Analysis deleted"],
      ["Excluir análise", "Delete analysis"],
      ["Pesagem excluída.", "Weighing record deleted."],
    ] as const;
    for (const [pt, en] of pairs) {
      expect(translateStaticUiText("en-US", pt), pt).toBe(en);
      expect(translateStaticUiText("pt-BR", pt), pt).toBe(pt);
    }
    expect(translateStaticUiText("en-US", "Fazenda Horizonte")).toBe("Fazenda Horizonte");
  });

  it("catalogs all added uiText arguments and no longer sends literal toast text", () => {
    let reviewed = 0;
    for (const file of targets) {
      const code = src(file);
      const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      expect(code).toContain("useStaticUiText");
      const walk = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const name = node.expression.getText(tree);
          const arg = node.arguments[0];
          if (/^toast\.(error|success|warning|info|loading)$/.test(name)) {
            expect(arg && !ts.isStringLiteral(arg), file + ": " + name).toBeTruthy();
          }
          if (name === "uiText" && arg) {
            const collect = (e: ts.Expression): void => {
              if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
                expect(Object.prototype.hasOwnProperty.call(translations, e.text), file + ": " + e.text).toBe(true);
                reviewed++;
              } else if (ts.isConditionalExpression(e)) {
                collect(e.whenTrue);
                collect(e.whenFalse);
              }
            };
            collect(arg);
          }
        }
        ts.forEachChild(node, walk);
      };
      walk(tree);
    }
    expect(reviewed).toBeGreaterThan(70);
  });

  it("keeps role identifiers, credentials and profession values unchanged in persistence", () => {
    const weighing = src(targets[0]);
    const factory = src(targets[1]);
    const adviser = src(targets[2]);
    expect(weighing).toContain('form.tipo === "pesador" ? "pesadores" : "pecuaristas"');
    expect(weighing).toContain("const userId = await provisionProfileUser({");
    expect(weighing).toContain("senha: form.senha,");
    expect(weighing).toContain('role: "usuario"');
    expect(weighing).toContain("user_id: userId");
    expect(weighing).toContain('uiText(u.tipo === "pesador" ? "Pesador" : "Pecuarista")');
    expect(factory).toContain('supabase.from("operadores_fabrica")');
    expect(factory).toContain('fabrica_id: form.fabrica_id');
    expect(adviser).toContain('const PROFISSOES = ["Zootecnista", "Médico(a) Veterinário(a)", "Agrônomo(a)"]');
    expect(adviser).toContain('onClick={() => setForm(f => ({ ...f, profissao: f.profissao === op ? "" : op }))}');
    expect(adviser).toContain('{uiText(op)}');
    expect(adviser).toContain('profissao: profissaoFinal');
  });

  it("localizes notification display only, preserving posted content and transfer statuses", () => {
    const news = src(targets[3]);
    const bell = src(targets[4]);
    expect(news).toContain('toLocaleString(language, { day: "2-digit"');
    expect(news).toContain('uiText(naoLidas === 1 ? "nova" : "novas")');
    expect(news).toContain('titulo: titulo.trim()');
    expect(news).toContain('mensagem: mensagem.trim() || null');
    expect(news).toContain("      modulo,");
    expect(bell).toContain('uiText("Transferência inválida")');
    expect(bell).toContain('uiText("Transferência recusada")');
    expect(bell).toContain('status: "finalizado"');
    expect(bell).toContain('.update({ status: "recusada"');
  });

  it("localizes Penn State feedback while keeping the submitted sample values", () => {
    const penn = src(targets[5]);
    const history = src(targets[6]);
    expect(penn).toContain('toast.success(uiText(editing ? "Análise atualizada" : "Análise salva"))');
    expect(penn).toContain('peso_amostra_g: numOrNull(amostra) ?? 0');
    expect(penn).toContain('uiText("Excluir análise")');
    expect(history).toContain('toast.success(uiText("Pesagem excluída."))');
    expect(history).toContain('allowRemoteFallback: false');
  });
});
