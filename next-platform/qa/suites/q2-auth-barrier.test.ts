import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';
import {
  signSyntheticJwt,
  SYNTHETIC_JWT_SECRET_LAB,
  SYNTHETIC_USERS
} from '@consubov/auth-client';

describe('Gate Q2.1: Barreira de Autenticação Bearer e Proteção Anti-Spoofing', () => {
  let apiInstance: ReturnType<typeof createApiServer>;
  let baseUrl: string;
  let validTokenCapataz: string;
  let validTokenGerente: string;

  beforeAll(async () => {
    const port = await allocateAvailablePort(3400);
    apiInstance = createApiServer(port, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${port}`;

    validTokenCapataz = await signSyntheticJwt({
      user_id: SYNTHETIC_USERS['capataz.lab@consubov.local']!.user_id,
      tenant_id: 'tenant-lab-001',
      fazenda_id: 'fazenda-guarani-01',
      profile_id: 'capataz',
      roles: ['capataz']
    });

    validTokenGerente = await signSyntheticJwt({
      user_id: SYNTHETIC_USERS['gerente.lab@consubov.local']!.user_id,
      tenant_id: 'tenant-lab-001',
      fazenda_id: 'fazenda-guarani-01',
      profile_id: 'gerente',
      roles: ['gerente']
    });
  });

  afterAll(() => {
    if (apiInstance) {
      apiInstance.stop();
    }
  });

  it('Q2.1.1: deve rejeitar POST /api/v1/commands sem cabeçalho Authorization com HTTP 401 UNAUTHORIZED', async () => {
    const envelope = createSyntheticCommandEnvelope();
    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope)
    });

    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('Q2.1.2: deve rejeitar cabeçalho de autenticação malformado (sem prefixo Bearer)', async () => {
    const envelope = createSyntheticCommandEnvelope();
    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic dXNlcjpwYXNz'
      },
      body: JSON.stringify(envelope)
    });

    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('Q2.1.3: deve rejeitar token com assinatura HMAC adulterada com HTTP 401 INVALID_TOKEN', async () => {
    const parts = validTokenCapataz.split('.');
    const tampered = `${parts[0]}.${parts[1]}.AssinaturaFalsaInvalidaXYZ123`;

    const envelope = createSyntheticCommandEnvelope();
    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tampered}`
      },
      body: JSON.stringify(envelope)
    });

    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toBe('INVALID_TOKEN');
  });

  it('Q2.1.4: deve rejeitar token expirado com HTTP 401 TOKEN_EXPIRED', async () => {
    const expiredToken = await signSyntheticJwt(
      {
        user_id: 'user-capataz-teste',
        tenant_id: 'tenant-lab-001',
        fazenda_id: 'fazenda-guarani-01',
        profile_id: 'capataz'
      },
      SYNTHETIC_JWT_SECRET_LAB,
      { expiresInSeconds: -3600 }
    );

    const envelope = createSyntheticCommandEnvelope();
    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredToken}`
      },
      body: JSON.stringify(envelope)
    });

    expect(res.status).toBe(401);
    const body: any = await res.json();
    expect(body.error).toBe('TOKEN_EXPIRED');
  });

  it('Q2.1.5: deve autenticar credenciais sintéticas via POST /api/v1/auth/login emitindo token assinado', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'gerente.lab@consubov.local',
        password: 'lab@123456'
      })
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.token).toBeDefined();
    expect(body.token_type).toBe('Bearer');
    expect(body.user.email).toBe('gerente.lab@consubov.local');
    expect(body.user.primary_profile).toBe('gerente');
  });

  it('Q2.1.6: deve barrar Cross-Tenant Spoofing com HTTP 403 CONTEXT_MISMATCH', async () => {
    // Token emitido para tenant-lab-001
    // Envelope forja tenant-atacante-999
    const spoofedEnvelope = createSyntheticCommandEnvelope({
      tenant_id: 'tenant-alheio-hack-999'
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validTokenCapataz}`
      },
      body: JSON.stringify(spoofedEnvelope)
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.error).toBe('CONTEXT_MISMATCH');
  });

  it('Q2.1.7: deve barrar Profile Spoofing com HTTP 403 PROFILE_MISMATCH', async () => {
    // Token emitido com profile_id: 'capataz'
    // Envelope forja profile_id: 'gerente'
    const spoofedEnvelope = createSyntheticCommandEnvelope({
      profile_id: 'gerente',
      user_id: SYNTHETIC_USERS['capataz.lab@consubov.local']!.user_id
    });

    const res = await fetch(`${baseUrl}/api/v1/commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validTokenCapataz}`
      },
      body: JSON.stringify(spoofedEnvelope)
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.error).toBe('PROFILE_MISMATCH');
  });
});
