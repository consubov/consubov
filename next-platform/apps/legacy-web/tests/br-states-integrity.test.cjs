const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const data = JSON.parse(readFileSync(join(__dirname, "../src/assets/br-states.json"), "utf8"));
const identityGeometry = data.features.map(({ properties, geometry }) => [
  properties.id, properties.name, properties.sigla, geometry,
]);

test("Brazil map retains the original 27 state shapes and display identifiers", () => {
  assert.equal(data.type, "FeatureCollection");
  assert.equal(data.features.length, 27);
  assert.equal(new Set(data.features.map(f => f.properties.sigla)).size, 27);
  assert.ok(data.features.every(f => f.type === "Feature" && f.geometry?.coordinates?.length > 0));
  assert.equal(createHash("sha256").update(JSON.stringify(identityGeometry)).digest("hex"),
    "f204352494b11ef5ec71f12022a092104de39be73b151ffe06929d45b6630db2");
});

test("shipped map drops only unused enrichment metadata", () => {
  for (const { properties } of data.features) {
    assert.deepEqual(Object.keys(properties).sort(), ["id", "name", "sigla"]);
    assert.ok(Number.isInteger(properties.id));
    assert.ok(typeof properties.name === "string" && properties.name.length > 1);
    assert.match(properties.sigla, /^[A-Z]{2}$/);
  }
});
