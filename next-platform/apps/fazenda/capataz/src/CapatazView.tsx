import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';

export const CapatazView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 16 }} data-testid="capataz-module-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {t('role.capataz.title', 'Capataz de Campo')}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748B' }}>
            {t('role.capataz.desc', 'Leitura de cocho por pasto, fotos de escore, registro de salga, contagem de animais e operação 100% offline.')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.pasto', 'Pasto')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#B45309' }}>{t('capataz.demo.pastureName', { pasto: '07', setor: 'Sede' })}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>{t('capataz.demo.lastReadingTime', { hours: '2' })}</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.cocho', 'Cocho')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#15803D' }}>{t('capataz.demo.scoreClean', { score: '3' })}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>{t('capataz.demo.normalConsumption')}</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.salga', 'Salga e Nutrição')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>{t('capataz.demo.stocked')}</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>{t('capataz.demo.stockedDesc', { amount: '250', type: '80' })}</p>
        </Card>
      </div>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <Button variant="primary">
          {t('action.save', 'Salvar')}
        </Button>
        <Button variant="secondary">
          {t('action.syncNow', 'Sincronizar Agora')}
        </Button>
      </div>
    </div>
  );
};

export default CapatazView;
