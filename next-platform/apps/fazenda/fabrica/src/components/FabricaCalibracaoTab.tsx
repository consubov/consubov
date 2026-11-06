import { QuiescentForm } from '@consubov/ui';
import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { FabricaState, FabricaStore } from '../store/fabricaStore';

export interface FabricaCalibracaoTabProps {
  state: FabricaState;
  store: FabricaStore;
}

export const FabricaCalibracaoTab: React.FC<FabricaCalibracaoTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [balancaId, setBalancaId] = useState('balanca-misturador-01');
  const [equipamentoTipo, setEquipamentoTipo] = useState<'balanca_silos' | 'balanca_ensaque' | 'celula_carga_misturador' | 'balanca_rodoviaria'>('celula_carga_misturador');
  const [pesoPadrao, setPesoPadrao] = useState('1000');
  const [pesoMedido, setPesoMedido] = useState('1001.5');
  const [certNumero, setCertNumero] = useState('CERT-INMETRO-2026-99');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCalibrar = async (e: React.FormEvent) => {
    e.preventDefault();
    const padrao = parseFloat(pesoPadrao) || 1000;
    const medido = parseFloat(pesoMedido) || 1000;
    const desvio = Math.round(((medido - padrao) / padrao) * 10000) / 100;

    setErrorMessage(null);
    try {
    await store.calibrarBalanca({
      balanca_id: balancaId,
      equipamento_tipo: equipamentoTipo,
      peso_padrao_afericao_kg: padrao,
      peso_medido_kg: medido,
      desvio_percentual: desvio,
      calibrado: Math.abs(desvio) <= 1.0,
      certificado_afericao_numero: certNumero,
      proxima_calibracao_data: '2026-12-01T00:00:00.000Z',
      data_calibracao: new Date().toISOString()
    });

    setFeedbackMessage(t('fabrica.calibration.success', 'Calibração registrada e balança liberada!'));
      return true;
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  return (
    <div data-testid="fabrica-calibracao-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {errorMessage && <Card elevation="elevated" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', padding: 12 }}><p role="alert" style={{ margin: 0, color: '#991B1B' }}>{errorMessage}</p></Card>}
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Formulário de Calibração */}
      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('fabrica.calibration.title', 'Calibração de Balança / Célula')}
        </h2>

        <QuiescentForm onSubmit={handleCalibrar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('fabrica.calibration.equipment', 'Tipo de Equipamento')}
              value={balancaId}
              onChange={e => setBalancaId(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.calibration.standardWeight', 'Peso Padrão de Aferição (kg)')}
              type="number"
              value={pesoPadrao}
              onChange={e => setPesoPadrao(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.calibration.measuredWeight', 'Peso Medido pela Balança (kg)')}
              type="number"
              step="0.1"
              value={pesoMedido}
              onChange={e => setPesoMedido(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.calibration.certNumber', 'Certificado de Aferição')}
              value={certNumero}
              onChange={e => setCertNumero(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('action.confirm', 'Confirmar')}
            </Button>
          </div>
        </QuiescentForm>
      </Card>

      {/* Histórico de Calibrações */}
      <Card elevation="flat">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('fabrica.tabs.calibration', 'Balança e Calibração')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.calibracoes.map(c => (
            <div
              key={c.balanca_id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
                borderRadius: 6,
                border: '1px solid #E2E8F0'
              }}
            >
              <div>
                <strong style={{ color: '#0F172A' }}>{c.balanca_id}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                  <span>{t('fabrica.calibration.standardWeight', 'Peso Padrão de Aferição (kg)')}: </span>
                  <strong>{c.peso_padrao_kg}</strong>
                  <span> | {t('fabrica.calibration.measuredWeight', 'Peso Medido pela Balança (kg)')}: </span>
                  <strong>{c.peso_medido_kg}</strong>
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: c.calibrado ? '#DCFCE7' : '#FEF2F2',
                    color: c.calibrado ? '#166534' : '#991B1B'
                  }}
                >
                  <span>{c.desvio_pct}%</span>
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                  <span>{c.data_calibracao.slice(0, 10)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
