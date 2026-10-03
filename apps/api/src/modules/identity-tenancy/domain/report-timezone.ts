declare const tenantReportTimeZoneBrand: unique symbol;

export type TenantReportTimeZone = string & {
  readonly [tenantReportTimeZoneBrand]: true;
};

/**
 * Tenant/report civil periods must use an explicit IANA timezone.
 * No browser/device timezone and no business default are inferred here.
 */
export function createTenantReportTimeZone(value: string): TenantReportTimeZone {
  const timeZone = value.trim();
  if (!timeZone) throw new Error("tenant report time zone is required");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
  } catch {
    throw new Error("tenant report time zone must be a valid IANA timezone");
  }

  return timeZone as TenantReportTimeZone;
}

export function requireTenantReportTimeZone(
  timeZone: TenantReportTimeZone | null,
): TenantReportTimeZone {
  if (timeZone === null) {
    throw new Error("tenant report time zone is not configured");
  }

  return timeZone;
}
