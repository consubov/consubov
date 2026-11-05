import React, { useState } from 'react';
import { useTranslation, Card, Button } from '@consubov/ui';
import { CapatazStore, CapatazState } from '../store/capatazStore';

interface CapatazCochoTabProps {
  store: CapatazStore;
  state: CapatazState;
}

export const CapatazCochoTab: React.FC<CapatazCochoTabProps> = ({ store, state }) => {
  const { t } = useTranslation();

  const [selectedPasto, setSelectedPasto] = useState(state.pastos[0]?.pasto_id || 'pasto-01');
  const [selectedLote, setSelectedLote] = useState(state.pastos[0]?.lote_id || 'lote-recria-01');
  const [selectedProduto, setSelectedProduto] = useState(state.produtos[0]?.produto_id || 'prod-sal-mineral-80');
  const [score, setScore] = useState<number>(2);
  const [bags, setBags] = useState<number>(4);
  const [bagWeight, setBagWeight] = useState<number>(25);
  const [cleanTrough, setCleanTrough] = useState<boolean>(true);
  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState(false);

  const scores = [0, 1, 2, 3, 4];

  const handlePastoChange = (pastoId: string) => {
    setSelectedPasto(pastoId);
    const pasto = state.pastos.find(p => p.pasto_id === pastoId);
    if (pasto) {
      setSelectedLote(pasto.lote_id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.registrarLeituraCocho({
      pasto_id: selectedPasto,
      lote_id: selectedLote,
      produto_id: selectedProduto,
      escore_cocho: score,
      sacos_fornecidos: Number(bags),
      peso_saco_kg: Number(bagWeight),
      cocho_limpo: cleanTrough,
      observacao: notes || undefined
    });

    setSuccessMessage(true);
    setTimeout(() => setSuccessMessage(false), 4000);
  };

  return (
    <div data-testid="capataz-cocho-tab">
      <Card elevation="elevated" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
          {t('capataz.cocho.title')}
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
            {t('capataz.cocho.saveSuccess')}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
            {/* Pasto */}
            <div>
              <label htmlFor="cocho-select-pasto" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.pastoLabel')}
              </label>
              <select
                id="cocho-select-pasto"
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
              <label htmlFor="cocho-select-lote" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.loteLabel')}
              </label>
              <select
                id="cocho-select-lote"
                value={selectedLote}
                onChange={e => setSelectedLote(e.target.value)}
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

            {/* Suplemento / Produto */}
            <div>
              <label htmlFor="cocho-select-produto" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.produtoLabel')}
              </label>
              <select
                id="cocho-select-produto"
                value={selectedProduto}
                onChange={e => setSelectedProduto(e.target.value)}
                aria-label={t('capataz.cocho.produtoLabel')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                {state.produtos.map(p => (
                  <option key={p.produto_id} value={p.produto_id}>
                    {p.nome_produto}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botoeira de Escores de Cocho (0 a 4) com toque amplo */}
          <div style={{ marginBottom: 20 }}>
            <span id="label-score-group" style={{ display: 'block', fontWeight: 700, marginBottom: 8, fontSize: '0.95rem', color: '#1E293B' }}>
              {t('capataz.cocho.scoreLabel')}
            </span>
            <div
              role="radiogroup"
              aria-labelledby="label-score-group"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}
            >
              {scores.map(s => {
                const isSelected = score === s;
                const scoreBgColors = ['#FEF3C7', '#DCFCE7', '#E0F2FE', '#F3E8FF', '#FEE2E2'];
                const scoreTextColors = ['#92400E', '#166534', '#075985', '#6B21A8', '#991B1B'];
                const scoreBorderColors = ['#F59E0B', '#22C55E', '#0EA5E9', '#A855F7', '#EF4444'];

                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setScore(s)}
                    style={{
                      padding: '14px 10px',
                      borderRadius: 8,
                      border: isSelected ? `3px solid ${scoreBorderColors[s]}` : '2px solid #E2E8F0',
                      backgroundColor: isSelected ? scoreBgColors[s] : '#FFFFFF',
                      color: isSelected ? scoreTextColors[s] : '#475569',
                      cursor: 'pointer',
                      textAlign: 'center',
                      minHeight: 56
                    }}
                  >
                    <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{s}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: 4 }}>
                      {t(`capataz.cocho.score${s}` as any)}
                    </div>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.825rem', color: '#64748B' }}>
              {t(`capataz.cocho.scoreDesc${score}` as any)}
            </p>
          </div>

          {/* Quantidade de Sacos e Limpeza */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label htmlFor="cocho-input-bags" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.bagsLabel')}
              </label>
              <input
                id="cocho-input-bags"
                type="number"
                min={0}
                step={0.5}
                value={bags}
                onChange={e => setBags(parseFloat(e.target.value) || 0)}
                aria-label={t('capataz.cocho.bagsLabel')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '1rem' }}
              />
            </div>

            <div>
              <label htmlFor="cocho-input-weight" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.bagWeight')}
              </label>
              <input
                id="cocho-input-weight"
                type="number"
                min={1}
                max={100}
                value={bagWeight}
                onChange={e => setBagWeight(parseFloat(e.target.value) || 25)}
                aria-label={t('capataz.cocho.bagWeight')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '1rem' }}
              />
            </div>

            <div>
              <label htmlFor="cocho-select-clean" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
                {t('capataz.cocho.cleanTrough')}
              </label>
              <select
                id="cocho-select-clean"
                value={cleanTrough ? 'yes' : 'no'}
                onChange={e => setCleanTrough(e.target.value === 'yes')}
                aria-label={t('capataz.cocho.cleanTrough')}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
              >
                <option value="yes">{t('capataz.cocho.cleanTroughYes')}</option>
                <option value="no">{t('capataz.cocho.cleanTroughNo')}</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="cocho-input-notes" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.9rem' }}>
              {t('capataz.cocho.notes')}
            </label>
            <textarea
              id="cocho-input-notes"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('capataz.cocho.notesPlaceholder')}
              aria-label={t('capataz.cocho.notes')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
            />
          </div>

          <Button type="submit" variant="primary" style={{ minHeight: 48, minWidth: 200, fontSize: '1rem' }}>
            {t('capataz.cocho.submit')}
          </Button>
        </form>
      </Card>

      {/* Histórico Recente de Leituras de Cocho */}
      {state.leiturasCocho.length > 0 && (
        <Card elevation="elevated">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px' }}>
            {t('capataz.tabs.cocho')} ({state.leiturasCocho.length})
          </h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {state.leiturasCocho.slice(0, 5).map(item => (
              <div
                key={item.leitura_id}
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
                    {state.pastos.find(p => p.pasto_id === item.pasto_id)?.nome_pasto || item.pasto_id}
                  </span>
                  <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
                  <span style={{ fontSize: '0.875rem', color: '#475569' }}>
                    {t(`capataz.cocho.score${item.escore_cocho}` as any)}
                  </span>
                  <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
                  <span style={{ fontSize: '0.875rem', color: '#64748B' }}>
                    {item.sacos_fornecidos} {t('capataz.cocho.bagsLabel')}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                  {item.registrado_em.slice(11, 16)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
