import { describe, it, expect } from 'bun:test';
import { scanAstLiterals, findTsxFiles } from '../harness/ast-literal-guard';
import { APP_DICTIONARY } from '@consubov/contracts';
import { resolve } from 'path';

describe('Gate Q6: AST Literal Guard & Bilinguismo 100% no Console ADM Global (q6-ast-literal-guard)', () => {
  const adminSrcDir = resolve(import.meta.dir, '../../apps/admin-global/src');

  it('Q6.6.1: deve encontrar todos os arquivos TSX do console ADM Global', () => {
    const tsxFiles = findTsxFiles(adminSrcDir);
    expect(tsxFiles.length).toBeGreaterThanOrEqual(10);

    const fileNames = tsxFiles.map(f => f.replace(/\\/g, '/'));
    expect(fileNames.some(f => f.endsWith('App.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('AdminLoginView.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('AdminLayout.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('TenantsView.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('NewTenantModal.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('SuspendTenantModal.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('LicensesView.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('OffgridLicenseModal.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('AuditLedgerView.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('CommandInspectorModal.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('GlobalUsersView.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('BlockUserModal.tsx'))).toBe(true);
    expect(fileNames.some(f => f.endsWith('LinkUserModal.tsx'))).toBe(true);
  });

  it('Q6.6.2: AST Literal Guard deve certificar ZERO violações de strings literais JSX em apps/admin-global/src/', () => {
    const tsxFiles = findTsxFiles(adminSrcDir);
    const violations = scanAstLiterals(tsxFiles);

    if (violations.length > 0) {
      console.error('Violações de literais encontradas no módulo ADM Global:', violations);
    }

    expect(violations.length).toBe(0);
  });

  it('Q6.6.3: Dicionário Bilíngue deve ter 100% de paridade estrita em todas as chaves admin.*', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const adminPtKeys = Object.keys(ptDict).filter(k => k.startsWith('admin.'));
    const adminEnKeys = Object.keys(enDict).filter(k => k.startsWith('admin.'));

    expect(adminPtKeys.length).toBeGreaterThanOrEqual(70);
    expect(adminEnKeys.length).toBe(adminPtKeys.length);

    const missingInEn = adminPtKeys.filter(k => !enDict[k]);
    const missingInPt = adminEnKeys.filter(k => !ptDict[k]);

    expect(missingInEn).toEqual([]);
    expect(missingInPt).toEqual([]);
  });

  it('Q6.6.4: Chaves de tradução do namespace admin.* devem conter traduções válidas não-vazias', () => {
    const ptDict = APP_DICTIONARY['pt-BR'];
    const enDict = APP_DICTIONARY['en-US'];

    const adminPtKeys = Object.keys(ptDict).filter(k => k.startsWith('admin.'));

    for (const key of adminPtKeys) {
      const ptVal = ptDict[key] ?? '';
      const enVal = enDict[key] ?? '';
      expect(ptVal.trim().length).toBeGreaterThan(0);
      expect(enVal.trim().length).toBeGreaterThan(0);
    }
  });
});
