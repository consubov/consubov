export class IntegrityVerificationError extends Error {
  constructor(public readonly expectedHash: string, public readonly actualHash: string) {
    super(`FALHA_DE_INTEGRIDADE_SRI: Hash real '${actualHash}' não confere com hash esperado '${expectedHash}'.`);
    this.name = 'IntegrityVerificationError';
  }
}

export async function verifyChunkIntegrity(
  chunkContent: string | ArrayBuffer,
  expectedSriHash: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = typeof chunkContent === 'string' ? encoder.encode(chunkContent) : chunkContent;
  
  const hashBuffer = await crypto.subtle.digest('SHA-384', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64Hash = btoa(String.fromCharCode(...hashArray));
  const actualSri = `sha384-${base64Hash}`;

  if (actualSri !== expectedSriHash) {
    throw new IntegrityVerificationError(expectedSriHash, actualSri);
  }

  return true;
}
