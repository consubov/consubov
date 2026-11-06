import React, { useState } from 'react';
import { useTranslation, Card, Button, Input } from '@consubov/ui';
import { GerenteState, GerenteStore } from '../store/gerenteStore';

export interface GerenteCochoAuditTabProps {
  state: GerenteState;
  store: GerenteStore;
}

export const GerenteCochoAuditTab: React.FC<GerenteCochoAuditTabProps> = ({ state, store }) => {
  const { t } = useTranslation();

  const [escoreRevisado, setEscoreRevisado] = useState('3');
  const [novoSacos, setNovoSacos] = useState('10');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAuditar = async (leituraId: string, pastoId: string, status: 'aprovado' | 'ajuste_necessario' | 'rejeitado') => {
    setErrorMessage(null);
    try {
    await store.aprovarLeituraCocho({
      leitura_cocho_id: leituraId,
      pasto_id: pastoId,
      status_aprovacao: status,
      escore_revisado: parseInt(escoreRevisado, 10),
      novo_fornecimento_sacos: parseFloat(novoSacos),
      justificativa_ajuste: 'Auditoria de rotina pelo gerente',
      aprovado_em: new Date().toISOString()
    });

    setFeedbackMessage(t('gerente.cochoAudit.success', 'Auditoria de cocho concluída com sucesso!'));
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : String(error)); }
  };

  return (
    <div data-testid="gerente-cocho-audit-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {errorMessage && <Card elevation="elevated" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', padding: 12 }}><p role="alert" style={{ margin: 0, color: '#991B1B' }}>{errorMessage}</p></Card>}
      {feedbackMessage && (
        <Card elevation="elevated" style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', padding: 12 }}>
          <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>{feedbackMessage}</p>
        </Card>
      )}

      <Card elevation="elevated">
        <h2 style={{ margin: '0 0 16px', fontSize: '1.2rem' }}>
          {t('gerente.cochoAudit.title', 'Auditoria de Ronda de Cocho')}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 16 }}>
          <Input
            label={t('gerente.cochoAudit.scoreReview', 'Escore Revisado (0 a 4)')}
            type="number"
            min="0"
            max="4"
            value={escoreRevisado}
            onChange={e => setEscoreRevisado(e.target.value)}
          />

          <Input
            label={t('gerente.cochoAudit.newBags', 'Novo Fornecimento de Sacos')}
            type="number"
            value={novoSacos}
            onChange={e => setNovoSacos(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.auditoriasCocho.map(item => (
            <Card key={item.leitura_cocho_id} elevation="flat" style={{ backgroundColor: '#F8FAFC', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1E293B' }}>{item.pasto_nome}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748B' }}>
                    <span>{t('domain.escore_cocho', 'Escore de Cocho')}: </span>
                    <strong>{item.escore_registrado}</strong>
                    <span> | {t('gerente.cochoAudit.newBags', 'Novo Fornecimento de Sacos')}: </span>
                    <strong>{item.sacos_fornecidos}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="primary"
                    onClick={() => handleAuditar(item.leitura_cocho_id, item.pasto_id, 'aprovado')}
                  >
                    {t('gerente.cochoAudit.approve', 'Aprovar Leitura')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleAuditar(item.leitura_cocho_id, item.pasto_id, 'ajuste_necessario')}
                  >
                    {t('gerente.cochoAudit.adjust', 'Solicitar Ajuste')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleAuditar(item.leitura_cocho_id, item.pasto_id, 'rejeitado')}
                  >
                    {t('gerente.cochoAudit.reject', 'Rejeitar Registro')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
