import { describe, expect, it } from "vitest";
import { planMapaCollectionChanges } from "./mapaEditorSavePlan";

type Shape = { id?: string; geometry: number[][]; color: string };
const same = (a: Shape, b: Shape) =>
  a.color === b.color && JSON.stringify(a.geometry) === JSON.stringify(b.geometry);

describe("non-destructive map saving plan", () => {
  const old: Shape[] = [
    { id: "polygon-1", geometry: [[10, 10], [20, 20]], color: "green" },
    { id: "polygon-2", geometry: [[30, 30], [40, 40]], color: "green" },
  ];

  it("does not rewrite unchanged geometry or delete it", () => {
    expect(planMapaCollectionChanges(old, [...old], same)).toEqual({
      toSave: [], toRemoveIds: [],
    });
  });

  it("only writes changed or new geometry; removes only deliberately excluded ids", () => {
    const updated = { ...old[0], color: "blue" };
    const created: Shape = { geometry: [[50, 50], [60, 60]], color: "green" };
    expect(planMapaCollectionChanges(old, [updated, created], same)).toEqual({
      toSave: [updated, created], toRemoveIds: ["polygon-2"],
    });
  });

  it("does not accept stale ids or duplicate ids from another map", () => {
    expect(() => planMapaCollectionChanges(old, [{ ...old[0], id: "foreign-polygon" }], same))
      .toThrow(/não pertence/);
    expect(() => planMapaCollectionChanges(old, [old[0], old[0]], same))
      .toThrow(/duplicado/);
  });
});
