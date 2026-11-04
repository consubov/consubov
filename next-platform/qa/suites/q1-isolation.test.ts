import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'child_process';

describe('Suíte Q1.1: Confinamento Físico e Isolamento da Raiz', () => {
  const rootDir = 'd:\\MATEUS\\Documentos\\GitHub\\consubov';
  const worktreeDir = 'd:\\MATEUS\\Documentos\\GitHub\\consubov-worktrees\\f23-isolated-next-platform';

  it('deve confirmar que a raiz principal está 100% limpa (main sem diff)', () => {
    const gitStatus = spawnSync('git', ['status', '--short', '--branch'], {
      cwd: rootDir,
      encoding: 'utf-8',
      shell: true
    });

    expect(gitStatus.status).toBe(0);
    const output = (gitStatus.stdout || '').trim();
    expect(output).toBe('## main...origin/main');
  });

  it('deve confirmar que todos os arquivos modificados na worktree pertencem estritamente a next-platform/**', () => {
    const gitDiff = spawnSync('git', ['status', '--short'], {
      cwd: worktreeDir,
      encoding: 'utf-8',
      shell: true
    });

    expect(gitDiff.status).toBe(0);
    const lines = (gitDiff.stdout || '')
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      // Ignora arquivos criados/modificados estritamente sob next-platform/
      const filePath = line.replace(/^[MADRCU?!]{1,2}\s+/, '').trim();
      expect(filePath.startsWith('next-platform/')).toBe(true);
    }
  });

  it('deve garantir que package.json e bun.lock na raiz da worktree não foram modificados', () => {
    const gitDiff = spawnSync('git', ['diff', 'HEAD', '--', 'package.json', 'bun.lock'], {
      cwd: worktreeDir,
      encoding: 'utf-8',
      shell: true
    });

    expect(gitDiff.status).toBe(0);
    expect((gitDiff.stdout || '').trim()).toBe('');
  });
});
