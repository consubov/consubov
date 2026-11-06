import { QuiescentForm } from '@consubov/ui';
import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { EscritorioState, EscritorioStore } from '../store/escritorioStore';

export interface EscritorioLotesTabProps {
  state: EscritorioState;
  store: EscritorioStore;
}

export const EscritorioLotesTab: React.FC<EscritorioLotesTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  // Novo lote
  const [nomeLote, setNomeLote] = useState('Lote 03 - Novilhas Angus');
  const [pastoId, setPastoId] = useState('pasto-08');
  const [categoria, setCategoria] = useState<'bezerro' | 'bezerra' | 'garrote' | 'novilha' | 'boi_magro' | 'boi_gordo' | 'vaca_solteira' | 'vaca_prenha' | 'touro'>('novilha');
  const [quantidadeCabecas, setQuantidadeCabecas] = useState('180');
  const [pesoMedio, setPesoMedio] = useState('290');

  // Partição
  const [origemLoteId, setOrigemLoteId] = useState(state.lotes[0]?.lote_id ?? '');
  const [partNome1, setPartNome1] = useState('Lote A - Pesados');
  const [partCabecas1, setPartCabecas1] = useState('90');
  const [partPasto1, setPartPasto1] = useState('pasto-10');
  const [partNome2, setPartNome2] = useState('Lote B - Leves');
  const [partCabecas2, setPartCabecas2] = useState('90');
  const [partPasto2, setPartPasto2] = useState('pasto-11');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleCadastrarLote = (e: React.FormEvent) => {
    e.preventDefault();
    return store.cadastrarLote({
      lote_id: `lote-${Date.now()}`,
      fazenda_id: 'fazenda-01',
      pasto_id: pastoId,
      nome_lote: nomeLote,
      categoria_animal: categoria,
      quantidade_cabecas: parseInt(quantidadeCabecas, 10),
      peso_medio_inicial_kg: parseFloat(pesoMedio),
      data_entrada: new Date().toISOString()
    }).then(() => { setFeedbackMessage(t('escritorio.lots.success', 'Lote cadastrado e pronto para manejo!')); return true; })
      .catch(() => undefined);
  };

  const handleParticionarLote = (e: React.FormEvent) => {
    e.preventDefault();
    return store.particionarLote({
      lote_origem_id: origemLoteId,
      novos_lotes: [
        {
          nome_lote: partNome1,
          pasto_destino_id: partPasto1,
          quantidade_cabecas: parseInt(partCabecas1, 10),
          peso_medio_kg: 320
        },
        {
          nome_lote: partNome2,
          pasto_destino_id: partPasto2,
          quantidade_cabecas: parseInt(partCabecas2, 10),
          peso_medio_kg: 270
        }
      ],
      data_particao: new Date().toISOString()
    }).then(() => { setFeedbackMessage(t('escritorio.lots.splitSuccess', 'Particionamento de lote concluído com sucesso!')); return true; })
      .catch(() => undefined);
  };

  return (
    <div data-testid="escritorio-lotes-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      {/* Cadastro de Novo Lote */}
      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('escritorio.lots.createTitle', 'Cadastrar Novo Lote')}
        </h2>

        <QuiescentForm onSubmit={handleCadastrarLote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('escritorio.lots.name', 'Identificação do Lote')}
              value={nomeLote}
              onChange={e => setNomeLote(e.target.value)}
              required
            />

            <Input
              label={t('gerente.transfer.destLabel', 'Pasto de Destino')}
              value={pastoId}
              onChange={e => setPastoId(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.lots.headCount', 'Cabeças Iniciais')}
              type="number"
              value={quantidadeCabecas}
              onChange={e => setQuantidadeCabecas(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.lots.initialWeight', 'Peso Médio de Entrada (kg)')}
              type="number"
              value={pesoMedio}
              onChange={e => setPesoMedio(e.target.value)}
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

      {/* Desdobramento / Particionamento */}
      <Card elevation="flat">
        <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>
          {t('escritorio.lots.splitTitle', 'Particionar / Desdobrar Lote')}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#64748B' }}>
          {t('escritorio.lots.splitNotice', 'A partição cria novos lotes filhos e encerra ou reduz o lote pai.')}
        </p>

        <QuiescentForm onSubmit={handleParticionarLote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="escritorio-particao-lote-origem" style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: '0.875rem' }}>
              {t('gerente.transfer.originLabel', 'Pasto de Origem')}
            </label>
            <select
              id="escritorio-particao-lote-origem"
              value={origemLoteId}
              onChange={e => setOrigemLoteId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1' }}
            >
              {state.lotes.map(l => (
                <option key={l.lote_id} value={l.lote_id}>{l.nome_lote}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('escritorio.lots.name', 'Identificação do Lote')}
              value={partNome1}
              onChange={e => setPartNome1(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.lots.headCount', 'Cabeças Iniciais')}
              type="number"
              value={partCabecas1}
              onChange={e => setPartCabecas1(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.lots.name', 'Identificação do Lote')}
              value={partNome2}
              onChange={e => setPartNome2(e.target.value)}
              required
            />

            <Input
              label={t('escritorio.lots.headCount', 'Cabeças Iniciais')}
              type="number"
              value={partCabecas2}
              onChange={e => setPartCabecas2(e.target.value)}
              required
            />
          </div>

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
