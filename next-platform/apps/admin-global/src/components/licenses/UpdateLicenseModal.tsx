import React, { useState } from 'react';
import { useTranslation, Button, Input, Dialog } from '@consubov/ui';
import { useAdminStore, type OffgridLicenseRecord } from '../../store/adminStore';

export interface UpdateLicenseModalProps {
  license: OffgridLicenseRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateLicenseModal: React.FC<UpdateLicenseModalProps> = ({
  license,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { atualizarLicenca } = useAdminStore();

  const [status, setStatus] = useState<'ativa' | 'suspensa' | 'revogada' | 'expirada'>('suspensa');
  const [justificativa, setJustificativa] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !license) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await atualizarLicenca({
        licenca_id: license.licenca_id,
        tenant_id: license.tenant_id,
        novo_status: status,
        justificativa: justificativa.trim(),
        atualizado_em: new Date().toISOString()
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
      title={t('admin.licenses.updateStatusTitle')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
          <strong>{license.licenca_id}</strong>
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
            {t('admin.licenses.statusLabel')}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            <option value="ativa">{t('admin.tenants.statusActive')}</option>
            <option value="suspensa">{t('admin.tenants.statusSuspended')}</option>
            <option value="revogada">{t('admin.tenants.statusCancelled')}</option>
            <option value="expirada">{t('admin.tenants.statusCancelled')}</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.licenses.justificationLabel')}
          </label>
          <Input
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            required
            minLength={5}
            maxLength={300}
            placeholder={t('admin.tenants.justificationPlaceholder')}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ border: '1px solid #CBD5E1' }}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || justificativa.trim().length < 5}
            style={{ backgroundColor: '#0284C7', color: '#FFFFFF' }}
          >
            {isSubmitting ? t('admin.common.loading') : t('admin.common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
