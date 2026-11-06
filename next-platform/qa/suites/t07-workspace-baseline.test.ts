import { describe, expect, it } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { assertOnlyNextPlatformChanges, canonicalRepository, captureGitBaseline, captureSourceManifest, changedPaths, createOwnedQaDirectory, nextPlatformDir, worktreeDir } from '../harness/workspace-baseline';

describe('T07 real checkout and owned QA filesystem boundaries', () => {
  it('parses porcelain NUL paths including spaces, Unicode and both sides of renames', () => {
    expect(changedPaths(' M next-platform/a b.ts\0?? next-platform/ação.ts\0R  next-platform/new.ts\0next-platform/old.ts\0'))
      .toEqual(['next-platform/a b.ts', 'next-platform/ação.ts', 'next-platform/new.ts', 'next-platform/old.ts']);
    expect(() => changedPaths('R  next-platform/new.ts\0')).toThrow('Missing rename');
    const baseline = captureGitBaseline();
    expect(baseline.root).toBe(worktreeDir);
    expect(baseline.head).toMatch(/^[a-f0-9]{40}$/);
    expect(baseline.stashSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.refsSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertOnlyNextPlatformChanges({ ...baseline, paths: ['next-platform/safe.ts', 'apps/web/legacy.ts'] })).toThrow('outside authorized');
    assertOnlyNextPlatformChanges(baseline);
  });
  it('observes and preserves the actual canonical checkout without clean/stash-count/SHA assumptions', () => {
    const root = canonicalRepository(), before = captureGitBaseline(root), after = captureGitBaseline(root);
    expect(after).toEqual(before);
  });
  it('captures a newly created untracked source and excludes owned generated evidence', () => {
    const name = `.source-manifest-${randomUUID()}.txt`, path = resolve(nextPlatformDir, 'qa', name);
    expect(relative(nextPlatformDir, path)).toBe(`qa${sep}${name}`);
    const bytes = Buffer.from(`untracked-source-${randomUUID()}`);
    writeFileSync(path, bytes, { flag: 'wx' });
    const fixture = createOwnedQaDirectory('manifest');
    try {
      writeFileSync(resolve(fixture.path, 'result.json'), '{}', { flag: 'wx' });
      const source = captureSourceManifest();
      expect(source.files[`qa/${name}`]).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(Object.keys(source.files).some(item => item.startsWith('.qa/'))).toBe(false);
      expect(source.exclusions).toContain('qa/reports (generated evidence)');
    } finally {
      expect(readFileSync(path)).toEqual(bytes); unlinkSync(path); fixture.dispose();
    }
  });
  it('never removes a linked descendant or its target; disposes only uniquely owned fixtures', () => {
    expect(() => createOwnedQaDirectory('../escape')).toThrow('Invalid fixture prefix');
    const fixture = createOwnedQaDirectory('cleanup'), target = createOwnedQaDirectory('target');
    const sentinel = resolve(target.path, 'keep.txt'), link = resolve(fixture.path, 'foreign-link');
    writeFileSync(sentinel, 'preserve', { flag: 'wx' });
    try {
      symlinkSync(target.path, link, process.platform === 'win32' ? 'junction' : 'dir');
      expect(() => fixture.dispose()).toThrow('linked descendants');
      expect(readFileSync(sentinel, 'utf8')).toBe('preserve');
      unlinkSync(link); fixture.dispose(); fixture.dispose();
      expect(existsSync(fixture.path)).toBe(false);
      expect(readFileSync(sentinel, 'utf8')).toBe('preserve');
    } finally { if (existsSync(link)) unlinkSync(link); if (existsSync(fixture.path)) fixture.dispose(); target.dispose(); }
  });
});
