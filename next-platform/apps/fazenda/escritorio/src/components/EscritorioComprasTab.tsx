import { QuiescentForm } from '@consubov/ui';
import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { EscritorioState, EscritorioStore } from '../store/escritorioStore';

export interface EscritorioComprasTabProps {
  state: EscritorioState;
  store: EscritorioStore;
}

export const EscritorioComprasTab: React.FC<EscritorioComprasTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [fornecedorId, setFornecedorId] = useState('forn-agropecuaria-central');
  const [produtoInsumoId, setProdutoInsumoId] = useState('insumo-milho-grao');
  const [quantidade, setQuantidade] = useState('20');
  const [unidade, setUnidade] = useState<'kg' | 'sc' | 'ton' | 'litro'>('ton');
  const [precoUnitario, setPrecoUnitario] = useState('1100');
  const [condicaoPagamento, setCondicaoPagamento] = useState<'a_vista' | '30_dias' | '30_60_dias' | 'safra'>('30_dias');
  const [previsaoEntrega, setPrevisaoEntrega] = useState('2026-11-20T00:00:00.000Z');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleEmitirPedido = (e: React.FormEvent) => {
    e.preventDefault();
    return store.criarPedidoCompra({
      pedido_compra_id: `pc-${Date.now()}`,
      fornecedor_id: fornecedorId,
      produto_insumo_id: produtoInsumoId,
      quantidade_pedida: parseFloat(quantidade),
      unidade,
      preco_unitario_brl: parseFloat(precoUnitario),
      condicao_pagamento: condicaoPagamento,
      previsao_entrega: previsaoEntrega
    }).then(() => { setFeedbackMessage(t('escritorio.purchase.success', 'Pedido de compra emitido com sucesso!')); return true; })
      .catch(() => undefined);
  };

  return (
    <div data-testid="escritorio-compras-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Formulário de Criação de Pedido */}
      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('escritorio.purchase.title', 'Criar Pedido de Compra')}
        </h2>

        <QuiescentForm onSubmit={handleEmitirPedido} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('escritorio.purchase.supplier', 'Fornecedor')}
              value={fornecedorId}
              onChange={e => setFornecedorId(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.purchase.product', 'Insumo / Produto')}
              value={produtoInsumoId}
              onChange={e => setProdutoInsumoId(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.purchase.quantity', 'Quantidade Pedida')}
              type="number"
              value={quantidade}
              onChange={e => setQuantidade(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.purchase.unitPrice', 'Preço Unitário (R$)')}
              type="number"
              value={precoUnitario}
              onChange={e => setPrecoUnitario(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('escritorio.purchase.title', 'Criar Pedido de Compra')}
            </Button>
          </div>
        </QuiescentForm>
      </Card>

      {/* Lista de Pedidos Emitidos */}
      <Card elevation="flat">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('escritorio.tabs.purchases', 'Pedidos de Compra')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.pedidosCompra.map(pc => (
            <Card key={pc.pedido_compra_id} elevation="elevated" style={{ backgroundColor: '#F8FAFC', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A' }}>
                    <span>{pc.produto_nome} - </span>
                    <span>{pc.fornecedor_nome}</span>
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                    <span>{t('escritorio.purchase.quantity', 'Quantidade Pedida')}: </span>
                    <strong>{pc.quantidade_pedida} {pc.unidade}</strong>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#334155' }}>
                    <span>R$ {(pc.quantidade_pedida * pc.preco_unitario_brl).toLocaleString()}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                    <span>{pc.previsao_entrega.slice(0, 10)}</span>
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
