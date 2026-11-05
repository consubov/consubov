import React, { useState } from 'react';
import { useTranslation, Button, Input, Dialog } from '@consubov/ui';
import { useAdminStore, type GlobalUserRecord } from '../../store/adminStore';

export interface LinkUserModalProps {
  user: GlobalUserRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LinkUserModal: React.FC<LinkUserModalProps> = ({
  user,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { tenants, vincularUsuario } = useAdminStore();

  const [tenantId, setTenantId] = useState(tenants[0]?.tenant_id || '');
  const [fazendaId, setFazendaId] = useState('faz-lab-001');
  const [profileId, setProfileId] = useState<'gerente' | 'capataz' | 'escritorio' | 'fabrica' | 'administrador'>('gerente');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await vincularUsuario({
        usuario_id: user.usuario_id,
        tenant_id: tenantId,
        fazenda_id: fazendaId,
        profile_id: profileId,
        ativo: true,
        vinculado_em: new Date().toISOString()
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
      title={t('admin.users.linkModalTitle')}
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
            {t('admin.users.linkTenantLabel')}
          </label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            {tenants.map(t => (
              <option key={t.tenant_id} value={t.tenant_id}>
                {t.nome_fantasia}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.users.linkFarmLabel')}
          </label>
          <Input
            value={fazendaId}
            onChange={(e) => setFazendaId(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.users.linkProfileLabel')}
          </label>
          <select
            value={profileId}
            onChange={(e) => setProfileId(e.target.value as any)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            <option value="gerente">{t('admin.licenses.moduleGerente')}</option>
            <option value="capataz">{t('admin.licenses.moduleCapataz')}</option>
            <option value="escritorio">{t('admin.licenses.moduleEscritorio')}</option>
            <option value="fabrica">{t('admin.licenses.moduleFabrica')}</option>
            <option value="administrador">{t('admin.users.roleSuperAdmin')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <Button type="button" variant="ghost" onClick={onClose} style={{ border: '1px solid #CBD5E1' }}>
            {t('admin.common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            style={{ backgroundColor: '#0284C7', color: '#FFFFFF' }}
          >
            {isSubmitting ? t('admin.common.loading') : t('admin.users.confirmLinkBtn')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
