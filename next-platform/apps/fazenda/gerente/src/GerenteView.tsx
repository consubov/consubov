import React, { useState, useEffect } from 'react';
import { useTranslation, StateBoundary } from '@consubov/ui';
import { getGerenteStore, GerenteState } from './store/gerenteStore';
import { GerenteDashboardTab } from './components/GerenteDashboardTab';
import { GerenteGmdTab } from './components/GerenteGmdTab';
import { GerenteLotesTab } from './components/GerenteLotesTab';
import { GerenteCustosTab } from './components/GerenteCustosTab';
import { GerenteCochoAuditTab } from './components/GerenteCochoAuditTab';

export type GerenteSubTab = 'overview' | 'metas' | 'lotes' | 'custos' | 'auditoria';

export const GerenteView: React.FC = () => {
  const { t } = useTranslation();
  const store = getGerenteStore();
  const [state, setState] = useState<GerenteState>(() => store.getState());

  // Recupera sub-aba da URL hash (#/fazenda/gerente?tab=xxx)
  const getInitialTab = (): GerenteSubTab => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/[?&]tab=([a-z_-]+)/);
      if (match && match[1]) {
        const tab = match[1] as GerenteSubTab;
        if (['overview', 'metas', 'lotes', 'custos', 'auditoria'].includes(tab)) {
          return tab;
        }
      }
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<GerenteSubTab>(getInitialTab);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState({ ...store.getState() });
    });
    return unsubscribe;
  }, [store]);

  const handleSelectTab = (tab: GerenteSubTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const basePath = window.location.hash.split('?')[0] || '#/fazenda/gerente';
      window.location.hash = `${basePath}?tab=${tab}`;
    }
  };

  const tabs: { key: GerenteSubTab; labelKey: string; defaultLabel: string }[] = [
    { key: 'overview', labelKey: 'gerente.tabs.overview', defaultLabel: 'Visão Geral da Produção' },
    { key: 'metas', labelKey: 'gerente.tabs.metas', defaultLabel: 'Metas e Curvas de GMD' },
    { key: 'lotes', labelKey: 'gerente.tabs.lotes', defaultLabel: 'Gestão de Lotes' },
    { key: 'custos', labelKey: 'gerente.tabs.custos', defaultLabel: 'Apropriação de Custos' },
    { key: 'auditoria', labelKey: 'gerente.tabs.auditoria', defaultLabel: 'Auditoria de Cocho' }
  ];

  return (
    <div style={{ padding: 16 }} data-testid="gerente-module-view">
      {/* Cabeçalho do Módulo */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
          {t('role.gerente.title', 'Gerente de Produção')}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.95rem' }}>
          {t('role.gerente.desc', 'Metas de GMD, curvas de peso, fechamento de lotes, auditoria de cocho e custos analíticos.')}
        </p>
      </div>

      {/* Navegação por Sub-Abas */}
      <div
        role="tablist"
        aria-label={t('gerente.tabs.overview', 'Visão Geral da Produção')}
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
              id={`tab-${tab.key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
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
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        <StateBoundary state={state.lotes.length === 0 ? 'empty' : 'success'}>
          {activeTab === 'overview' && (
            <GerenteDashboardTab
              state={state}
              onRefresh={() => setState({ ...store.getState() })}
              onNavigateTab={tab => handleSelectTab(tab as GerenteSubTab)}
            />
          )}
          {activeTab === 'metas' && (
            <GerenteGmdTab state={state} store={store} />
          )}
          {activeTab === 'lotes' && (
            <GerenteLotesTab state={state} store={store} />
          )}
          {activeTab === 'custos' && (
            <GerenteCustosTab state={state} store={store} />
          )}
          {activeTab === 'auditoria' && (
            <GerenteCochoAuditTab state={state} store={store} />
          )}
        </StateBoundary>
      </div>
    </div>
  );
};

export default GerenteView;
