import { describe, expect, test } from "bun:test";
import {
  conflictsWithExistingProfile,
  deriveCreateUserIntent,
  findEmailConflict,
  mayDeleteAdmin,
  mayRemoveLastActiveAdmin,
  type AuthUserId,
  type GlobalAdminId,
} from "./index";

const callerAuthUserId = "auth-caller" as AuthUserId;

describe("deletion of a global administrator", () => {
  test("blocks self-deletion using the identity proven by the token", () => {
    expect(
      mayDeleteAdmin({
        targetUserId: callerAuthUserId,
        callerAuthUserId,
      }),
    ).toBe(false);
  });

  test("allows removing another administrator", () => {
    expect(
      mayDeleteAdmin({
        targetUserId: "auth-other" as AuthUserId,
        callerAuthUserId,
      }),
    ).toBe(true);
  });

  test("does not treat a target without a linked access as self-deletion", () => {
    expect(
      mayDeleteAdmin({ targetUserId: null, callerAuthUserId }),
    ).toBe(true);
  });
});

describe("last active administrator", () => {
  test("blocks the removal while one or zero active administrators exist", () => {
    expect(mayRemoveLastActiveAdmin(0)).toBe(false);
    expect(mayRemoveLastActiveAdmin(1)).toBe(false);
  });

  test("denies when the active count could not be read", () => {
    expect(mayRemoveLastActiveAdmin(null)).toBe(false);
    expect(mayRemoveLastActiveAdmin(undefined)).toBe(false);
  });

  test("allows the removal when another active administrator remains", () => {
    expect(mayRemoveLastActiveAdmin(2)).toBe(true);
    expect(mayRemoveLastActiveAdmin(7)).toBe(true);
  });
});

describe("duplicate e-mail detection", () => {
  const targetAdminId = "admin-1" as GlobalAdminId;

  test("finds another row holding the same address", () => {
    const conflict = findEmailConflict({
      normalizedEmail: "novo@empresa.com",
      currentEmail: "antigo@empresa.com",
      targetAdminId,
      existing: [
        { id: "admin-1" as GlobalAdminId, email: "antigo@empresa.com" },
        { id: "admin-2" as GlobalAdminId, email: "novo@empresa.com" },
      ],
    });

    expect(conflict).toBe("admin-2");
  });

  test("excludes the row being updated from the conflict", () => {
    const conflict = findEmailConflict({
      normalizedEmail: "admin1@empresa.com",
      currentEmail: "admin1@empresa.com",
      targetAdminId,
      existing: [{ id: targetAdminId, email: "admin1@empresa.com" }],
    });

    expect(conflict).toBeNull();
  });

  test("ignores a row holding the same address but with a different case", () => {
    const conflict = findEmailConflict({
      normalizedEmail: "admin1@empresa.com",
      currentEmail: "ADMIN1@EMPRESA.COM",
      targetAdminId,
      existing: [{ id: targetAdminId, email: "admin1@empresa.com" }],
    });

    expect(conflict).toBeNull();
  });

  test("returns null when the address is free", () => {
    const conflict = findEmailConflict({
      normalizedEmail: "novo@empresa.com",
      currentEmail: "antigo@empresa.com",
      targetAdminId,
      existing: [{ id: targetAdminId, email: "antigo@empresa.com" }],
    });

    expect(conflict).toBeNull();
  });

  test("treats a row without an address as no conflict", () => {
    const conflict = findEmailConflict({
      normalizedEmail: "novo@empresa.com",
      currentEmail: null,
      targetAdminId,
      existing: [{ id: "admin-3" as GlobalAdminId, email: null }],
    });

    expect(conflict).toBeNull();
  });
});

describe("role derivation for a new account", () => {
  test("an explicit administrador role creates the global administrator row", () => {
    expect(
      deriveCreateUserIntent({ role: "administrador", nome: "Maria" }),
    ).toEqual({
      requestedRole: "administrador",
      createsGlobalAdminRecord: true,
      grantedRole: "administrador",
    });
  });

  test("an explicit usuario role does not create the global administrator row", () => {
    expect(deriveCreateUserIntent({ role: "usuario", nome: "Maria" })).toEqual({
      requestedRole: "usuario",
      createsGlobalAdminRecord: false,
      grantedRole: "usuario",
    });
  });

  test("preserved fail-open behavior: a missing role with a name creates a global administrator", () => {
    expect(deriveCreateUserIntent({ nome: "Maria" })).toEqual({
      requestedRole: null,
      createsGlobalAdminRecord: true,
      grantedRole: "administrador",
    });
  });

  test("preserved fail-open behavior: an unrecognized role with a name also creates a global administrator", () => {
    expect(
      deriveCreateUserIntent({ role: "invalid-role", nome: "Maria" }),
    ).toEqual({
      requestedRole: null,
      createsGlobalAdminRecord: true,
      grantedRole: "administrador",
    });
  });

  test("a missing role without a name does not create the global administrator row", () => {
    expect(deriveCreateUserIntent({ role: "invalid-role" })).toEqual({
      requestedRole: null,
      createsGlobalAdminRecord: false,
      grantedRole: "usuario",
    });
    expect(deriveCreateUserIntent({ nome: "   " })).toEqual({
      requestedRole: null,
      createsGlobalAdminRecord: false,
      grantedRole: "usuario",
    });
  });
});

describe("conflict with an already linked profile", () => {
  test("blocks when the access belongs to a gerente or a capataz", () => {
    expect(
      conflictsWithExistingProfile({
        hasGerenteProfile: true,
        hasCapatazProfile: false,
      }),
    ).toBe(true);
    expect(
      conflictsWithExistingProfile({
        hasGerenteProfile: false,
        hasCapatazProfile: true,
      }),
    ).toBe(true);
  });

  test("allows when neither profile holds the access", () => {
    expect(
      conflictsWithExistingProfile({
        hasGerenteProfile: false,
        hasCapatazProfile: false,
      }),
    ).toBe(false);
  });
});
