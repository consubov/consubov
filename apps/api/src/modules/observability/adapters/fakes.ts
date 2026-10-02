import type {
  AuditEvent,
  AuditLogPort,
  LogLevel,
  TelemetryEvent,
  TelemetryMetric,
  TelemetryPort,
} from "../domain/ports";

const SENSITIVE_KEY_VALUE = /"(password|token|apiKey|secret|credit_card|cpf|email)":\s*"[^"]*"/gi;
const EMAIL_PATTERN = /[^\s"@]+@[^\s"@]+\.[^\s"@]+/g;

export function sanitizeChangesSummary(summary: string): string {
  return summary
    .replace(SENSITIVE_KEY_VALUE, '"[redacted]"')
    .replace(EMAIL_PATTERN, "[redacted-email]");
}

export class FakeAuditLogAdapter implements AuditLogPort {
  public logs: AuditEvent[] = [];

  async log(entry: AuditEvent): Promise<void> {
    this.logs.push({
      ...entry,
      changesSummary:
        typeof entry.changesSummary === "string"
          ? sanitizeChangesSummary(entry.changesSummary)
          : entry.changesSummary,
    });
  }
}

export class FakeTelemetryAdapter implements TelemetryPort {
  public logs: Array<{ level: LogLevel; message: string; context?: Record<string, unknown> }> = [];
  public events: TelemetryEvent[] = [];
  public metrics: TelemetryMetric[] = [];
  public errors: Array<{ error: Error; context?: Record<string, unknown> }> = [];

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.logs.push({ level, message, context });
  }

  recordEvent(event: TelemetryEvent): void {
    this.events.push(event);
  }

  recordMetric(metric: TelemetryMetric): void {
    this.metrics.push(metric);
  }

  recordError(error: Error, context?: Record<string, unknown>): void {
    this.errors.push({ error, context });
  }
}
