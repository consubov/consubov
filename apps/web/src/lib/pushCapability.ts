/** Public-only VAPID capability check. Never place the private VAPID key in a client bundle. */
export function isValidVapidPublicKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(value)) return false;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=";
    const decoded = atob(base64);
    return decoded.length === 65 && decoded.charCodeAt(0) === 4;
  } catch { return false; }
}
