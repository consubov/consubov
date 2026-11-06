import { attachmentUploadMetadataSchema, MAX_ATTACHMENT_BYTES } from '@consubov/contracts';
import { authenticateRequest } from '../auth/middleware';
import { LabGrantRegistry } from '../auth/grants';
import { InMemoryLedger } from '../ledger/in-memory-ledger';
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function matchesImage(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte);
  return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
}
export async function handleAttachmentRequest(req: Request, id: string, ledger: InMemoryLedger, grants: LabGrantRegistry): Promise<Response> {
  if (req.method !== 'PUT' && req.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) return auth.response;
  const capability = req.method === 'PUT' ? 'sync.push' : 'sync.pull';
  if (!grants.check(auth.claims, capability)) return json({ error: 'FORBIDDEN' }, 403);
  if (req.method === 'GET') {
    const attachment = ledger.getAttachment(auth.claims, id);
    return attachment ? new Response(new Blob([new Uint8Array(attachment.bytes)]), { headers: { 'Content-Type': attachment.ref.mime_type, 'Content-Length': String(attachment.ref.size_bytes), 'X-Attachment-Sha256': attachment.ref.hash_sha256, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } }) : json({ error: 'NOT_FOUND' }, 404);
  }
  const parsed = attachmentUploadMetadataSchema.safeParse({ attachment_id: id, mime_type: req.headers.get('content-type'), size_bytes: Number(req.headers.get('x-attachment-size')), hash_sha256: req.headers.get('x-attachment-sha256'), local_blob_ref: req.headers.get('x-attachment-local-ref') });
  if (!parsed.success) return json({ error: 'INVALID_ATTACHMENT_METADATA' }, 422);
  const ref = parsed.data;
  const reader = req.body?.getReader();
  if (!reader) return json({ error: 'ATTACHMENT_BODY_REQUIRED' }, 422);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > MAX_ATTACHMENT_BYTES || size > ref.size_bytes) { await reader.cancel(); return json({ error: 'ATTACHMENT_TOO_LARGE' }, 413); }
      chunks.push(item.value);
    }
  } catch { return json({ error: 'ATTACHMENT_BODY_INCOMPLETE' }, 422); }
  if (size !== ref.size_bytes) return json({ error: 'ATTACHMENT_SIZE_MISMATCH' }, 422);
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== ref.hash_sha256 || !matchesImage(bytes, ref.mime_type)) return json({ error: 'ATTACHMENT_INTEGRITY_MISMATCH' }, 422);
  // A device logout/revocation during streamed upload or hashing must prevent persistence.
  if (!grants.check(auth.claims, capability)) return json({ error: 'GRANT_REVOKED' }, 403);
  return ledger.putAttachment(auth.claims, ref, bytes) ? json(ref, 200) : json({ error: 'ATTACHMENT_ID_REUSED' }, 409);
}
