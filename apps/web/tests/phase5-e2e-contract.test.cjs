const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const app = ts.createSourceFile('App.tsx', fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const text = fs.readFileSync(path.join(root, 'e2e/phase5-web-ready.spec.ts'), 'utf8');
const e2e = ts.createSourceFile('phase5-web-ready.spec.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

function routePatterns() {
  const paths = [];
  function walk(node, parent = '') {
    let next = parent;
    const tag = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (tag && tag.tagName.getText(app) === 'Route') {
      const attr = tag.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(app) === 'path');
      if (attr && attr.initializer && ts.isStringLiteral(attr.initializer)) {
        const value = attr.initializer.text;
        next = value.startsWith('/') ? value : (parent.replace(/\/$/, '') + '/' + value);
        if (!next.includes('*')) paths.push(next);
      }
    }
    ts.forEachChild(node, child => walk(child, next));
  }
  walk(app);
  return paths.map(p => new RegExp('^' + p.split('/').map(s => s.startsWith(':') ? '[^/]+' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '/?$'));
}

test('positive Phase 5 navigation only references routes actually declared by the application', () => {
  const paths = new Set();
  function walk(node) {
    if (ts.isStringLiteral(node) && node.text.startsWith('/') && !node.text.startsWith('//')) paths.add(node.text.split('?')[0]);
    ts.forEachChild(node, walk);
  }
  walk(e2e);
  const patterns = routePatterns();
  const missing = [...paths].filter(p => !patterns.some(pattern => pattern.test(p)));
  assert.deepEqual(missing, [], 'Do not manufacture routes in tests or add product routes just to satisfy obsolete tests');
});

test('extra browser contexts preserve the configured project viewport and baseURL', () => {
  const start = text.indexOf('async function openAs(');
  const end = text.indexOf('\nasync function expectHealthySurface', start);
  const helper = text.slice(start, end);
  assert.match(helper, /test\.info\(\)\.project\.use/);
  for (const name of ['baseURL', 'viewport', 'hasTouch', 'isMobile']) assert.match(helper, new RegExp('\\b' + name + '\\b'));
  assert.doesNotMatch(helper, /browser\.newContext\(\)/);
});

test('login waits for its authenticated redirect before any subsequent navigation', () => {
  const helper = text.slice(text.indexOf('async function login('), text.indexOf('\nasync function openAs('));
  assert.match(helper, /await expect\(page\)\.not\.toHaveURL|await page\.waitForURL/);
});

test('tenant denial scenario does not log in twice and checks rejected-data isolation', () => {
  const start = text.indexOf('test("tenant mismatch');
  const end = text.indexOf('\n  });', start);
  const body = text.slice(start, end);
  assert.doesNotMatch(body, /await login\(page\)/);
  assert.match(body, /getByRole\("alert"\)/);
  assert.match(body, /PRIVATE-TENANT/);
});
