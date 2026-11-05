import { describe, it, expect } from 'bun:test';
import {
  signSyntheticJwt,
  verifySyntheticJwt,
  decodeSyntheticJwt,
  SYNTHETIC_JWT_SECRET_LAB
} from '../src/jwt/synthetic-jwt';
import { SyntheticJwtClaims } from '../src/jwt/claims';

describe('Suíte Unitária: Motor JWT Sintético Web Crypto API (HS256)', () => {
  const baseClaims: Partial<SyntheticJwtClaims> & {
    user_id: string;
    tenant_id: string;
    fazenda_id: string;
    profile_id: any;
  } = {
    user_id: '11111111-1111-4111-8111-111111111111',
    tenant_id: '22222222-2222-4222-8222-222222222222',
    fazenda_id: '33333333-3333-4333-8333-333333333333',
    profile_id: 'gerente',
    email: 'gerente.lab@consubov.local',
    name: 'Carlos Gerente Lab',
    roles: ['gerente'],
    permissions: ['analytics:view', 'meta:edit']
  };

  it('deve assinar e verificar um token JWT sintético válido com HS256', async () => {
    const token = await signSyntheticJwt(baseClaims);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const result = await verifySyntheticJwt(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.user_id).toBe(baseClaims.user_id);
      expect(result.payload.tenant_id).toBe(baseClaims.tenant_id);
      expect(result.payload.profile_id).toBe('gerente');
      expect(result.payload.iss).toBe('consubov:auth:local');
      expect(result.payload.aud).toBe('consubov:platform:api');
    }
  });

  it('deve decodificar payload de token sem verificar assinatura', async () => {
    const token = await signSyntheticJwt(baseClaims);
    const decoded = decodeSyntheticJwt(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.user_id).toBe(baseClaims.user_id);
    expect(decoded?.profile_id).toBe('gerente');
  });

  it('deve rejeitar token com assinatura adulterada (INVALID_SIGNATURE)', async () => {
    const token = await signSyntheticJwt(baseClaims);
    const parts = token.split('.');
    // Adulterar assinatura
    const tamperedSignature = parts[2].substring(0, parts[2].length - 3) + 'XYZ';
    const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

    const result = await verifySyntheticJwt(tamperedToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('INVALID_SIGNATURE');
    }
  });

  it('deve rejeitar token com payload adulterado (INVALID_SIGNATURE)', async () => {
    const token = await signSyntheticJwt(baseClaims);
    const parts = token.split('.');
    // Adulterar payload
    const tamperedPayload = parts[1] + 'a';
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await verifySyntheticJwt(tamperedToken);
    expect(result.valid).toBe(false);
  });

  it('deve rejeitar token assinado com chave secreta diferente', async () => {
    const token = await signSyntheticJwt(baseClaims, 'chave-secreta-diferente-123456');
    const result = await verifySyntheticJwt(token, SYNTHETIC_JWT_SECRET_LAB);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('INVALID_SIGNATURE');
    }
  });

  it('deve rejeitar token expirado (TOKEN_EXPIRED)', async () => {
    // Expira em -10 segundos
    const token = await signSyntheticJwt(baseClaims, SYNTHETIC_JWT_SECRET_LAB, {
      expiresInSeconds: -10
    });

    const result = await verifySyntheticJwt(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('TOKEN_EXPIRED');
    }
  });

  it('deve rejeitar token malformado com menos de 3 partes', async () => {
    const result1 = await verifySyntheticJwt('token-invalido-sem-pontos');
    expect(result1.valid).toBe(false);
    if (!result1.valid) {
      expect(result1.error).toBe('MALFORMED_JWT');
    }

    const result2 = await verifySyntheticJwt('parte1.parte2');
    expect(result2.valid).toBe(false);
  });
});
