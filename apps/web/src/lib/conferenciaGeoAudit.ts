import type { LocationPosition, LocationProvider } from "../platform/contracts";

/** The caller deliberately does not await this in the QR reading flow. */
export async function auditConferenciaLocation(
  provider: LocationProvider,
  recordAudit: (latitude: number | null, longitude: number | null) => Promise<void> | void,
): Promise<void> {
  let location: LocationPosition | null = null;
  try {
    location = await provider.getCurrentPosition();
  } catch {
    // No GPS cannot prevent the audit attempt or the QR reading.
  }
  try {
    await recordAudit(location?.latitude ?? null, location?.longitude ?? null);
  } catch {
    // Existing audit is best-effort; recording errors must not break QR.
  }
}
