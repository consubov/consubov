import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import { resolve } from 'path';

describe('Suíte Q1.2: Compilação Estrita TypeScript (Strict Typecheck)', () => {
  const nextPlatformDir = resolve(import.meta.dir, '../..');

  it('deve compilar todos os projetos com zero erros via tsc -b', () => {
    // Roda tsc -b a partir de next-platform
    const result = spawnSync('bun', ['run', 'typecheck'], {
      cwd: nextPlatformDir,
      encoding: 'utf-8',
      shell: true
    });

    if (result.status !== 0) {
      console.error('STDOUT:', result.stdout);
      console.error('STDERR:', result.stderr);
    }

    expect(result.status).toBe(0);
  });
});
