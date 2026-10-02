/**
 * Base integration contract that all external integrations must follow.
 * 
 * Rules:
 * - Every integration must enter via an adapter.
 * - Domain/Application layers must NOT import external SDKs directly.
 * - Tenant context must not come from arbitrary request bodies.
 * - Integration must not bypass RBAC.
 * - Automatic retry only when safe/idempotent.
 * - Circuit breaker only when there is real need.
 * - Cost must be documentable.
 * - Do not create any paid integration or expand existing ones (SyncVet, Relatto, etc.) in this phase.
 */
export interface IntegrationContract {
  /** Owner of the integration (team or person responsible) */
  owner: string;

  /** Purpose/description of the integration */
  finalidade: string;

  /** Authentication mechanism contract */
  auth: unknown;

  /** Tenant scoping for the integration */
  tenantScope: string;

  /** Request timeout in milliseconds */
  timeout: number;

  /** Retry policy configuration */
  retryPolicy: {
    /** Number of retry attempts */
    attempts: number;
    /** Backoff strategy: fixed or exponential */
    backoff: 'fixed' | 'exponential';
  };

  /** Idempotency key for safe retries */
  idempotencyKey: string;

  /** Circuit breaker configuration */
  circuitBreaker: {
    /** Whether circuit breaker is enabled */
    enabled: boolean;
    /** Failure threshold before opening circuit */
    threshold: number;
  };

  /** Whether to log integration activities */
  logs: boolean;

  /** Description of error handling strategy */
  errorHandling: string;

  /** Rate limiting contract */
  rateLimit: unknown;

  /** Cost documentation contract */
  cost: unknown;

  /** Schema for data sent to external service */
  dataSent: unknown;

  /** Schema for data received from external service */
  dataReceived: unknown;

  /** Policy for handling service unavailability */
  unavailabilityPolicy: string;

  /** Strategy for replacing or fallback when integration fails */
  replacementStrategy: string;
}
