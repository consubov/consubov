import type { PinnedModuleGeneration } from '@consubov/module-release';
// Fetch in the controlled shell, then execute only inside the opaque sandbox.
// Opaque iframe navigations cannot rely on a service worker controlling their document.
export async function createIsolatedModuleDocument(pinned: PinnedModuleGeneration, nonce: string): Promise<string> {
  const moduleId = pinned.moduleId;
  if (!['capataz', 'gerente', 'escritorio', 'fabrica'].includes(moduleId)) throw new Error('Unknown module.');
  const entry = new URL('index.html', pinned.resourceBase);
  if (entry.origin !== location.origin || !pinned.cacheName.startsWith('consubov-module-' + moduleId + '-')) throw new Error('Invalid pinned module entry.');
  const root = new URL('./', entry);
  if (!await caches.has(pinned.cacheName)) throw new Error('Pinned module cache unavailable.');
  const cache = await caches.open(pinned.cacheName);
  const manifestResponse = await cache.match(new URL('module.json', root));
  if (!manifestResponse?.ok) throw new Error('Verified manifest unavailable.');
  const manifestBytes = await manifestResponse.arrayBuffer();
  const manifestHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', manifestBytes)), value => value.toString(16).padStart(2, '0')).join('');
  if (manifestHash !== pinned.generation || manifestHash !== pinned.manifestDigest) throw new Error('Pinned manifest integrity rejected.');
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  if (JSON.stringify(manifest) !== JSON.stringify(pinned.manifest)) throw new Error('Pinned manifest changed.');
  if (manifest.moduleId !== moduleId || manifest.profileId !== moduleId || manifest.protocolVersion !== 1 ||
      manifest.entry !== 'index.html' || typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version) ||
      !Array.isArray(manifest.apiVersions) || !manifest.apiVersions.includes('1') ||
      !Array.isArray(manifest.assets) || manifest.assets.length < 1 || manifest.assets.length > 16) throw new Error('Invalid module manifest.');
  const assets = new Map<string, { bytes: Uint8Array; mime: string }>();
  let totalBytes = 0;
  for (const asset of manifest.assets) {
    if (typeof asset.url !== 'string' || !/^[A-Za-z0-9._-]+$/.test(asset.url) || asset.url === '.' || asset.url === '..' || assets.has(asset.url) ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || typeof asset.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid asset metadata.');
    const response = await cache.match(new URL(asset.url, root));
    if (!response?.ok) throw new Error('Verified asset unavailable.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    totalBytes += bytes.byteLength;
    if (totalBytes > 32 * 1024 * 1024 || bytes.byteLength !== asset.bytes) throw new Error('Invalid asset size.');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const sri = `sha256-${btoa(Array.from(new Uint8Array(digest), byte => String.fromCharCode(byte)).join(''))}`;
    if (hash !== asset.sha256 || sri !== asset.integrity) throw new Error('Invalid asset integrity.');
    assets.set(asset.url, { bytes, mime: response.headers.get('content-type') ?? 'application/octet-stream' });
  }
  const html = assets.get('index.html');
  if (!html) throw new Error('Module document missing.');
  const document = new DOMParser().parseFromString(new TextDecoder().decode(html.bytes), 'text/html');
  const dataUrl = (name: string): string => {
    const asset = assets.get(name);
    if (!asset) throw new Error('Undeclared module resource.');
    let binary = '';
    for (const byte of asset.bytes) binary += String.fromCharCode(byte);
    return `data:${asset.mime.split(';')[0]};base64,${btoa(binary)}`;
  };
  for (const element of document.querySelectorAll('[src], link[href]')) {
    const attribute = element.hasAttribute('src') ? 'src' : 'href';
    const url = new URL(element.getAttribute(attribute)!, root);
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) throw new Error('External module resource rejected.');
    element.setAttribute(attribute, dataUrl(url.pathname.slice(root.pathname.length)));
    // The bytes were verified above, before rewriting their transport URL.
    element.removeAttribute('integrity');
    element.removeAttribute('crossorigin');
  }
  const bootstrap = document.createElement('meta');
  bootstrap.name = 'consubov-module-nonce';
  bootstrap.content = nonce;
  document.head.prepend(bootstrap);
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; script-src data: 'wasm-unsafe-eval'; style-src 'unsafe-inline' data:; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  document.head.prepend(policy);
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

