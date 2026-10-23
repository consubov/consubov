import { beforeEach, describe, expect, it } from "vitest";
import { clearConsubovResumeRoute, eligible, getConsubovResumeRoute } from "./consubovRouteResume";

describe("CONSUBOV resume guards", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  it("allows only an authorized CONSUBOV role route", () => {
    expect(eligible("/admin/inteligencia", "administrador")).toBe(true);
    expect(eligible("/admin", "gerente")).toBe(false);
    expect(eligible("/admin/painel", "consultor")).toBe(false);
    expect(eligible("/syncvet", "syncvet")).toBe(false);
    expect(eligible("//evil.test", "administrador")).toBe(false);
    expect(eligible("/admin\\evil", "administrador")).toBe(false);
  });
  it("never resumes another account or another role", () => {
    localStorage.setItem("consubov:resume-route:v2", JSON.stringify({userId:"one",role:"administrador",path:"/admin/inteligencia"}));
    expect(getConsubovResumeRoute("one","administrador")).toBe("/admin/inteligencia");
    expect(getConsubovResumeRoute("two","administrador")).toBe(null);
    expect(getConsubovResumeRoute("one","gerente")).toBe(null);
    clearConsubovResumeRoute();
    expect(getConsubovResumeRoute("one","administrador")).toBe(null);
  });
  it("does not restore external, malformed, or module-crossing paths", () => {
    for (const path of ["//evil.test", "/syncvet", "/relatto", "/admin\\foo", "/admin?x=1\nInjected"]) {
      localStorage.setItem("consubov:resume-route:v2", JSON.stringify({userId:"one",role:"administrador",path}));
      expect(getConsubovResumeRoute("one","administrador")).toBe(null);
    }
  });
});
