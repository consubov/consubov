import React, { useState } from 'react';
import { useTranslation, Button, Input, Dialog } from '@consubov/ui';
import { useAdminStore } from '../../store/adminStore';

export interface OffgridLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OffgridLicenseModal: React.FC<OffgridLicenseModalProps> = ({
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { tenants, gerarLicencaOffgrid } = useAdminStore();

  const [tenantId, setTenantId] = useState(tenants[0]?.tenant_id || '');
  const [fazendaId, setFazendaId] = useState('faz-lab-001');
  const [dispositivoId, setDispositivoId] = useState('00000000-0000-4000-8000-000000000001');
  const [diasValidade, setDiasValidade] = useState(30);
  const [modulos, setModulos] = useState<('gerente' | 'capataz' | 'escritorio' | 'fabrica')[]>(['capataz', 'gerente']);
  const [chavePublica, setChavePublica] = useState('PUBKEY-CONSUBOV-LAB-TEST-SIGNATURE-KEY-HEX-ABCDEF-0123456789');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleModulo = (mod: 'gerente' | 'capataz' | 'escritorio' | 'fabrica') => {
    if (modulos.includes(mod)) {
      if (modulos.length > 1) {
        setModulos(modulos.filter(m => m !== mod));
      }
    } else {
      setModulos([...modulos, mod]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const licencaId = `lic-off-${Date.now()}`;
      const rec = await gerarLicencaOffgrid({
        licenca_id: licencaId,
        tenant_id: tenantId,
        fazenda_id: fazendaId,
        dispositivo_id: dispositivoId,
        dias_validade_offgrid: Number(diasValidade),
        modulos_autorizados: modulos,
        chave_assinatura_publica: chavePublica,
        gerado_em: new Date().toISOString()
      });

      setGeneratedToken(rec.token_jwt || rec.licenca_id);
      setIsSubmitting(false);
    } catch (err: any) {
      setIsSubmitting(false);
      if (err?.errors && Array.isArray(err.errors) && err.errors[0]?.message) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg(err.message || 'Erro');
      }
    }
  };

  const handleClose = () => {
    setGeneratedToken(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={t('admin.licenses.offgridModalTitle')}
    >
      {generatedToken ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            role="status"
            style={{
              padding: '12px 16px',
              backgroundColor: '#DCFCE7',
              border: '1px solid #86EFAC',
              borderRadius: '8px',
              color: '#15803D',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            {t('admin.licenses.offgridSuccess')}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              {t('admin.licenses.tokenCopied')}
            </label>
            <textarea
              readOnly
              value={generatedToken}
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                backgroundColor: '#F8FAFC'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <Button type="button" onClick={handleClose}>
              {t('admin.common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              {t('admin.tenants.colTradeName')}
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
              {t('admin.licenses.offgridDeviceLabel')}
            </label>
            <Input
              value={dispositivoId}
              onChange={(e) => setDispositivoId(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
              {t('admin.licenses.offgridDaysLabel')}
            </label>
            <Input
              type="number"
              min={1}
              max={90}
              value={diasValidade}
              onChange={(e) => setDiasValidade(Number(e.target.value))}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              {t('admin.licenses.matrixTitle')}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={modulos.includes('capataz')}
                  onChange={() => toggleModulo('capataz')}
                />
                {t('admin.licenses.moduleCapataz')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={modulos.includes('gerente')}
                  onChange={() => toggleModulo('gerente')}
                />
                {t('admin.licenses.moduleGerente')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={modulos.includes('escritorio')}
                  onChange={() => toggleModulo('escritorio')}
                />
                {t('admin.licenses.moduleEscritorio')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={modulos.includes('fabrica')}
                  onChange={() => toggleModulo('fabrica')}
                />
                {t('admin.licenses.moduleFabrica')}
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
              {t('admin.licenses.offgridKeyLabel')}
            </label>
            <Input
              value={chavePublica}
              onChange={(e) => setChavePublica(e.target.value)}
              required
              minLength={32}
              maxLength={512}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button type="button" variant="ghost" onClick={handleClose} style={{ border: '1px solid #CBD5E1' }}>
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              style={{ backgroundColor: '#0284C7', color: '#FFFFFF' }}
            >
              {isSubmitting ? t('admin.common.loading') : t('admin.licenses.offgridGenerateBtn')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
};
