/**
 * Ports of the integration boundary. Adapters implement them; this module ships
 * no implementation, no client and no channel.
 */
import type {
  IntegrationCaller,
  IntegrationContent,
  IntegrationDeliveryReport,
  IntegrationSelection,
} from "./contracts";
import type { GeoPoint, RouteEstimationResult } from "./route";

/**
 * A request that already passed normalization, audience derivation and the
 * admission rules. The audience arrives resolved: this boundary never accepts a
 * caller-provided destination list (`send-push-notification/index.ts:604-618`).
 */
export type PushDeliveryRequest = {
  caller: IntegrationCaller;
  content: IntegrationContent;
  selections: readonly IntegrationSelection[];
  targetUserIds: readonly string[];
};

/** Send of an accepted push request. */
export interface PushNotificationPort {
  deliver(request: PushDeliveryRequest): Promise<IntegrationDeliveryReport>;
}

/** Estimate of a route between two points. */
export interface RouteEstimationPort {
  estimate(request: {
    origin: GeoPoint;
    destination: GeoPoint;
  }): Promise<RouteEstimationResult>;
}

/**
 * Analysis of free-text observations is intentionally an empty port.
 *
 * The existing analysis flow authenticates the caller but does not check any
 * role nor any tenant (`analisar-retiro/index.ts:39-42`). Inventing a method
 * signature here would silently create the authorization contract the flow does
 * not have; the tenant/role rule has to be decided first. The proven limits of
 * that flow — a serialized context of at most 8000 characters
 * (`analisar-retiro/index.ts:17`) and a minimum of 10 characters of
 * observations (`:73-75`) — are documented here only, not turned into
 * authorization.
 *
 * [PENDENTE] tenant and role check for the analysis flow: absent from the
 * repository.
 */
export interface AnalysisPort {}
