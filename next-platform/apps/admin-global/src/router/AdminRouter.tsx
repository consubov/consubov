import React, { useState } from 'react';
import { useTranslation, Card } from '@consubov/ui';
import { useAdminAuth } from '../auth/useAdminAuth';
import { AdminLoginView } from '../auth/AdminLoginView';
import { AdminLayout, type AdminTab } from '../components/layout/AdminLayout';
import { TenantsView } from '../components/tenants/TenantsView';
import { LicensesView } from '../components/licenses/LicensesView';
import { AuditLedgerView } from '../components/audit/AuditLedgerView';
import { GlobalUsersView } from '../components/users/GlobalUsersView';

export const AdminRouter: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useAdminAuth();
  const [currentTab, setCurrentTab] = useState<AdminTab>('tenants');

  // 1. Barreira de Autenticação: sem sessão ativa -> Login
  if (!session) {
    return <AdminLoginView />;
  }

  const role = session.user.role;

  // 2. Matriz RBAC Guard por Função (Fail-Closed)
  const canAccessTab = (tab: AdminTab): boolean => {
    if (role === 'super_admin') return true;
    if (role === 'support_admin') {
      return tab === 'tenants' || tab === 'audit' || tab === 'users';
    }
    if (role === 'financial_admin') {
      return tab === 'tenants' || tab === 'licenses';
    }
    return false;
  };

  const renderRestrictedWarning = () => {
    const restrictionKey =
      role === 'financial_admin'
        ? 'admin.rbac.financialRestricted'
        : 'admin.rbac.supportRestricted';

    return (
      <Card
        style={{
          padding: '32px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '16px',
          textAlign: 'center'
        }}
      >
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#991B1B'
          }}
        >
          {t('admin.rbac.accessDeniedTitle')}
        </h3>
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '0.925rem',
            color: '#B91C1C'
          }}
        >
          {t('admin.rbac.accessDeniedDesc', { role })}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: '#7F1D1D',
            fontWeight: 600
          }}
        >
          {t(restrictionKey)}
        </p>
      </Card>
    );
  };

  const renderTabContent = () => {
    if (!canAccessTab(currentTab)) {
      return renderRestrictedWarning();
    }

    switch (currentTab) {
      case 'tenants':
        return <TenantsView />;
      case 'licenses':
        return <LicensesView />;
      case 'audit':
        return <AuditLedgerView />;
      case 'users':
        return <GlobalUsersView />;
      default:
        return <TenantsView />;
    }
  };

  return (
    <AdminLayout currentTab={currentTab} onSelectTab={setCurrentTab}>
      {renderTabContent()}
    </AdminLayout>
  );
};
