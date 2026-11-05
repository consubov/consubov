import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { FabricaState, FabricaStore } from '../store/fabricaStore';
import { IngredienteFormula } from '@consubov/contracts';

export interface FabricaFormulasTabProps {
  state: FabricaState;
  store: FabricaStore;
}

export const FabricaFormulasTab: React.FC<FabricaFormulasTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [nomeFormula, setNomeFormula] = useState('Proteinado Águas 40%');
  const [tipoRaca, setTipoRaca] = useState<'mineral_linha_branca' | 'proteinado_aguas' | 'proteinado_seca' | 'proteico_energetico' | 'racao_confinamento' | 'nucleo'>('proteinado_aguas');
  const [tamanhoBatida, setTamanhoBatida] = useState('2000');

  // Ingredientes
  const [ing1Pct, setIng1Pct] = useState('50');
  const [ing2Pct, setIng2Pct] = useState('30');
  const [ing3Pct, setIng3Pct] = useState('15');
  const [ing4Pct, setIng4Pct] = useState('5');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalInclusao = (parseFloat(ing1Pct) || 0) + (parseFloat(ing2Pct) || 0) + (parseFloat(ing3Pct) || 0) + (parseFloat(ing4Pct) || 0);
  const is100Percent = Math.abs(totalInclusao - 100) < 0.01;

  const handleSalvarFormula = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!is100Percent) {
      setErrorMessage(t('api.error.invalid_domain_payload', 'Soma das porcentagens de inclusão deve ser exatamente 100%'));
      return;
    }

    const ingredientes: IngredienteFormula[] = [
      { materia_prima_id: 'mp-milho', nome_ingrediente: 'Milho Moído', porcentagem_inclusao: parseFloat(ing1Pct) },
      { materia_prima_id: 'mp-soja', nome_ingrediente: 'Farelo de Soja 46%', porcentagem_inclusao: parseFloat(ing2Pct) },
      { materia_prima_id: 'mp-nucleo', nome_ingrediente: 'Núcleo Mineral', porcentagem_inclusao: parseFloat(ing3Pct) },
      { materia_prima_id: 'mp-ureia', nome_ingrediente: 'Ureia Pecuária', porcentagem_inclusao: parseFloat(ing4Pct) }
    ];

    try {
      store.salvarFormula({
        formula_id: `form-${Date.now()}`,
        nome_formula: nomeFormula,
        tipo_raca_destino: tipoRaca,
        tamanho_batida_padrao_kg: parseFloat(tamanhoBatida),
        ativo: true,
        ingredientes
      });
      setFeedbackMessage(t('fabrica.formula.success', 'Fórmula nutricional salva no catálogo!'));
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  return (
    <div data-testid="fabrica-formulas-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

      {/* Formulário de Nova Fórmula */}
      <Card elevation="elevated">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('fabrica.formula.newTitle', 'Cadastrar Nova Fórmula')}
        </h3>

        <form onSubmit={handleSalvarFormula} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <Input
              label={t('fabrica.formula.name', 'Nome da Fórmula')}
              value={nomeFormula}
              onChange={e => setNomeFormula(e.target.value)}
              required
            />

            <Input
              label={t('fabrica.formula.batchSize', 'Batida Padrão (kg)')}
              type="number"
              value={tamanhoBatida}
              onChange={e => setTamanhoBatida(e.target.value)}
              required
            />
          </div>

          {/* Composição Percentual com Validação Matemática */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#334155' }}>
                {t('fabrica.formula.ingredients', 'Composição de Ingredientes')}
              </h4>

              <span
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '4px 10px',
                  borderRadius: 6,
                  backgroundColor: is100Percent ? '#DCFCE7' : '#FEE2E2',
                  color: is100Percent ? '#166534' : '#991B1B'
                }}
              >
                <span>{totalInclusao}% / 100%</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Input
                label={t('fabrica.formula.inclusionPct', '% de Inclusão')}
                type="number"
                value={ing1Pct}
                onChange={e => setIng1Pct(e.target.value)}
                required
              />

              <Input
                label={t('fabrica.formula.inclusionPct', '% de Inclusão')}
                type="number"
                value={ing2Pct}
                onChange={e => setIng2Pct(e.target.value)}
                required
              />

              <Input
                label={t('fabrica.formula.inclusionPct', '% de Inclusão')}
                type="number"
                value={ing3Pct}
                onChange={e => setIng3Pct(e.target.value)}
                required
              />

              <Input
                label={t('fabrica.formula.inclusionPct', '% de Inclusão')}
                type="number"
                value={ing4Pct}
                onChange={e => setIng4Pct(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" type="submit" disabled={!is100Percent}>
              {t('fabrica.formula.salvar', 'Salvar Fórmula Nutricional')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Relação de Fórmulas no Catálogo */}
      <Card elevation="flat">
        <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>
          {t('fabrica.tabs.formulas', 'Fórmulas Nutricionais')}
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {state.formulas.map(f => (
            <Card key={f.formula_id} elevation="elevated" style={{ backgroundColor: '#F8FAFC' }}>
              <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#0F172A' }}>{f.nome_formula}</h4>
              <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#64748B' }}>
                <span>{t('fabrica.formula.batchSize', 'Batida Padrão (kg)')}: </span>
                <strong>{f.tamanho_batida_padrao_kg}</strong>
              </p>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 8 }}>
                {f.ingredientes.map(ing => (
                  <div key={ing.materia_prima_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '2px 0' }}>
                    <span style={{ color: '#475569' }}>{ing.nome_ingrediente}</span>
                    <strong style={{ color: '#0F172A' }}>{ing.porcentagem_inclusao}%</strong>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
