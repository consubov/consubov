export class IntegrityVerificationError extends Error {
  constructor(public readonly expectedHash: string, public readonly actualHash: string) {
    super(`FALHA_DE_INTEGRIDADE: Hash real '${actualHash}' não confere com hash esperado '${expectedHash}'.`);
    this.name = 'IntegrityVerificationError';
  }
}

/**
 * Verifica integridade de chunk comparando com hash esperado no formato SRI (ex: sha384-...).
 */
export async function verifyChunkIntegrity(
  chunkContent: string | ArrayBuffer | Uint8Array,
  expectedSriHash: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = typeof chunkContent === 'string' ? encoder.encode(chunkContent) : chunkContent;

  const isSha256 = expectedSriHash.startsWith('sha256-');
  const algorithm = isSha256 ? 'SHA-256' : 'SHA-384';
  const prefix = isSha256 ? 'sha256-' : 'sha384-';

  const hashBuffer = await crypto.subtle.digest(algorithm, data as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64Hash = btoa(String.fromCharCode(...hashArray));
  const actualSri = `${prefix}${base64Hash}`;

  if (actualSri !== expectedSriHash) {
    throw new IntegrityVerificationError(expectedSriHash, actualSri);
  }

  return true;
}

/**
 * Verifica integridade criptográfica SHA-256 calculada nativamente via crypto.subtle.digest.
 * Compara hash hexadecimal de 64 caracteres.
 */
export async function verifyChunkIntegritySha256(
  chunkContent: string | ArrayBuffer | Uint8Array,
  expectedSha256: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = typeof chunkContent === 'string' ? encoder.encode(chunkContent) : chunkContent;

  const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const actualHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  const expectedNormalized = expectedSha256.trim().toLowerCase();

  // Comparação defensiva em tempo constante
  if (actualHex.length !== expectedNormalized.length) {
    throw new IntegrityVerificationError(expectedNormalized, actualHex);
  }

  let mismatch = 0;
  for (let i = 0; i < actualHex.length; i++) {
    mismatch |= actualHex.charCodeAt(i) ^ expectedNormalized.charCodeAt(i);
  }

  if (mismatch !== 0) {
    throw new IntegrityVerificationError(expectedNormalized, actualHex);
  }

  return true;
}
