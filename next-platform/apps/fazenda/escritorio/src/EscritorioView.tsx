import React, { useState, useEffect } from 'react';
import { useTranslation, StateBoundary } from '@consubov/ui';
import { getEscritorioStore, EscritorioState } from './store/escritorioStore';
import { EscritorioDashboardTab } from './components/EscritorioDashboardTab';
import { EscritorioNotasTab } from './components/EscritorioNotasTab';
import { EscritorioComprasTab } from './components/EscritorioComprasTab';
import { EscritorioLotesTab } from './components/EscritorioLotesTab';
import { EscritorioFinanceiroTab } from './components/EscritorioFinanceiroTab';

export type EscritorioSubTab = 'overview' | 'invoices' | 'purchases' | 'lots' | 'closing';

export const EscritorioView: React.FC = () => {
  const { t } = useTranslation();
  const store = getEscritorioStore();
  const [state, setState] = useState<EscritorioState>(() => store.getState());

  // Recupera sub-aba da URL hash (#/fazenda/escritorio?tab=xxx)
  const getInitialTab = (): EscritorioSubTab => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/[?&]tab=([a-z_-]+)/);
      if (match && match[1]) {
        const tab = match[1] as EscritorioSubTab;
        if (['overview', 'invoices', 'purchases', 'lots', 'closing'].includes(tab)) {
          return tab;
        }
      }
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<EscritorioSubTab>(getInitialTab);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState({ ...store.getState() });
    });
    return unsubscribe;
  }, [store]);

  const handleSelectTab = (tab: EscritorioSubTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const basePath = window.location.hash.split('?')[0] || '#/fazenda/escritorio';
      window.location.hash = `${basePath}?tab=${tab}`;
    }
  };

  const tabs: { key: EscritorioSubTab; labelKey: string; defaultLabel: string }[] = [
    { key: 'overview', labelKey: 'escritorio.tab.overview', defaultLabel: 'Resumo Administrativo' },
    { key: 'invoices', labelKey: 'escritorio.tabs.invoices', defaultLabel: 'Notas Fiscais (NF-e)' },
    { key: 'purchases', labelKey: 'escritorio.tabs.purchases', defaultLabel: 'Pedidos de Compra' },
    { key: 'lots', labelKey: 'escritorio.tabs.lots', defaultLabel: 'Cadastros e Desdobramentos' },
    { key: 'closing', labelKey: 'escritorio.tabs.closing', defaultLabel: 'Fechamento Financeiro' }
  ];

  return (
    <div style={{ padding: 16 }} data-testid="escritorio-module-view">
      {/* Cabeçalho do Módulo */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
          {t('role.escritorio.title', 'Escritório Administrativo')}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.95rem' }}>
          {t('role.escritorio.desc', 'Entrada de notas fiscais, pedidos de compra de insumos, conferência e fechamento financeiro de lotes.')}
        </p>
      </div>

      {/* Navegação por Sub-Abas */}
      <div
        role="tablist"
        aria-label={t('escritorio.tab.overview', 'Resumo Administrativo')}
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '2px solid #E2E8F0',
          marginBottom: 20,
          overflowX: 'auto',
          paddingBottom: 2
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectTab(tab.key)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.925rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0284C7' : '#64748B',
                borderBottom: isActive ? '3px solid #0284C7' : '3px solid transparent',
                marginBottom: -4,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {t(tab.labelKey, tab.defaultLabel)}
            </button>
          );
        })}
      </div>

      {/* Conteúdo da Sub-Aba Ativa */}
      <StateBoundary state={state.notasFiscais.length === 0 ? 'empty' : 'success'}>
        {activeTab === 'overview' && (
          <EscritorioDashboardTab
            state={state}
            onRefresh={() => setState({ ...store.getState() })}
            onNavigateTab={tab => handleSelectTab(tab as EscritorioSubTab)}
          />
        )}
        {activeTab === 'invoices' && (
          <EscritorioNotasTab state={state} store={store} />
        )}
        {activeTab === 'purchases' && (
          <EscritorioComprasTab state={state} store={store} />
        )}
        {activeTab === 'lots' && (
          <EscritorioLotesTab state={state} store={store} />
        )}
        {activeTab === 'closing' && (
          <EscritorioFinanceiroTab state={state} store={store} />
        )}
      </StateBoundary>
    </div>
  );
};

export default EscritorioView;
