const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');

const configSource = fs.readFileSync(path.resolve(__dirname, '../vite.config.ts'), 'utf8');
const swSource = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf8');

function buildPluginAt(dir) {
  const code = ts.transpileModule(configSource, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  const imports = {
    vite: { defineConfig: (config) => config },
    '@vitejs/plugin-react-swc': () => ({ name: 'react' }),
    path, fs,
  };
  vm.runInNewContext('(function (require, module, exports, __dirname) {\n' + code + '\n})', {
    Date, JSON, RegExp, Object, String,
  })(name => {
    assert.ok(Object.hasOwn(imports, name), 'unexpected import: ' + name);
    return imports[name];
  }, module, module.exports, dir);
  const config = module.exports.default();
  const plugin = config.plugins.find(item => item.name === 'inject-sw-build-timestamp');
  assert.ok(plugin, 'missing Vite SW build plugin');
  return plugin;
}

function withDist(cb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'consubov-sw-build-'));
  try {
    fs.mkdirSync(path.join(dir, 'dist', 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'src', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'lib', 'appVersion.ts'), 'export const APP_VERSION = "0.1.0";');
    // The real SW plugin requires the inline boot-repair placeholder and source.
    fs.copyFileSync(path.resolve(__dirname, '../src/lib/pwaBootRepair.inline.js'), path.join(dir, 'src', 'lib', 'pwaBootRepair.inline.js'));
    fs.writeFileSync(path.join(dir, 'dist', 'index.html'), '<!doctype html><html><body><!-- CONSUBOV_BOOT_REPAIR_INLINE --></body></html>');
    fs.writeFileSync(path.join(dir, 'dist', 'sw.js'), swSource);
    return cb(dir, path.join(dir, 'dist', 'assets'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Vite SW build plugin injects every route bundle, CSS, and font into precache', () => withDist((dir, assets) => {
  fs.writeFileSync(path.join(assets, 'app.12345678.js'), 'entry');
  fs.writeFileSync(path.join(assets, 'lazy.12345678.js'), 'route');
  fs.mkdirSync(path.join(assets, 'nested'));
  fs.writeFileSync(path.join(assets, 'nested', 'style.12345678.css'), 'css');
  fs.writeFileSync(path.join(assets, 'font.12345678.woff2'), 'font');
  fs.writeFileSync(path.join(assets, 'app.12345678.js.map'), 'debug');
  buildPluginAt(dir).closeBundle();
  const result = fs.readFileSync(path.join(dir, 'dist', 'sw.js'), 'utf8');
  const match = result.match(/const PRECACHE_ASSETS = (\[[^\n]*\]);/);
  assert.ok(match, 'precache list was not injected');
  assert.deepEqual(JSON.parse(match[1]), [
    '/assets/app.12345678.js',
    '/assets/font.12345678.woff2',
    '/assets/lazy.12345678.js',
    '/assets/nested/style.12345678.css',
  ]);
  assert.doesNotMatch(result, /__BUILD_TIMESTAMP__/);
  assert.ok(fs.existsSync(path.join(dir, 'dist', 'version.json')));
  const html = fs.readFileSync(path.join(dir, 'dist', 'index.html'), 'utf8');
  assert.match(html, /<script data-consubov-boot-repair>/);
  assert.doesNotMatch(html, /<!-- CONSUBOV_BOOT_REPAIR_INLINE -->/);
}));

test('Vite SW build plugin rejects an incomplete build with no executable assets', () => withDist((dir, assets) => {
  fs.writeFileSync(path.join(assets, 'style.12345678.css'), 'css');
  assert.throws(() => buildPluginAt(dir).closeBundle(), /without JavaScript assets/);
}));
