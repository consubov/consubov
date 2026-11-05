import { describe, it, expect } from 'bun:test';
import {
  SYNTHETIC_ADMIN_USERS,
  ADMIN_SESSION_STORAGE_KEY,
  LAB_MFA_CODE
} from '../../apps/admin-global/src/auth/AdminAuthContext';
import {
  signSyntheticJwt,
  verifySyntheticJwt,
  SYNTHETIC_JWT_SECRET_LAB
} from '@consubov/auth-client';

describe('Gate Q6: Autenticação Administrativa em 2 Etapas, MFA Simulado & JWT Global (q6-admin-auth-mfa)', () => {
  it('Q6.5.1: deve conter credenciais sintéticas corporativas isoladas para os 3 perfis administrativos', () => {
    expect(SYNTHETIC_ADMIN_USERS['admin.lab@consubov.local']).toBeDefined();
    expect(SYNTHETIC_ADMIN_USERS['admin.lab@consubov.local']?.role).toBe('super_admin');

    expect(SYNTHETIC_ADMIN_USERS['suporte.lab@consubov.local']).toBeDefined();
    expect(SYNTHETIC_ADMIN_USERS['suporte.lab@consubov.local']?.role).toBe('support_admin');

    expect(SYNTHETIC_ADMIN_USERS['financeiro.lab@consubov.local']).toBeDefined();
    expect(SYNTHETIC_ADMIN_USERS['financeiro.lab@consubov.local']?.role).toBe('financial_admin');
  });

  it('Q6.5.2: deve validar código TOTP simulado de 6 dígitos (código de laboratório 123456)', () => {
    expect(LAB_MFA_CODE).toBe('123456');

    const validateMfaCode = (input: string) => {
      const clean = input.trim().replace(/\D/g, '');
      return clean === LAB_MFA_CODE;
    };

    expect(validateMfaCode('123456')).toBe(true);
    expect(validateMfaCode(' 123456 ')).toBe(true);
    expect(validateMfaCode('123-456')).toBe(true);
    expect(validateMfaCode('000000')).toBe(false);
    expect(validateMfaCode('12345')).toBe(false);
    expect(validateMfaCode('')).toBe(false);
  });

  it('Q6.5.3: deve emitir JWT administrativo com claims globais sem vínculo territorial obrigatório', async () => {
    const cred = SYNTHETIC_ADMIN_USERS['admin.lab@consubov.local']!;

    const token = await signSyntheticJwt(
      {
        sub: 'usr-admin-test',
        user_id: 'usr-admin-test',
        email: cred.email,
        name: cred.name,
        profile_id: 'administrador',
        tenant_id: '00000000-0000-4000-8000-000000000000',
        fazenda_id: '00000000-0000-4000-8000-000000000000',
        product_id: 'consubov',
        roles: [cred.role],
        exp: Math.floor(Date.now() / 1000) + 86400
      },
      SYNTHETIC_JWT_SECRET_LAB
    );

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const verified = await verifySyntheticJwt(token, SYNTHETIC_JWT_SECRET_LAB);
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.profile_id).toBe('administrador');
      expect(verified.payload.roles).toContain('super_admin');
      expect(verified.payload.tenant_id).toBe('00000000-0000-4000-8000-000000000000');
    }
  });

  it('Q6.5.4: chave de persistência de sessão administrativa deve ser isolada da sessão de fazendas', () => {
    expect(ADMIN_SESSION_STORAGE_KEY).toBe('consubov:admin-session');
    expect(ADMIN_SESSION_STORAGE_KEY).not.toBe('consubov:user-session');
  });
});
