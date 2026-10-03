import type { TenantExecutionContext } from "../../modules/identity-tenancy";

export interface EventPublisherPort {
  publish<T>(eventName: string, payload: T, context: TenantExecutionContext): Promise<void>;
}
