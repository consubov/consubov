import { QuiescentForm } from '@consubov/ui';
import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { EscritorioState, EscritorioStore } from '../store/escritorioStore';

export interface EscritorioFinanceiroTabProps {
  state: EscritorioState;
  store: EscritorioStore;
}

export const EscritorioFinanceiroTab: React.FC<EscritorioFinanceiroTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [loteId, setLoteId] = useState(state.lotes[0]?.lote_id ?? '');
  const [periodoMes, setPeriodoMes] = useState('11');
  const [periodoAno, setPeriodoAno] = useState('2026');
  const [cNutricao, setCNutricao] = useState('45000');
  const [cSanidade, setCSanidade] = useState('11000');
  const [cPastagem, setCPastagem] = useState('14000');
  const [cOperacional, setCOperacional] = useState('9500');

  // Relatório
  const [relatorioTipo, setRelatorioTipo] = useState<'dre_fazenda' | 'custo_por_arroba_produzida' | 'extrato_insumos' | 'fluxo_caixa_operacional'>('dre_fazenda');
  const [formato, setFormato] = useState<'json' | 'pdf' | 'csv'>('json');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleFecharCusto = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(cNutricao) || 0;
    const s = parseFloat(cSanidade) || 0;
    const p = parseFloat(cPastagem) || 0;
    const o = parseFloat(cOperacional) || 0;
    const total = n + s + p + o;

    return store.fecharCustoLote({
      lote_id: loteId,
      periodo_mes: parseInt(periodoMes, 10),
      periodo_ano: parseInt(periodoAno, 10),
      custo_nutricao_brl: n,
      custo_sanidade_brl: s,
      custo_pastagem_brl: p,
      custo_operacional_brl: o,
      valor_total_apropriado_brl: total,
      fechado_em: new Date().toISOString()
    }).then(() => { setFeedbackMessage(t('gerente.costs.success', 'Apropriação de custos registrada no ledger!')); return true; })
      .catch(() => undefined);
  };

  const handleEmitirRelatorio = (e: React.FormEvent) => {
    e.preventDefault();
    return store.emitirRelatorio({
      relatorio_id: `rel-${Date.now()}`,
      tipo_relatorio: relatorioTipo,
      data_inicio: '2026-11-01T00:00:00.000Z',
      data_fim: '2026-11-30T23:59:59.000Z',
      incluir_projecoes: true,
      formato_exportacao: formato
    }).then(() => { setFeedbackMessage(t('escritorio.report.downloadReady', 'Solicitação de relatório registrada.')); return true; })
      .catch(() => undefined);
  };

  return (
    <div data-testid="escritorio-financeiro-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Formulário de Fechamento de Custos */}
      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('escritorio.tabs.closing', 'Fechamento Financeiro')}
        </h2>

        <QuiescentForm onSubmit={handleFecharCusto} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="escritorio-fechamento-lote" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('escritorio.lots.name', 'Identificação do Lote')}
              </label>
              <select
                id="escritorio-fechamento-lote"
                value={loteId}
                onChange={e => setLoteId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
              >
                {state.lotes.map(l => (
                  <option key={l.lote_id} value={l.lote_id}>{l.nome_lote}</option>
                ))}
              </select>
            </div>

            <Input
              label={t('gerente.costs.periodLabel', 'Mês / Ano de Competência')}
              value={periodoMes}
              onChange={e => setPeriodoMes(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.nutritionLabel', 'Custo de Nutrição (R$)')}
              type="number"
              value={cNutricao}
              onChange={e => setCNutricao(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.healthLabel', 'Custo de Sanidade (R$)')}
              type="number"
              value={cSanidade}
              onChange={e => setCSanidade(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.pastureLabel', 'Custo de Pastagem (R$)')}
              type="number"
              value={cPastagem}
              onChange={e => setCPastagem(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.operationalLabel', 'Custo Operacional (R$)')}
              type="number"
              value={cOperacional}
              onChange={e => setCOperacional(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('action.confirm', 'Confirmar')}
            </Button>
          </div>
        </QuiescentForm>
      </Card>

      {/* Emissão de Relatório */}
      <Card elevation="flat">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('escritorio.report.generateTitle', 'Emitir Relatório Financeiro')}
        </h2>

        <QuiescentForm onSubmit={handleEmitirRelatorio} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" type="submit">
            {t('escritorio.report.generateTitle', 'Emitir Relatório Financeiro')}
          </Button>
        </QuiescentForm>
      </Card>


    </div>
  );
};
