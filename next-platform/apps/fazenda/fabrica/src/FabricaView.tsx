import React, { useState, useEffect } from 'react';
import { useTranslation, StateBoundary, useLocalData, useLocalDataChanges, OperationIssuesFeedback, useReportModuleHealth } from '@consubov/ui';
import { getFabricaStore, FabricaState } from './store/fabricaStore';
import type { ModuleExecutionContext } from '@consubov/contracts';
import { FabricaDashboardTab } from './components/FabricaDashboardTab';
import { FabricaBatidasTab } from './components/FabricaBatidasTab';
import { FabricaFormulasTab } from './components/FabricaFormulasTab';
import { FabricaSilosTab } from './components/FabricaSilosTab';
import { FabricaCalibracaoTab } from './components/FabricaCalibracaoTab';

export type FabricaSubTab = 'overview' | 'batches' | 'formulas' | 'silos' | 'calibration';

export const FabricaView: React.FC<{ context: ModuleExecutionContext }> = ({ context }) => {
  const { t } = useTranslation();
  const localData = useLocalData();
  const store = getFabricaStore(context, localData);
  const [state, setState] = useState<FabricaState>(() => store.getState());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  useReportModuleHealth(ready, storageError);
  useLocalDataChanges(store, error => {
    setReady(!error);
    setStorageError(error ? t('gerente.storage.error') : null);
  });

  // Recupera sub-aba da URL hash (#/fazenda/fabrica?tab=xxx)
  const getInitialTab = (): FabricaSubTab => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/[?&]tab=([a-z_-]+)/);
      if (match && match[1]) {
        const tab = match[1] as FabricaSubTab;
        if (['overview', 'batches', 'formulas', 'silos', 'calibration'].includes(tab)) {
          return tab;
        }
      }
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<FabricaSubTab>(getInitialTab);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState({ ...store.getState() });
    });
    store.ready.then(() => setReady(true), error => {
      setStorageError(error instanceof Error ? error.message : String(error));
    });
    return unsubscribe;
  }, [store]);

  const handleSelectTab = (tab: FabricaSubTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const basePath = window.location.hash.split('?')[0] || '#/fazenda/fabrica';
      window.location.hash = `${basePath}?tab=${tab}`;
    }
  };

  const tabs: { key: FabricaSubTab; labelKey: string; defaultLabel: string }[] = [
    { key: 'overview', labelKey: 'fabrica.tab.overview', defaultLabel: 'Painel da Fábrica' },
    { key: 'batches', labelKey: 'fabrica.tabs.batches', defaultLabel: 'Batidas e Misturadores' },
    { key: 'formulas', labelKey: 'fabrica.tabs.formulas', defaultLabel: 'Fórmulas Nutricionais' },
    { key: 'silos', labelKey: 'fabrica.tabs.silos', defaultLabel: 'Estoque de Silos' },
    { key: 'calibration', labelKey: 'fabrica.tabs.calibration', defaultLabel: 'Balança e Calibração' }
  ];

  return (
    <div style={{ padding: 16 }} data-testid="fabrica-module-view">
      <OperationIssuesFeedback />
      {!ready && !storageError && <p role="status">{t('common.loading', 'Carregando dados locais…')}</p>}
      {storageError && <p role="alert">{t('fabrica.storage.error', 'Não foi possível abrir os dados locais.')} {storageError}</p>}
      {/* Cabeçalho do Módulo */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
          {t('role.fabrica.title', 'Operador da Fábrica de Ração')}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.95rem' }}>
          {t('role.fabrica.desc', 'Execução de batidas de ração, fórmulas nutricionais, pesagem de ingredientes e controle de estoque de silos.')}
        </p>
      </div>

      {/* Navegação por Sub-Abas */}
      <div
        role="tablist"
        aria-label={t('fabrica.tab.overview', 'Painel da Fábrica')}
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
                color: isActive ? '#0369A1' : '#64748B',
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
        <StateBoundary state={storageError ? 'error' : !ready ? 'loading' : state.silos.length === 0 ? 'empty' : 'success'}>
          {activeTab === 'overview' && (
            <FabricaDashboardTab
              state={state}
              onRefresh={() => setState({ ...store.getState() })}
              onNavigateTab={tab => handleSelectTab(tab as FabricaSubTab)}
            />
          )}
          {activeTab === 'batches' && (
            <FabricaBatidasTab state={state} store={store} />
          )}
          {activeTab === 'formulas' && (
            <FabricaFormulasTab state={state} store={store} />
          )}
          {activeTab === 'silos' && (
            <FabricaSilosTab state={state} store={store} />
          )}
          {activeTab === 'calibration' && (
            <FabricaCalibracaoTab state={state} store={store} />
          )}
        </StateBoundary>
      </div>
    </div>
  );
};

export default FabricaView;
