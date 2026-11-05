import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { FabricaState } from '../store/fabricaStore';

export interface FabricaDashboardTabProps {
  state: FabricaState;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

export const FabricaDashboardTab: React.FC<FabricaDashboardTabProps> = ({
  state,
  onRefresh,
  onNavigateTab
}) => {
  const { t } = useTranslation();

  return (
    <div data-testid="fabrica-dashboard-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grade de KPIs da Fábrica */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.batida', 'Batida de Ração')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#334155' }}>
            {t('fabrica.dashboard.batchNumber', { number: '42' })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('fabrica.dashboard.mixerInProgress', { mixer: '01' })}
          </p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.formula', 'Fórmula Nutricional')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#15803D' }}>
            {t('fabrica.dashboard.formulaFinishing', 'Terminação 22%')}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('fabrica.dashboard.formulaIngredientsDemo', 'Milho, Farelo de Soja, Núcleo')}
          </p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.silo', 'Silo de Armazenagem')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>
            {t('fabrica.dashboard.siloCapacityPercent', { percent: '84.5' })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('fabrica.dashboard.siloContentDemo', { silo: '02', content: 'Milho moído' })}
          </p>
        </Card>
      </div>

      {/* Status dos Misturadores Industriais */}
      <Card elevation="flat">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
            {t('fabrica.tabs.batches', 'Batidas e Misturadores')}
          </h3>
          <Button variant="secondary" onClick={() => onNavigateTab('batches')}>
            {t('action.search', 'Buscar...')}
          </Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {state.misturadores.map(m => (
            <Card key={m.misturador_id} elevation="elevated" style={{ backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A' }}>{m.nome}</h4>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: m.status === 'misturando' ? '#FEF3C7' : '#DCFCE7',
                    color: m.status === 'misturando' ? '#92400E' : '#166534'
                  }}
                >
                  {m.status}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                <span>{t('fabrica.formula.batchSize', 'Batida Padrão (kg)')}: </span>
                <strong>{m.capacidade_kg}</strong>
              </p>
            </Card>
          ))}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="primary" onClick={onRefresh}>
          {t('action.refresh', 'Atualizar')}
        </Button>
        <Button variant="secondary" onClick={() => onNavigateTab('formulas')}>
          {t('fabrica.tabs.formulas', 'Fórmulas Nutricionais')}
        </Button>
      </div>
    </div>
  );
};
