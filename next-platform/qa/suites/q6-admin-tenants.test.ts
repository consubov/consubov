import { describe, it, expect, beforeEach } from 'bun:test';
import {
  criarTenantPayloadSchema,
  suspenderTenantPayloadSchema
} from '@consubov/contracts';

describe('Gate Q6: Gestão de Tenants, Governança Multitenant & Limites de Cota (q6-admin-tenants)', () => {
  it('Q6.1.1: deve validar com sucesso o cadastro de novo tenant corporativo com cotas válidas', () => {
    const payload = {
      tenant_id: 'ten-corp-001',
      razao_social: 'Agropecuária Rio Brilhante S/A',
      nome_fantasia: 'Rio Brilhante Pecuária',
      cnpj: '12345678000195',
      plano: 'enterprise' as const,
      limite_fazendas: 20,
      limite_cabecas: 85000,
      admin_email: 'governance@riobrilhante.com.br',
      admin_nome: 'Roberto Brilhante'
    };

    const parsed = criarTenantPayloadSchema.parse(payload);
    expect(parsed.tenant_id).toBe('ten-corp-001');
    expect(parsed.cnpj).toBe('12345678000195');
    expect(parsed.limite_cabecas).toBe(85000);
    expect(parsed.plano).toBe('enterprise');
  });

  it('Q6.1.2: deve rejeitar CNPJ com formato inválido (com pontuação, letras ou tamanho != 14)', () => {
    const invalidCnpjs = [
      '12.345.678/0001-95',
      '1234567800019',
      '123456780001955',
      '12345678ABCD95',
      ''
    ];

    for (const cnpj of invalidCnpjs) {
      const res = criarTenantPayloadSchema.safeParse({
        tenant_id: 'ten-test',
        razao_social: 'Empresa Teste',
        nome_fantasia: 'Teste',
        cnpj,
        plano: 'starter',
        limite_fazendas: 1,
        limite_cabecas: 1000,
        admin_email: 'adm@teste.com',
        admin_nome: 'Admin'
      });
      expect(res.success).toBe(false);
    }
  });

  it('Q6.1.3: deve rejeitar limites de capacidade fora da faixa estabelecida (limite_fazendas e limite_cabecas)', () => {
    // limite_fazendas < 1
    const resLowFarms = criarTenantPayloadSchema.safeParse({
      tenant_id: 'ten-test',
      razao_social: 'Empresa Teste',
      nome_fantasia: 'Teste',
      cnpj: '12345678000195',
      plano: 'starter',
      limite_fazendas: 0,
      limite_cabecas: 1000,
      admin_email: 'adm@teste.com',
      admin_nome: 'Admin'
    });
    expect(resLowFarms.success).toBe(false);

    // limite_fazendas > 1000
    const resHighFarms = criarTenantPayloadSchema.safeParse({
      tenant_id: 'ten-test',
      razao_social: 'Empresa Teste',
      nome_fantasia: 'Teste',
      cnpj: '12345678000195',
      plano: 'starter',
      limite_fazendas: 1001,
      limite_cabecas: 1000,
      admin_email: 'adm@teste.com',
      admin_nome: 'Admin'
    });
    expect(resHighFarms.success).toBe(false);

    // limite_cabecas > 500000
    const resHighCattle = criarTenantPayloadSchema.safeParse({
      tenant_id: 'ten-test',
      razao_social: 'Empresa Teste',
      nome_fantasia: 'Teste',
      cnpj: '12345678000195',
      plano: 'starter',
      limite_fazendas: 10,
      limite_cabecas: 500001,
      admin_email: 'adm@teste.com',
      admin_nome: 'Admin'
    });
    expect(resHighCattle.success).toBe(false);
  });

  it('Q6.1.4: deve validar e autorizar suspensão formal com motivo válido e justificativa detalhada', () => {
    const validSuspension = {
      tenant_id: 'ten-corp-001',
      motivo_suspensao: 'inadimplencia' as const,
      detalhes: 'Fatura corporativa em atraso há mais de 45 dias conforme contrato',
      suspender_imediatamente: true,
      suspenso_em: new Date().toISOString()
    };

    const parsed = suspenderTenantPayloadSchema.parse(validSuspension);
    expect(parsed.tenant_id).toBe('ten-corp-001');
    expect(parsed.motivo_suspensao).toBe('inadimplencia');
    expect(parsed.suspender_imediatamente).toBe(true);
  });

  it('Q6.1.5: deve rejeitar suspensão com motivo inválido ou detalhes insuficientes (< 5 caracteres)', () => {
    const invalidReason = {
      tenant_id: 'ten-corp-001',
      motivo_suspensao: 'motivo_desconhecido' as any,
      detalhes: 'Justificativa detalhada com mais de cinco caracteres',
      suspender_imediatamente: true,
      suspenso_em: new Date().toISOString()
    };
    expect(suspenderTenantPayloadSchema.safeParse(invalidReason).success).toBe(false);

    const shortDetails = {
      tenant_id: 'ten-corp-001',
      motivo_suspensao: 'inadimplencia' as const,
      detalhes: 'abc',
      suspender_imediatamente: true,
      suspenso_em: new Date().toISOString()
    };
    expect(suspenderTenantPayloadSchema.safeParse(shortDetails).success).toBe(false);
  });

  it('Q6.1.6: deve validar todos os 4 motivos canônicos de suspensão previstos no contrato', () => {
    const allowedReasons = [
      'inadimplencia',
      'solicitacao_cliente',
      'violacao_termos',
      'auditoria_seguranca'
    ] as const;

    for (const motivo of allowedReasons) {
      const res = suspenderTenantPayloadSchema.safeParse({
        tenant_id: 'ten-corp-001',
        motivo_suspensao: motivo,
        detalhes: `Justificativa formal para motivo ${motivo}`,
        suspender_imediatamente: false,
        suspenso_em: new Date().toISOString()
      });
      expect(res.success).toBe(true);
    }
  });
});
