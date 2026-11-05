import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { GerenteState, GerenteStore } from '../store/gerenteStore';

export interface GerenteLotesTabProps {
  state: GerenteState;
  store: GerenteStore;
}

export const GerenteLotesTab: React.FC<GerenteLotesTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [selectedLoteId, setSelectedLoteId] = useState(state.lotes[0]?.lote_id ?? '');
  const [pastoDestinoId, setPastoDestinoId] = useState('pasto-12');
  const [quantidadeAnimais, setQuantidadeAnimais] = useState('150');
  const [motivoMovimentacao, setMotivoMovimentacao] = useState<'rotacionamento' | 'apartacao' | 'tratamento' | 'pesagem' | 'venda' | 'confinamento'>('rotacionamento');
  const [responsavelNome, setResponsavelNome] = useState('Carlos Gestor');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleTransferirPasto = (e: React.FormEvent) => {
    e.preventDefault();
    const lote = state.lotes.find(l => l.lote_id === selectedLoteId);
    if (!lote) return;

    store.transferirPasto({
      lote_id: selectedLoteId,
      pasto_origem_id: lote.pasto_id,
      pasto_destino_id: pastoDestinoId,
      quantidade_animais: parseInt(quantidadeAnimais, 10),
      motivo_movimentacao: motivoMovimentacao,
      data_movimentacao: new Date().toISOString(),
      responsavel_nome: responsavelNome
    });

    setFeedbackMessage(t('gerente.transfer.success', 'Movimentação de lote confirmada com sucesso!'));
  };

  return (
    <div data-testid="gerente-lotes-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Formulário de Transferência de Pasto */}
      <Card elevation="elevated">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('gerente.transfer.title', 'Transferência de Pasto')}
        </h3>

        <form onSubmit={handleTransferirPasto} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
                {t('gerente.lote.nome', 'Identificação do Lote')}
              </label>
              <select
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
              label={t('gerente.transfer.destLabel', 'Pasto de Destino')}
              value={pastoDestinoId}
              onChange={e => setPastoDestinoId(e.target.value)}
              required
            />

            <Input
              label={t('gerente.transfer.headCountLabel', 'Quantidade de Cabeças')}
              type="number"
              value={quantidadeAnimais}
              onChange={e => setQuantidadeAnimais(e.target.value)}
              required
            />

            <Input
              label={t('gerente.transfer.responsibleLabel', 'Responsável pelo Manejo')}
              value={responsavelNome}
              onChange={e => setResponsavelNome(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('gerente.lote.transferir', 'Movimentar para Pasto')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Relação Detalhada dos Lotes */}
      <Card elevation="flat">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('gerente.tabs.lotes', 'Gestão de Lotes')}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {state.lotes.map(lote => (
            <Card key={lote.lote_id} elevation="elevated" style={{ backgroundColor: '#F8FAFC' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '1.05rem', color: '#1E293B' }}>{lote.nome_lote}</h4>
              <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#64748B' }}>
                <span>{t('gerente.transfer.originLabel', 'Pasto de Origem')}: </span>
                <strong style={{ color: '#334155' }}>{lote.pasto_nome}</strong>
              </p>
              <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#64748B' }}>
                <span>{t('gerente.lote.cabecas', 'Quantidade de Cabeças')}: </span>
                <strong style={{ color: '#334155' }}>{lote.quantidade_cabecas}</strong>
              </p>
              <p style={{ margin: '4px 0', fontSize: '0.875rem', color: '#64748B' }}>
                <span>{t('gerente.lote.peso_medio', 'Peso Médio (kg)')}: </span>
                <strong style={{ color: '#334155' }}>{lote.peso_medio_kg}</strong>
              </p>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
