import React from 'react';
import { CommandStatus } from '@consubov/contracts';
import { useTranslation } from '../i18n';

export interface SyncStatusBarProps {
  status: CommandStatus;
  pendingCount: number;
  isOnline: boolean;
  statusTextOverride?: string;
  resolveActionLabel?: string;
  onActionClick?: () => void;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  status,
  pendingCount,
  isOnline,
  statusTextOverride,
  resolveActionLabel,
  onActionClick
}) => {
  const { t } = useTranslation();

  const getStatusText = () => {
    if (statusTextOverride) return statusTextOverride;
    if (!isOnline) {
      return t('status.offline', 'Modo Campo Off-Grid (100% Offline)');
    }
    switch (status) {
      case 'PENDENTE':
        return t('status.pendingCount', { count: pendingCount }, `${pendingCount} comando(s) aguardando sincronização`);
      case 'ENVIANDO':
        return t('status.syncing', 'Sincronizando com a API central...');
      case 'SINCRONIZADO':
        return t('status.synced', 'Todos os lançamentos estão sincronizados');
      case 'CONFLITO':
        return t('status.conflict', 'Conflito de concorrência detectado (409)');
      case 'ERRO_FATAL':
        return t('status.error', 'Falha na comunicação com o servidor');
    }
  };

  const actionText = resolveActionLabel ?? t('status.conflictAction', 'Resolver Conflito');

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sync-bar sync-bar--${status.toLowerCase()}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        fontSize: '0.875rem'
      }}
    >
      <span>{getStatusText()}</span>
      {status === 'CONFLITO' && onActionClick && (
        <button
          onClick={onActionClick}
          style={{ minHeight: 48, minWidth: 48, padding: '0 12px', fontWeight: 600 }}
          aria-label={actionText}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
