import React, { useState } from 'react';
import { useTranslation, Button, Input, Dialog } from '@consubov/ui';
import { useAdminStore } from '../../store/adminStore';

export interface NewTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewTenantModal: React.FC<NewTenantModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { criarTenant } = useAdminStore();

  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [plano, setPlano] = useState<'starter' | 'profissional' | 'enterprise' | 'custom'>('profissional');
  const [limiteFazendas, setLimiteFazendas] = useState(5);
  const [limiteCabecas, setLimiteCabecas] = useState(10000);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNome, setAdminNome] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const tenantId = `ten-${Date.now()}`;
      const cleanCnpj = cnpj.replace(/\D/g, '');

      await criarTenant({
        tenant_id: tenantId,
        razao_social: razaoSocial.trim(),
        nome_fantasia: nomeFantasia.trim(),
        cnpj: cleanCnpj,
        plano,
        limite_fazendas: Number(limiteFazendas),
        limite_cabecas: Number(limiteCabecas),
        admin_email: adminEmail.trim(),
        admin_nome: adminNome.trim()
      });

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      if (err?.errors && Array.isArray(err.errors) && err.errors[0]?.message) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg(err.message || 'Erro de validação');
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.tenants.newModalTitle')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '0.875rem', color: '#64748B' }}>
          {t('admin.tenants.newModalSubtitle')}
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
            {t('admin.tenants.razaoSocialLabel')}
          </label>
          <Input
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            required
            minLength={3}
            maxLength={120}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.tenants.nomeFantasiaLabel')}
          </label>
          <Input
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.tenants.cnpjLabel')}
          </label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            required
            placeholder="00000000000000"
            maxLength={18}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            {t('admin.tenants.planoLabel')}
          </label>
          <select
            value={plano}
            onChange={(e) => setPlano(e.target.value as any)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            <option value="starter">{t('admin.licenses.plansStarter')}</option>
            <option value="profissional">{t('admin.licenses.plansProfissional')}</option>
            <option value="enterprise">{t('admin.licenses.plansEnterprise')}</option>
            <option value="custom">{t('admin.licenses.plansCustom')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
              {t('admin.tenants.limiteFazendasLabel')}
            </label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={limiteFazendas}
              onChange={(e) => setLimiteFazendas(Number(e.target.value))}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
              {t('admin.tenants.limiteCabecasLabel')}
            </label>
            <Input
              type="number"
              min={1}
              max={500000}
              value={limiteCabecas}
              onChange={(e) => setLimiteCabecas(Number(e.target.value))}
              required
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
              {t('admin.tenants.adminNomeLabel')}
            </label>
            <Input
              value={adminNome}
              onChange={(e) => setAdminNome(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
              {t('admin.tenants.adminEmailLabel')}
            </label>
            <Input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>
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
            {isSubmitting ? t('admin.common.loading') : t('admin.tenants.createBtn')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
