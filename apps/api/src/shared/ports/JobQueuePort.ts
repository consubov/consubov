export interface JobOptions {
  idempotencyKey?: string;
  delayMs?: number;
}

import type { TenantExecutionContext } from "../../identity-tenancy";

export interface JobQueuePort {
  enqueue<T>(queueName: string, payload: T, options?: JobOptions, context?: TenantExecutionContext): Promise<void>;
}
