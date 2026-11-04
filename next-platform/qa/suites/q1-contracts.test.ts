import { describe, it, expect } from 'bun:test';
import {
  atomicCommandEnvelopeSchema,
  ALLOWED_COMMAND_TYPES,
  isAllowedCommand,
  createSyntheticCommandEnvelope
} from '../harness/synthetic-data';

describe('Suíte Q1.4: Contratos Zod e AtomicCommandEnvelope', () => {
  it('deve validar com sucesso um envelope sintético conforme', () => {
    const envelope = createSyntheticCommandEnvelope();
    const result = atomicCommandEnvelopeSchema.safeParse(envelope);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.command_type).toBe('capataz.cocho.registrar_escore');
      expect(result.data.aggregate_type).toBe('pasto');
      expect(result.data.base_version).toBe(0);
    }
  });

  it('deve conter todos os comandos críticos na allowlist fechada', () => {
    expect(ALLOWED_COMMAND_TYPES.length).toBeGreaterThanOrEqual(20);
    expect(isAllowedCommand('capataz.salga.lancar')).toBe(true);
    expect(isAllowedCommand('gerente.metas.definir')).toBe(true);
    expect(isAllowedCommand('admin.tenants.criar')).toBe(true);
    expect(isAllowedCommand('comando_malicioso_injetado')).toBe(false);
  });

  it('deve rejeitar envelope com idempotency_key muito curta (< 16 caracteres)', () => {
    const invalidEnvelope = createSyntheticCommandEnvelope({
      idempotency_key: 'curta'
    });

    const result = atomicCommandEnvelopeSchema.safeParse(invalidEnvelope);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar envelope com comando fora da allowlist no schema', () => {
    const invalidEnvelope = createSyntheticCommandEnvelope({
      command_type: 'comando.inexistente' as any
    });

    const result = atomicCommandEnvelopeSchema.safeParse(invalidEnvelope);
    expect(result.success).toBe(false);
  });

  it('deve rejeitar envelope com base_version negativa', () => {
    const invalidEnvelope = createSyntheticCommandEnvelope({
      base_version: -1
    });

    const result = atomicCommandEnvelopeSchema.safeParse(invalidEnvelope);
    expect(result.success).toBe(false);
  });
});
