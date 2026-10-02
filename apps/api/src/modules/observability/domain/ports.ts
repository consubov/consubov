export type AuditLogEntry = {
  actorId: string;
  tenantId: string;
  action: string;
  result: "success" | "failure";
  requestId: string;
  context?: Record<string, unknown>; // Must not contain PII
};

export interface AuditLogPort {
  log(entry: AuditLogEntry): Promise<void>;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export type TelemetryEvent = {
  name: string;
  properties?: Record<string, unknown>;
};

export type TelemetryMetric = {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
};

export interface TelemetryPort {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void;
  recordEvent(event: TelemetryEvent): void;
  recordMetric(metric: TelemetryMetric): void;
  recordError(error: Error, context?: Record<string, unknown>): void;
}
