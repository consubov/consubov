import React from 'react';
import { useTranslation, Button, LanguageSwitch } from '@consubov/ui';
import { useAdminAuth } from '../../auth/useAdminAuth';

export type AdminTab = 'tenants' | 'licenses' | 'audit' | 'users';

export interface AdminLayoutProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  children
}) => {
  const { t } = useTranslation();
  const { session, logout } = useAdminAuth();

  const userRole = session?.user.role || 'super_admin';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#F8FAFC'
      }}
    >
      {/* Top Header / Branding Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          borderBottom: '1px solid #1E293B'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: '#38BDF8'
              }}
            >
              {t('admin.app.title')}
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#94A3B8'
              }}
            >
              {t('admin.app.subtitle')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 700,
              backgroundColor: '#1E293B',
              color: '#38BDF8',
              border: '1px solid #0284C7'
            }}
          >
            {t('admin.nav.roleBadge', { role: userRole })}
          </span>

          <LanguageSwitch />

          <Button
            type="button"
            variant="ghost"
            onClick={logout}
            style={{
              border: '1px solid #475569',
              color: '#F1F5F9',
              fontSize: '0.85rem'
            }}
          >
            {t('admin.nav.logout')}
          </Button>
        </div>
      </header>

      {/* Navigation Tabs Bar (W3C ARIA tablist) */}
      <nav
        role="tablist"
        aria-label={t('admin.app.title')}
        style={{
          display: 'flex',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 24px',
          gap: '8px'
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-tenants"
          aria-selected={currentTab === 'tenants'}
          aria-controls="tabpanel-tenants"
          onClick={() => onSelectTab('tenants')}
          style={{
            padding: '14px 20px',
            border: 'none',
            borderBottom: currentTab === 'tenants' ? '3px solid #0284C7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'tenants' ? '#0284C7' : '#64748B',
            fontWeight: currentTab === 'tenants' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {t('admin.nav.tenants')}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-licenses"
          aria-selected={currentTab === 'licenses'}
          aria-controls="tabpanel-licenses"
          onClick={() => onSelectTab('licenses')}
          style={{
            padding: '14px 20px',
            border: 'none',
            borderBottom: currentTab === 'licenses' ? '3px solid #0284C7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'licenses' ? '#0284C7' : '#64748B',
            fontWeight: currentTab === 'licenses' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {t('admin.nav.licenses')}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-audit"
          aria-selected={currentTab === 'audit'}
          aria-controls="tabpanel-audit"
          onClick={() => onSelectTab('audit')}
          style={{
            padding: '14px 20px',
            border: 'none',
            borderBottom: currentTab === 'audit' ? '3px solid #0284C7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'audit' ? '#0284C7' : '#64748B',
            fontWeight: currentTab === 'audit' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {t('admin.nav.audit')}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-users"
          aria-selected={currentTab === 'users'}
          aria-controls="tabpanel-users"
          onClick={() => onSelectTab('users')}
          style={{
            padding: '14px 20px',
            border: 'none',
            borderBottom: currentTab === 'users' ? '3px solid #0284C7' : '3px solid transparent',
            backgroundColor: 'transparent',
            color: currentTab === 'users' ? '#0284C7' : '#64748B',
            fontWeight: currentTab === 'users' ? 700 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {t('admin.nav.users')}
        </button>
      </nav>

      {/* Main Content Area (W3C ARIA tabpanel) */}
      <main
        role="tabpanel"
        id={`tabpanel-${currentTab}`}
        aria-labelledby={`tab-${currentTab}`}
        style={{
          flex: 1,
          padding: '24px',
          maxWidth: '1400px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box'
        }}
      >
        {children}
      </main>
    </div>
  );
};
