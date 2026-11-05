import { describe, it, expect } from 'bun:test';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { APP_DICTIONARY, translateKey } from '@consubov/contracts';
import { resolve } from 'path';

describe('Gate Q8.4: Full AST Literal Guard & Bilinguismo Global 100% (q8-ast-literal-guard)', () => {
  const rootSrcDir = resolve(import.meta.dir, '../..');
  const shellSrcDir = resolve(rootSrcDir, 'apps/fazenda/shell/src');
  const gerenteSrcDir = resolve(rootSrcDir, 'apps/fazenda/gerente/src');
  const capatazSrcDir = resolve(rootSrcDir, 'apps/fazenda/capataz/src');
  const escritorioSrcDir = resolve(rootSrcDir, 'apps/fazenda/escritorio/src');
  const fabricaSrcDir = resolve(rootSrcDir, 'apps/fazenda/fabrica/src');
  const adminSrcDir = resolve(rootSrcDir, 'apps/admin-global/src');
  const uiSrcDir = resolve(rootSrcDir, 'packages/ui/src');

  it('Q8.4.1: AST Literal Guard deve certificar ZERO violações em apps/fazenda/shell/src/', () => {
    const files = findTsxFiles(shellSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas no Shell:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.2: AST Literal Guard deve certificar ZERO violações em apps/fazenda/gerente/src/', () => {
    const files = findTsxFiles(gerenteSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas no Gerente:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.3: AST Literal Guard deve certificar ZERO violações em apps/fazenda/capataz/src/', () => {
    const files = findTsxFiles(capatazSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas no Capataz:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.4: AST Literal Guard deve certificar ZERO violações em apps/fazenda/escritorio/src/', () => {
    const files = findTsxFiles(escritorioSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas no Escritório:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.5: AST Literal Guard deve certificar ZERO violações em apps/fazenda/fabrica/src/', () => {
    const files = findTsxFiles(fabricaSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas na Fábrica:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.6: AST Literal Guard deve certificar ZERO violações em apps/admin-global/src/', () => {
    const files = findTsxFiles(adminSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas no Admin Global:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.7: AST Literal Guard deve certificar ZERO violações em packages/ui/src/', () => {
    const files = findTsxFiles(uiSrcDir);
    expect(files.length).toBeGreaterThan(0);
    const violations = scanAstLiterals(files);
    if (violations.length > 0) {
      console.error('Violações encontradas no Design System UI:', violations);
    }
    expect(violations.length).toBe(0);
  });

  it('Q8.4.8: Varredura agregada de todo o monorepo deve cobrir mais de 50 componentes TSX sem nenhuma violação', () => {
    const allFiles = [
      ...findTsxFiles(shellSrcDir),
      ...findTsxFiles(gerenteSrcDir),
      ...findTsxFiles(capatazSrcDir),
      ...findTsxFiles(escritorioSrcDir),
      ...findTsxFiles(fabricaSrcDir),
      ...findTsxFiles(adminSrcDir),
      ...findTsxFiles(uiSrcDir)
    ];

    expect(allFiles.length).toBeGreaterThanOrEqual(50);
    const totalViolations = scanAstLiterals(allFiles);
    expect(totalViolations.length).toBe(0);
  });

  it('Q8.4.9: Dicionário APP_DICTIONARY deve ter 100% de paridade simétrica estrita entre pt-BR e en-US', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const ptKeys = Object.keys(ptDict).sort();
    const enKeys = Object.keys(enDict).sort();

    expect(ptKeys.length).toBeGreaterThanOrEqual(100);
    expect(ptKeys.length).toBe(enKeys.length);

    const missingInEn = ptKeys.filter((k) => !enDict[k]);
    const missingInPt = enKeys.filter((k) => !ptDict[k]);

    expect(missingInEn).toEqual([]);
    expect(missingInPt).toEqual([]);
  });

  it('Q8.4.10: Todas as strings do dicionário devem ser não-vazias e translateKey deve resolver com fidelidade em ambos os idiomas', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    for (const key of Object.keys(ptDict)) {
      const ptVal = ptDict[key]?.trim();
      const enVal = enDict[key]?.trim();

      expect(ptVal).toBeDefined();
      expect(ptVal!.length).toBeGreaterThan(0);

      expect(enVal).toBeDefined();
      expect(enVal!.length).toBeGreaterThan(0);

      expect(translateKey('pt-BR', key)).toBe(ptVal!);
      expect(translateKey('en-US', key)).toBe(enVal!);
    }
  });
});
