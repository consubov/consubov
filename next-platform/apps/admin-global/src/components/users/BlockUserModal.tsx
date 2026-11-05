import React, { useState } from 'react';
import { useTranslation, Button, Input, Dialog } from '@consubov/ui';
import { useAdminStore, type GlobalUserRecord } from '../../store/adminStore';

export interface BlockUserModalProps {
  user: GlobalUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BlockUserModal: React.FC<BlockUserModalProps> = ({
  user,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { bloquearUsuario } = useAdminStore();

  const [motivo, setMotivo] = useState<'inadimplencia' | 'desligamento_colaborador' | 'violacao_seguranca' | 'solicitacao_gestor' | 'manutencao_cadastral'>('violacao_seguranca');
  const [detalhes, setDetalhes] = useState('');
  const [revogarSessoes, setRevogarSessoes] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await bloquearUsuario({
        usuario_id: user.usuario_id,
        tenant_id: user.tenant_id,
        motivo_bloqueio: motivo,
        detalhes_bloqueio: detalhes.trim(),
        revogar_sessoes_ativas: revogarSessoes,
        bloqueado_em: new Date().toISOString()
      });

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      if (err?.errors && Array.isArray(err.errors) && err.errors[0]?.message) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg(err.message || 'Erro');
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.users.blockModalTitle')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          <strong>{user.nome}</strong> ({user.email})
        </p>

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '6px',
              color: '#B91C1C',
              fontSize: '0.85rem'
            }}
          >
            {errorMsg}
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.users.blockReasonLabel')}
          </label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as any)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            <option value="inadimplencia">{t('admin.users.reasonInadimplencia')}</option>
            <option value="desligamento_colaborador">{t('admin.users.reasonDesligamento')}</option>
            <option value="violacao_seguranca">{t('admin.users.reasonViolacao')}</option>
            <option value="solicitacao_gestor">{t('admin.users.reasonSolicitacao')}</option>
            <option value="manutencao_cadastral">{t('admin.users.reasonManutencao')}</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.users.blockDetailsLabel')}
          </label>
          <Input
            value={detalhes}
            onChange={(e) => setDetalhes(e.target.value)}
            required
            minLength={5}
            maxLength={500}
            placeholder={t('admin.users.blockDetailsPlaceholder')}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            id="revoke-sessions-check"
            type="checkbox"
            checked={revogarSessoes}
            onChange={(e) => setRevogarSessoes(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="revoke-sessions-check" style={{ fontSize: '0.85rem', color: '#334155' }}>
            {t('admin.users.revokeSessionsLabel')}
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ border: '1px solid #CBD5E1' }}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || detalhes.trim().length < 5}
            style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
          >
            {isSubmitting ? t('admin.common.loading') : t('admin.users.confirmBlockBtn')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
