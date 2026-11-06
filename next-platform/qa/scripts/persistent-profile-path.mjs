import { execFileSync } from 'node:child_process';
import { mkdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';

/** Keep WebKit's internal CacheStorage filenames below Windows MAX_PATH.
 * The drive aliases only this run's owned QA directory; files stay in the workspace.
 * Close every browser before dispose(), then clean files using canonical paths.
 */
export async function createPersistentProfilePaths(runRoot) {
  const workspacePath = resolve(import.meta.dirname, '../..');
  const requested = relative(workspacePath, resolve(runRoot));
  if (isAbsolute(requested) || !requested.startsWith(`.qa${sep}tmp${sep}`) || requested.split(sep).includes('..')) {
    throw new Error('Persistent browser profile path is outside the owned QA directory.');
  }
  await mkdir(runRoot, { recursive: true });
  const canonicalRoot = await realpath(runRoot);
  const workspace = await realpath(workspacePath);
  const owned = relative(workspace, canonicalRoot);
  if (isAbsolute(owned) || !owned.startsWith(`.qa${sep}tmp${sep}`) || owned.split(sep).includes('..')) {
    throw new Error('Persistent browser profiles must belong to this workspace QA run.');
  }
  let drive;
  const rootStat = await stat(canonicalRoot);
  const sameDirectory = async path => {
    const candidate = await stat(path);
    return candidate.dev === rootStat.dev && candidate.ino === rootStat.ino;
  };
  if (process.platform === 'win32') {
    for (const letter of 'ZYXWVUTSR') {
      const candidate = `${letter}:`;
      try { await stat(`${candidate}\\`); continue; }
      catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
      try { execFileSync('subst.exe', [candidate, canonicalRoot], { windowsHide: true, stdio: 'pipe' }); }
      catch { continue; } // A concurrent QA run may have reserved this letter.
      if (!await sameDirectory(`${candidate}\\`)) throw new Error('QA drive mapping does not point to its owned directory.');
      drive = candidate;
      break;
    }
    if (!drive) throw new Error('No unused temporary drive available for the Windows WebKit profile.');
  }
  let disposed = false;
  return {
    browserPath(path) {
      if (disposed) throw new Error('QA profile mapping already released.');
      const child = relative(canonicalRoot, resolve(path));
      if (isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`)) throw new Error('Profile outside owned QA run.');
      return drive ? win32.join(`${drive}\\`, child) : resolve(path);
    },
    async dispose() {
      if (disposed) return;
      if (drive) {
        if (!await sameDirectory(`${drive}\\`)) throw new Error('Refusing to release a changed QA drive mapping.');
        execFileSync('subst.exe', [drive, '/D'], { windowsHide: true, stdio: 'pipe' });
      }
      disposed = true;
    }
  };
}
