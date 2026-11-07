import { describe, it, expect } from "vitest";
import { isValidVapidPublicKey } from "./pushCapability";
describe("Web Push VAPID public key configuration", () => {
  it("fails closed without key", () => expect(isValidVapidPublicKey(undefined)).toBe(false));
  it("rejects invalid and suspicious formats", () => {
    expect(isValidVapidPublicKey("")).toBe(false);
    expect(isValidVapidPublicKey("CHAVE_PRIVADA_NAO_DEVE_ESTAR_NO_CLIENTE")).toBe(false);
    expect(isValidVapidPublicKey("a".repeat(87))).toBe(false);
  });
  it("accepts properly encoded uncompressed 65-byte public point shape", () => {
    const bytes = new Uint8Array(65); bytes[0] = 4;
    for (let i = 1; i < 65; i++) bytes[i] = i;
    const key = btoa(Array.from(bytes, x => String.fromCharCode(x)).join("")).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
    expect(isValidVapidPublicKey(key)).toBe(true);
  });
});
