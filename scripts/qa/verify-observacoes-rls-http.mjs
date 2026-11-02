import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

/**
 * Manual F12-L34 integration QA. Use ONLY with disposable, local synthetic
 * PostgREST/PG. Locally signed test JWTs do NOT prove GoTrue/remote parity.
 */
const url = process.env.PR76_RLS_HTTP_URL;
const secretFile = process.env.PR76_RLS_HTTP_JWT_SECRET_FILE;
if (!url || !secretFile || !/^http:\/\/qa_pr76_rls_http_(?:support_)?20261102:3000$/.test(url)) {
  throw new Error("Synthetic QA accepts only designated local PostgREST URL");
}
const secret = fs.readFileSync(secretFile, "utf8").trim();
if (!/^[0-9a-f]{64,}$/.test(secret)) throw new Error("Invalid synthetic JWT secret file");

const fA = "00000000-0000-4000-8000-0000000000a1";
const fB = "00000000-0000-4000-8000-0000000000b2";
const rA = "00000000-0000-4000-8000-0000000001a1";
const rB = "00000000-0000-4000-8000-0000000001b2";
const pA = "00000000-0000-4000-8000-0000000002a1";
const pB = "00000000-0000-4000-8000-0000000002b2";
const pA2 = "00000000-0000-4000-8000-0000000002c1";
const capA = "00000000-0000-4000-8000-0000000020a1";
const mgrA = "00000000-0000-4000-8000-0000000010a1";
const mgrB = "00000000-0000-4000-8000-0000000010b2";
const admin = "00000000-0000-4000-8000-0000000050a1";
let passed = 0;

function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const msg = encode({ alg: "HS256", typ: "JWT" }) + "." +
    encode({ aud: "authenticated", sub: user, role: "authenticated", iat: now, exp: now + 600 });
  return msg + "." + crypto.createHmac("sha256", secret).update(msg).digest("base64url");
}
async function req(method, path, user, body, prefer) {
  const headers = { Accept: "application/json" };
  if (user) headers.Authorization = "Bearer " + jwt(user);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const responseText = await res.text();
  let data;
  try { data = JSON.parse(responseText); } catch { data = responseText; }
  return { status: res.status, data };
}
function check(label, response, expected) {
  assert.equal(response.status, expected, label + ": HTTP " + response.status + ", expected " + expected + "; code " + (response.data?.code ?? "none"));
  passed++;
  console.log("PASS " + passed + ": " + label + " (" + expected + ")");
}
async function run() {
  check("anonymous cannot read observations", await req("GET", "/observacoes?select=id&limit=1"), 401);
  const bad = await fetch(url + "/observacoes?select=id&limit=1", {
    headers: { Authorization: "Bearer bad.local.token" },
  });
  assert.equal(bad.status, 401);
  console.log("PASS " + (++passed) + ": invalid JWT rejected (401)");

  const aRows = await req("GET", "/observacoes?select=id,fazenda_id", mgrA);
  check("manager A reads farm A", aRows, 200);
  assert.ok(Array.isArray(aRows.data) && aRows.data.length > 0);
  assert.ok(aRows.data.every(row => row.fazenda_id === fA));

  const bRows = await req("GET", "/observacoes?select=id,fazenda_id", mgrB);
  check("manager B reads farm B", bRows, 200);
  assert.ok(Array.isArray(bRows.data) && bRows.data.length > 0);
  assert.ok(bRows.data.every(row => row.fazenda_id === fB));

  const outsider = await req("GET", "/observacoes?select=id", "00000000-0000-4000-8000-0000000030aa");
  check("authenticated user with no membership reads an empty collection", outsider, 200);
  assert.deepEqual(outsider.data, []);

  const id = crypto.randomUUID();
  const payload = { id, fazenda_id: fA, retiro_id: rA, pasto_id: pA, tipo: "geral",
    descricao: "Synthetic HTTP QA observation", resolvido: false };
  check("capataz inserts own observation", await req("POST", "/observacoes", capA, payload,
    "return=representation"), 201);

  check("capataz denied pasture in another retiro of same farm",
    await req("POST", "/observacoes", capA, { ...payload, id: crypto.randomUUID(), pasto_id: pA2 },
      "return=representation"), 403);

  check("capataz denied another farm",
    await req("POST", "/observacoes", capA, { ...payload, id: crypto.randomUUID(),
      fazenda_id: fB, retiro_id: rB, pasto_id: pB }, "return=representation"), 403);

  check("capataz denied pasture without matching retiro",
    await req("POST", "/observacoes", capA, { ...payload, id: crypto.randomUUID(), retiro_id: null },
      "return=representation"), 403);

  check("manager resolves own observation",
    await req("PATCH", "/observacoes?id=eq." + id, mgrA, { resolvido: true },
      "return=representation"), 200);

  check("capataz replay ignores duplicate without reopening",
    await req("POST", "/observacoes?on_conflict=id", capA, payload,
      "resolution=ignore-duplicates,return=representation"), 201);
  const after = await req("GET", "/observacoes?select=resolvido&id=eq." + id, mgrA);
  check("manager verifies resolved state", after, 200);
  assert.equal(after.data?.length, 1);
  assert.equal(after.data[0].resolvido, true);

  check("manager denied mismatching pasture in same farm",
    await req("PATCH", "/observacoes?id=eq." + id, mgrA, { pasto_id: pA2 },
      "return=representation"), 403);

  check("manager denied cross-farm UPDATE",
    await req("PATCH", "/observacoes?id=eq." + id, mgrA,
      { fazenda_id: fB, retiro_id: rB, pasto_id: pB }, "return=representation"), 403);

  const otherTenant = await req("GET", "/observacoes?select=id&id=eq." + id, mgrB);
  check("manager B cannot read farm A observation", otherTenant, 200);
  assert.deepEqual(otherTenant.data, []);
  console.log("PASS " + (++passed) + ": cross-tenant read returned no rows");

  check("admin allowed optional NULL parents",
    await req("POST", "/observacoes", admin,
      { id: crypto.randomUUID(), fazenda_id: fA, retiro_id: null, pasto_id: null, tipo: "geral" },
      "return=representation"), 201);

  console.log("QA_PR76_HTTP_RLS_PASS count=" + passed + "; isolated PostgREST local JWT, NOT GoTrue");
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
