import { loginApi, authorizedEnvelope } from '../harness/api-auth';
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApiServer } from '@consubov/platform-api';
import { allocateAvailablePort } from '../harness/port-allocator';
import { createSyntheticCommandEnvelope } from '../harness/synthetic-data';
import {
  signSyntheticJwt,
  verifySyntheticJwt,
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

    validTokenCapataz = (await loginApi(baseUrl, 'capataz')).tokens.access_token;

    validTokenGerente = (await loginApi(baseUrl, 'gerente')).tokens.access_token;
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

  it('Q2.1.5: API valida a conta primeiro e só emite token após seleção explícita de vínculo', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'gerente.lab@consubov.local',
        password: 'lab@123456',
        device_id: 'qa-device-q2'
      })
    });

    expect(login.status).toBe(200);
    const initial: any = await login.json();
    expect(initial.session.user_email).toBe('gerente.lab@consubov.local');
    expect(initial.session.active_context).toBeNull();
    expect(initial.requires_context_selection).toBe(true);
    expect(initial.tokens).toBeUndefined();
    expect(initial.available_memberships.length).toBeGreaterThan(0);

    const selected = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'gerente.lab@consubov.local', password: 'lab@123456', device_id: 'qa-device-q2',
        membership_id: initial.available_memberships[0].membership_id
      })
    });
    expect(selected.status).toBe(200);
    const scoped: any = await selected.json();
    expect(scoped.session.active_context.profile_id).toBe('gerente');
    expect(scoped.tokens.access_token).toBeDefined();
    expect(scoped.tokens.token_type).toBe('Bearer');
    expect(scoped.session.device_id).toBe('qa-device-q2');
    const verified = await verifySyntheticJwt(scoped.tokens.access_token);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.user_id).toBe(scoped.session.user_id);
      expect(verified.payload.profile_id).toBe('gerente');
      expect(verified.payload.device_id).toBe('qa-device-q2');
    }
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
      body: JSON.stringify({ ...authorizedEnvelope(validTokenCapataz, spoofedEnvelope), tenant_id: 'tenant-alheio-hack-999' })
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
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
      body: JSON.stringify({ ...authorizedEnvelope(validTokenCapataz, spoofedEnvelope), profile_id: 'gerente' })
    });

    expect(res.status).toBe(403);
    const body: any = await res.json();
    expect(body.security.error).toBe('FORBIDDEN_403');
  });
});
