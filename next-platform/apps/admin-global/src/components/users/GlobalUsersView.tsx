import React, { useState, useMemo } from 'react';
import { useTranslation, Button, Card } from '@consubov/ui';
import { useAdminStore, type GlobalUserRecord } from '../../store/adminStore';
import { BlockUserModal } from './BlockUserModal';
import { LinkUserModal } from './LinkUserModal';

export const GlobalUsersView: React.FC = () => {
  const { t } = useTranslation();
  const { users } = useAdminStore();

  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUserForBlock, setSelectedUserForBlock] = useState<GlobalUserRecord | null>(null);
  const [selectedUserForLink, setSelectedUserForLink] = useState<GlobalUserRecord | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      return true;
    });
  }, [users, roleFilter]);

  const getRoleBadgeLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return t('admin.users.roleSuperAdmin');
      case 'support_admin':
        return t('admin.users.roleSupportAdmin');
      case 'financial_admin':
        return t('admin.users.roleFinancialAdmin');
      default:
        return role;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
            {t('admin.users.title')}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
            {t('admin.users.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
            {t('admin.users.filterRole')}
          </span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              fontSize: '0.875rem'
            }}
          >
            <option value="">{t('admin.common.all')}</option>
            <option value="super_admin">{t('admin.users.roleSuperAdmin')}</option>
            <option value="support_admin">{t('admin.users.roleSupportAdmin')}</option>
            <option value="financial_admin">{t('admin.users.roleFinancialAdmin')}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <Card style={{ padding: 0, backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            role="table"
            aria-label={t('admin.users.title')}
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700 }}>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.users.colName')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.users.colEmail')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.users.colRole')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.users.colTenant')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.users.colStatus')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.users.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                    {t('admin.users.emptyUsers')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.usuario_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                      {u.nome}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569' }}>
                      {u.email}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#E0F2FE',
                          color: '#0369A1',
                          border: '1px solid #BAE6FD'
                        }}
                      >
                        {getRoleBadgeLabel(u.role)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748B', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {u.tenant_id}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: u.status === 'ativo' ? '#DCFCE7' : '#FEE2E2',
                          color: u.status === 'ativo' ? '#15803D' : '#B91C1C'
                        }}
                      >
                        {u.status === 'ativo' ? t('admin.users.statusActive') : t('admin.users.statusBlocked')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {u.status === 'ativo' && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setSelectedUserForBlock(u)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              color: '#DC2626',
                              border: '1px solid #FCA5A5'
                            }}
                          >
                            {t('admin.users.actionBlock')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setSelectedUserForLink(u)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            color: '#0284C7',
                            border: '1px solid #BAE6FD'
                          }}
                        >
                          {t('admin.users.actionLink')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modais */}
      <BlockUserModal
        user={selectedUserForBlock}
        isOpen={Boolean(selectedUserForBlock)}
        onClose={() => setSelectedUserForBlock(null)}
      />

      <LinkUserModal
        user={selectedUserForLink}
        isOpen={Boolean(selectedUserForLink)}
        onClose={() => setSelectedUserForLink(null)}
      />
    </div>
  );
};
