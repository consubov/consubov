import React from 'react';
import { useTranslation } from '../i18n';

export type UiState = 'loading' | 'empty' | 'error' | 'success' | 'partial' | 'pending';

export interface StateBoundaryProps {
  state: UiState;
  loadingFallback?: React.ReactNode;
  emptyFallback?: React.ReactNode;
  errorFallback?: (error: Error | null, retry: () => void) => React.ReactNode;
  pendingFallback?: React.ReactNode;
  partialNotice?: React.ReactNode;
  error?: Error | null;
  onRetry?: () => void;
  children: React.ReactNode;
}

export const StateBoundary: React.FC<StateBoundaryProps> = ({
  state,
  loadingFallback,
  emptyFallback,
  errorFallback,
  pendingFallback,
  partialNotice,
  error = null,
  onRetry,
  children
}) => {
  const { t } = useTranslation();

  if (state === 'loading') {
    return (
      <div role="status" aria-live="polite">
        {loadingFallback ?? <p>{t('state.loading', 'Carregando dados operacionais...')}</p>}
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" aria-live="assertive">
        {errorFallback ? (
          errorFallback(error, onRetry ?? (() => {}))
        ) : (
          <div>
            <p>{t('state.error', 'Ocorreu um erro ao carregar os dados desta visualização.')}</p>
            {onRetry && (
              <button onClick={onRetry} style={{ minHeight: 48, minWidth: 48 }}>
                {t('action.retry', 'Tentar Novamente')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div role="region" aria-label={t('state.empty', 'Nenhum registro cadastrado no momento.')}>
        {emptyFallback ?? <p>{t('state.empty', 'Nenhum registro cadastrado no momento.')}</p>}
      </div>
    );
  }
  if (state === 'pending') {
    return (
      <div>
        {pendingFallback}
        {children}
      </div>
    );
  }
  if (state === 'partial') {
    return (
      <div>
        {partialNotice && <div role="note" className="partial-notice">{partialNotice}</div>}
        {children}
      </div>
    );
  }
  // state === 'success'
  return <>{children}</>;
};
