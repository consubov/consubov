import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { FabricaState, FabricaStore } from '../store/fabricaStore';

export interface FabricaBatidasTabProps {
  state: FabricaState;
  store: FabricaStore;
}

export const FabricaBatidasTab: React.FC<FabricaBatidasTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  // Iniciar batida
  const [selectedFormulaId, setSelectedFormulaId] = useState(state.formulas[0]?.formula_id ?? '');
  const [selectedMixerId, setSelectedMixerId] = useState(state.misturadores[0]?.misturador_id ?? '');
  const [ordemProducao, setOrdemProducao] = useState('op-2026-1105');
  const [quantidadePlanejada, setQuantidadePlanejada] = useState('2000');
  const [operadorId, setOperadorId] = useState('user-fabrica-synthetic');

  // Concluir batida
  const [selectedBatidaId, setSelectedBatidaId] = useState(state.batidas.find(b => b.status === 'em_andamento')?.batida_id ?? '');
  const [quantidadeRealizada, setQuantidadeRealizada] = useState('2005');
  const [tempoMistura, setTempoMistura] = useState('180');
  const [desvioPeso, setDesvioPeso] = useState('5');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleIniciarBatida = (e: React.FormEvent) => {
    e.preventDefault();
    store.iniciarBatida({
      batida_id: `batida-${Date.now()}`,
      ordem_producao_id: ordemProducao,
      formula_id: selectedFormulaId,
      misturador_id: selectedMixerId,
      quantidade_planejada_kg: parseFloat(quantidadePlanejada),
      operador_id: operadorId,
      iniciado_em: new Date().toISOString()
    });

    setFeedbackMessage(t('fabrica.batch.startSuccess', 'Batida iniciada e vinculada ao misturador!'));
  };

  const handleConcluirBatida = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatidaId) return;

    store.concluirBatida({
      batida_id: selectedBatidaId,
      quantidade_realizada_kg: parseFloat(quantidadeRealizada),
      tempo_mistura_segundos: parseInt(tempoMistura, 10),
      finalizado_em: new Date().toISOString(),
      desvio_peso_kg: parseFloat(desvioPeso)
    });

    setFeedbackMessage(t('fabrica.batch.concludeSuccess', 'Batida concluída e estoque baixado!'));
  };

  const batidasEmAndamento = state.batidas.filter(b => b.status === 'em_andamento');

  return (
    <div data-testid="fabrica-batidas-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Iniciar Nova Batida */}
      <Card elevation="elevated">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('fabrica.batch.startTitle', 'Iniciar Batida de Ração')}
        </h3>

        <form onSubmit={handleIniciarBatida} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('fabrica.batch.formula', 'Fórmula da Dieta')}
              </label>
              <select
                value={selectedFormulaId}
                onChange={e => setSelectedFormulaId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
              >
                {state.formulas.map(f => (
                  <option key={f.formula_id} value={f.formula_id}>{f.nome_formula}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('fabrica.batch.mixer', 'Misturador / Linha')}
              </label>
              <select
                value={selectedMixerId}
                onChange={e => setSelectedMixerId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
              >
                {state.misturadores.map(m => (
                  <option key={m.misturador_id} value={m.misturador_id}>{m.nome}</option>
                ))}
              </select>
            </div>

            <Input
              label={t('fabrica.batch.productionOrder', 'Ordem de Produção')}
              value={ordemProducao}
              onChange={e => setOrdemProducao(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.batch.plannedKg', 'Quantidade Planejada (kg)')}
              type="number"
              value={quantidadePlanejada}
              onChange={e => setQuantidadePlanejada(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('fabrica.batch.startTitle', 'Iniciar Batida de Ração')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Concluir Batida em Andamento */}
      {batidasEmAndamento.length > 0 && (
        <Card elevation="elevated" style={{ backgroundColor: '#F8FAFC' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
            {t('fabrica.batch.concludeTitle', 'Concluir Batida de Ração')}
          </h3>

          <form onSubmit={handleConcluirBatida} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                  {t('domain.batida', 'Batida de Ração')}
                </label>
                <select
                  value={selectedBatidaId}
                  onChange={e => setSelectedBatidaId(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
                >
                  {batidasEmAndamento.map(b => (
                    <option key={b.batida_id} value={b.batida_id}>{b.batida_id} ({b.ordem_producao_id})</option>
                  ))}
                </select>
              </div>

              <Input
                label={t('fabrica.batch.realizedKg', 'Quantidade Realizada (kg)')}
                type="number"
                value={quantidadeRealizada}
                onChange={e => setQuantidadeRealizada(e.target.value)}
                required
              />

              <Input
                label={t('fabrica.batch.mixTime', 'Tempo de Mistura (segundos)')}
                type="number"
                min="30"
                max="3600"
                value={tempoMistura}
                onChange={e => setTempoMistura(e.target.value)}
                required
              />

              <Input
                label={t('fabrica.batch.weightDeviation', 'Desvio de Peso (kg)')}
                type="number"
                value={desvioPeso}
                onChange={e => setDesvioPeso(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="secondary" type="submit">
                {t('fabrica.batch.concludeTitle', 'Concluir Batida de Ração')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Histórico Recente de Batidas */}
      <Card elevation="flat">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('fabrica.tabs.batches', 'Batidas e Misturadores')}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {state.batidas.map(b => (
            <div
              key={b.batida_id}
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
                <strong style={{ color: '#0F172A' }}>{b.batida_id}</strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                  <span>{t('fabrica.batch.productionOrder', 'Ordem de Produção')}: </span>
                  <strong>{b.ordem_producao_id}</strong>
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: b.status === 'concluida' ? '#DCFCE7' : '#FEF3C7',
                    color: b.status === 'concluida' ? '#166534' : '#92400E'
                  }}
                >
                  {b.status}
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                  <span>{b.quantidade_realizada_kg ?? b.quantidade_planejada_kg}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
