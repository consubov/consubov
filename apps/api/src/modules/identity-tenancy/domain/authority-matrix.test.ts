import { describe, expect, test } from "bun:test";
import {
  AUTHORITY_MATRIX,
  getAuthorityDecision,
  type AuthorityAction,
} from "./authority-matrix";

describe("authority matrix", () => {
  test("keeps the two proven administrative flows explicit", () => {
    expect(getAuthorityDecision("create_user")).toBe("ADMIN_REQUIRED");
    expect(getAuthorityDecision("manage_admin")).toBe("ADMIN_REQUIRED");
  });

  test("keeps unapproved authorities closed by default", () => {
    const pending: AuthorityAction[] = [
      "create_capataz",
      "self_register_farm",
      "structural_changes",
      "approvals",
      "global_admin_operations",
    ];

    pending.forEach((action) => {
      expect(AUTHORITY_MATRIX[action]).toBe("DENY_UNTIL_APPROVED");
    });
  });
});
