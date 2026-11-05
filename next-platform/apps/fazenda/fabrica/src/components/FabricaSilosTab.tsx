import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { FabricaState, FabricaStore } from '../store/fabricaStore';

export interface FabricaSilosTabProps {
  state: FabricaState;
  store: FabricaStore;
}

export const FabricaSilosTab: React.FC<FabricaSilosTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  // Ajuste de silo
  const [selectedSiloId, setSelectedSiloId] = useState(state.silos[0]?.silo_id ?? '');
  const [quantidadeAjustada, setQuantidadeAjustada] = useState('40000');
  const [justificativa, setJustificativa] = useState('Inventário físico mensal aferido');
  const [tipoAjuste, setTipoAjuste] = useState<'inventario_fisico' | 'perda_umidade' | 'avaria' | 'sobra_processo' | 'acerto_balanca'>('inventario_fisico');

  // Recebimento
  const [destSiloId, setDestSiloId] = useState(state.silos[0]?.silo_id ?? '');
  const [pesoRecebido, setPesoRecebido] = useState('15000');
  const [loteFornecedor, setLoteFornecedor] = useState('LOTE-2026-NUTR');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleAjustarSilo = (e: React.FormEvent) => {
    e.preventDefault();
    const silo = state.silos.find(s => s.silo_id === selectedSiloId);
    if (!silo) return;

    store.ajustarEstoque({
      materia_prima_id: silo.materia_prima_id,
      silo_id: selectedSiloId,
      quantidade_anterior_kg: silo.nivel_atual_kg,
      quantidade_ajustada_kg: parseFloat(quantidadeAjustada),
      tipo_ajuste: tipoAjuste,
      justificativa,
      ajustado_em: new Date().toISOString()
    });

    setFeedbackMessage(t('fabrica.stock.success', 'Saldo do silo atualizado sob controle de concorrência!'));
  };

  const handleReceberCarga = (e: React.FormEvent) => {
    e.preventDefault();
    const silo = state.silos.find(s => s.silo_id === destSiloId);
    if (!silo) return;

    store.receberMateriaPrima({
      recebimento_id: `rec-${Date.now()}`,
      materia_prima_id: silo.materia_prima_id,
      silo_destino_id: destSiloId,
      quantidade_kg: parseFloat(pesoRecebido),
      lote_fornecedor: loteFornecedor,
      recebido_em: new Date().toISOString()
    });

    setFeedbackMessage(t('fabrica.receiving.success', 'Carga de matéria-prima estocada no silo!'));
  };

  return (
    <div data-testid="fabrica-silos-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Monitoramento dos Silos */}
      <Card elevation="elevated">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('fabrica.tabs.silos', 'Estoque de Silos')}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {state.silos.map(s => (
            <Card key={s.silo_id} elevation="flat" style={{ backgroundColor: '#F8FAFC', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A' }}>{s.nome_silo}</h4>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0369A1' }}>
                  <span>{s.ocupacao_pct}%</span>
                </span>
              </div>

              <p style={{ margin: '6px 0 2px', fontSize: '0.85rem', color: '#64748B' }}>
                <span>{t('fabrica.silo.produto', 'Produto Armazenado')}: </span>
                <strong style={{ color: '#334155' }}>{s.materia_prima_nome}</strong>
              </p>

              <div style={{ width: '100%', height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden', margin: '8px 0' }}>
                <div style={{ width: `${Math.min(100, s.ocupacao_pct)}%`, height: '100%', backgroundColor: '#0284C7' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748B' }}>
                <span>{s.nivel_atual_kg}</span>
                <span>/ {s.capacidade_total_kg}</span>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Ajuste de Inventário de Silo */}
      <Card elevation="flat">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('fabrica.stock.adjustTitle', 'Ajuste de Estoque de Silo')}
        </h3>

        <form onSubmit={handleAjustarSilo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('fabrica.stock.silo', 'Silo de Armazenagem')}
              </label>
              <select
                value={selectedSiloId}
                onChange={e => setSelectedSiloId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
              >
                {state.silos.map(s => (
                  <option key={s.silo_id} value={s.silo_id}>{s.nome_silo} - {s.materia_prima_nome}</option>
                ))}
              </select>
            </div>

            <Input
              label={t('fabrica.stock.adjustedKg', 'Novo Estoque Aferido (kg)')}
              type="number"
              value={quantidadeAjustada}
              onChange={e => setQuantidadeAjustada(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.stock.justification', 'Justificativa Técnica')}
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="secondary" type="submit">
              {t('fabrica.silo.ajustar', 'Ajustar Inventário do Silo')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Recebimento de Carga */}
      <Card elevation="flat">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('fabrica.receiving.title', 'Receber Carga de Matéria-Prima')}
        </h3>

        <form onSubmit={handleReceberCarga} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('fabrica.receiving.destSilo', 'Silo de Destino')}
              </label>
              <select
                value={destSiloId}
                onChange={e => setDestSiloId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
              >
                {state.silos.map(s => (
                  <option key={s.silo_id} value={s.silo_id}>{s.nome_silo} ({s.materia_prima_nome})</option>
                ))}
              </select>
            </div>

            <Input
              label={t('fabrica.receiving.weightKg', 'Peso Líquido Recebido (kg)')}
              type="number"
              value={pesoRecebido}
              onChange={e => setPesoRecebido(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.receiving.supplierLot', 'Lote do Fornecedor')}
              value={loteFornecedor}
              onChange={e => setLoteFornecedor(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('fabrica.materia.receber', 'Receber Carga de Matéria-Prima')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
