/**
 * Generic envelope for internal domain events.
 * 
 * Rules:
 * - Reuse EventPublisherPort for publishing events.
 * - Events do not replace transactions or authorization.
 * - Consumers must be idempotent.
 * - Retries must not duplicate effect.
 * - Failures must be observable.
 * - No external brokers (Kafka, RabbitMQ, etc.).
 * - No event sourcing implementation.
 */
export type EventEnvelope<T> = {
  eventId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: Date;
  tenantId?: string;
  correlationId?: string;
  causationId?: string;
  payload: T;
};
