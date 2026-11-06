import { describe, expect, it } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '@consubov/ui';
import { operationIssueSchema, operationIssuesSchema, type OperationIssue } from '../../packages/contracts/src/runtime/operation-issues';
import { OperationIssuesPanel } from '../../packages/ui/src/OperationIssuesPanel';
import { CapatazHistoricoTab } from '../../apps/fazenda/capataz/src/components/CapatazHistoricoTab';
import type { CapatazStore, CapatazState } from '../../apps/fazenda/capataz/src/store/capatazStore';
import { INITIAL_MODULE_STATES } from '../../api/src/fixtures/initial-module-states';

const failure: OperationIssue = {
  commandId: 'private-command-id', commandType: 'gerente.metas.definir', aggregateType: 'lote', aggregateId: 'private-aggregate-id',
  occurredAt: '2026-11-05T12:00:00.000Z', recordedAt: '2026-11-05T12:01:00.000Z',
  kind: 'validation', baseVersion: 1, currentVersion: 2,
  violations: [{ field: 'payload.peso_kg', code: 'INVALID_DOMAIN_PAYLOAD', message: 'technical-private-server-message' }]
};
function render(issues: readonly OperationIssue[], language: 'pt-BR' | 'en-US' = 'pt-BR', readError = false) {
  return renderToStaticMarkup(<I18nProvider language={language}><OperationIssuesPanel issues={issues} readError={readError} /></I18nProvider>);
}

describe('operational review feedback', () => {
  it('has strict read-only DTOs bounded by record and field count', () => {
    expect(operationIssueSchema.safeParse(failure).success).toBe(true);
    expect(operationIssueSchema.safeParse({ ...failure, accessToken: 'forbidden' }).success).toBe(false);
    expect(operationIssuesSchema.safeParse(Array.from({ length: 501 }, () => failure)).success).toBe(false);
    expect(operationIssueSchema.safeParse({ ...failure, violations: Array.from({ length: 101 }, () => failure.violations![0]) }).success).toBe(false);
    expect(operationIssueSchema.safeParse({ ...failure, currentVersion: -1 }).success).toBe(false);
  });

  it('offers native expandable review details with translated business fields and date', () => {
    const html = render([failure]);
    expect(html).toContain('Registro precisa de revisão');
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('Ver detalhes do registro');
    expect(html).toContain('Metas e Curvas de GMD');
    expect(html).toContain('05/11/2026');
    expect(html).toContain('Peso: Confira o valor informado.');
    expect(html).toContain('dados informados foram preservados');
    for (const hidden of ['private-command-id', 'private-aggregate-id', 'gerente.metas.definir', 'payload.peso_kg', 'INVALID_DOMAIN_PAYLOAD', 'technical-private-server-message', 'baseVersion', 'currentVersion']) expect(html).not.toContain(hidden);
    expect(html).not.toContain('<button');
    expect(html).not.toMatch(/sincroniza|sync|offline|online|outbox|PWA/i);
  });

  it('does not present normal records as operational failures', () => {
    expect(render([])).toBe('');
    const html = render([], 'pt-BR', true);
    expect(html).toContain('Não foi possível consultar os registros');
    expect(html).toContain('Abra o aplicativo novamente');
    expect(html).not.toContain('sincron');
  });

  it('translates conflict, validation and security guidance without claiming resolution', () => {
    const html = render([{ ...failure, kind: 'conflict' }, { ...failure, commandId: 'other', kind: 'security' }], 'en-US');
    expect(html).toContain('A record needs review');
    expect(html).toContain('View record details');
    expect(html).toContain('Different information exists');
    expect(html).toContain('Sign in again with your account');
    expect(html).toContain('No choice between records has been confirmed');
    expect(html).not.toContain('Registro precisa');
    expect(html).not.toContain('technical-private-server-message');
  });

  it('retains the Capataz conflict explanation without unsafe memory-only resolution controls', () => {
    const state = structuredClone(INITIAL_MODULE_STATES.capataz!) as unknown as CapatazState;
    state.conflitos = [{ command: { command_id: 'original', command_type: 'capataz.animais.contagem' } as CapatazState['conflitos'][number]['command'], detectedAt: failure.recordedAt, reason: 'private reason' }];
    const html = renderToStaticMarkup(<I18nProvider language="pt-BR"><CapatazHistoricoTab store={{} as CapatazStore} state={state} /></I18nProvider>);
    expect(html).toContain('Registro precisa de revisão');
    expect(html).toContain('Contagem de rebanho');
    expect(html).toContain('Os dados informados foram preservados');
    expect(html).not.toContain('Manter este registro');
    expect(html).not.toContain('Usar registro atualizado');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('private reason');
  });
});
