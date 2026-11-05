import React, { useState } from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { CapatazStore, CapatazState } from '../store/capatazStore';

interface CapatazHistoricoTabProps {
  store: CapatazStore;
  state: CapatazState;
}

export const CapatazHistoricoTab: React.FC<CapatazHistoricoTabProps> = ({ store, state }) => {
  const { t } = useTranslation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await store.sincronizarFila();
      if (res.syncedCount > 0) {
        setSyncFeedback(t('capataz.historico.syncSuccess'));
      }
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handleResolveConflict = (commandId: string, decisao: 'manter_local' | 'aceitar_servidor') => {
    store.resolverConflito(commandId, decisao);
  };

  return (
    <div data-testid="capataz-historico-tab">
      {/* Painel de Status de Rede e Eleição de Líder */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* Líder Web Locks */}
        <Card elevation="elevated">
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
            {t('capataz.historico.leaderStatus')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: state.isLeader ? '#22C55E' : '#94A3B8'
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: state.isLeader ? '#15803D' : '#475569' }}>
              {state.isLeader ? t('capataz.historico.isLeader') : t('capataz.historico.isFollower')}
            </span>
          </div>
        </Card>

        {/* Circuit Breaker de Conexão */}
        <Card elevation="elevated">
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
            {t('capataz.historico.circuitBreaker')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: state.circuitState === 'CLOSED' ? '#22C55E' : '#EF4444'
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: state.circuitState === 'CLOSED' ? '#15803D' : '#B91C1C' }}>
              {state.circuitState === 'CLOSED'
                ? t('capataz.historico.circuitClosed')
                : t('capataz.historico.circuitOpen')}
            </span>
          </div>
        </Card>
      </div>

      {/* Alerta de Conflitos OCC (409) */}
      {state.conflitos.length > 0 && (
        <Card
          elevation="elevated"
          style={{
            marginBottom: 20,
            border: '2px solid #F87171',
            backgroundColor: '#FEF2F2'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: '1.25rem', color: '#DC2626' }}>⚠️</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#991B1B' }}>
              {t('capataz.historico.conflictAlert')} ({state.conflitos.length})
            </h3>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {state.conflitos.map(item => (
              <div
                key={item.command.command_id}
                style={{
                  padding: 12,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 6,
                  border: '1px solid #FECACA'
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                  {item.command.command_type}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 10 }}>
                  {item.reason}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => handleResolveConflict(item.command.command_id, 'manter_local')}
                    style={{ minHeight: 38, fontSize: '0.85rem' }}
                  >
                    {t('capataz.historico.keepLocal')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleResolveConflict(item.command.command_id, 'aceitar_servidor')}
                    style={{ minHeight: 38, fontSize: '0.85rem' }}
                  >
                    {t('capataz.historico.acceptServer')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Nota sobre Merge Aditivo de Cocho */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#F0FDF4',
          border: '1px solid #86EFAC',
          borderRadius: 8,
          marginBottom: 20,
          color: '#166534',
          fontSize: '0.875rem'
        }}
      >
        {t('capataz.historico.additiveMergeNotice')}
      </div>

      {/* Comandos Pendentes de Envio (Outbox) */}
      <Card elevation="elevated" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0F172A' }}>
            {t('capataz.historico.pendingCommands')} ({state.outbox.length})
          </h3>
          <Button
            type="button"
            variant="primary"
            onClick={handleSyncNow}
            disabled={isSyncing || state.outbox.length === 0}
            style={{ minHeight: 40 }}
          >
            {isSyncing ? t('common.loading') : t('capataz.historico.retrySync')}
          </Button>
        </div>

        {syncFeedback && (
          <div
            role="status"
            style={{
              padding: '10px 14px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #10B981',
              borderRadius: 6,
              color: '#065F46',
              marginBottom: 12,
              fontWeight: 600
            }}
          >
            {syncFeedback}
          </div>
        )}

        {state.outbox.length === 0 ? (
          <p style={{ color: '#64748B', margin: 0 }}>
            {t('capataz.historico.emptyOutbox')}
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {state.outbox.map(cmd => (
              <div
                key={cmd.command_id}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#FFFBEB',
                  borderRadius: 6,
                  border: '1px solid #FDE68A',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400E' }}>
                    {cmd.command_type}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#B45309', marginTop: 2 }}>
                    {t('capataz.historico.commandId')} {cmd.command_id}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#92400E' }}>
                  {cmd.occurred_at_local.slice(11, 19)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Comandos Sincronizados Recentemente */}
      {state.syncedCommands.length > 0 && (
        <Card elevation="elevated">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px', color: '#0F172A' }}>
            {t('capataz.historico.syncedCommands')} ({state.syncedCommands.length})
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {state.syncedCommands.slice(0, 8).map(cmd => (
              <div
                key={cmd.command_id}
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                  {cmd.command_type}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 600 }}>
                  ✓ {cmd.synced_at.slice(11, 19)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
