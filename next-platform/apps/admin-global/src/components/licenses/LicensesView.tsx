import React, { useState } from 'react';
import { useTranslation, Button, Card } from '@consubov/ui';
import { useAdminStore, type OffgridLicenseRecord } from '../../store/adminStore';
import { OffgridLicenseModal } from './OffgridLicenseModal';
import { UpdateLicenseModal } from './UpdateLicenseModal';

export const LicensesView: React.FC = () => {
  const { t } = useTranslation();
  const { licenses } = useAdminStore();

  const [isOffgridModalOpen, setIsOffgridModalOpen] = useState(false);
  const [selectedLicenseForUpdate, setSelectedLicenseForUpdate] = useState<OffgridLicenseRecord | null>(null);

  const plansMatrix = [
    {
      name: t('admin.licenses.plansStarter'),
      modules: [t('admin.licenses.moduleGerente'), t('admin.licenses.moduleCapataz')],
      farms: 1,
      cattle: 3000
    },
    {
      name: t('admin.licenses.plansProfissional'),
      modules: [
        t('admin.licenses.moduleGerente'),
        t('admin.licenses.moduleCapataz'),
        t('admin.licenses.moduleEscritorio'),
        t('admin.licenses.moduleOffline')
      ],
      farms: 5,
      cattle: 20000
    },
    {
      name: t('admin.licenses.plansEnterprise'),
      modules: [
        t('admin.licenses.moduleGerente'),
        t('admin.licenses.moduleCapataz'),
        t('admin.licenses.moduleEscritorio'),
        t('admin.licenses.moduleFabrica'),
        t('admin.licenses.moduleRelatto'),
        t('admin.licenses.moduleOffline')
      ],
      farms: 50,
      cattle: 250000
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header View */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
            {t('admin.licenses.title')}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
            {t('admin.licenses.subtitle')}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsOffgridModalOpen(true)}
          style={{ backgroundColor: '#0284C7', color: '#FFFFFF', fontWeight: 700 }}
        >
          {t('admin.licenses.generateOffgridBtn')}
        </Button>
      </div>

      {/* Plan Matrix Cards */}
      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1E293B' }}>
        {t('admin.licenses.matrixTitle')}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {plansMatrix.map((p, idx) => (
          <Card key={idx} style={{ padding: '20px', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284C7', marginBottom: '8px' }}>
              {p.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '12px' }}>
              <span>{t('admin.tenants.colFarmsLimit')}: {p.farms}</span> • <span>{t('admin.tenants.colCattleLimit')}: {p.cattle.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {p.modules.map((m, mIdx) => (
                <div key={mIdx} style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#16A34A', fontWeight: 800 }}>✓</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Offgrid Licenses Table */}
      <h3 style={{ margin: '16px 0 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#1E293B' }}>
        {t('admin.licenses.offgridModalTitle')}
      </h3>

      <Card style={{ padding: 0, backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            role="table"
            aria-label={t('admin.licenses.title')}
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700 }}>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.common.id')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.licenses.offgridDeviceLabel')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.licenses.offgridDaysLabel')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.licenses.statusLabel')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {licenses.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                    {t('admin.tenants.empty')}
                  </td>
                </tr>
              ) : (
                licenses.map((lic) => (
                  <tr key={lic.licenca_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {lic.licenca_id}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: '#475569' }}>
                      {lic.dispositivo_id}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      {lic.dias_validade_offgrid}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: lic.status === 'ativa' ? '#DCFCE7' : '#FEE2E2',
                          color: lic.status === 'ativa' ? '#15803D' : '#B91C1C'
                        }}
                      >
                        {lic.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedLicenseForUpdate(lic)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #CBD5E1' }}
                      >
                        {t('admin.licenses.updateStatusTitle')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modais */}
      <OffgridLicenseModal
        isOpen={isOffgridModalOpen}
        onClose={() => setIsOffgridModalOpen(false)}
      />

      <UpdateLicenseModal
        license={selectedLicenseForUpdate}
        isOpen={Boolean(selectedLicenseForUpdate)}
        onClose={() => setSelectedLicenseForUpdate(null)}
      />
    </div>
  );
};
