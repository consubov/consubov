export interface JobOptions {
  idempotencyKey?: string;
  delayMs?: number;
}

export interface JobQueuePort {
  enqueue<T>(queueName: string, payload: T, options?: JobOptions): Promise<void>;
}
