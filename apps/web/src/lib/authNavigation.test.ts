import { describe, expect, it } from "vitest";
import { getRoleHomePath, ROLE_HOME_PATHS } from "./authNavigation";

describe("auth navigation", () => {
  it("maps every supported authenticated role to its entry route", () => {
    expect(ROLE_HOME_PATHS).toEqual({
      administrador: "/admin",
      gerente: "/gerente",
      capataz: "/capataz",
      escritorio: "/escritorio",
      operador_fabrica: "/fabrica",
      consultor: "/consultor",
      pesador: "/pesador",
      pecuarista: "/pecuarista",
      syncvet: "/syncvet",
    });
  });

  it("does not invent a destination when the role is unresolved", () => {
    expect(getRoleHomePath(null)).toBeNull();
  });
});
