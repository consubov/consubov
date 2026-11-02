/** The stored SyncVet row may contain a legacy field absent from generated types.
 * Read it defensively without changing the query or assuming a database migration.
 */
export function readLegacyProtocoloId(record: unknown): string | null {
  if (record === null || typeof record !== "object" || !("protocolo_id" in record)) {
    return null;
  }
  const value = record.protocolo_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}
