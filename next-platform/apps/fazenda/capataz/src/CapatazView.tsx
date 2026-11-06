import React, { useState, useEffect } from 'react';
import { useLocalData, useLocalDataChanges, useTranslation, OperationIssuesFeedback, useReportModuleHealth } from '@consubov/ui';
import type { ModuleExecutionContext } from '@consubov/contracts';
import { getCapatazStore, CapatazState } from './store/capatazStore';
import { CapatazCochoTab } from './components/CapatazCochoTab';
import { CapatazQrTab } from './components/CapatazQrTab';
import { CapatazContagemTab } from './components/CapatazContagemTab';
import { CapatazFotosTab } from './components/CapatazFotosTab';
import { CapatazHistoricoTab } from './components/CapatazHistoricoTab';

export type CapatazSubTab = 'cocho' | 'qr' | 'contagem' | 'fotos' | 'historico';

export interface CapatazViewProps {
  context: ModuleExecutionContext;
}

export const CapatazView: React.FC<CapatazViewProps> = ({ context }) => {
  const { t } = useTranslation();
  const localData = useLocalData();
  const store = getCapatazStore(context, localData);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<CapatazState>(() => store.getState());
  useReportModuleHealth(ready, state.quotaExceededError);
  useLocalDataChanges(store, error => {
    setReady(!error);
    setState({ ...store.getState(), quotaExceededError: error ? t('gerente.storage.error') : null });
  });

  const getInitialTab = (): CapatazSubTab => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/[?&]tab=([a-z_-]+)/);
      if (match && match[1]) {
        const tab = match[1] as CapatazSubTab;
        if (['cocho', 'qr', 'contagem', 'fotos', 'historico'].includes(tab)) {
          return tab;
        }
      }
    }
    return 'cocho';
  };

  const [activeTab, setActiveTab] = useState<CapatazSubTab>(getInitialTab);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setState({ ...store.getState() });
    });
    void store.ready.then(() => { setReady(true); setState({ ...store.getState() }); }, () => { setReady(false); setState({ ...store.getState() }); });
    return unsubscribe;
  }, [store]);

  const handleSelectTab = (tab: CapatazSubTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const basePath = window.location.hash.split('?')[0] || '#/fazenda/capataz';
      window.location.hash = `${basePath}?tab=${tab}`;
    }
  };

  const tabs: { key: CapatazSubTab; labelKey: string }[] = [
    { key: 'cocho', labelKey: 'capataz.tabs.cocho' },
    { key: 'qr', labelKey: 'capataz.tabs.qr' },
    { key: 'contagem', labelKey: 'capataz.tabs.contagem' },
    { key: 'fotos', labelKey: 'capataz.tabs.fotos' },
    { key: 'historico', labelKey: 'capataz.tabs.historico' }
  ];
  return (
      <div style={{ padding: 16 }} data-testid="capataz-module-view">
      <OperationIssuesFeedback />
      {!ready && !state.quotaExceededError && <p role="status">{t('state.loading', 'Carregando dados locais…')}</p>}
      {/* Alerta de Quota Excedida se houver falha de disco */}
      {state.quotaExceededError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '2px solid #EF4444',
            borderRadius: 8,
            color: '#B91C1C',
            fontWeight: 700,
            marginBottom: 16
          }}
        >
          {state.quotaExceededError}
        </div>
      )}

      {/* Cabeçalho do Módulo */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
          {t('role.capataz.title')}
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.95rem' }}>
          {t('role.capataz.desc')}
        </p>
      </div>

      {/* Navegação por Sub-Abas com Semântica W3C ARIA */}
      <div
        role="tablist"
        aria-label={t('role.capataz.title')}
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
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              onClick={() => handleSelectTab(tab.key)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0369A1' : '#64748B',
                borderBottom: isActive ? '3px solid #0284C7' : '3px solid transparent',
                marginBottom: -4,
                whiteSpace: 'nowrap',
                minHeight: 48
              }}
            >
              {t(tab.labelKey as any)}
            </button>
          );
        })}
      </div>

      {/* Conteúdo das Abas (Tabpanels) */}
      <div
        id="tabpanel-cocho"
        role="tabpanel"
        aria-labelledby="tab-cocho"
        hidden={activeTab !== 'cocho'}
      >
        {ready && activeTab === 'cocho' && <CapatazCochoTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-qr"
        role="tabpanel"
        aria-labelledby="tab-qr"
        hidden={activeTab !== 'qr'}
      >
        {ready && activeTab === 'qr' && <CapatazQrTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-contagem"
        role="tabpanel"
        aria-labelledby="tab-contagem"
        hidden={activeTab !== 'contagem'}
      >
        {ready && activeTab === 'contagem' && <CapatazContagemTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-fotos"
        role="tabpanel"
        aria-labelledby="tab-fotos"
        hidden={activeTab !== 'fotos'}
      >
        {ready && activeTab === 'fotos' && <CapatazFotosTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-historico"
        role="tabpanel"
        aria-labelledby="tab-historico"
        hidden={activeTab !== 'historico'}
      >
        {ready && activeTab === 'historico' && <CapatazHistoricoTab store={store} state={state} />}
      </div>
    </div>
  );
};

export default CapatazView;
