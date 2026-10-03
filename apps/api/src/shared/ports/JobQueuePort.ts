export interface JobOptions {
  idempotencyKey?: string;
  delayMs?: number;
}

import type { TenantExecutionContext } from "../../modules/identity-tenancy/domain/tenant-context";

export interface JobQueuePort {
  enqueue<T>(queueName: string, payload: T, options?: JobOptions, context?: TenantExecutionContext): Promise<void>;
}
