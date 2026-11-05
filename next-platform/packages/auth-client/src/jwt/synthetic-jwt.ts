import { SyntheticJwtClaims } from './claims';

export const SYNTHETIC_JWT_SECRET_LAB = 'consubov-lab-secret-hmac-sha256-isolated-f23-key-synthetic';

/**
 * Utilitários de codificação Base64URL conforme RFC 7515 / RFC 7519.
 * Compatível com browser e Bun sem dependências externas.
 */
export function base64UrlEncode(input: string | Uint8Array | ArrayBuffer): string {
  let base64: string;
  if (typeof input === 'string') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b !== undefined) {
        binary += String.fromCharCode(b);
      }
    }
    base64 = btoa(binary);
  } else {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b !== undefined) {
        binary += String.fromCharCode(b);
      }
    }
    base64 = btoa(binary);
  }

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function base64UrlToBytes(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyData = enc.encode(secret);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface SignJwtOptions {
  expiresInSeconds?: number;
}

/**
 * Assina um JWT sintético utilizando HMAC-SHA256 nativo via Web Crypto API.
 */
export async function signSyntheticJwt(
  claims: Partial<SyntheticJwtClaims> & {
    user_id: string;
    tenant_id: string;
    fazenda_id: string;
    profile_id: any;
  },
  secret: string = SYNTHETIC_JWT_SECRET_LAB,
  options?: SignJwtOptions
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = options?.expiresInSeconds ?? 86400; // 24h padrão offgrid

  const completeClaims: SyntheticJwtClaims = {
    sub: claims.user_id,
    iss: 'consubov:auth:local',
    aud: 'consubov:platform:api',
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + ttl,
    user_id: claims.user_id,
    email: claims.email ?? `${claims.user_id}@consubov.local`,
    name: claims.name ?? 'Usuário Sintético',
    tenant_id: claims.tenant_id,
    fazenda_id: claims.fazenda_id,
    retiro_id: claims.retiro_id ?? null,
    product_id: claims.product_id ?? 'consubov',
    device_id: claims.device_id ?? 'device-lab-default',
    session_id: claims.session_id ?? `session-${claims.user_id}-${now}`,
    profile_id: claims.profile_id,
    roles: claims.roles ?? [claims.profile_id],
    permissions: claims.permissions ?? []
  };

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(completeClaims));
  const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);

  const cryptoKey = await getHmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
  const encodedSignature = base64UrlEncode(signatureBuffer);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export type VerifyJwtResult =
  | { valid: true; payload: SyntheticJwtClaims }
  | { valid: false; error: 'MALFORMED_JWT' | 'INVALID_SIGNATURE' | 'TOKEN_EXPIRED'; payload?: unknown };

/**
 * Verifica um JWT sintético, validando estrutura, assinatura HMAC e prazo de validade.
 */
export async function verifySyntheticJwt(
  token: string,
  secret: string = SYNTHETIC_JWT_SECRET_LAB
): Promise<VerifyJwtResult> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'MALFORMED_JWT' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'MALFORMED_JWT' };
  }

  const encodedHeader = parts[0]!;
  const encodedPayload = parts[1]!;
  const encodedSignature = parts[2]!;

  try {
    const dataToVerify = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const signatureBytes = base64UrlToBytes(encodedSignature);
    const cryptoKey = await getHmacKey(secret);

    const isSignatureValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes as unknown as BufferSource,
      dataToVerify
    );

    if (!isSignatureValid) {
      return { valid: false, error: 'INVALID_SIGNATURE' };
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson) as SyntheticJwtClaims;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'TOKEN_EXPIRED', payload };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'MALFORMED_JWT' };
  }
}

/**
 * Decodifica o payload de um JWT sem validar assinatura criptográfica.
 */
export function decodeSyntheticJwt(token: string): SyntheticJwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson) as SyntheticJwtClaims;
  } catch {
    return null;
  }
}
