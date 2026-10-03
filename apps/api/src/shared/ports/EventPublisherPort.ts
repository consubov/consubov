import type { TenantExecutionContext } from "../../identity-tenancy";

export interface EventPublisherPort {
  publish<T>(eventName: string, payload: T, context?: TenantExecutionContext): Promise<void>;
}
