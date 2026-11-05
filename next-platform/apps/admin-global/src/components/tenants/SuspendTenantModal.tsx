import React, { useState } from 'react';
import { useTranslation, Button, Input, Dialog } from '@consubov/ui';
import { useAdminStore, type TenantRecord } from '../../store/adminStore';

export interface SuspendTenantModalProps {
  tenant: TenantRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SuspendTenantModal: React.FC<SuspendTenantModalProps> = ({
  tenant,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { suspenderTenant } = useAdminStore();

  const [motivo, setMotivo] = useState<'inadimplencia' | 'solicitacao_cliente' | 'violacao_termos' | 'auditoria_seguranca'>('inadimplencia');
  const [detalhes, setDetalhes] = useState('');
  const [suspenderImediatamente, setSuspenderImediatamente] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !tenant) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await suspenderTenant({
        tenant_id: tenant.tenant_id,
        motivo_suspensao: motivo,
        detalhes: detalhes.trim(),
        suspender_imediatamente: suspenderImediatamente,
        suspenso_em: new Date().toISOString()
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
      title={t('admin.tenants.suspendModalTitle')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          <strong>{tenant.nome_fantasia}</strong> ({tenant.razao_social})
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
            {t('admin.tenants.suspendReasonLabel')}
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
            <option value="inadimplencia">{t('admin.tenants.reasonInadimplencia')}</option>
            <option value="solicitacao_cliente">{t('admin.tenants.reasonSolicitacao')}</option>
            <option value="violacao_termos">{t('admin.tenants.reasonViolacao')}</option>
            <option value="auditoria_seguranca">{t('admin.tenants.reasonAuditoria')}</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.tenants.suspendDetailsLabel')}
          </label>
          <Input
            value={detalhes}
            onChange={(e) => setDetalhes(e.target.value)}
            required
            minLength={5}
            maxLength={500}
            placeholder={t('admin.tenants.justificationPlaceholder')}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            id="suspend-immediate-check"
            type="checkbox"
            checked={suspenderImediatamente}
            onChange={(e) => setSuspenderImediatamente(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="suspend-immediate-check" style={{ fontSize: '0.85rem', color: '#334155' }}>
            {t('admin.tenants.suspendImmediateLabel')}
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
            {isSubmitting ? t('admin.common.loading') : t('admin.tenants.confirmSuspendBtn')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
