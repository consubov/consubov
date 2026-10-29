import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../../public/instalar-consubov-v2.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../../public/manifest-consubov-v2.json', import.meta.url), 'utf8'));
const start = '// app-launch-detection:start';
const end = '// app-launch-detection:end';
const first = html.indexOf(start);
const last = html.indexOf(end);
assert.ok(first >= 0 && last > first, 'inline detection script must be present');
const code = html.slice(first + start.length, last).trim();

function harness({apps = [], unsupported = false, reject = false} = {}) {
  let resolveDetection;
  const listeners = {};
  const install = {hidden: false};
  const open = {hidden: true, href: '/app'};
  const manual = {hidden: false};
  const status = {textContent: ''};
  const context = {
    document: {getElementById: id => id === 'open-installed-app' ? open : null},
    location: {origin: 'https://app.consubov.com.br'},
    navigator: unsupported ? {} : {getInstalledRelatedApps: () => reject ? Promise.reject(Error('unavailable')) : new Promise(done => resolveDetection = done)},
    window: {addEventListener: (name, callback) => {listeners[name] = callback;}},
    install, manual, status, promptEvent: {}, URL
  };
  vm.runInNewContext(code, context);
  return {
    context, install, open, manual, status, listeners,
    async settle() { if (resolveDetection) resolveDetection(apps); await new Promise(done => setTimeout(done, 0)); }
  };
}
test('manifest identity unchanged; verified self relation and safe launch handler', () => {
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.related_applications, [{platform: 'webapp', url: '/manifest-consubov-v2.json', id: 'https://app.consubov.com.br/'}]);
  assert.equal(manifest.launch_handler?.client_mode, 'focus-existing');
});
test('installer preserves install CTA; installed CTA is in-scope and initially hidden', () => {
  assert.match(html, /id="install" type="button"/);
  assert.match(html, /id="open-installed-app" href="\/app" hidden/);
  assert.match(html, /\.cta\[hidden\]\s*\{display:none\}/);
  assert.match(html, /beforeinstallprompt/);
  assert.match(html, /appinstalled/);
});
test('verified installed CONSUBOV switches the CTA without requesting new install', async () => {
  const h = harness({apps:[{platform:'webapp',id:'https://app.consubov.com.br/',url:'https://app.consubov.com.br/manifest-consubov-v2.json'}]});
  await h.settle();
  assert.equal(h.install.hidden,true);
  assert.equal(h.open.hidden,false);
  assert.equal(h.manual.hidden,true);
  assert.equal(h.context.promptEvent,null);
});
test('manifest alias and relative id are recognized', async () => {
  const h = harness({apps:[{platform:'webapp',id:'/',url:'/manifest.json'}]}); await h.settle();
  assert.equal(h.open.hidden,false);
});
test('Android verified self manifest without id is recognized', async () => {
  const h = harness({apps:[{platform:'webapp',url:'/manifest-consubov-v2.json'}]}); await h.settle();
  assert.equal(h.open.hidden,false);
});
test('other app, play app or mismatched manifest cannot masquerade as CONSUBOV', async () => {
  for(const app of [
    {platform:'webapp',id:'https://other.example/',url:'https://other.example/manifest.json'},
    {platform:'play',id:'https://app.consubov.com.br/',url:'/manifest.json'},
    {platform:'webapp',id:'https://app.consubov.com.br/',url:'https://other.example/manifest.json'},
    {platform:'webapp',id:':invalid',url:'/manifest.json'}
  ]) {
    const h=harness({apps:[app]}); await h.settle();
    assert.equal(h.install.hidden,false);
    assert.equal(h.open.hidden,true);
  }
});
test('unsupported API, API failure or empty list keeps existing installation UX', async () => {
  for(const options of [{unsupported:true},{reject:true},{apps:[]}]) {
    const h=harness(options); await h.settle();
    assert.equal(h.install.hidden,false);
    assert.equal(h.open.hidden,true);
  }
});
test('native appinstalled event changes CTA without another installation', async () => {
  const h=harness({unsupported:true});
  h.listeners.appinstalled(); await h.settle();
  assert.equal(h.install.hidden,true);
  assert.equal(h.open.hidden,false);
});
