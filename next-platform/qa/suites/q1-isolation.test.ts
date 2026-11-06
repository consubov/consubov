import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, readGit, worktreeDir } from '../harness/workspace-baseline';

describe('Suíte Q1.1: Confinamento físico e preservação do baseline observado', () => {
  let canonicalBefore: ReturnType<typeof captureGitBaseline>;
  let worktreeBefore: ReturnType<typeof captureGitBaseline>;
  beforeAll(() => {
    canonicalBefore = captureGitBaseline(canonicalRepository());
    worktreeBefore = captureGitBaseline();
  });
  afterAll(() => {
    expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
    expect(captureGitBaseline()).toEqual(worktreeBefore);
  });

  it('preserva HEAD, branch observada, arquivos dirty/untracked e stashes canônicos', () => {
    expect(captureGitBaseline(canonicalBefore.root)).toEqual(canonicalBefore);
  });

  it('todos os arquivos staged, unstaged e untracked ficam em next-platform/**', () => {
    expect(() => assertOnlyNextPlatformChanges(worktreeBefore)).not.toThrow();
  });

  it('package.json e bun.lock da raiz não foram modificados nem adicionados', () => {
    expect(worktreeBefore.paths.filter(path => ['package.json', 'bun.lock'].includes(path))).toEqual([]);
    expect(readGit(worktreeDir, ['diff', 'HEAD', '--', 'package.json', 'bun.lock'])).toBe('');
  });
});
