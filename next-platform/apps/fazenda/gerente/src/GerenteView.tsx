import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';

export const GerenteView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 16 }} data-testid="gerente-module-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {t('role.gerente.title', 'Gerente de Produção')}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748B' }}>
            {t('role.gerente.desc', 'Metas de GMD, curvas de peso, fechamento de lotes, auditoria de cocho e custos analíticos.')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.gmd', 'Ganho Médio Diário (GMD)')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#15803D' }}>1.45 kg/dia</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Meta: 1.35 kg/dia</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.escore_cocho', 'Escore de Cocho')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>98.2%</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Leituras dentro do alvo</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.lote', 'Lote')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#475569' }}>12 Ativos</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Total: 3.420 cabeças</p>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button variant="primary">
          {t('action.refresh', 'Atualizar')}
        </Button>
      </div>
    </div>
  );
};

export default GerenteView;
