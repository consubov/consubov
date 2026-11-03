import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const functions = [
  ["get_painel_mae_rapido", "supabase/migrations/20261103021156_p0_gerente_painel_mae_fast.sql", false],
  ["get_gerente_fazendas_rapido", "supabase/migrations/20261103054000_p0_gerente_fazendas_rapido.sql", true],
  ["get_gerente_custos_rapido", "supabase/migrations/20261103054001_p0_gerente_custos_rapido.sql", false],
  ["get_gerente_curva_rapida", "supabase/migrations/20261103054002_p0_gerente_curva_rapida.sql", false],
  ["get_gerente_lancamentos_rapido", "supabase/migrations/20261103054003_p0_gerente_lancamentos_rapido.sql", false],
];

for (const [name, file, definer] of functions) {
  test("manager RPC present, ACL restricted and versioned: " + name, () => {
    const sql = read(file);
    assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public." + name + "("));
    const beforeGrant = sql.slice(sql.indexOf("CREATE OR REPLACE FUNCTION public." + name + "("));
    const functionBody = beforeGrant.slice(0, beforeGrant.indexOf("$function$;") + 11);
    assert.match(functionBody, definer ? /SECURITY DEFINER/ : /SECURITY INVOKER/);
    assert.ok(sql.includes("REVOKE ALL ON FUNCTION public." + name + "("));
    assert.ok(sql.includes("FROM PUBLIC, anon;"));
    assert.ok(sql.includes("GRANT EXECUTE ON FUNCTION public." + name + "("));
    assert.ok(sql.includes("TO authenticated;"));
    assert.match(functionBody, /auth\.uid\(\)/);
  });
}
test("function-only extended timeout never changes authenticated global role", () => {
  const migration = read(functions[0][1]);
  assert.ok(migration.includes("CREATE OR REPLACE FUNCTION public.get_painel_mae_rapido("));
  for (const [,file] of functions) {
    assert.doesNotMatch(read(file), /ALTER ROLE\s+authenticated\b/i);
  }
});
test("only manager avoids shared heavy consumption RPC and barrier views", () => {
  const hook = read("apps/web/src/hooks/useGerenteData.ts");
  const curve = read("apps/web/src/components/gerente/CurvaConsumoCard.tsx");
  const facade = read("apps/web/src/pages/GerenteDashboard.tsx");
  assert.ok(hook.includes("useGerenteCustos("));
  assert.ok(hook.includes("fetchGerenteLancamentos("));
  assert.doesNotMatch(hook, /useConsumoMineral\(/);
  assert.doesNotMatch(hook, /\.from\("view_consumo_(tempo_real|consolidado)"\)/);
  assert.doesNotMatch(curve, /\.from\("view_lancamento_consumo_real"\)/);
  assert.doesNotMatch(curve, /\.limit\(10000\)/);
  assert.ok(curve.includes("fetchGerenteCurva("));
  assert.ok(facade.includes("fetchGerenteFazendas("));
  assert.ok(hook.includes("false, // Manager never fans out"));
  assert.ok(facade.includes('abaAtiva === "ranking"'));
});
test("every new manager frontend RPC has matching migration", () => {
  const sources = [
    "gerenteFazendasRepository.ts", "gerenteCustosRepository.ts",
    "gerenteCurvaRepository.ts", "gerenteLancamentosRepository.ts",
  ].map(p => read("apps/web/src/features/painel/repositories/" + p)).join("\n");
  for (const [name] of functions.slice(1)) assert.ok(sources.includes(name));
  assert.ok(read("apps/web/src/features/painel/repositories/painelMaeRepository.ts").includes(functions[0][0]));
});
