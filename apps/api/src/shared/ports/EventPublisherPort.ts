export interface EventPublisherPort {
  publish<T>(eventName: string, payload: T): Promise<void>;
}
