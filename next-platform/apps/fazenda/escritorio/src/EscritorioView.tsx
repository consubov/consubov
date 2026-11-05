import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';

export const EscritorioView: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div style={{ padding: 16 }} data-testid="escritorio-module-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            {t('role.escritorio.title', 'Escritório Administrativo')}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748B' }}>
            {t('role.escritorio.desc', 'Entrada de notas fiscais, pedidos de compra de insumos, conferência e fechamento financeiro de lotes.')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.nota_fiscal', 'Nota Fiscal')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>3 Pendentes</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Aguardando conferência física</p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>{t('domain.ordem_compra', 'Ordem de Compra')}</h3>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#15803D' }}>8 Aprovadas</p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>Entrega prevista na semana</p>
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Button variant="primary">
          {t('action.search', 'Buscar...')}
        </Button>
      </div>
    </div>
  );
};

export default EscritorioView;
