import ts from "typescript";
import { describe, expect, it } from "vitest";
import source from "../../pages/CiclosPage.tsx?raw";
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

  it("nega reabertura sem sessão e evita reabertura repetida ou de outra fazenda", () => {
    expect(source).toContain("if (!user?.id)");
    expect(source).toContain("if (!ciclo.fechado)");
    expect(source).toContain('.eq("fechado", true)');
    expect(source).toContain('.eq("fazenda_id", ciclo.fazenda_id)');
    expect(source).toContain("if (error || !data)");
  });

  it("não substitui listagens existentes por vazio se a consulta falhar", () => {
    expect(source).toContain("if (ciclosRes.error || fazendasRes.error)");
    expect(source).toContain("Não foi possível carregar os ciclos");
  });

  it("descarta consultas antigas e separa os dados por usuário", () => {
    expect(source).toContain("const requestVersion = useRef(0)");
    expect(source).toContain("if (!isCurrent()) return");
    expect(source).toContain("setLoadedForUser(sessionUserId)");
    expect(source).toContain("loadedForUser === user.id");
    expect(source).toContain("}, [user?.id]);");
  });

  it("não reutiliza confirmação de outra sessão", () => {
    expect(source).toContain("confirmationUserId.current = user?.id ?? null");
    expect(source).toContain("confirmationUserId.current !== user.id");
    expect(source).toContain("setConfirmAction(null)");
  });

  it("valida a identidade no Supabase Auth antes do UPDATE", () => {
    const authIndex = source.indexOf("await supabase.auth.getUser()");
    const updateIndex = source.indexOf('.update({ fechado: false, fechado_em: null })');
    expect(authIndex).toBeGreaterThan(0);
    expect(updateIndex).toBeGreaterThan(authIndex);
    expect(source).toContain('sessionData?.user?.id !== user.id');
    expect(source).toContain('Sessão não confirmada');
  });

  it("usa trava síncrona contra duplo clique, liberada no finally", () => {
    expect(source).toContain('const actionInFlight = useRef(false)');
    expect(source).toContain('if (actionInFlight.current) return');
    expect(source).toContain('actionInFlight.current = true');
    expect(source).toContain('actionInFlight.current = false');
  });

  it("distingue erro SQL de ausência de ciclos e oferece recuperação", () => {
    expect(source).toContain('setLoadError(true)');
    expect(source).toContain('role="alert"');
    expect(source).toContain('Tentar novamente');
    expect(source).toContain('loadError && visibleCiclos.length === 0 ? null');
  });

  it("não escreve auditoria com identidade trocada após a atualização", () => {
    const fenceIndex = source.indexOf('if (activeUserId.current !== user.id)');
    const auditIndex = source.indexOf('const auditError = await logAuditoria');
    expect(fenceIndex).toBeGreaterThan(0);
    expect(auditIndex).toBeGreaterThan(fenceIndex);
  });

  it("não reporta sucesso silencioso quando a auditoria falha", () => {
    expect(source).toContain("Ciclo reaberto, mas o registro de auditoria falhou");
    expect(source).toContain("a auditoria não pôde ser confirmada");
  });
  it("estabiliza load com useCallback e inclui a dependência no efeito Realtime", () => {
    expect(source).toContain('const load = useCallback(async () => {');
    expect(source).toContain('}, [user?.id, load]);');
  });

  it("usa o tipo gerado de ciclos_auditoria sem any", () => {
    expect(source).toContain('supabase.from("ciclos_auditoria").insert({');
    expect(source).not.toContain('"ciclos_auditoria" as any');
  });

});
