/**
 * Circuit Breaker de Sincronização de Campo
 * Protege dispositivos móveis em condições off-grid e borda de conectividade.
 * Interrompe a drenagem da fila imediatamente no primeiro erro de conexão (falha de rede, timeout, 503)
 * para evitar exaustão de bateria e enxurrada de requisições inúteis.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Padrão: 1 (parada imediata no primeiro erro)
  cooldownPeriodMs?: number; // Padrão: 15.000 ms (15 segundos)
  onStateChange?: (state: CircuitState) => void;
}

export interface CircuitFailureRecord {
  error: string;
  statusCode?: number;
  occurredAt: string;
}

export class SyncCircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private lastFailureRecord: CircuitFailureRecord | null = null;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;
  private readonly onStateChange?: (state: CircuitState) => void;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 1;
    this.cooldownPeriodMs = options.cooldownPeriodMs ?? 15000;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Retorna o estado atual considerando o tempo de cooldown transcorrido.
   */
  getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  /**
   * Indica se a outbox pode tentar despachar comandos no momento.
   */
  canAttemptSync(): boolean {
    const current = this.getState();
    return current === 'CLOSED' || current === 'HALF_OPEN';
  }

  /**
   * Registra uma requisição bem-sucedida, fechando o circuito.
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.lastFailureRecord = null;
    if (this.state !== 'CLOSED') {
      this.transitionTo('CLOSED');
    }
  }

  /**
   * Registra uma falha de rede/servidor. Se atingir o threshold, abre o circuito.
   */
  recordFailure(error: Error | string | { status?: number; message?: string }): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    let errorMsg = 'Falha desconhecida na sincronização';
    let statusCode: number | undefined = undefined;

    if (typeof error === 'string') {
      errorMsg = error;
    } else if (error instanceof Error) {
      errorMsg = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMsg = error.message || `HTTP Error ${error.status}`;
      statusCode = error.status;
    }

    this.lastFailureRecord = {
      error: errorMsg,
      statusCode,
      occurredAt: new Date().toISOString()
    };

    if (this.failureCount >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  /**
   * Força a abertura imediata do circuito (útil em testes ou modo avião explícito).
   */
  trip(reason = 'Desconexão forçada'): void {
    this.recordFailure(reason);
  }

  /**
   * Reseta o circuito manualmente (ex: usuário pressionou "Tentar Novamente").
   */
  forceReset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.lastFailureRecord = null;
    this.transitionTo('CLOSED');
  }

  getLastFailure(): CircuitFailureRecord | null {
    return this.lastFailureRecord;
  }

  getCooldownRemainingMs(): number {
    if (this.state !== 'OPEN') return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.cooldownPeriodMs - elapsed);
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      if (this.onStateChange) {
        this.onStateChange(newState);
      }
    }
  }
}
