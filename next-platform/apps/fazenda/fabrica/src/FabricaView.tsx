import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';

export const FabricaView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 16 }} data-testid="fabrica-module-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {t('role.fabrica.title', 'Operador da Fábrica de Ração')}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748B' }}>
            {t('role.fabrica.desc', 'Execução de batidas de ração, fórmulas nutricionais, pesagem de ingredientes e controle de estoque de silos.')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.batida', 'Batida de Ração')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#475569' }}>Batida #42</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Misturador 01 - Em andamento</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.formula', 'Fórmula Nutricional')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#15803D' }}>Terminação 22%</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Milho, Farelo de Soja, Núcleo</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.silo', 'Silo de Armazenagem')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>84.5% Cheio</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Silo 02: Milho moído</p>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button variant="primary">
          {t('action.confirm', 'Confirmar')}
        </Button>
      </div>
    </div>
  );
};

export default FabricaView;
