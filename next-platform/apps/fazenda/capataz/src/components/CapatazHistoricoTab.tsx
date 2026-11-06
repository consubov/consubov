import React from 'react';
import { useTranslation, Card } from '@consubov/ui';
import { CapatazStore, CapatazState } from '../store/capatazStore';

interface CapatazHistoricoTabProps {
  store: CapatazStore;
  state: CapatazState;
}

interface OperationalHistoryItem {
  key: string;
  title: string;
  detail: string;
  recordedAt: string;
}

export const CapatazHistoricoTab: React.FC<CapatazHistoricoTabProps> = ({ state }) => {
  const { t, language } = useTranslation();
  const pastureName = (pastoId: string) => state.pastos.find(pasto => pasto.pasto_id === pastoId)?.nome_pasto ?? t('capataz.historico.pasture');
  const history: OperationalHistoryItem[] = [
    ...state.leiturasCocho.map(item => ({
      key: `cocho:${item.leitura_id}`,
      title: t('capataz.historico.cochoReading'),
      detail: `${pastureName(item.pasto_id)} · ${t('capataz.historico.score')} ${item.escore_cocho}`,
      recordedAt: item.registrado_em
    })),
    ...state.leiturasQr.map(item => ({
      key: `pasto:${item.leitura_id}`,
      title: t('capataz.historico.pastureReading'),
      detail: `${pastureName(item.pasto_id)} · ${item.altura_media_cm} cm`,
      recordedAt: item.data_leitura
    })),
    ...state.contagens.map(item => ({
      key: `contagem:${item.contagem_id}`,
      title: t('capataz.historico.herdCount'),
      detail: `${pastureName(item.pasto_id)} · ${item.quantidade_cabecas} ${t('capataz.historico.heads')}`,
      recordedAt: item.data_contagem
    }))
  ].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));

  const operationName = (commandType: string) => {
    if (commandType.includes('cocho')) return t('capataz.historico.cochoReading');
    if (commandType.includes('pasto')) return t('capataz.historico.pastureReading');
    if (commandType.includes('contagem') || commandType.includes('animais')) return t('capataz.historico.herdCount');
    return t('capataz.historico.fieldRecord');
  };
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  return (
    <div data-testid="capataz-historico-tab">
      {state.conflitos.length > 0 && (
        <Card elevation="elevated" style={{ marginBottom: 20, border: '2px solid #F87171', backgroundColor: '#FEF2F2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span aria-hidden="true" style={{ fontSize: '1.25rem', color: '#DC2626' }}>⚠️</span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#991B1B' }}>
              {t('capataz.historico.conflictAlert')} ({state.conflitos.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {state.conflitos.map(item => (
              <div key={item.command.command_id} style={{ padding: 12, backgroundColor: '#FFFFFF', borderRadius: 6, border: '1px solid #FECACA' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                  {operationName(item.command.command_type)}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 10 }}>
                  {t('operationIssue.conflict')}
                </div>
                <p>{t('operationIssue.preserved')}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card elevation="elevated">
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
          {t('capataz.historico.title')}
        </h2>
        {history.length === 0 ? (
          <p style={{ color: '#64748B', margin: 0 }}>{t('capataz.historico.emptyHistory')}</p>
        ) : (
          <ol style={{ display: 'grid', gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
            {history.slice(0, 20).map(item => (
              <li key={item.key} style={{ padding: '12px 14px', backgroundColor: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1E293B' }}>{item.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 3 }}>{item.detail}</div>
                <time dateTime={item.recordedAt} style={{ display: 'block', fontSize: '0.8rem', color: '#64748B', marginTop: 5 }}>
                  {formatDate(item.recordedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
};
