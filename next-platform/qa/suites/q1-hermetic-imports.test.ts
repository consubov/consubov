import { describe, it, expect } from 'bun:test';
import { readdirSync, statSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

describe('Suíte Q1.3: Hermeticidade Estática de Código e Imports', () => {
  const nextPlatformDir = resolve(import.meta.dir, '../..');

  function collectTsFiles(dir: string, fileList: string[] = []): string[] {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        collectTsFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allTsFiles = collectTsFiles(nextPlatformDir);

  it('deve encontrar arquivos TypeScript no monorepo next-platform', () => {
    expect(allTsFiles.length).toBeGreaterThan(10);
  });

  it('não deve conter nenhum import relativo apontando para fora de next-platform', () => {
    const violations: Array<{ file: string; line: string }> = [];

    for (const file of allTsFiles) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        if (/import\s+.*from\s+['"][^'"]+['"]/.test(line)) {
          // Detecta se tenta escapar de next-platform com caminhos para código legado
          if (line.includes('../../apps/web') || line.includes('../../../apps/web') || line.includes('../../../src/')) {
            violations.push({ file, line });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('não deve conter referências ao pacote legado @supabase/supabase-js nos módulos de aplicação', () => {
    const violations: Array<{ file: string; match: string }> = [];

    for (const file of allTsFiles) {
      // Ignora o próprio arquivo de teste que contém a string de verificação
      if (file.endsWith('q1-hermetic-imports.test.ts')) continue;

      const content = readFileSync(file, 'utf-8');
      if (content.includes('@supabase/supabase-js')) {
        violations.push({ file, match: '@supabase/supabase-js' });
      }
    }

    expect(violations).toEqual([]);
  });
});
