export interface JobOptions {
  idempotencyKey?: string;
  delayMs?: number;
}

import type { TenantExecutionContext } from "../../modules/identity-tenancy";

export interface JobQueuePort {
  enqueue<T>(queueName: string, payload: T, context: TenantExecutionContext, options?: JobOptions): Promise<void>;
}
