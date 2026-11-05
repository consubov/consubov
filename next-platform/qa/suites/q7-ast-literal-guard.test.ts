import { describe, it, expect } from 'bun:test';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { APP_DICTIONARY } from '@consubov/contracts';
import { resolve } from 'path';

describe('Gate Q7.6: AST Literal Guard & Bilinguismo 100% nas Novas Funcionalidades (q7-ast-literal-guard)', () => {
  const shellSrcDir = resolve(import.meta.dir, '../../apps/fazenda/shell/src');
  const capatazSrcDir = resolve(import.meta.dir, '../../apps/fazenda/capataz/src');

  it('Q7.6.1: AST Literal Guard deve certificar ZERO violações de strings literais JSX em apps/fazenda/shell/src/', () => {
    const tsxFiles = findTsxFiles(shellSrcDir);
    expect(tsxFiles.length).toBeGreaterThan(0);

    const violations = scanAstLiterals(tsxFiles);

    if (violations.length > 0) {
      console.error('Violações de literais JSX encontradas no Shell Fazenda:', violations);
    }

    expect(violations.length).toBe(0);
  });

  it('Q7.6.2: AST Literal Guard deve certificar ZERO violações de strings literais JSX em CapatazFotosTab.tsx', () => {
    const fotosTabFile = resolve(capatazSrcDir, 'components/CapatazFotosTab.tsx');
    const violations = scanAstLiterals([fotosTabFile]);

    if (violations.length > 0) {
      console.error('Violações de literais JSX encontradas em CapatazFotosTab:', violations);
    }

    expect(violations.length).toBe(0);
  });

  it('Q7.6.3: Dicionário Bilíngue deve ter 100% de paridade estrita em todas as chaves do namespace update.*', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const updatePtKeys = Object.keys(ptDict).filter((k) => k.startsWith('update.'));
    const updateEnKeys = Object.keys(enDict).filter((k) => k.startsWith('update.'));

    expect(updatePtKeys.length).toBeGreaterThanOrEqual(25);
    expect(updateEnKeys.length).toBe(updatePtKeys.length);

    const missingInEn = updatePtKeys.filter((k) => !enDict[k]);
    const missingInPt = updateEnKeys.filter((k) => !ptDict[k]);

    expect(missingInEn).toEqual([]);
    expect(missingInPt).toEqual([]);
  });

  it('Q7.6.4: Chaves de tradução do namespace update.* devem conter valores não-vazios e simétricos', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const updatePtKeys = Object.keys(ptDict).filter((k) => k.startsWith('update.'));

    for (const key of updatePtKeys) {
      const ptVal = ptDict[key]?.trim();
      const enVal = enDict[key]?.trim();

      expect(ptVal).toBeDefined();
      expect(ptVal!.length).toBeGreaterThan(0);

      expect(enVal).toBeDefined();
      expect(enVal!.length).toBeGreaterThan(0);
    }
  });

  it('Q7.6.5: Paridade geral completa entre pt-BR e en-US em todo o APP_DICTIONARY', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const ptKeys = Object.keys(ptDict).sort();
    const enKeys = Object.keys(enDict).sort();

    expect(ptKeys.length).toBe(enKeys.length);

    const missingInEn = ptKeys.filter((k) => !enDict[k]);
    const missingInPt = enKeys.filter((k) => !ptDict[k]);

    expect(missingInEn).toEqual([]);
    expect(missingInPt).toEqual([]);
  });
});
