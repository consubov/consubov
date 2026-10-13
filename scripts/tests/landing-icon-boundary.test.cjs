const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('node:module').createRequire(path.resolve(__dirname, '../../apps/web/package.json'))('typescript');
const root = path.resolve(__dirname, '../..');
function entry() { return ts.createSourceFile('LandingPage.tsx', fs.readFileSync(path.join(root, 'apps/web/src/pages/LandingPage.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
test('landing public entry does not eagerly import the complete icon catalog', () => {
  const eager = entry().statements.filter(ts.isImportDeclaration).some((n) => n.moduleSpecifier.text === 'lucide-react' && n.importClause?.namedBindings && (ts.isNamespaceImport(n.importClause.namedBindings) || n.importClause.namedBindings.elements?.some((i) => (i.propertyName || i.name).text === 'icons')));
  assert.equal(eager, false, 'Full icon catalog must not block the public route');
});
test('landing defers below-fold Brazil geometry', () => {
  assert.equal(entry().statements.filter(ts.isImportDeclaration).some((n) => n.moduleSpecifier.text.endsWith('/BrasilMap')), false, 'Map needs an async boundary');
});

test('manual refresh retains its static icon binding after splitting the catalog', () => {
  const source = entry();
  const imported = source.statements.filter(ts.isImportDeclaration).filter((n) => n.moduleSpecifier.text === 'lucide-react').flatMap((n) => n.importClause?.namedBindings?.elements || []);
  assert.ok(imported.some((n) => (n.propertyName || n.name).text === 'RefreshCw'), 'RefreshCw must remain statically imported');
  assert.doesNotMatch(source.text, /<Lucide\./, 'Removed namespace must have no remaining JSX reference');
});
