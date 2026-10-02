import { describe, expect, test } from "bun:test";
import {
  buildIntegrationSelections,
  collectUserTargets,
  defaultIntegrationContent,
  hasNoSelection,
  normalizeIntegrationPayload,
} from "./index";

describe("request body normalization", () => {
  test("refuses a root that is not a plain object", () => {
    expect(normalizeIntegrationPayload(null)).toBeNull();
    expect(normalizeIntegrationPayload([])).toBeNull();
    expect(normalizeIntegrationPayload("title")).toBeNull();
    expect(normalizeIntegrationPayload(7)).toBeNull();
    expect(normalizeIntegrationPayload(undefined)).toBeNull();
  });

  test("keeps only the string fields and ignores the others", () => {
    expect(
      normalizeIntegrationPayload({
        title: "Titulo",
        body: "Corpo",
        url: "/tela",
        desconhecido: 1,
      }),
    ).toEqual({ title: "Titulo", body: "Corpo", url: "/tela" });
  });

  test("ignores content fields of the wrong type instead of failing", () => {
    expect(normalizeIntegrationPayload({ title: 5, body: {}, url: [] })).toEqual({});
  });

  test("refuses an audience selector of the wrong type or empty", () => {
    expect(normalizeIntegrationPayload({ fazenda_id: 7 })).toBeNull();
    expect(normalizeIntegrationPayload({ fazenda_id: "" })).toBeNull();
    expect(normalizeIntegrationPayload({ fabrica_id: [] })).toBeNull();
    expect(normalizeIntegrationPayload({ fabrica_id: "" })).toBeNull();
    expect(normalizeIntegrationPayload({ user_id: 7 })).toBeNull();
    expect(normalizeIntegrationPayload({ user_id: "" })).toBeNull();
  });

  test("refuses a user list that is not a list of non-empty strings", () => {
    expect(normalizeIntegrationPayload({ user_ids: "u1" })).toBeNull();
    expect(normalizeIntegrationPayload({ user_ids: ["u1", 7] })).toBeNull();
    expect(normalizeIntegrationPayload({ user_ids: ["u1", ""] })).toBeNull();
    expect(normalizeIntegrationPayload({ user_ids: [] })).toEqual({
      user_ids: [],
    });
  });

  test("coerces the boolean flags, so a truthy string stays truthy", () => {
    expect(normalizeIntegrationPayload({ admins_only: "false" })).toEqual({
      admins_only: true,
    });
    expect(normalizeIntegrationPayload({ all: 1 })).toEqual({ all: true });
    expect(normalizeIntegrationPayload({ all: 0 })).toEqual({ all: false });
    expect(normalizeIntegrationPayload({ all: null })).toEqual({});
    expect(normalizeIntegrationPayload({ admins_only: undefined })).toEqual({});
  });
});

describe("direct user targets", () => {
  test("puts the single target first and removes duplicates", () => {
    const payload = normalizeIntegrationPayload({
      user_id: "u1",
      user_ids: ["u2", "u1", "u3"],
    });

    expect(payload).not.toBeNull();
    expect(collectUserTargets(payload!)).toEqual(["u1", "u2", "u3"]);
  });

  test("returns nothing when no user is addressed", () => {
    expect(collectUserTargets({})).toEqual([]);
  });
});

describe("audiences of a normalized request", () => {
  test("derives one audience per selector, in the proven order", () => {
    const payload = normalizeIntegrationPayload({
      fazenda_id: "f1",
      fabrica_id: "fab-1",
      admins_only: true,
      user_ids: ["u1"],
    });
    const targets = collectUserTargets(payload!);

    expect(buildIntegrationSelections(payload!, targets)).toEqual([
      { kind: "fazenda", fazendaId: "f1" },
      { kind: "fabrica", fabricaId: "fab-1" },
      { kind: "admins" },
      { kind: "users", userIds: ["u1"] },
    ]);
  });

  test("produces no audience when the request selects nothing", () => {
    const payload = normalizeIntegrationPayload({ title: "Sem audiencia" });
    const targets = collectUserTargets(payload!);

    expect(buildIntegrationSelections(payload!, targets)).toEqual([]);
    expect(hasNoSelection(buildIntegrationSelections(payload!, targets))).toBe(true);
  });
});

describe("content defaults", () => {
  test("fills the absent fields with the product defaults", () => {
    expect(defaultIntegrationContent({})).toEqual({
      title: "Consubov",
      body: "",
      url: "/",
    });
  });

  test("keeps the values the request provided", () => {
    expect(
      defaultIntegrationContent({ title: "Consulta", body: "Agende", url: "/syncvet" }),
    ).toEqual({
      title: "Consulta",
      body: "Agende",
      url: "/syncvet",
    });
  });
});
