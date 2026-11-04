import React from 'react';

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
  if (state === 'loading') {
    return <div role="status" aria-live="polite">{loadingFallback ?? <p>Carregando dados...</p>}</div>;
  }
  if (state === 'error') {
    return (
      <div role="alert" aria-live="assertive">
        {errorFallback ? errorFallback(error, onRetry ?? (() => {})) : (
          <div>
            <p>Ocorreu um erro na visualização.</p>
            {onRetry && <button onClick={onRetry} style={{ minHeight: 48, minWidth: 48 }}>Tentar Novamente</button>}
          </div>
        )}
      </div>
    );
  }
  if (state === 'empty') {
    return <div role="region" aria-label="Sem registros">{emptyFallback ?? <p>Nenhum registro encontrado.</p>}</div>;
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
