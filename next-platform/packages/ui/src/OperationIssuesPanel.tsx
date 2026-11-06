import React, { useEffect, useState } from 'react';
import type { OperationIssue } from '@consubov/contracts';
import { useTranslation } from './i18n';
import { useLocalData } from './ModuleRuntimeContext';

const operationLabels: Record<string, string> = {
  'capataz.salga.lancar': 'capataz.historico.cochoReading',
  'capataz.cocho.registrar_escore': 'capataz.historico.cochoReading',
  'capataz.cocho.foto_adicionar': 'operationIssue.photo',
  'capataz.pasto.leitura_qr': 'capataz.historico.pastureReading',
  'capataz.animais.contagem': 'capataz.historico.herdCount',
  'gerente.metas.definir': 'gerente.tabs.metas',
  'gerente.gmd.ajustar_curva': 'gerente.tabs.metas',
  'gerente.lote.transferir_pasto': 'gerente.tabs.lotes',
  'gerente.custos.apropriar': 'gerente.tabs.custos',
  'gerente.leitura_cocho.aprovar': 'gerente.tabs.auditoria',
  'escritorio.notas.registrar_entrada': 'escritorio.tabs.invoices',
  'escritorio.compras.criar_pedido': 'escritorio.tabs.purchases',
  'escritorio.lotes.cadastrar': 'escritorio.tabs.lots',
  'escritorio.lotes.particionar': 'escritorio.tabs.lots',
  'escritorio.custos.fechar': 'escritorio.tabs.closing',
  'escritorio.relatorios.emitir': 'escritorio.tabs.reports',
  'fabrica.formulas.salvar': 'fabrica.tabs.formulas',
  'fabrica.batidas.iniciar': 'fabrica.tabs.batches',
  'fabrica.batidas.concluir': 'fabrica.tabs.batches',
  'fabrica.estoque.ajustar': 'fabrica.tabs.silos',
  'fabrica.materia_prima.receber': 'fabrica.tabs.receiving',
  'fabrica.balanca.calibrar': 'fabrica.tabs.calibration'
};
const fieldLabels: Record<string, string> = {
  peso_kg: 'operationIssue.field.weight', peso_medio_inicial_kg: 'operationIssue.field.weight',
  quantidade_cabecas: 'operationIssue.field.quantity', quantidade_animais: 'operationIssue.field.quantity',
  quantidade_pedida: 'operationIssue.field.quantity', quantidade_kg: 'operationIssue.field.quantity',
  quantidade_ajustada_kg: 'operationIssue.field.quantity', quantidade_realizada_kg: 'operationIssue.field.quantity',
  sacos_fornecidos: 'operationIssue.field.quantity', escore_cocho: 'capataz.historico.score',
  escore_revisado: 'capataz.historico.score', altura_media_cm: 'operationIssue.field.height',
  ingredientes: 'operationIssue.field.ingredients', chave_acesso_nfe: 'operationIssue.field.invoice',
  data_pesagem: 'operationIssue.field.date', data_contagem: 'operationIssue.field.date',
  data_leitura: 'operationIssue.field.date', data_emissao: 'operationIssue.field.date',
  pasto_id: 'capataz.historico.pasture', pasto_destino_id: 'capataz.historico.pasture',
  lote_id: 'operationIssue.field.lot', produto_id: 'operationIssue.field.product',
  foto_attachment_id: 'operationIssue.photo', gmd_alvo_kg_dia: 'operationIssue.field.target'
};

/** Operational failures only. This view cannot acknowledge, discard or replace a record. */
export function OperationIssuesPanel({ issues, readError = false }: { issues: readonly OperationIssue[]; readError?: boolean }) {
  const { t, language } = useTranslation();
  if (!issues.length && !readError) return null;
  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? t('operationIssue.dateUnavailable')
      : new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
  };
  return (
    <section role="alert" data-testid="operation-issues" style={{ padding: 16, marginBottom: 16, border: '1px solid #FECACA', borderRadius: 8, backgroundColor: '#FEF2F2', color: '#7F1D1D' }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>{t('operationIssue.title')}</h2>
      {readError && <p>{t('operationIssue.readError')}</p>}
      {issues.map(issue => (
        <details key={issue.commandId} style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
            {t('operationIssue.details')} · {t(operationLabels[issue.commandType] ?? 'capataz.historico.fieldRecord')} · {date(issue.occurredAt)}
          </summary>
          <p>{t(`operationIssue.${issue.kind}`)}</p>
          <p>{t('operationIssue.preserved')}</p>
          {!!issue.violations?.length && (
            <ul>
              {issue.violations.map((violation, index) => {
                const field = violation.field.split('.').find(part => part !== 'payload' && !/^\d+$/.test(part)) ?? '';
                return <li key={index}>{t(fieldLabels[field] ?? 'operationIssue.field.record')}: {t('operationIssue.checkValue')}</li>;
              })}
            </ul>
          )}
        </details>
      ))}
    </section>
  );
}

/** Read issues again after a durable change, without remounting the operational forms. */
export function OperationIssuesFeedback() {
  const localData = useLocalData();
  const [feedback, setFeedback] = useState<{ source: typeof localData; issues: readonly OperationIssue[]; readError: boolean }>(() => ({ source: localData, issues: [], readError: false }));
  useEffect(() => {
    let active = true;
    let generation = 0;
    setFeedback({ source: localData, issues: [], readError: false });
    const reload = async () => {
      const request = ++generation;
      try {
        const next = await localData.listOperationIssues?.(500) ?? [];
        if (active && request === generation) setFeedback({ source: localData, issues: next, readError: false });
      } catch {
        if (active && request === generation) setFeedback(previous => ({ source: localData, issues: previous.source === localData ? previous.issues : [], readError: true }));
      }
    };
    void reload();
    const unsubscribe = localData.subscribeToChanges?.(() => { void reload(); });
    return () => { active = false; generation++; unsubscribe?.(); };
  }, [localData]);
  // Hide the previous account's feedback during the render before effect cleanup.
  return <OperationIssuesPanel issues={feedback.source === localData ? feedback.issues : []} readError={feedback.source === localData && feedback.readError} />;
}
