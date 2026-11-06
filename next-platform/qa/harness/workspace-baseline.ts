import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const nextPlatformDir = realpathSync(resolve(import.meta.dir, '../..'));
export const worktreeDir = realpathSync(resolve(nextPlatformDir, '..'));
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/** Read-only Git calls: no shell expansion and no persistent safe.directory edit. */
export function readGit(cwd: string, args: string[]): string {
  const result = spawnSync('git', ['-c', `safe.directory=${cwd.replaceAll('\\', '/')}`, ...args], { cwd, encoding: 'utf8', shell: false, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Git read failed: ${args[0]} (exit ${result.status})`);
  return result.stdout;
}

export function canonicalRepository(): string {
  const common = realpathSync(readGit(worktreeDir, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim());
  if (basename(common) !== '.git') throw new Error('Unsupported Git layout; canonical repository not inferred.');
  const root = realpathSync(dirname(common));
  if (realpathSync(readGit(root, ['rev-parse', '--show-toplevel']).trim()) !== root) throw new Error('Canonical repository identity mismatch.');
  return root;
}

export function changedPaths(status: string): string[] {
  const entries = status.split('\0'), paths: string[] = [];
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index]; if (!entry) continue;
    if (entry.length < 4 || entry[2] !== ' ') throw new Error('Malformed porcelain status');
    paths.push(entry.slice(3).replaceAll('\\', '/'));
    if (/[RC]/.test(entry.slice(0, 2))) {
      const previous = entries[++index]; if (!previous) throw new Error('Missing rename origin');
      paths.push(previous.replaceAll('\\', '/'));
    }
  }
  return paths;
}

export function captureGitBaseline(directory = worktreeDir) {
  const root = realpathSync(directory);
  const head = readGit(root, ['rev-parse', 'HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error('Invalid HEAD');
  const status = readGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  return {
    root, head, branch: readGit(root, ['branch', '--show-current']).trim() || '(detached)',
    dirty: status.length > 0, paths: changedPaths(status).sort(),
    statusSha256: hash(status),
    diffSha256: hash(readGit(root, ['diff', '--binary', 'HEAD', '--', '.'])),
    stashSha256: hash(readGit(root, ['stash', 'list', '--format=%H%x00%gs'])),
    refsSha256: hash(readGit(root, ['for-each-ref', '--format=%(refname)%00%(objectname)'])),
    // File bytes include untracked work that git diff cannot represent.
    changedFileHashes: Object.fromEntries(changedPaths(status).sort().map(path => {
      const full = resolve(root, path), inside = relative(root, full);
      if (isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) throw new Error('Changed path escaped repository');
      try { const info = lstatSync(full); return [path, info.isFile() ? hash(readFileSync(full)) : info.isSymbolicLink() ? 'LINK' : 'DIRECTORY']; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [path, 'DELETED']; throw error; }
    }))
  };
}

export function assertOnlyNextPlatformChanges(baseline = captureGitBaseline()): void {
  const foreign = baseline.paths.filter(path => !path.startsWith('next-platform/'));
  if (foreign.length) throw new Error(`Worktree changes outside authorized next-platform scope: ${foreign.join(', ')}`);
}

/** Captures tracked AND untracked files. Output exclusions are explicit evidence,
 * never an assertion that a clean commit contains the current dirty sources. */
export function captureSourceManifest() {
  const excludedDirectories = new Set(['.git', 'node_modules', '.qa', '.module-artifacts', 'dist', 'dist-site', 'dist-candidate', 'dist-lab']);
  const files: Record<string, string> = {};
  const walk = (directory: string, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
      const name = prefix + entry.name;
      if (name === 'qa/reports' || name.startsWith('qa/reports/')) continue;
      const full = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Source symlink not accepted in manifest: ${name}`);
      if (entry.isDirectory()) walk(full, `${name}/`);
      else if (entry.isFile()) files[name] = hash(readFileSync(full));
    }
  };
  walk(nextPlatformDir);
  return { files, sha256: hash(JSON.stringify(files)), exclusions: [...excludedDirectories, 'qa/reports (generated evidence)'] };
}

export function createOwnedQaDirectory(prefix: string, area: 'tmp' | 'runs' = 'tmp') {
  if (!/^[a-z0-9-]{1,50}$/.test(prefix)) throw new Error('Invalid fixture prefix');
  if (area !== 'tmp' && area !== 'runs') throw new Error('Invalid QA output area');
  const temporaryRoot = resolve(nextPlatformDir, '.qa', area);
  // Check each existing ancestor before any creation, including a redirected
  // .qa whose absent tmp child would otherwise be created outside this checkout.
  for (const directory of [resolve(nextPlatformDir, '.qa'), temporaryRoot]) {
    try {
      const info = lstatSync(directory);
      if (info.isSymbolicLink() || !info.isDirectory() || realpathSync(directory) !== directory) throw new Error('QA temporary ancestry is redirected');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      mkdirSync(directory);
      if (lstatSync(directory).isSymbolicLink() || realpathSync(directory) !== directory) throw new Error('QA temporary ancestry changed');
    }
  }
  const canonicalRoot = realpathSync(temporaryRoot);
  const expected = relative(nextPlatformDir, canonicalRoot);
  if (expected !== `.qa${sep}${area}`) throw new Error('QA temporary root is redirected');
  const path = mkdtempSync(resolve(canonicalRoot, `${prefix}-`)), canonicalPath = realpathSync(path);
  const identity = lstatSync(canonicalPath);
  if (isAbsolute(relative(canonicalRoot, canonicalPath)) || dirname(canonicalPath) !== canonicalRoot || identity.isSymbolicLink()) throw new Error('Invalid owned QA directory');
  let disposed = false;
  return { path: canonicalPath, dispose() {
    if (disposed) return;
    const current = lstatSync(path);
    if (current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino || realpathSync(path) !== canonicalPath || realpathSync(temporaryRoot) !== canonicalRoot) throw new Error('Owned QA directory identity changed; cleanup refused');
    const rejectLinks = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const child = resolve(directory, entry.name);
        if (entry.isSymbolicLink() || lstatSync(child).isSymbolicLink()) throw new Error('QA cleanup refuses linked descendants');
        if (entry.isDirectory()) rejectLinks(child);
      }
    };
    rejectLinks(canonicalPath);
    // The exact created directory, parent containment, identity and descendants
    // have all been checked before the one recursive operation.
    rmSync(canonicalPath, { recursive: true, force: false }); disposed = true;
  } };
}
