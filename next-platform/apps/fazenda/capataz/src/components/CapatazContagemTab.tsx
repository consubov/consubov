import React, { useState } from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { CapatazStore, CapatazState } from '../store/capatazStore';

interface CapatazContagemTabProps {
  store: CapatazStore;
  state: CapatazState;
}

export const CapatazContagemTab: React.FC<CapatazContagemTabProps> = ({ store, state }) => {
  const { t } = useTranslation();

  const [selectedPasto, setSelectedPasto] = useState(state.pastos[0]?.pasto_id || 'pasto-01');
  const [selectedLote, setSelectedLote] = useState(state.pastos[0]?.lote_id || 'lote-recria-01');
  const initialHeads = state.lotes.find(l => l.lote_id === selectedLote)?.quantidade_cabecas || 120;
  const [headCount, setHeadCount] = useState<number>(initialHeads);
  const [calvesCount, setCalvesCount] = useState<number>(0);
  const [deathsCount, setDeathsCount] = useState<number>(0);
  const [mortalityCause, setMortalityCause] = useState('capataz.contagem.causeNone');
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState(false);

  const handlePastoChange = (pastoId: string) => {
    setSelectedPasto(pastoId);
    const pasto = state.pastos.find(p => p.pasto_id === pastoId);
    if (pasto) {
      setSelectedLote(pasto.lote_id);
      const lote = state.lotes.find(l => l.lote_id === pasto.lote_id);
      if (lote) {
        setHeadCount(lote.quantidade_cabecas);
      }
    }
  };

  const handleLoteChange = (loteId: string) => {
    setSelectedLote(loteId);
    const lote = state.lotes.find(l => l.lote_id === loteId);
    if (lote) {
      setHeadCount(lote.quantidade_cabecas);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.registrarContagemRebanho({
      pasto_id: selectedPasto,
      lote_id: selectedLote,
      quantidade_cabecas: Number(headCount),
      quantidade_bezerros: Number(calvesCount),
      quantidade_mortos: Number(deathsCount),
      causa_mortalidade: deathsCount > 0 ? t(mortalityCause as any) : undefined,
      observacoes: notes || undefined
    });

    setSuccessMessage(true);
    setTimeout(() => setSuccessMessage(false), 4000);
  };

  return (
    <div data-testid="capataz-contagem-tab">
      <Card elevation="elevated" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
          {t('capataz.contagem.title')}
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
            {t('capataz.contagem.success')}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Pasto */}
            <div>
              <label htmlFor="contagem-select-pasto" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.pastoLabel')}
              </label>
              <select
                id="contagem-select-pasto"
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

            {/* Lote */}
            <div>
              <label htmlFor="contagem-select-lote" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.loteLabel')}
              </label>
              <select
                id="contagem-select-lote"
                value={selectedLote}
                onChange={e => handleLoteChange(e.target.value)}
                aria-label={t('capataz.cocho.loteLabel')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                {state.lotes.map(l => (
                  <option key={l.lote_id} value={l.lote_id}>
                    {l.nome_lote} ({l.quantidade_cabecas})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Total de Cabeças */}
            <div>
              <label htmlFor="contagem-input-head" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.contagem.headCount')}
              </label>
              <input
                id="contagem-input-head"
                type="number"
                min={0}
                value={headCount}
                onChange={e => setHeadCount(parseInt(e.target.value, 10) || 0)}
                aria-label={t('capataz.contagem.headCount')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '1.1rem', fontWeight: 700 }}
              />
            </div>

            {/* Bezerros ao Pé */}
            <div>
              <label htmlFor="contagem-input-calves" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.contagem.calvesCount')}
              </label>
              <input
                id="contagem-input-calves"
                type="number"
                min={0}
                value={calvesCount}
                onChange={e => setCalvesCount(parseInt(e.target.value, 10) || 0)}
                aria-label={t('capataz.contagem.calvesCount')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '1rem' }}
              />
            </div>

            {/* Baixas / Mortes */}
            <div>
              <label htmlFor="contagem-input-deaths" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.contagem.deathsCount')}
              </label>
              <input
                id="contagem-input-deaths"
                type="number"
                min={0}
                value={deathsCount}
                onChange={e => setDeathsCount(parseInt(e.target.value, 10) || 0)}
                aria-label={t('capataz.contagem.deathsCount')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '1rem', color: deathsCount > 0 ? '#DC2626' : undefined }}
              />
            </div>
          </div>

          {/* Causa Provável de Morte (quando houver baixas) */}
          {deathsCount > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="contagem-select-cause" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem', color: '#DC2626' }}>
                {t('capataz.contagem.cause')}
              </label>
              <select
                id="contagem-select-cause"
                value={mortalityCause}
                onChange={e => setMortalityCause(e.target.value)}
                aria-label={t('capataz.contagem.cause')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #F87171', fontSize: '0.95rem' }}
              >
                <option value="capataz.contagem.causeSnake">{t('capataz.contagem.causeSnake')}</option>
                <option value="capataz.contagem.causeDisease">{t('capataz.contagem.causeDisease')}</option>
                <option value="capataz.contagem.causeAccident">{t('capataz.contagem.causeAccident')}</option>
                <option value="capataz.contagem.causeUnknown">{t('capataz.contagem.causeUnknown')}</option>
              </select>
            </div>
          )}

          {/* Observações */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="contagem-input-notes" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              {t('capataz.contagem.notes')}
            </label>
            <textarea
              id="contagem-input-notes"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('capataz.contagem.notesPlaceholder')}
              aria-label={t('capataz.contagem.notes')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
            />
          </div>

          <Button type="submit" variant="primary" style={{ minHeight: 48, minWidth: 200, fontSize: '1rem' }}>
            {t('capataz.contagem.submit')}
          </Button>
        </form>
      </Card>

      {/* Histórico Recente de Contagens */}
      {state.contagens.length > 0 && (
        <Card elevation="elevated">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px' }}>
            {t('capataz.tabs.contagem')} ({state.contagens.length})
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {state.contagens.slice(0, 5).map(c => (
              <div
                key={c.contagem_id}
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>
                    {state.pastos.find(p => p.pasto_id === c.pasto_id)?.nome_pasto || c.pasto_id}
                  </span>
                  <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
                  <span style={{ fontSize: '0.875rem', color: '#1E293B', fontWeight: 600 }}>
                    {c.quantidade_cabecas} {t('capataz.contagem.headCount')}
                  </span>
                  {c.quantidade_mortos > 0 && (
                    <>
                      <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
                      <span style={{ fontSize: '0.875rem', color: '#DC2626', fontWeight: 600 }}>
                        {c.quantidade_mortos} {t('capataz.contagem.deathsCount')}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  {c.data_contagem.slice(11, 16)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
