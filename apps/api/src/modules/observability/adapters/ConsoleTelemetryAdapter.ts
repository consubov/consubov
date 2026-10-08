import type {
  LogLevel,
  TelemetryEvent,
  TelemetryMetric,
  TelemetryPort,
} from "../domain/ports";

const SENSITIVE_KEY = /^(authorization|cookie|set-cookie|password|passwd|token|access[_-]?token|refresh[_-]?token|secret|api[_-]?key|service[_-]?role|email|cpf|cnpj|card|credit[_-]?card|cvv)$/i;
const EMAIL_PATTERN = /\b[^\s"@]+@[^\s"@]+\.[^\s"@]+\b/g;
const BEARER_PATTERN = /\bBearer\s+[^\s",]+/gi;
const PRIVATE_KEY_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g;

function sanitizeString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(PRIVATE_KEY_PATTERN, "[redacted-private-key]");
}

function sanitizeValue(
  key: string,
  value: unknown,
  depth: number,
): unknown {
  if (SENSITIVE_KEY.test(key)) return "[redacted]";
  if (depth > 5) return "[truncated]";
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue("", entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return sanitizeTelemetryContext(value as Record<string, unknown>, depth + 1);
  }
  return value;
}

export function sanitizeTelemetryContext(
  context: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sanitizeValue(key, value, depth),
    ]),
  );
}

function safeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: sanitizeString(error.message),
  };
}

export class ConsoleTelemetryAdapter implements TelemetryPort {
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry = JSON.stringify({
      level,
      message: sanitizeString(message),
      ...(context ? { context: sanitizeTelemetryContext(context) } : {}),
    });

    if (level === "error") console.error(entry);
    else if (level === "warn") console.warn(entry);
    else if (level === "debug") console.debug(entry);
    else console.info(entry);
  }

  recordEvent(event: TelemetryEvent): void {
    this.log("info", "telemetry.event", {
      name: event.name,
      ...(event.properties ? { properties: event.properties } : {}),
    });
  }

  recordMetric(metric: TelemetryMetric): void {
    this.log("info", "telemetry.metric", {
      name: metric.name,
      value: metric.value,
      ...(metric.unit ? { unit: metric.unit } : {}),
      ...(metric.tags ? { tags: metric.tags } : {}),
    });
  }

  recordError(error: Error, context?: Record<string, unknown>): void {
    this.log("error", "telemetry.error", {
      error: safeError(error),
      ...(context ?? {}),
    });
  }
}

export const runtimeTelemetry = new ConsoleTelemetryAdapter();
