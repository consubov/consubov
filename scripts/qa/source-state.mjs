/** Source evidence only: no source bytes, diffs or Git diagnostics leave this helper. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';


// One metadata-only policy for selected security scans and whole-source witness denial.
export const privateSourceParts = Object.freeze(['.git', '.qa', '.aws', '.ssh', '.codex', '.agents', 'node_modules', 'dist', 'build', 'coverage', '.turbo', '.cache', 'cache', 'sessions', 'profiles', 'uploads', 'dumps', 'backups', '.dsh', '.lovable', '.work-go-task', 'test-results']);
export const privateSourceExtensions = Object.freeze(['.pem', '.key', '.pfx', '.p12', '.sqlite', '.sqlite3', '.db', '.csv', '.pdf', '.zip', '.gz', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.ico', '.avif', '.woff', '.woff2', '.ttf', '.map', '.tsbuildinfo']);
export const privateSourceBasenames = Object.freeze(['.npmrc', '.root.env.test', 'bun.lockb']);
export const privateSourceRootFiles = Object.freeze(['coverage-output.txt', 'lint-baseline-full.txt', 'lint-baseline-output.txt', 'lint-output.txt', 'output.txt', 'phase7-out.txt', 'quality-final.txt', 'quality-full.txt', 'quality-ph5.txt', 'quality-test-output.txt', 'quality-test2.txt', 'quality-fase.txt', 'quality-output.txt', 'superpowers']);
export function isPrivateSource(name) {
  const parts = name.split('/');
  const basename = parts.at(-1);
  return parts.some(part => privateSourceBasenames.includes(part.toLowerCase())) || privateSourceRootFiles.includes(parts[0].toLowerCase())
    || parts.some(part => privateSourceParts.includes(part.toLowerCase()) || part.toLowerCase().startsWith('.env'))
    || /credential|private.*key|session.*material/i.test(basename)
    || privateSourceExtensions.includes(path.extname(basename).toLowerCase());
}

export function sourceState(repoRoot) {
  const git = (args) => execFileSync('git', args, {
    cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024, timeout: 30_000,
  });
  const metadata = { commit: 'no-git', branch: null, workingTreeDirty: true };
  try {
    const commit = git(['rev-parse', '--verify', 'HEAD']).toString('utf8').trim();
    if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('Invalid revision');
    metadata.commit = commit;
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).toString('utf8').trim();
    metadata.branch = branch;
    const status = git(['status', '--porcelain', '-z', '--untracked-files=all']);
    metadata.workingTreeDirty = status.length > 0;
    const names = git(['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean).sort();
    const changed = [];
    const trackedChanges = [];
    const records = status.toString('utf8').split('\0').filter(Boolean);
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      const entryNames = [record.slice(3)];
      // Both rename/copy endpoints can carry private material in a binary diff.
      if (/[RC]/.test(record.slice(0, 2))) entryNames.push(records[++index]);
      changed.push(...entryNames);
      if (record.slice(0, 2) !== '??') trackedChanges.push(...entryNames);
    }
    if ([...changed, ...names].some(name => typeof name !== 'string' || isPrivateSource(name))) {
      return { ...metadata, fingerprint: null, captureReason: 'private-source-not-witnessed' };
    }
    // Git diff may read a changed descendant through a junction. Inspect metadata first.
    for (const name of trackedChanges) {
      const parts = name.split('/');
      if (path.isAbsolute(name) || parts.some(part => part === '..' || part === '')) throw new Error('Unsafe source path');
      let file = repoRoot;
      for (let index = 0; index < parts.length; index++) {
        file = path.join(file, parts[index]);
        let stat;
        try { stat = fs.lstatSync(file); }
        catch (error) { if (error.code === 'ENOENT') break; throw error; }
        if (stat.isSymbolicLink()) return { ...metadata, fingerprint: null, captureReason: 'source-link-not-witnessed' };
        if (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()) throw new Error('Unsupported source entry');
      }
    }
    const hash = createHash('sha256');
    // Length framing preserves binary bytes and unusual path names without ambiguity.
    const add = value => {
      const data = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
      hash.update(String(data.length)).update(':').update(data);
    };
    add(commit); add(branch); add(status);
    add(git(['diff', '--no-ext-diff', '--no-textconv', '--binary', '--']));
    // HEAD-vs-working-tree alone misses index-only drift when the file matches HEAD.
    add(git(['diff', '--no-ext-diff', '--no-textconv', '--cached', '--binary', 'HEAD', '--']));
    const links = new Set();
    for (const name of names) {
      const parts = name.split('/');
      if (path.isAbsolute(name) || parts.some(part => part === '..' || part === '')) throw new Error('Unsafe source path');
      let file = repoRoot;
      let linkedParent = false;
      // Git for Windows can list junction descendants. Hash the link, never its target.
      for (let index = 0; index < parts.length - 1; index++) {
        file = path.join(file, parts[index]);
        const parent = fs.lstatSync(file);
        if (parent.isSymbolicLink()) {
          const link = parts.slice(0, index + 1).join('/');
          if (!links.has(link)) { add(link); add('symlink'); add(fs.readlinkSync(file)); links.add(link); }
          linkedParent = true;
          break;
        }
        if (!parent.isDirectory()) throw new Error('Unsafe source parent');
      }
      if (linkedParent) continue;
      file = path.join(file, parts.at(-1));
      const stat = fs.lstatSync(file);
      add(name);
      if (stat.isSymbolicLink()) { add('symlink'); add(fs.readlinkSync(file)); }
      else if (stat.isFile()) { add('file'); add(fs.readFileSync(file)); }
      else throw new Error('Unsupported source entry');
    }
    return { ...metadata, fingerprint: hash.digest('hex'), captureReason: null };
  } catch {
    return { ...metadata, fingerprint: null, captureReason: 'source-state-unavailable' };
  }
}

function writeRecord() {
  const env = process.env;
  const initial = JSON.parse(env.QA_INITIAL_SOURCE);
  const final = JSON.parse(env.QA_FINAL_SOURCE);
  const commandExitCode = Number(env.QA_COMMAND_EXIT);
  const loggerExitCode = Number(env.QA_LOGGER_EXIT);
  if (![commandExitCode, loggerExitCode].every(code => Number.isInteger(code) && code >= 0 && code <= 255)) {
    throw new Error('Invalid pipeline evidence');
  }
  const sourceUnchanged = initial.fingerprint !== null && final.fingerprint !== null
    && initial.fingerprint === final.fingerprint && initial.commit === final.commit;
  // Preserve a failed child exactly; secondary evidence failure must not mask its exit.
  const exitCode = commandExitCode || loggerExitCode || (sourceUnchanged ? 0 : 1);
  const result = {
    task: env.QA_NAME, startedAt: env.QA_STARTED, finishedAt: env.QA_FINISHED,
    branch: initial.branch, commit: initial.commit, finalCommit: final.commit,
    workingTreeDirty: initial.workingTreeDirty, finalWorkingTreeDirty: final.workingTreeDirty,
    sourceUnchanged, sourceFingerprint: initial.fingerprint, finalSourceFingerprint: final.fingerprint,
    sourceCaptureReason: initial.captureReason ?? null, finalSourceCaptureReason: final.captureReason ?? null,
    commandExitCode, loggerExitCode, exitCode, status: exitCode === 0 ? 'PASS' : 'FAIL', log: 'output.log',
  };
  const runDir = path.resolve(env.QA_RUN_DIR);
  if (!fs.statSync(path.join(runDir, 'output.log')).isFile()) throw new Error('Missing output log');
  const temporary = path.join(runDir, 'result.json.tmp');
  fs.writeFileSync(temporary, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  // An interruption while writing cannot leave a truncated PASS result.json.
  fs.renameSync(temporary, path.join(runDir, 'result.json'));
  process.exitCode = exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'capture') console.log(JSON.stringify(sourceState(process.cwd())));
  else if (process.argv[2] === 'record') {
    try { writeRecord(); }
    catch {
      console.error('[qa] Could not write complete evidence.');
      const commandExit = Number(process.env.QA_COMMAND_EXIT);
      process.exitCode = Number.isInteger(commandExit) && commandExit > 0 && commandExit <= 255 ? commandExit : 1;
    }
  } else {
    console.error('Usage: node source-state.mjs capture|record');
    process.exitCode = 2;
  }
}
