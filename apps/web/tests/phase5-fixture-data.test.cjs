const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../e2e/fixtures/phase5-data.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exported = {};
vm.runInNewContext('(function(exports){' + code + '\n})', { structuredClone, Buffer })(exported);
const { fieldFixtures, selectFixtureRows, localPdfFixture } = exported;

test('empty fixture tables stay empty for unmodelled product read filters', () => {
  assert.deepEqual(Array.from(selectFixtureRows([], new URLSearchParams('or=(status.eq.open,status.eq.pending)'))), []);
});

test('populated fixture tables reject unsupported filters instead of returning arbitrary data', () => {
  assert.throws(() => selectFixtureRows([{ id: 'a' }], new URLSearchParams('or=(id.eq.a)')), /Unsupported local fixture filter/);
});

test('fixture equality preserves the requested farm and retiro scope', () => {
  const data = fieldFixtures(new Date('2026-01-15T12:00:00Z'));
  assert.equal(selectFixtureRows(data.retiros, new URLSearchParams('id=eq.retiro-1'))[0].nome, 'Retiro de teste');
  assert.equal(selectFixtureRows(data.retiros, new URLSearchParams('fazenda_id=eq.other-farm')).length, 0);
  assert.equal(selectFixtureRows(data.retiros, new URLSearchParams('ativo=eq.true')).length, 2);
  assert.equal(selectFixtureRows(data.pastos, new URLSearchParams('retiro_id=in.(retiro-1,retiro-2)')).length, 1);
});

test('fixture filters compose without mutating their source rows', () => {
  const data = fieldFixtures();
  const result = selectFixtureRows(data.retiros, new URLSearchParams('fazenda_id=eq.fazenda-1&id=neq.retiro-2'));
  assert.equal(result.length, 1);
  result[0].nome = 'changed after response';
  assert.equal(data.retiros[0].nome, 'Retiro de teste');
});

test('fixture null, wildcard and numeric filters return only matching rows', () => {
  const rows = [{ id: 'a', nome: 'Produto de teste', amount: 2, value: null }, { id: 'b', nome: 'Other', amount: 9, value: true }];
  assert.equal(selectFixtureRows(rows, new URLSearchParams('value=is.null'))[0].id, 'a');
  assert.equal(selectFixtureRows(rows, new URLSearchParams('value=not.is.null'))[0].id, 'b');
  assert.equal(selectFixtureRows(rows, new URLSearchParams('nome=ilike.%25TESTE%25'))[0].id, 'a');
  assert.equal(selectFixtureRows(rows, new URLSearchParams('amount=gte.5'))[0].id, 'b');
});

test('test PDF has a consistent cross-reference and one page, without external assets', () => {
  const bytes = localPdfFixture();
  const text = bytes.toString('ascii');
  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.match(text, /\/Count 1/);
  const offset = Number(text.match(/startxref\n(\d+)\n/)[1]);
  assert.equal(text.slice(offset, offset + 4), 'xref');
  const entries = [...text.matchAll(/(\d{10}) 00000 n/g)];
  assert.equal(entries.length, 4);
  entries.forEach((match, index) => assert.ok(text.slice(Number(match[1])).startsWith(`${index + 1} 0 obj`)));
  assert.ok(text.endsWith('%%EOF\n'));
});
