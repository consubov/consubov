import React from 'react';
import { CommandStatus } from '@consubov/contracts';

export interface SyncStatusBarProps {
  status: CommandStatus;
  pendingCount: number;
  isOnline: boolean;
  onActionClick?: () => void;
}

export const SyncStatusBar: React.FC<SyncStatusBarProps> = ({
  status,
  pendingCount,
  isOnline,
  onActionClick
}) => {
  const getStatusText = () => {
    if (!isOnline) return 'Modo Offline: dados protegidos localmente';
    switch (status) {
      case 'PENDENTE':
        return `${pendingCount} lançamento(s) aguardando envio`;
      case 'ENVIANDO':
        return 'Sincronizando com a fazenda...';
      case 'SINCRONIZADO':
        return 'Tudo atualizado';
      case 'CONFLITO':
        return 'Conflito detectado: ação requerida';
      case 'ERRO_FATAL':
        return 'Falha na sincronização';
    }
  };

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
          aria-label="Resolver conflito de dados"
        >
          Resolver
        </button>
      )}
    </div>
  );
};
