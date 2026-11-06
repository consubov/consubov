import { QuiescentForm } from '@consubov/ui';
import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { GerenteState, GerenteStore } from '../store/gerenteStore';

export interface GerenteCustosTabProps {
  state: GerenteState;
  store: GerenteStore;
}

export const GerenteCustosTab: React.FC<GerenteCustosTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [selectedLoteId, setSelectedLoteId] = useState(state.lotes[0]?.lote_id ?? '');
  const [periodoMes, setPeriodoMes] = useState('11');
  const [periodoAno, setPeriodoAno] = useState('2026');
  const [custoNutricao, setCustoNutricao] = useState('50000');
  const [custoSanidade, setCustoSanidade] = useState('12000');
  const [custoPastagem, setCustoPastagem] = useState('15000');
  const [custoOperacional, setCustoOperacional] = useState('10000');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApropriarCustos = async (e: React.FormEvent) => {
    e.preventDefault();
    const vNutricao = parseFloat(custoNutricao) || 0;
    const vSanidade = parseFloat(custoSanidade) || 0;
    const vPastagem = parseFloat(custoPastagem) || 0;
    const vOperacional = parseFloat(custoOperacional) || 0;
    const vTotal = vNutricao + vSanidade + vPastagem + vOperacional;

    setErrorMessage(null);
    try {
    await store.apropriarCustos({
      lote_id: selectedLoteId,
      periodo_mes: parseInt(periodoMes, 10),
      periodo_ano: parseInt(periodoAno, 10),
      valor_total_apropriado: vTotal,
      itens_apropriacao: [
        { centro_custo: 'Nutricao', valor: vNutricao },
        { centro_custo: 'Sanidade', valor: vSanidade },
        { centro_custo: 'Pastagem', valor: vPastagem },
        { centro_custo: 'Operacional', valor: vOperacional }
      ],
      data_apropriacao: new Date().toISOString()
    });

    setFeedbackMessage(t('gerente.costs.success', 'Apropriação de custos registrada no ledger!'));
      return true;
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  const totalCustos = state.custos.reduce((acc, c) => acc + c.valor, 0);

  return (
    <div data-testid="gerente-custos-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {errorMessage && <Card elevation="elevated" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', padding: 12 }}><p role="alert" style={{ margin: 0, color: '#991B1B' }}>{errorMessage}</p></Card>}
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Formulário de Apropriação Mensal */}
      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('gerente.costs.title', 'Apropriação Mensal de Custos')}
        </h2>

        <QuiescentForm onSubmit={handleApropriarCustos} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label htmlFor="gerente-custos-lote" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('gerente.lote.nome', 'Identificação do Lote')}
              </label>
              <select
                id="gerente-custos-lote"
                value={selectedLoteId}
                onChange={e => setSelectedLoteId(e.target.value)}
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
              value={custoNutricao}
              onChange={e => setCustoNutricao(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.healthLabel', 'Custo de Sanidade (R$)')}
              type="number"
              value={custoSanidade}
              onChange={e => setCustoSanidade(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.pastureLabel', 'Custo de Pastagem (R$)')}
              type="number"
              value={custoPastagem}
              onChange={e => setCustoPastagem(e.target.value)}
              required
            />

            <Input
              label={t('gerente.costs.operationalLabel', 'Custo Operacional (R$)')}
              type="number"
              value={custoOperacional}
              onChange={e => setCustoOperacional(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('gerente.custos.apropriar', 'Apropriar Custos Mensais')}
            </Button>
          </div>
        </QuiescentForm>
      </Card>

      {/* Relação de Centros de Custo Apropriados */}
      <Card elevation="flat">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('gerente.tabs.custos', 'Apropriação de Custos')}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {state.custos.map(item => (
            <Card key={item.centro_custo} elevation="elevated" style={{ backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#334155' }}>{item.centro_custo}</h3>
              <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0F172A' }}>
                <span>R$ {item.valor.toLocaleString()}</span>
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                <span>{item.percentual}%</span>
              </p>
            </Card>
          ))}
        </div>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600 }}>{t('gerente.costs.totalLabel', 'Valor Total Apropriado (R$)')}:</span>
          <strong style={{ fontSize: '1.1rem' }}>R$ {totalCustos.toLocaleString()}</strong>
        </div>
      </Card>
    </div>
  );
};
