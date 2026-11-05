import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { EscritorioState, EscritorioStore } from '../store/escritorioStore';
import { ItemNotaFiscal } from '@consubov/contracts';

export interface EscritorioNotasTabProps {
  state: EscritorioState;
  store: EscritorioStore;
}

export const EscritorioNotasTab: React.FC<EscritorioNotasTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [numeroNf, setNumeroNf] = useState('10500');
  const [serie, setSerie] = useState('1');
  const [chaveNfe, setChaveNfe] = useState('35261112345678000195550010000105001234567890');
  const [fornecedorNome, setFornecedorNome] = useState('NutriAgro Nutrição Animal Ltda');
  const [fornecedorDoc, setFornecedorDoc] = useState('12345678000195');
  const [valorTotal, setValorTotal] = useState('36000');

  // Item padrão
  const [itemDescricao, setItemDescricao] = useState('Milho Grão Padrão');
  const [itemQuantidade, setItemQuantidade] = useState('30000');
  const [itemUnidade, setItemUnidade] = useState<'kg' | 'sc' | 'ton' | 'un' | 'litro' | 'cabeca'>('kg');
  const [itemValorUnit, setItemValorUnit] = useState('1.20');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegistrarNota = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validação estrita da chave de 44 dígitos
    const cleanKey = chaveNfe.trim();
    if (!/^[0-9]{44}$/.test(cleanKey)) {
      setErrorMessage(t('api.error.invalid_domain_payload', 'Chave da NF-e deve conter exatamente 44 dígitos numéricos'));
      return;
    }

    const q = parseFloat(itemQuantidade) || 0;
    const vu = parseFloat(itemValorUnit) || 0;
    const itemTotal = q * vu;

    const item: ItemNotaFiscal = {
      produto_descricao: itemDescricao,
      quantidade: q,
      unidade_medida: itemUnidade,
      valor_unitario_brl: vu,
      valor_total_item_brl: itemTotal
    };

    store.registrarNotaFiscal({
      nota_fiscal_id: `nfe-${Date.now()}`,
      numero_nf: numeroNf,
      serie: serie,
      chave_acesso_nfe: cleanKey,
      fornecedor_cnpj_cpf: fornecedorDoc,
      fornecedor_nome: fornecedorNome,
      valor_total_brl: parseFloat(valorTotal) || itemTotal,
      data_emissao: new Date().toISOString(),
      itens: [item]
    });

    setFeedbackMessage(t('escritorio.invoice.success', 'Nota fiscal registrada com sucesso no ledger!'));
  };

  return (
    <div data-testid="escritorio-notas-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {errorMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', padding: 12 }}>
          <p style={{ margin: 0, color: '#991B1B', fontWeight: 600 }}>{errorMessage}</p>
        </Card>
      )}

      {/* Formulário de Registro de Entrada */}
      <Card elevation="elevated">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('escritorio.invoice.title', 'Registrar Entrada de Nota Fiscal')}
        </h3>

        <form onSubmit={handleRegistrarNota} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('escritorio.invoice.number', 'Número da NF')}
              value={numeroNf}
              onChange={e => setNumeroNf(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.invoice.series', 'Série')}
              value={serie}
              onChange={e => setSerie(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.invoice.supplierDoc', 'CNPJ / CPF do Fornecedor')}
              value={fornecedorDoc}
              onChange={e => setFornecedorDoc(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.invoice.totalValue', 'Valor Total (R$)')}
              type="number"
              value={valorTotal}
              onChange={e => setValorTotal(e.target.value)}
              required
            />
          </div>

          <Input
            label={t('escritorio.invoice.supplierName', 'Nome do Fornecedor')}
            value={fornecedorNome}
            onChange={e => setFornecedorNome(e.target.value)}
            required
          />

          <Input
            label={t('escritorio.invoice.accessKey', 'Chave de Acesso (44 dígitos)')}
            value={chaveNfe}
            onChange={e => setChaveNfe(e.target.value)}
            maxLength={44}
            required
          />

          {/* Dados do Item */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '1.05rem', color: '#334155' }}>
              {t('escritorio.invoice.itemsTitle', 'Itens da Nota Fiscal')}
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Input
                label={t('escritorio.purchase.product', 'Insumo / Produto')}
                value={itemDescricao}
                onChange={e => setItemDescricao(e.target.value)}
                required
              />

              <Input
                label={t('escritorio.purchase.quantity', 'Quantidade Pedida')}
                type="number"
                value={itemQuantidade}
                onChange={e => setItemQuantidade(e.target.value)}
                required
              />

              <Input
                label={t('escritorio.purchase.unitPrice', 'Preço Unitário (R$)')}
                type="number"
                step="0.01"
                value={itemValorUnit}
                onChange={e => setItemValorUnit(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit">
              {t('escritorio.invoice.title', 'Registrar Entrada de Nota Fiscal')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Relação de Notas Cadastradas */}
      <Card elevation="flat">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('escritorio.tabs.invoices', 'Notas Fiscais (NF-e)')}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.notasFiscais.map(nf => (
            <Card key={nf.nota_fiscal_id} elevation="elevated" style={{ backgroundColor: '#F8FAFC', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A' }}>
                    <span>#{nf.numero_nf} - </span>
                    <span>{nf.fornecedor_nome}</span>
                  </h4>
                  <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: '#64748B', wordBreak: 'break-all' }}>
                    <span>{t('escritorio.invoice.accessKey', 'Chave de Acesso (44 dígitos)')}: </span>
                    <code>{nf.chave_acesso_nfe}</code>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#15803D' }}>
                    <span>R$ {nf.valor_total_brl.toLocaleString()}</span>
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                    <span>{nf.data_emissao.slice(0, 10)}</span>
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
