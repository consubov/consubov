import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../pages/CiclosPage.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("CiclosPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function containsCall(method: string): boolean {
  let matched = false;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === method) {
      matched = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return matched;
}

describe("CiclosPage — contenção de exclusão insegura", () => {
  it("não permite DELETE diretamente pela tela", () => {
    expect(containsCall("delete")).toBe(false);
    expect(source).not.toContain("handleExcluir");
    expect(source).not.toMatch(/>\s*Excluir\s*<\/Button>/i);
  });

  it("informa claramente a suspensão temporária", () => {
    expect(source).toContain("A exclusão de ciclos está temporariamente indisponível");
  });

  it("preserva a reabertura com confirmação de linha afetada", () => {
    expect(source).toContain("handleReabrir");
    expect(source).toContain(".select(\"id\")");
    expect(source).toContain(".maybeSingle()");
    expect(source).toContain("if (error || !data)");
  });

  it("não reporta sucesso silencioso quando a auditoria falha", () => {
    expect(source).toContain("Ciclo reaberto, mas o registro de auditoria falhou");
    expect(source).toContain("a auditoria não pôde ser confirmada");
  });
});
