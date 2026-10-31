import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TARGETS = new Set([
  'consubov-app',
  'consubov-site',
  'relatto-app',
  'relatto-site',
]);

function git(cwd, ...args) {
  const res = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024,
  });
  return res.status === 0 ? res.stdout.trim() : null;
}

function loadJson(cwd, rev, file) {
  const raw = git(cwd, 'show', rev + ':' + file);
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version ?? '');
  return match ? match.slice(1).map(Number) : null;
}

function greaterThan(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

export function decideDeployment(target, env = process.env, cwd = process.cwd()) {
  const skip = (reason) => ({ build: false, reason });
  if (!TARGETS.has(target)) return skip('unknown-project');
  if (env.VERCEL_ENV === 'preview') return { build: true, reason: 'preview' };
  if (env.VERCEL_ENV !== 'production' || env.VERCEL_GIT_COMMIT_REF !== 'main') {
    return skip('unrecognized-production-ref');
  }

  const root = git(cwd, 'rev-parse', '--show-toplevel');
  if (!root) return skip('missing-git-checkout');
  const markerPath = 'releases/' + target + '.json';
  const current = loadJson(root, 'HEAD', markerPath);
  if (!current || current.target !== target || !Number.isSafeInteger(current.revision)) {
    return skip('missing-or-invalid-release-marker');
  }

  const previousSha = env.VERCEL_GIT_PREVIOUS_SHA;
  const previousReachable = previousSha && git(root, 'rev-parse', '--verify', previousSha + '^{commit}');
  // The last successful deployment may predate introduction of the markers.
  const published = previousReachable ? loadJson(root, previousSha, markerPath) : null;
  const previous = published ?? loadJson(root, 'HEAD^', markerPath);
  if (!previous || previous.target !== target || !Number.isSafeInteger(previous.revision)) {
    return skip('no-trusted-release-baseline');
  }
  if (current.revision <= previous.revision) return skip('release-revision-not-increased');
  if (current.revision !== previous.revision + 1) return skip('release-revision-jump');

  if (target === 'consubov-app') {
    const oldVersion = parseVersion(previous.appVersion);
    const newVersion = parseVersion(current.appVersion);
    const floor = [2, 0, 0];
    const code = git(root, 'show', 'HEAD:apps/web/src/lib/appVersion.ts') ?? '';
    const fromCode = code.match(/export\s+const\s+APP_VERSION\s*=\s*"([^"]+)"/);
    if (!oldVersion || !newVersion || !fromCode || fromCode[1] !== current.appVersion) {
      return skip('app-version-mismatch');
    }
    if (!greaterThan(newVersion, oldVersion) || newVersion[0] < floor[0]) {
      return skip('non-increasing-or-legacy-app-version');
    }
  }
  return { build: true, reason: 'explicit-product-release' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { build, reason } = decideDeployment(process.argv[2]);
  console.log('[F23 deployment gate] ' + (process.argv[2] ?? '?') + ': ' + (build ? 'BUILD' : 'SKIP') + ' (' + reason + ')');
  process.exit(build ? 42 : 0); // Wrapper maps 42 to Vercel BUILD (1); other errors skip.
}
