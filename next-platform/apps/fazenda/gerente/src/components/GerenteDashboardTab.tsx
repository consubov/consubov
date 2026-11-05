import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { GerenteState } from '../store/gerenteStore';

export interface GerenteDashboardTabProps {
  state: GerenteState;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

export const GerenteDashboardTab: React.FC<GerenteDashboardTabProps> = ({
  state,
  onRefresh,
  onNavigateTab
}) => {
  const { t } = useTranslation();

  return (
    <div data-testid="gerente-dashboard-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grade de KPIs Principais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.gmd', 'Ganho Médio Diário (GMD)')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#15803D' }}>
            {t('gerente.dashboard.demoGmdValue', '1,45 kg/dia')}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('gerente.dashboard.gmdTarget', { value: String(state.kpis.gmdMeta) })}
          </p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.escore_cocho', 'Escore de Cocho')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>
            <span>{state.kpis.escoreCochoPct}%</span>
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('gerente.dashboard.troughOnTarget', 'Leituras dentro do alvo')}
          </p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.lote', 'Lote')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#334155' }}>
            {t('gerente.dashboard.activeLotsCount', { count: String(state.lotes.length) })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('gerente.dashboard.totalHeadCount', { count: String(state.kpis.animaisAtivos) })}
          </p>
        </Card>
      </div>

      {/* Tabela de Lotes Ativos */}
      <Card elevation="flat">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
            {t('gerente.tabs.lotes', 'Gestão de Lotes')}
          </h3>
          <Button variant="secondary" onClick={() => onNavigateTab('lotes')}>
            {t('action.search', 'Buscar...')}
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('gerente.lote.nome', 'Identificação do Lote')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('gerente.transfer.originLabel', 'Pasto de Origem')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('gerente.lote.cabecas', 'Quantidade de Cabeças')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('gerente.lote.peso_medio', 'Peso Médio (kg)')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('gerente.metas.gmdTargetLabel', 'GMD Alvo (kg/dia)')}</th>
              </tr>
            </thead>
            <tbody>
              {state.lotes.map(lote => (
                <tr key={lote.lote_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lote.nome_lote}</td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>{lote.pasto_nome}</td>
                  <td style={{ padding: '10px 12px' }}>{lote.quantidade_cabecas}</td>
                  <td style={{ padding: '10px 12px' }}>{lote.peso_medio_kg}</td>
                  <td style={{ padding: '10px 12px', color: '#15803D', fontWeight: 600 }}>{lote.meta_gmd_kg_dia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="primary" onClick={onRefresh}>
          {t('action.refresh', 'Atualizar')}
        </Button>
        <Button variant="secondary" onClick={() => onNavigateTab('metas')}>
          {t('gerente.tabs.metas', 'Metas e Curvas de GMD')}
        </Button>
      </div>
    </div>
  );
};
