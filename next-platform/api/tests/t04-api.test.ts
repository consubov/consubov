import { describe, expect, it } from 'bun:test';
import { SYNTHETIC_USERS, decodeSyntheticJwt, signSyntheticJwt } from '@consubov/auth-client';
import { commandApiResponseSchema, syncPullResponseSchema, type AtomicCommandEnvelope } from '@consubov/contracts';
import { createRouter } from '../src/router';
import { InMemoryLedger } from '../src/ledger/in-memory-ledger';
import { LabGrantRegistry } from '../src/auth/grants';

const url = 'http://127.0.0.1:3333';
function laboratory() {
  const ledger = new InMemoryLedger(), grants = new LabGrantRegistry(), router = createRouter(ledger, grants);
  async function login(email = 'capataz.lab@consubov.local', device = 'device-api-test', membershipId?: string) {
    const user = SYNTHETIC_USERS[email]!;
    const res = await router(new Request(url + '/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: user.password_hash, device_id: device, membership_id: membershipId ?? user.memberships.find(m => m.is_active)?.membership_id }) }));
    expect(res.status).toBe(200);
    return await res.json();
  }
  function send(token: string, envelope: AtomicCommandEnvelope) {
    return router(new Request(url + '/api/v1/commands', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(envelope) }));
  }
  function pull(token: string, cursor?: string, extra: Record<string, string> = {}) {
    const claims = decodeSyntheticJwt(token)!;
    const params = new URLSearchParams({ tenant_id: claims.tenant_id, fazenda_id: claims.fazenda_id, profile_id: claims.profile_id, ...extra, ...(cursor ? { since_cursor: cursor } : {}) });
    return router(new Request(url + '/api/v1/sync?' + params, { headers: { Authorization: 'Bearer ' + token } }));
  }
  return { ledger, grants, router, login, send, pull };
}
function command(token: string, changes: Partial<AtomicCommandEnvelope> = {}): AtomicCommandEnvelope {
  const claims = decodeSyntheticJwt(token)!;
  const id = crypto.randomUUID();
  return { command_id: id, idempotency_key: 'idempotency-' + id, command_type: 'capataz.animais.contagem', aggregate_type: 'lote', aggregate_id: 'lote-01', base_version: 1,
    user_id: claims.user_id, tenant_id: claims.tenant_id, product_id: claims.product_id, fazenda_id: claims.fazenda_id, retiro_id: claims.retiro_id, profile_id: claims.profile_id, device_id: claims.device_id,
    schema_version: 1, payload: { pasto_id: 'pasto-01', lote_id: 'lote-01', quantidade_cabecas: 42, data_contagem: new Date().toISOString() }, correlation_id: id, attachment_refs: [], occurred_at_local: new Date().toISOString(), status: 'PENDENTE', attempts: 0, last_attempt_at: null, error_message: null, ...changes };
}
async function imageRef(bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,1])) {
  return { attachment_id: crypto.randomUUID(), mime_type: 'image/png', size_bytes: bytes.length, hash_sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join(''), local_blob_ref: 'blob:test' };
}
function upload(lab: ReturnType<typeof laboratory>, token: string, ref: Awaited<ReturnType<typeof imageRef>>, bytes: Uint8Array) {
  return lab.router(new Request(url + '/api/v1/attachments/' + ref.attachment_id, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': ref.mime_type, 'X-Attachment-Size': String(ref.size_bytes), 'X-Attachment-Sha256': ref.hash_sha256, 'X-Attachment-Local-Ref': ref.local_blob_ref }, body: bytes }));
}

describe('T04 local authenticated transactional API', () => {
  it('applies once with stable ACK, detects changed payload/key/ID and keeps authoritative full state', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const envelope = command(token);
    const first = await lab.send(token, envelope), body = await first.json();
    expect(first.status).toBe(200); expect(commandApiResponseSchema.safeParse(body).success).toBe(true);
    const retry = await lab.send(token, envelope); expect(await retry.json()).toEqual(body);
    for (const changed of [{ payload: { ...envelope.payload, quantidade_cabecas: 43 } }, { command_id: crypto.randomUUID() }, { idempotency_key: 'another-key-long-enough' }]) expect((await lab.send(token, { ...envelope, ...changed })).status).toBe(409);
    expect(lab.ledger.queryLogs()).toHaveLength(1);
    const refreshed = await lab.login(undefined, 'another-device');
    expect(refreshed.initial_data.snapshot.version).toBe(1);
    expect(refreshed.initial_data.snapshot.data.baseVersions['lote-01']).toBe(2);
    expect(JSON.stringify(refreshed.initial_data.snapshot.data)).toContain('42');
  });
  it('rejects all forged scope dimensions and revoked grants without writes', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const envelope = command(token);
    for (const field of ['user_id','tenant_id','fazenda_id','retiro_id','product_id','profile_id','device_id'] as const) {
      const changed = { ...envelope, [field]: field === 'product_id' ? 'relatto' : field === 'profile_id' ? 'gerente' : 'forged' };
      expect((await lab.send(token, changed as AtomicCommandEnvelope)).status, field).toBe(403);
    }
    const forged = await signSyntheticJwt({ ...decodeSyntheticJwt(token)!, session_id: 'not-server-issued' });
    expect((await lab.send(forged, envelope)).status).toBe(403);
    lab.grants.revoke(auth.session.session_id);
    expect((await lab.send(token, envelope)).status).toBe(403);
    expect((await lab.pull(token)).status).toBe(403);
    expect(lab.ledger.queryLogs()).toHaveLength(0);
  });
  it('rechecks current membership and capabilities, not only signed claims', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const claims = decodeSyntheticJwt(token)!;
    const noPermission = await signSyntheticJwt({ ...claims, permissions: [] });
    expect((await lab.send(noPermission, command(token))).status).toBe(403);
    const membership = SYNTHETIC_USERS['capataz.lab@consubov.local']!.memberships[0]!;
    const active = membership.is_active;
    try { membership.is_active = false; expect((await lab.send(token, command(token))).status).toBe(403); }
    finally { membership.is_active = active; }
    expect(lab.ledger.queryLogs()).toHaveLength(0);
  });
  it('conflicts stale aggregate versions and rejects unsupported aliases and invalid payload without mutation', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    expect((await lab.send(token, command(token))).status).toBe(200);
    const stale = await lab.send(token, command(token));
    expect(stale.status).toBe(409); expect(commandApiResponseSchema.safeParse(await stale.json()).success).toBe(true);
    const unsupported = command(token, { command_type: 'pesagem_animal', base_version: 2, payload: { animal_id: 'animal-1', lote_id: 'lote-01', peso_kg: 100, data_pesagem: new Date().toISOString() } });
    expect((await lab.send(token, unsupported)).status).toBe(422);
    expect((await lab.send(token, command(token, { payload: { arbitrary: true } }))).status).toBe(422);
    expect(lab.ledger.queryLogs()).toHaveLength(1);
  });
  it('scopes opaque incremental cursors to session and returns full module snapshots without raw payload deltas', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const initial = await (await lab.pull(token)).json(); expect(initial.deltas).toEqual([]);
    expect((await lab.send(token, command(token))).status).toBe(200);
    const page = await (await lab.pull(token, initial.next_cursor)).json();
    expect(syncPullResponseSchema.safeParse(page).success).toBe(true);
    expect(page.deltas).toHaveLength(1); expect(page.deltas[0].aggregate_type).toBe('module-state'); expect(page.deltas[0].aggregate_id).toBe('bootstrap'); expect(page.deltas[0].version).toBe(1);
    expect(page.deltas[0].data.baseVersions['lote-01']).toBe(2);
    expect((await (await lab.pull(token, page.next_cursor)).json()).deltas).toEqual([]);
    const other = await lab.login(undefined, 'other-device');
    expect((await lab.pull(other.tokens.access_token, page.next_cursor)).status).toBe(400);
    expect((await lab.pull(token, '123')).status).toBe(400);
    expect((await lab.pull(token, undefined, { tenant_id: 'forged' })).status).toBe(403);
    expect((await lab.router(new Request(url + '/api/v1/sync/extra'))).status).toBe(404);
    expect((await lab.router(new Request(url + '/api/v1/sync', { method: 'POST' }))).status).toBe(405);
  });
  it('persists valid image dependencies, rejects tampering, and protects reads by account ACL', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,1]), ref = await imageRef(bytes);
    expect((await lab.send(token, command(token, { attachment_refs: [ref] }))).status).toBe(422);
    expect((await upload(lab, token, { ...ref, hash_sha256: '0'.repeat(64) }, bytes)).status).toBe(422);
    expect((await upload(lab, token, { ...ref, size_bytes: bytes.length + 1 }, bytes)).status).toBe(422);
    expect((await upload(lab, token, ref, bytes)).status).toBe(200);
    expect((await upload(lab, token, ref, bytes)).status).toBe(200);
    expect((await lab.send(token, command(token, { attachment_refs: [ref] }))).status).toBe(200);
    const download = await lab.router(new Request(url + '/api/v1/attachments/' + ref.attachment_id, { headers: { Authorization: 'Bearer ' + token } }));
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
    const gerente = await lab.login('gerente.lab@consubov.local');
    expect((await lab.router(new Request(url + '/api/v1/attachments/' + ref.attachment_id, { headers: { Authorization: 'Bearer ' + gerente.tokens.access_token } }))).status).toBe(404);
    lab.grants.revoke(auth.session.session_id);
    expect((await upload(lab, token, ref, bytes)).status).toBe(403);
  });
  it('loses cursors and grants on process restart honestly', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const restarted = laboratory(); expect((await restarted.pull(token)).status).toBe(403);
  });
  it('returns the latest full snapshot after null-cursor relogin and shares account state across devices', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    for (let version = 1; version <= 3; version++) expect((await lab.send(token, command(token, { base_version: version }))).status).toBe(200);
    const next = await lab.login(undefined, 'new-account-device');
    expect(next.initial_data.snapshot.version).toBe(3);
    const pull = await (await lab.pull(next.tokens.access_token, undefined, { limit: '1' })).json();
    expect(pull.has_more).toBe(false); expect(pull.deltas).toHaveLength(1); expect(pull.deltas[0].version).toBe(3);
    expect(pull.deltas[0].data.baseVersions['lote-01']).toBe(4);
    expect((await lab.send(next.tokens.access_token, command(next.tokens.access_token, { base_version: 4 }))).status).toBe(200);
  });
  it('commits actual photo metadata and returns only state-referenced attachments on pull and bootstrap', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,1]), ref = await imageRef(bytes), unrelated = await imageRef(bytes);
    expect((await upload(lab, token, ref, bytes)).status).toBe(200);
    expect((await upload(lab, token, unrelated, bytes)).status).toBe(200);
    const envelope = command(token, { command_type: 'capataz.cocho.foto_adicionar', aggregate_type: 'cocho', aggregate_id: 'pasto-01', attachment_refs: [ref], payload: {
      pasto_id: 'pasto-01', foto_attachment_id: ref.attachment_id, tipo_registro: 'auditoria', registrado_em: new Date().toISOString(),
      photo_metadata: { originalSizeBytes: bytes.length, compressedSizeBytes: bytes.length, width: 1, height: 1, compressionRatioPct: 0, mimeType: ref.mime_type, pastoId: 'pasto-01', createdAt: new Date().toISOString() }
    } });
    const bad = structuredClone(envelope); (bad.payload.photo_metadata as Record<string, unknown>).compressedSizeBytes = bytes.length + 1;
    expect((await lab.send(token, bad)).status).toBe(422);
    expect((await lab.send(token, envelope)).status).toBe(200);
    const pull = await (await lab.pull(token)).json(); expect(pull.attachment_refs).toEqual([ref]);
    const relogin = await lab.login(undefined, 'photo-other-device'); expect(relogin.initial_data.attachment_refs).toEqual([ref]);
    expect(relogin.initial_data.snapshot.data.fotos[ref.attachment_id].compressedSizeBytes).toBe(bytes.length);
    const download = await lab.router(new Request(url + '/api/v1/attachments/' + ref.attachment_id, { headers: { Authorization: 'Bearer ' + relogin.tokens.access_token } }));
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
  });
  it('rechecks revocation after a streamed upload await before persisting bytes', async () => {
    const lab = laboratory(), auth = await lab.login(), token = auth.tokens.access_token;
    const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,1]), ref = await imageRef(bytes);
    let release!: () => void, started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const body = new ReadableStream<Uint8Array>({ async pull(controller) { started(); await new Promise<void>(resolve => { release = resolve; }); controller.enqueue(bytes); controller.close(); } }, { highWaterMark: 0 });
    const pending = lab.router(new Request(url + '/api/v1/attachments/' + ref.attachment_id, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': ref.mime_type, 'X-Attachment-Size': String(ref.size_bytes), 'X-Attachment-Sha256': ref.hash_sha256, 'X-Attachment-Local-Ref': ref.local_blob_ref }, body }));
    await reading; lab.grants.revoke(auth.session.session_id); release();
    expect((await pending).status).toBe(403);
    const next = await lab.login();
    expect((await lab.router(new Request(url + '/api/v1/attachments/' + ref.attachment_id, { headers: { Authorization: 'Bearer ' + next.tokens.access_token } }))).status).toBe(404);
  });
});
