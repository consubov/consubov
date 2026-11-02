import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const sql = fs.readFileSync("supabase/migrations/20261102153021_observacoes_parent_integrity_rls.sql", "utf8");

test("historical-data preflight aborts before any DDL", () => {
  assert.match(sql, /inconsistent observacoes parent references; migration aborted/);
  assert.ok(sql.indexOf("RAISE EXCEPTION") < sql.indexOf("ALTER TABLE public.observacoes ENABLE"));
});
test("both observation write policies are RESTRICTIVE", () => {
  for (const [name,cmd] of [["observacoes_parent_integrity_insert","INSERT"], ["observacoes_parent_integrity_update","UPDATE"]]) {
    const start=sql.indexOf("CREATE POLICY "+name+"\n");
    assert.ok(start>0,name);
    const end=sql.indexOf(");\n",start);
    const part=sql.slice(start,end+3);
    assert.match(part,/AS RESTRICTIVE/);
    assert.ok(part.includes("FOR "+cmd+"\nTO authenticated"));
    assert.match(part,/p\.retiro_id = observacoes\.retiro_id/);
    assert.match(part,/pr\.fazenda_id = observacoes\.fazenda_id/);
  }
});
test("manager parent reads are SELECT-only and farm-scoped", () => {
  for(const table of ["retiros","pastos"]){
    const start=sql.indexOf("CREATE POLICY observacoes_parent_gerente_"+table+"_read\n");
    assert.ok(start>0);
    const part=sql.slice(start,sql.indexOf(");\n",start)+3);
    assert.match(part,/FOR SELECT TO authenticated/);
    assert.match(part,/g\.user_id = auth\.uid\(\)/);
    assert.match(part,/g\.ativo = true/);
    assert.match(part,/g\.fazenda_id = /);
  }
});
test("do not assume pastos.fazenda_id, which is absent from actual target schema", () => {
  assert.doesNotMatch(sql, /(?:\bp\.|\bpastos\.)fazenda_id\b/);
  assert.match(sql, /JOIN public\.retiros r ON r\.id = pastos\.retiro_id/);
  assert.match(sql, /pr\.fazenda_id = o\.fazenda_id/);
});

test("no RLS disable, all grants, or security definer bypass",()=>{
  assert.doesNotMatch(sql,/DISABLE ROW LEVEL SECURITY|SECURITY DEFINER|GRANT\s+ALL/i);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
});
