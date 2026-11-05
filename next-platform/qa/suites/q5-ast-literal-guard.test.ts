import { describe, it, expect } from 'bun:test';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { APP_DICTIONARY } from '@consubov/contracts';
import { resolve } from 'path';

describe('Q5.6: AST Literal Guard & Verificação Estrita de Bilinguismo no Módulo Capataz', () => {
  const capatazSrcDir = resolve(import.meta.dir, '../../apps/fazenda/capataz/src');

  it('Q5.6.1: deve encontrar todos os arquivos TSX do módulo Capataz', () => {
    const tsxFiles = findTsxFiles(capatazSrcDir);
    expect(tsxFiles.length).toBeGreaterThanOrEqual(6);

    const fileNames = tsxFiles.map(f => f.replace(/\\/g, '/'));
    expect(fileNames.some(f => f.endsWith('CapatazView.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('CapatazCochoTab.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('CapatazQrTab.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('CapatazContagemTab.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('CapatazFotosTab.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('CapatazHistoricoTab.tsx'))).toBe(true);
  });

  it('Q5.6.2: AST Literal Guard deve certificar ZERO violações de strings literais JSX no módulo Capataz', () => {
    const tsxFiles = findTsxFiles(capatazSrcDir);
    const violations = scanAstLiterals(tsxFiles);

    if (violations.length > 0) {
      console.error('Violações de literais encontradas no módulo Capataz:', violations);
    }

    expect(violations.length).toBe(0);
  });

  it('Q5.6.3: Dicionário Bilíngue deve ter 100% de paridade estrita em todas as chaves capataz.*', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const capatazPtKeys = Object.keys(ptDict).filter(k => k.startsWith('capataz.'));
    const capatazEnKeys = Object.keys(enDict).filter(k => k.startsWith('capataz.'));

    expect(capatazPtKeys.length).toBeGreaterThanOrEqual(50);
    expect(capatazEnKeys.length).toBe(capatazPtKeys.length);

    const missingInEn = capatazPtKeys.filter(k => !enDict[k]);
    const missingInPt = capatazEnKeys.filter(k => !ptDict[k]);

    expect(missingInEn).toEqual([]);
    expect(missingInPt).toEqual([]);
  });

  it('Q5.6.4: Chaves de tradução devem conter traduções válidas não-vazias', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const capatazPtKeys = Object.keys(ptDict).filter(k => k.startsWith('capataz.'));

    for (const key of capatazPtKeys) {
      const ptVal = ptDict[key] ?? '';
      const enVal = enDict[key] ?? '';
      expect(ptVal.trim().length).toBeGreaterThan(0);
      expect(enVal.trim().length).toBeGreaterThan(0);
    }
  });
});
