import { describe, it, expect } from 'bun:test';
import {
  ativarModuloPayloadSchema,
  gerarLicencaOffgridPayloadSchema,
  atualizarLicencaPayloadSchema
} from '@consubov/contracts';

describe('Gate Q6: Licenciamento, Planos SaaS & Emissão de Licença Offgrid (q6-admin-licenses)', () => {
  it('Q6.2.1: deve autorizar ativação seletiva de módulos do ecossistema SaaS via schema canônico', () => {
    const modulos = [
      'gerente',
      'capataz',
      'escritorio',
      'fabrica',
      'relatto_integracao',
      'offline_pack'
    ] as const;

    for (const mod of modulos) {
      const payload = {
        tenant_id: 'ten-corp-001',
        fazenda_id: 'faz-001',
        modulo_id: mod,
        ativo: true,
        vigencia_inicio: new Date().toISOString(),
        vigencia_fim: new Date(Date.now() + 30 * 86400000).toISOString(),
        motivo_ativacao: `Contratação adicional do módulo ${mod} em upgrade de plano`
      };

      const parsed = ativarModuloPayloadSchema.parse(payload);
      expect(parsed.modulo_id).toBe(mod);
      expect(parsed.ativo).toBe(true);
    }
  });

  it('Q6.2.2: deve emitir licença de campo offgrid com prazo válido entre 1 e 90 dias', () => {
    const valid1Day = {
      licenca_id: 'lic-off-001',
      tenant_id: 'ten-001',
      fazenda_id: 'faz-001',
      dispositivo_id: 'device-rugged-tablet-01',
      dias_validade_offgrid: 1,
      modulos_autorizados: ['capataz' as const],
      chave_assinatura_publica: 'PUBKEY-CONSUBOV-ED25519-LAB-SIGNATURE-TEST-KEY-0123456789',
      gerado_em: new Date().toISOString()
    };
    expect(gerarLicencaOffgridPayloadSchema.parse(valid1Day).dias_validade_offgrid).toBe(1);

    const valid90Days = {
      ...valid1Day,
      licenca_id: 'lic-off-090',
      dias_validade_offgrid: 90,
      modulos_autorizados: ['capataz' as const, 'gerente' as const]
    };
    expect(gerarLicencaOffgridPayloadSchema.parse(valid90Days).dias_validade_offgrid).toBe(90);
  });

  it('Q6.2.3: deve rejeitar emissão de licença offgrid com validade fora do intervalo de 1 a 90 dias', () => {
    const base = {
      licenca_id: 'lic-off-invalid',
      tenant_id: 'ten-001',
      fazenda_id: 'faz-001',
      dispositivo_id: 'device-01',
      modulos_autorizados: ['capataz' as const],
      chave_assinatura_publica: 'PUBKEY-CONSUBOV-ED25519-LAB-SIGNATURE-TEST-KEY-0123456789',
      gerado_em: new Date().toISOString()
    };

    // 0 dias
    expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...base, dias_validade_offgrid: 0 }).success).toBe(false);
    // Negativo
    expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...base, dias_validade_offgrid: -5 }).success).toBe(false);
    // 91 dias
    expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...base, dias_validade_offgrid: 91 }).success).toBe(false);
    // Float
    expect(gerarLicencaOffgridPayloadSchema.safeParse({ ...base, dias_validade_offgrid: 30.5 }).success).toBe(false);
  });

  it('Q6.2.4: deve rejeitar licença offgrid sem módulos autorizados ou chave de assinatura curta (< 32 chars)', () => {
    const base = {
      licenca_id: 'lic-off-test',
      tenant_id: 'ten-001',
      fazenda_id: 'faz-001',
      dispositivo_id: 'device-01',
      dias_validade_offgrid: 30,
      chave_assinatura_publica: 'PUBKEY-CONSUBOV-ED25519-LAB-SIGNATURE-TEST-KEY-0123456789',
      gerado_em: new Date().toISOString()
    };

    // Lista vazia de módulos
    const resNoModules = gerarLicencaOffgridPayloadSchema.safeParse({
      ...base,
      modulos_autorizados: []
    });
    expect(resNoModules.success).toBe(false);

    // Chave curta
    const resShortKey = gerarLicencaOffgridPayloadSchema.safeParse({
      ...base,
      modulos_autorizados: ['capataz'],
      chave_assinatura_publica: 'chave_muito_curta'
    });
    expect(resShortKey.success).toBe(false);
  });

  it('Q6.2.5: deve atualizar status de licença existente com justificativa formal', () => {
    const statuses = ['ativa', 'suspensa', 'revogada', 'expirada'] as const;

    for (const st of statuses) {
      const payload = {
        licenca_id: 'lic-off-001',
        tenant_id: 'ten-001',
        novo_status: st,
        justificativa: `Alteração de status da licença para ${st} por solicitação comercial`,
        atualizado_em: new Date().toISOString()
      };

      const parsed = atualizarLicencaPayloadSchema.parse(payload);
      expect(parsed.novo_status).toBe(st);
    }
  });

  it('Q6.2.6: deve rejeitar atualização de licença com status desconhecido ou justificativa curta (< 5 chars)', () => {
    const invalidStatus = {
      licenca_id: 'lic-off-001',
      tenant_id: 'ten-001',
      novo_status: 'status_invalido' as any,
      justificativa: 'Justificativa válida com mais de cinco caracteres',
      atualizado_em: new Date().toISOString()
    };
    expect(atualizarLicencaPayloadSchema.safeParse(invalidStatus).success).toBe(false);

    const shortJust = {
      licenca_id: 'lic-off-001',
      tenant_id: 'ten-001',
      novo_status: 'suspensa' as const,
      justificativa: 'abc',
      atualizado_em: new Date().toISOString()
    };
    expect(atualizarLicencaPayloadSchema.safeParse(shortJust).success).toBe(false);
  });
});
