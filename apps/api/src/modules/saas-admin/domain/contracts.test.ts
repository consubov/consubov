import { describe, expect, test } from "bun:test";
import {
  MANAGE_ADMIN_ACTIONS,
  SYNCVET_PROFILES,
  isCompanyAdminScope,
  isCompanyFullAccess,
  isManageAdminAction,
  isPlatformAdminScope,
  isSyncVetProfile,
  type GlobalAdminRecord,
  type PlatformAdminScope,
} from "./index";

const activeAdmin: GlobalAdminRecord = {
  id: "admin-1" as GlobalAdminRecord["id"],
  userId: "auth-1" as GlobalAdminRecord["userId"],
  email: "admin@empresa.com",
  nome: "Administrador",
  ativo: true,
};

describe("global administrator record", () => {
  test("represents only an active row linked to an access", () => {
    expect(activeAdmin.ativo).toBe(true);
    expect(activeAdmin.userId).toBeTruthy();
  });
});

describe("platform administration scope", () => {
  test("separates the global administrator from the administrator of a company", () => {
    const platform: PlatformAdminScope = { kind: "platform" };
    const company: PlatformAdminScope = { kind: "company", companyId: "empresa-1" };

    expect(isPlatformAdminScope(platform)).toBe(true);
    expect(isCompanyAdminScope(platform)).toBe(false);

    expect(isCompanyAdminScope(company)).toBe(true);
    expect(isPlatformAdminScope(company)).toBe(false);
    expect(company.kind === "company" && company.companyId).toBe("empresa-1");
  });
});

describe("SyncVet profiles", () => {
  test("exposes exactly the five proven profiles", () => {
    expect(SYNCVET_PROFILES).toEqual([
      "administrador",
      "veterinario",
      "prestador_servico",
      "estagiario",
      "auxiliar",
    ]);

    for (const profile of SYNCVET_PROFILES) {
      expect(isSyncVetProfile(profile)).toBe(true);
    }
    expect(isSyncVetProfile("gerente")).toBe(false);
    expect(isSyncVetProfile(null)).toBe(false);
  });

  test("grants full access inside the company only to administrador", () => {
    for (const profile of SYNCVET_PROFILES) {
      expect(isCompanyFullAccess(profile)).toBe(profile === "administrador");
    }
  });

  test("denies full access for absent or unknown profiles", () => {
    expect(isCompanyFullAccess(null)).toBe(false);
    expect(isCompanyFullAccess(undefined)).toBe(false);
    expect(isCompanyFullAccess("")).toBe(false);
    expect(isCompanyFullAccess("super_admin")).toBe(false);
    expect(isCompanyFullAccess("Administrador")).toBe(false);
  });
});

describe("administration action allow list", () => {
  test("accepts only update and delete", () => {
    expect(MANAGE_ADMIN_ACTIONS).toEqual(["update", "delete"]);
    expect(isManageAdminAction("update")).toBe(true);
    expect(isManageAdminAction("delete")).toBe(true);
  });

  test("rejects every other action, including a missing one", () => {
    expect(isManageAdminAction("create")).toBe(false);
    expect(isManageAdminAction("UPDATE")).toBe(false);
    expect(isManageAdminAction(undefined)).toBe(false);
    expect(isManageAdminAction(null)).toBe(false);
    expect(isManageAdminAction(1)).toBe(false);
  });
});
