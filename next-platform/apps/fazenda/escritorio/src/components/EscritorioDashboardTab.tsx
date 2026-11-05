import React from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { EscritorioState } from '../store/escritorioStore';

export interface EscritorioDashboardTabProps {
  state: EscritorioState;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

export const EscritorioDashboardTab: React.FC<EscritorioDashboardTabProps> = ({
  state,
  onRefresh,
  onNavigateTab
}) => {
  const { t } = useTranslation();

  return (
    <div data-testid="escritorio-dashboard-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grade de KPIs Administrativos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.nota_fiscal', 'Nota Fiscal')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#0369A1' }}>
            {t('escritorio.dashboard.pendingInvoicesCount', { count: String(state.kpis.pendentesConferencia) })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('escritorio.dashboard.awaitingPhysicalCheck', 'Aguardando conferência física')}
          </p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('domain.ordem_compra', 'Ordem de Compra')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#15803D' }}>
            {t('escritorio.dashboard.approvedOrdersCount', { count: String(state.kpis.comprasAprovadas) })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('escritorio.dashboard.deliveryThisWeek', 'Entrega prevista na semana')}
          </p>
        </Card>

        <Card elevation="elevated">
          <h3 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#475569' }}>
            {t('escritorio.outbox.titulo', 'Fila Outbox de Conciliação')}
          </h3>
          <p style={{ fontSize: '1.85rem', fontWeight: 800, margin: 0, color: '#475569' }}>
            <span>{state.outbox.length}</span>
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
            {t('escritorio.outbox.pendentes', 'Pendentes de Envio')}
          </p>
        </Card>
      </div>

      {/* Relação Recente de Notas Fiscais e Pedidos */}
      <Card elevation="flat">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
            {t('escritorio.tabs.invoices', 'Notas Fiscais (NF-e)')}
          </h3>
          <Button variant="secondary" onClick={() => onNavigateTab('invoices')}>
            {t('action.search', 'Buscar...')}
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('escritorio.invoice.number', 'Número da NF')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('escritorio.invoice.supplierName', 'Nome do Fornecedor')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('escritorio.invoice.totalValue', 'Valor Total (R$)')}</th>
                <th scope="col" style={{ padding: '8px 12px' }}>{t('escritorio.invoice.issueDate', 'Data de Emissão')}</th>
              </tr>
            </thead>
            <tbody>
              {state.notasFiscais.map(nf => (
                <tr key={nf.nota_fiscal_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{nf.numero_nf}</td>
                  <td style={{ padding: '10px 12px', color: '#334155' }}>{nf.fornecedor_nome}</td>
                  <td style={{ padding: '10px 12px', color: '#0F172A', fontWeight: 600 }}>
                    <span>R$ {nf.valor_total_brl.toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748B' }}>{nf.data_emissao.slice(0, 10)}</td>
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
        <Button variant="secondary" onClick={() => onNavigateTab('purchases')}>
          {t('escritorio.tabs.purchases', 'Pedidos de Compra')}
        </Button>
      </div>
    </div>
  );
};
