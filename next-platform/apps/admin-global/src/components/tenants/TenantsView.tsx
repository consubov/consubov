import React, { useState, useMemo } from 'react';
import { useTranslation, Button, Input, Card } from '@consubov/ui';
import { useAdminStore, type TenantRecord } from '../../store/adminStore';
import { NewTenantModal } from './NewTenantModal';
import { SuspendTenantModal } from './SuspendTenantModal';

export const TenantsView: React.FC = () => {
  const { t } = useTranslation();
  const { tenants, reativarTenant } = useAdminStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativo' | 'suspenso' | 'cancelado'>('todos');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedTenantForSuspend, setSelectedTenantForSuspend] = useState<TenantRecord | null>(null);

  // KPIs
  const kpis = useMemo(() => {
    const totalTenants = tenants.length;
    const activeTenants = tenants.filter(t => t.status === 'ativo').length;
    const suspendedTenants = tenants.filter(t => t.status === 'suspenso').length;
    const totalFarms = tenants.reduce((acc, curr) => acc + (curr.limite_fazendas || 0), 0);
    const totalCattle = tenants.reduce((acc, curr) => acc + (curr.limite_cabecas || 0), 0);

    return { totalTenants, activeTenants, suspendedTenants, totalFarms, totalCattle };
  }, [tenants]);

  // Filtro
  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant => {
      const matchesStatus = statusFilter === 'todos' || tenant.status === statusFilter;
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch = !term ||
        tenant.nome_fantasia.toLowerCase().includes(term) ||
        tenant.razao_social.toLowerCase().includes(term) ||
        tenant.cnpj.includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [tenants, statusFilter, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header View */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
            {t('admin.tenants.title')}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
            {t('admin.tenants.subtitle')}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          style={{ backgroundColor: '#0284C7', color: '#FFFFFF', fontWeight: 700 }}
        >
          {t('admin.tenants.newTenantBtn')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
            {t('admin.tenants.totalTenants')}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
            {kpis.totalTenants}
          </div>
        </Card>

        <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 600 }}>
            {t('admin.tenants.activeTenants')}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            {kpis.activeTenants}
          </div>
        </Card>

        <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>
            {t('admin.tenants.suspendedTenants')}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
            {kpis.suspendedTenants}
          </div>
        </Card>

        <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#0284C7', fontWeight: 600 }}>
            {t('admin.tenants.totalFarms')}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284C7', marginTop: '4px' }}>
            {kpis.totalFarms}
          </div>
        </Card>

        <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', color: '#D97706', fontWeight: 600 }}>
            {t('admin.tenants.totalCattle')}
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
            {kpis.totalCattle.toLocaleString()}
          </div>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('admin.tenants.searchPlaceholder')}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
            {t('admin.tenants.filterStatus')}
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem',
              color: '#334155'
            }}
          >
            <option value="todos">{t('admin.common.all')}</option>
            <option value="ativo">{t('admin.tenants.statusActive')}</option>
            <option value="suspenso">{t('admin.tenants.statusSuspended')}</option>
            <option value="cancelado">{t('admin.tenants.statusCancelled')}</option>
          </select>
        </div>
      </Card>

      {/* Tenants Table */}
      <Card style={{ padding: 0, backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            role="table"
            aria-label={t('admin.tenants.title')}
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700 }}>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colTradeName')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colCorporateName')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colCnpj')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colPlan')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colFarmsLimit')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colCattleLimit')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colStatus')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.tenants.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                    {t('admin.tenants.empty')}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((item) => (
                  <tr key={item.tenant_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                      {item.nome_fantasia}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {item.razao_social}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748B', fontFamily: 'monospace' }}>
                      {item.cnpj}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#0284C7' }}>
                        {item.plano}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      {item.limite_fazendas}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      {item.limite_cabecas.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: item.status === 'ativo' ? '#DCFCE7' : '#FEE2E2',
                          color: item.status === 'ativo' ? '#15803D' : '#B91C1C'
                        }}
                      >
                        {item.status === 'ativo' ? t('admin.tenants.statusActive') : t('admin.tenants.statusSuspended')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {item.status === 'ativo' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedTenantForSuspend(item)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            color: '#DC2626',
                            border: '1px solid #FCA5A5'
                          }}
                        >
                          {t('admin.tenants.actionSuspend')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => reativarTenant(item.tenant_id)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            color: '#16A34A',
                            border: '1px solid #86EFAC'
                          }}
                        >
                          {t('admin.tenants.actionReactivate')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modais */}
      <NewTenantModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
      />

      <SuspendTenantModal
        tenant={selectedTenantForSuspend}
        isOpen={Boolean(selectedTenantForSuspend)}
        onClose={() => setSelectedTenantForSuspend(null)}
      />
    </div>
  );
};
