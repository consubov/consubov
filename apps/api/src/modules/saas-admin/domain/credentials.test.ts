import { describe, expect, test } from "bun:test";
import {
  MIN_PASSWORD_LENGTH,
  isEmailShape,
  isPasswordLengthAllowed,
  isUuidV4,
  normalizeEmail,
  parseBearerHeader,
} from "./index";

describe("bearer header parsing", () => {
  test("accepts the scheme in any case and returns the token", () => {
    expect(parseBearerHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearerHeader("bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(parseBearerHeader("BEARER abc.def.ghi")).toBe("abc.def.ghi");
  });

  test("denies a missing header", () => {
    expect(parseBearerHeader(null)).toBeNull();
    expect(parseBearerHeader(undefined)).toBeNull();
    expect(parseBearerHeader("")).toBeNull();
  });

  test("denies a malformed header", () => {
    expect(parseBearerHeader("abc.def.ghi")).toBeNull();
    expect(parseBearerHeader("Basic abc")).toBeNull();
    expect(parseBearerHeader("Bearer a b")).toBeNull();
    expect(parseBearerHeader("Bearer")).toBeNull();
    expect(parseBearerHeader("Token abc")).toBeNull();
  });
});

describe("e-mail normalization and shape", () => {
  test("trims and lowercases", () => {
    expect(normalizeEmail("  Admin@Empresa.COM  ")).toBe("admin@empresa.com");
    expect(normalizeEmail("ADMIN@EMPRESA.COM")).toBe("admin@empresa.com");
  });

  test("accepts the proven shape", () => {
    expect(isEmailShape("admin@empresa.com")).toBe(true);
    expect(isEmailShape("nome.sobrenome@sub.empresa.com.br")).toBe(true);
  });

  test("rejects malformed addresses", () => {
    expect(isEmailShape("")).toBe(false);
    expect(isEmailShape("admin")).toBe(false);
    expect(isEmailShape("admin@empresa")).toBe(false);
    expect(isEmailShape("admin @empresa.com")).toBe(false);
    expect(isEmailShape("admin@empresa .com")).toBe(false);
    expect(isEmailShape("admin@@empresa.com")).toBe(false);
  });
});

describe("password length", () => {
  test("requires at least six characters", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(isPasswordLengthAllowed("12345")).toBe(false);
    expect(isPasswordLengthAllowed("123456")).toBe(true);
    expect(isPasswordLengthAllowed("1234567")).toBe(true);
  });
});

describe("identifier guard for destructive operations", () => {
  test("accepts a v4 identifier", () => {
    expect(
      isUuidV4("7bfbe4c8-563f-460c-9dce-5367b0985b7b"),
    ).toBe(true);
    expect(
      isUuidV4("7BFBE4C8-563F-460C-9DCE-5367B0985B7B"),
    ).toBe(true);
  });

  test("rejects anything that is not an identifier in the proven shape", () => {
    expect(isUuidV4("")).toBe(false);
    expect(isUuidV4("not-a-uuid")).toBe(false);
    expect(isUuidV4("7bfbe4c8-563f-460c-9dce")).toBe(false);
    expect(isUuidV4("7bfbe4c8-563f-460c-9dce-5367b0985b7b-extra")).toBe(false);
    expect(isUuidV4("zbfbe4c8-563f-460c-9dce-5367b0985b7b")).toBe(false);
    expect(isUuidV4("7bfbe4c8-563f-460c-9dce-5367b0985b7b ")).toBe(false);
    expect(isUuidV4(undefined)).toBe(false);
    expect(isUuidV4(null)).toBe(false);
  });

  test("keeps the current guard behavior: the shape is validated, the version nibble is not", () => {
    // Documented limitation of the existing guard (syncvet-delete-equipe/index.ts:15-16).
    expect(isUuidV4("7bfbe4c8-563f-110c-9dce-5367b0985b7b")).toBe(true);
  });
});
