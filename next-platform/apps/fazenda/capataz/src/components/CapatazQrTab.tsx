import React, { useState } from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { CapatazStore, CapatazState } from '../store/capatazStore';

interface CapatazQrTabProps {
  store: CapatazStore;
  state: CapatazState;
}

export const CapatazQrTab: React.FC<CapatazQrTabProps> = ({ store, state }) => {
  const { t } = useTranslation();

  const [selectedPasto, setSelectedPasto] = useState(state.pastos[0]?.pasto_id || 'pasto-01');
  const [scannedCode, setScannedCode] = useState(state.pastos[0]?.qr_code_esperado || 'PASTO-01-MOMBACA-SEDE');
  const [heightCm, setHeightCm] = useState<number>(state.pastos[0]?.altura_media_cm || 65);
  const [forageScore, setForageScore] = useState<number>(3);
  const [waterCondition, setWaterCondition] = useState<'otima' | 'boa' | 'regular' | 'ruim'>('boa');
  const [troughCondition, setTroughCondition] = useState<'otimo' | 'bom' | 'danificado' | 'precisa_reparo'>('otimo');
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('capataz.qr.reasonPlaque');
  const [successMessage, setSuccessMessage] = useState(false);

  const handleSimulateScan = () => {
    const pasto = state.pastos.find(p => p.pasto_id === selectedPasto);
    if (pasto) {
      setScannedCode(pasto.qr_code_esperado);
      setHeightCm(pasto.altura_media_cm);
      setIsManualOverride(false);
    }
  };

  const handlePastoChange = (pastoId: string) => {
    setSelectedPasto(pastoId);
    const pasto = state.pastos.find(p => p.pasto_id === pastoId);
    if (pasto) {
      setScannedCode(pasto.qr_code_esperado);
      setHeightCm(pasto.altura_media_cm);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.registrarLeituraQrPasto({
      pasto_id: selectedPasto,
      altura_media_cm: Number(heightCm),
      qr_code_lido: scannedCode,
      escore_massa_forragem: Number(forageScore),
      condicao_aguada: waterCondition,
      condicao_cocho: troughCondition,
      justificativa_falha_qr: isManualOverride ? t(overrideReason as any) : undefined
    });

    setSuccessMessage(true);
    setTimeout(() => setSuccessMessage(false), 4000);
  };

  const currentPasto = state.pastos.find(p => p.pasto_id === selectedPasto);

  return (
    <div data-testid="capataz-qr-tab">
      <Card elevation="elevated" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
          {t('capataz.qr.title')}
        </h2>

        {successMessage && (
          <div
            role="status"
            style={{
              padding: '12px 16px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #10B981',
              borderRadius: 6,
              color: '#065F46',
              marginBottom: 16,
              fontWeight: 600
            }}
          >
            {t('capataz.qr.saveSuccess')}
          </div>
        )}

        <div style={{ padding: 16, backgroundColor: '#F1F5F9', borderRadius: 8, marginBottom: 20 }}>
          <p style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#334155' }}>
            {t('capataz.qr.scanPrompt')}
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSimulateScan}
              style={{ minHeight: 44 }}
            >
              {t('capataz.qr.simulateScan')}
            </Button>

            {scannedCode && (
              <span
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  borderRadius: 6,
                  color: '#15803D',
                  fontWeight: 700,
                  fontSize: '0.875rem'
                }}
              >
                {scannedCode}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Seletor de Pasto */}
            <div>
              <label htmlFor="qr-select-pasto" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.pastoLabel')}
              </label>
              <select
                id="qr-select-pasto"
                value={selectedPasto}
                onChange={e => handlePastoChange(e.target.value)}
                aria-label={t('capataz.cocho.pastoLabel')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                {state.pastos.map(p => (
                  <option key={p.pasto_id} value={p.pasto_id}>
                    {p.nome_pasto}
                  </option>
                ))}
              </select>
            </div>

            {/* Altura Média do Pasto (cm) */}
            <div>
              <label htmlFor="qr-input-height" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.qr.heightCm')}
              </label>
              <input
                id="qr-input-height"
                type="number"
                min={5}
                max={250}
                value={heightCm}
                onChange={e => setHeightCm(parseFloat(e.target.value) || 0)}
                aria-label={t('capataz.qr.heightCm')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '1rem' }}
              />
            </div>

            {/* Massa de Forragem (1 a 5) */}
            <div>
              <label htmlFor="qr-select-forage" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.qr.forageScore')}
              </label>
              <select
                id="qr-select-forage"
                value={forageScore}
                onChange={e => setForageScore(parseInt(e.target.value, 10) || 3)}
                aria-label={t('capataz.qr.forageScore')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            {/* Condição da Aguada */}
            <div>
              <label htmlFor="qr-select-water" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.qr.waterCondition')}
              </label>
              <select
                id="qr-select-water"
                value={waterCondition}
                onChange={e => setWaterCondition(e.target.value as any)}
                aria-label={t('capataz.qr.waterCondition')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                <option value="otima">{t('capataz.qr.waterOptimal')}</option>
                <option value="boa">{t('capataz.qr.waterGood')}</option>
                <option value="regular">{t('capataz.qr.waterRegular')}</option>
                <option value="ruim">{t('capataz.qr.waterPoor')}</option>
              </select>
            </div>

            {/* Condição do Cocho */}
            <div>
              <label htmlFor="qr-select-trough" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.qr.troughCondition')}
              </label>
              <select
                id="qr-select-trough"
                value={troughCondition}
                onChange={e => setTroughCondition(e.target.value as any)}
                aria-label={t('capataz.qr.troughCondition')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                <option value="otimo">{t('capataz.qr.troughOptimal')}</option>
                <option value="bom">{t('capataz.qr.troughGood')}</option>
                <option value="danificado">{t('capataz.qr.troughDamaged')}</option>
                <option value="precisa_reparo">{t('capataz.qr.troughNeedsRepair')}</option>
              </select>
            </div>
          </div>

          {/* Entrada Manual com Justificativa */}
          <div style={{ marginBottom: 20, padding: 14, border: '1px dashed #CBD5E1', borderRadius: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isManualOverride}
                onChange={e => setIsManualOverride(e.target.checked)}
              />
              {t('capataz.qr.manualOverride')}
            </label>

            {isManualOverride && (
              <div style={{ marginTop: 12 }}>
                <label htmlFor="qr-select-reason" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.875rem' }}>
                  {t('capataz.qr.overrideReason')}
                </label>
                <select
                  id="qr-select-reason"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  aria-label={t('capataz.qr.overrideReason')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                >
                  <option value="capataz.qr.reasonPlaque">{t('capataz.qr.reasonPlaque')}</option>
                  <option value="capataz.qr.reasonWeather">{t('capataz.qr.reasonWeather')}</option>
                  <option value="capataz.qr.reasonDark">{t('capataz.qr.reasonDark')}</option>
                </select>
              </div>
            )}
          </div>

          <Button type="submit" variant="primary" style={{ minHeight: 48, minWidth: 200, fontSize: '1rem' }}>
            {t('capataz.qr.confirmReading')}
          </Button>
        </form>
      </Card>
    </div>
  );
};
