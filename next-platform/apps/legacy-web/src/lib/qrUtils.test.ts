import { describe, expect, it } from 'vitest';
import { extractQrUuid, findActivePastoForQr, isQrResourceAvailable } from './qrUtils';

describe('extractQrUuid', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000';

  it('returns a plain UUID-shaped identifier', () => {
    expect(extractQrUuid(uuid)).toBe(uuid);
  });

  it('extracts the identifier from a URL payload', () => {
    expect(extractQrUuid(`https://consubov.local/pasto/${uuid}?source=qr`)).toBe(uuid);
  });

  it('accepts hexadecimal letters regardless of case', () => {
    expect(extractQrUuid('550E8400-E29B-41D4-A716-446655440000')).toBe('550E8400-E29B-41D4-A716-446655440000');
  });

  it('returns null when no UUID-shaped identifier exists', () => {
    expect(extractQrUuid('pasto-sem-identificador-valido')).toBeNull();
  });
});


describe('isQrResourceAvailable', () => {
  it('rejects an unknown resource', () => {
    expect(isQrResourceAvailable(null)).toBe(false);
  });

  it('rejects an inactive resource', () => {
    expect(isQrResourceAvailable({ ativo: false })).toBe(false);
  });

  it('accepts an active resource only when lookup has no error', () => {
    expect(isQrResourceAvailable({ ativo: true })).toBe(true);
    expect(isQrResourceAvailable({ ativo: true }, new Error('lookup failed'))).toBe(false);
  });
});

describe('findActivePastoForQr', () => {
  const qr = '550e8400-e29b-41d4-a716-446655440000';
  const pasto = { id: 'p1', qr_uuid: qr, num_animais: 32 };
  it('resolves the current pasture with its real animal count', () => {
    const current = { ...pasto, num_animais: 45 };
    expect(findActivePastoForQr(qr.toUpperCase(), pasto, [current])).toEqual(current);
  });
  it('never silently assumes zero when the current state has no pasture', () => {
    expect(findActivePastoForQr(qr, pasto, [])).toBeNull();
  });
  it('rejects a pasture from another active retreat or a rotated QR', () => {
    expect(findActivePastoForQr(qr, pasto, [{ ...pasto, id: 'other' }])).toBeNull();
    expect(findActivePastoForQr(qr, pasto, [{ ...pasto, qr_uuid: 'new-uuid' }])).toBeNull();
  });
  it('rejects a mismatched cached QR or missing cache', () => {
    expect(findActivePastoForQr(qr, { ...pasto, qr_uuid: 'old-uuid' }, [pasto])).toBeNull();
    expect(findActivePastoForQr(qr, undefined, [pasto])).toBeNull();
  });
});
