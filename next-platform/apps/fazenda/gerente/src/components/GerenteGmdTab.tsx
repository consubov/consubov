import { QuiescentForm } from '@consubov/ui';
import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { GerenteState, GerenteStore } from '../store/gerenteStore';

export interface GerenteGmdTabProps {
  state: GerenteState;
  store: GerenteStore;
}

export const GerenteGmdTab: React.FC<GerenteGmdTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [selectedLoteId, setSelectedLoteId] = useState(state.lotes[0]?.lote_id ?? '');
  const [gmdAlvo, setGmdAlvo] = useState('1.40');
  const [pesoFinalAlvo, setPesoFinalAlvo] = useState('520');
  const [dataAbate, setDataAbate] = useState('2026-12-20T00:00:00.000Z');
  const [estrategia, setEstrategia] = useState<'pasto_aguas' | 'pasto_seca' | 'semi_confinamento' | 'confinamento'>('pasto_aguas');
  const [consumoEsperado, setConsumoEsperado] = useState('1500');

  // Ajuste de dieta
  const [produtoNutricional, setProdutoNutricional] = useState('prod-proteinado-aguas');
  const [novaMetaConsumo, setNovaMetaConsumo] = useState('1800');
  const [motivoAjuste, setMotivoAjuste] = useState('Ajuste para acelerar curva de ganho');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSalvarMetas = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
    await store.definirMetas({
      lote_id: selectedLoteId,
      gmd_alvo_kg_dia: parseFloat(gmdAlvo),
      peso_final_alvo_kg: parseFloat(pesoFinalAlvo),
      data_alvo_abate: dataAbate,
      estrategia_nutricional: estrategia,
      consumo_esperado_g_cab_dia: parseFloat(consumoEsperado)
    });
    setFeedbackMessage(t('gerente.metas.success', 'Metas zootécnicas atualizadas com sucesso!'));
      return true;
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  const handleAjustarDieta = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
    await store.ajustarDieta({
      lote_id: selectedLoteId,
      produto_id: produtoNutricional,
      nova_meta_consumo_g_cab_dia: parseFloat(novaMetaConsumo),
      periodo_inicio: new Date().toISOString(),
      motivo_ajuste: motivoAjuste
    });
    setFeedbackMessage(t('gerente.gmd.success', 'Ajuste de dieta registrado com sucesso!'));
      return true;
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  return (
    <div data-testid="gerente-gmd-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {errorMessage && <Card elevation="elevated" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', padding: 12 }}><p role="alert" style={{ margin: 0, color: '#991B1B' }}>{errorMessage}</p></Card>}
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Formulário de Definição de Metas */}
      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('gerente.metas.title', 'Definir Metas do Lote')}
        </h2>

        <QuiescentForm onSubmit={handleSalvarMetas} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="gerente-gmd-lote" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
              {t('gerente.lote.nome', 'Identificação do Lote')}
            </label>
            <select
              id="gerente-gmd-lote"
              value={selectedLoteId}
              onChange={e => setSelectedLoteId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
            >
              {state.lotes.map(l => (
                <option key={l.lote_id} value={l.lote_id}>{l.nome_lote}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('gerente.metas.gmdTargetLabel', 'GMD Alvo (kg/dia)')}
              type="number"
              step="0.05"
              value={gmdAlvo}
              onChange={e => setGmdAlvo(e.target.value)}
              required
            />

            <Input
              label={t('gerente.metas.finalWeightLabel', 'Peso Final Alvo (kg)')}
              type="number"
              value={pesoFinalAlvo}
              onChange={e => setPesoFinalAlvo(e.target.value)}
              required
            />

            <Input
              label={t('gerente.metas.dailyIntakeLabel', 'Consumo Esperado (g/cab/dia)')}
              type="number"
              value={consumoEsperado}
              onChange={e => setConsumoEsperado(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('action.save', 'Salvar')}
            </Button>
          </div>
        </QuiescentForm>
      </Card>

      {/* Formulário de Ajuste de Dieta e Curva */}
      <Card elevation="flat">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('gerente.gmd.adjustTitle', 'Ajustar Dieta e Curva de GMD')}
        </h2>

        <QuiescentForm onSubmit={handleAjustarDieta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Input
              label={t('gerente.gmd.productLabel', 'Produto Nutricional')}
              value={produtoNutricional}
              onChange={e => setProdutoNutricional(e.target.value)}
              required
            />

            <Input
              label={t('gerente.gmd.newIntakeTargetLabel', 'Nova Meta de Consumo (g/cab/dia)')}
              type="number"
              value={novaMetaConsumo}
              onChange={e => setNovaMetaConsumo(e.target.value)}
              required
            />
          </div>

          <Input
            label={t('gerente.gmd.reasonLabel', 'Motivo do Ajuste')}
            placeholder={t('gerente.gmd.reasonPlaceholder', 'Descreva o motivo técnico da alteração da dieta...')}
            value={motivoAjuste}
            onChange={e => setMotivoAjuste(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" type="submit">
              {t('action.confirm', 'Confirmar')}
            </Button>
          </div>
        </QuiescentForm>
      </Card>
    </div>
  );
};
