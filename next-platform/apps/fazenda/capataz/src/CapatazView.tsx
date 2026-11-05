import React, { useState, useEffect } from 'react';
import { useTranslation, SyncStatusBar } from '@consubov/ui';
import { CommandStatus } from '@consubov/contracts';
import { getCapatazStore, CapatazState } from './store/capatazStore';
import { CapatazCochoTab } from './components/CapatazCochoTab';
import { CapatazQrTab } from './components/CapatazQrTab';
import { CapatazContagemTab } from './components/CapatazContagemTab';
import { CapatazFotosTab } from './components/CapatazFotosTab';
import { CapatazHistoricoTab } from './components/CapatazHistoricoTab';

export type CapatazSubTab = 'cocho' | 'qr' | 'contagem' | 'fotos' | 'historico';

export interface CapatazViewProps {
  partitionKey?: string;
}

export const CapatazView: React.FC<CapatazViewProps> = ({ partitionKey }) => {
  const { t } = useTranslation();
  const store = getCapatazStore(partitionKey);
  const [state, setState] = useState<CapatazState>(() => store.getState());

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

  // Determina o status da barra de sincronização
  let syncStatus: CommandStatus = 'SINCRONIZADO';
  if (state.conflitos.length > 0) {
    syncStatus = 'CONFLITO';
  } else if (state.outbox.length > 0) {
    syncStatus = 'PENDENTE';
  }

  const isOnline = state.circuitState === 'CLOSED';

  return (
    <div style={{ padding: 16 }} data-testid="capataz-module-view">
      {/* Barra de Status de Sincronização Local-First */}
      <div style={{ marginBottom: 16 }}>
        <SyncStatusBar
          status={syncStatus}
          pendingCount={state.outbox.length}
          isOnline={isOnline}
          onActionClick={() => handleSelectTab('historico')}
        />
      </div>

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
                color: isActive ? '#0284C7' : '#64748B',
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
        {activeTab === 'cocho' && <CapatazCochoTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-qr"
        role="tabpanel"
        aria-labelledby="tab-qr"
        hidden={activeTab !== 'qr'}
      >
        {activeTab === 'qr' && <CapatazQrTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-contagem"
        role="tabpanel"
        aria-labelledby="tab-contagem"
        hidden={activeTab !== 'contagem'}
      >
        {activeTab === 'contagem' && <CapatazContagemTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-fotos"
        role="tabpanel"
        aria-labelledby="tab-fotos"
        hidden={activeTab !== 'fotos'}
      >
        {activeTab === 'fotos' && <CapatazFotosTab store={store} state={state} />}
      </div>

      <div
        id="tabpanel-historico"
        role="tabpanel"
        aria-labelledby="tab-historico"
        hidden={activeTab !== 'historico'}
      >
        {activeTab === 'historico' && <CapatazHistoricoTab store={store} state={state} />}
      </div>
    </div>
  );
};

export default CapatazView;
