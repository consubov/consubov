import type { TenantExecutionContext } from "../../modules/identity-tenancy/domain/tenant-context";

export interface EventPublisherPort {
  publish<T>(eventName: string, payload: T, context?: TenantExecutionContext): Promise<void>;
}
