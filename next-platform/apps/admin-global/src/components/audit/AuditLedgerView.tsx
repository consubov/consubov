import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation, Button, Input, Card } from '@consubov/ui';
import { useAdminStore, type AuditLogRecord } from '../../store/adminStore';
import { CommandInspectorModal } from './CommandInspectorModal';

export const AuditLedgerView: React.FC = () => {
  const { t } = useTranslation();
  const { logs, isLoading, fetchAuditLogs } = useAdminStore();

  const [tenantFilter, setTenantFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [commandFilter, setCommandFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const clearFilters = () => {
    setTenantFilter('');
    setUserFilter('');
    setProfileFilter('');
    setCommandFilter('');
    setStartDate('');
    setEndDate('');
    setStatusFilter('');
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (tenantFilter && !log.tenant_id.toLowerCase().includes(tenantFilter.toLowerCase())) {
        return false;
      }
      if (userFilter && !log.user_id.toLowerCase().includes(userFilter.toLowerCase())) {
        return false;
      }
      if (profileFilter && log.profile_id.toLowerCase() !== profileFilter.toLowerCase()) {
        return false;
      }
      if (commandFilter && !log.command_type.toLowerCase().includes(commandFilter.toLowerCase())) {
        return false;
      }
      if (statusFilter && log.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (startDate && log.timestamp < startDate) {
        return false;
      }
      if (endDate && log.timestamp > endDate) {
        return false;
      }
      return true;
    });
  }, [logs, tenantFilter, userFilter, profileFilter, commandFilter, statusFilter, startDate, endDate]);

  const exportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `consubov-audit-ledger-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCsv = () => {
    const headers = ['ID', 'Command', 'Tenant', 'User', 'Profile', 'Status', 'Timestamp'];
    const rows = filteredLogs.map(l => [
      l.id,
      l.command_type,
      l.tenant_id,
      l.user_id,
      l.profile_id,
      l.status,
      l.timestamp
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map(e => e.join(',')).join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodeURI(csvContent));
    downloadAnchor.setAttribute('download', `consubov-audit-ledger-${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
            {t('admin.audit.title')}
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
            {t('admin.audit.subtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button type="button" variant="ghost" onClick={exportJson} disabled={filteredLogs.length === 0} style={{ border: '1px solid #CBD5E1' }}>
            {t('admin.audit.exportJson')}
          </Button>
          <Button type="button" variant="ghost" onClick={exportCsv} disabled={filteredLogs.length === 0} style={{ border: '1px solid #CBD5E1' }}>
            {t('admin.audit.exportCsv')}
          </Button>
        </div>
      </div>

      {/* Multi-Criteria Filters Bar */}
      <Card style={{ padding: '16px', backgroundColor: '#FFFFFF', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
              {t('admin.audit.filterTenant')}
            </label>
            <Input
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
              {t('admin.audit.filterUser')}
            </label>
            <Input
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
              {t('admin.audit.filterProfile')}
            </label>
            <select
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontSize: '0.8rem'
              }}
            >
              <option value="">{t('admin.common.all')}</option>
              <option value="capataz">{t('admin.licenses.moduleCapataz')}</option>
              <option value="gerente">{t('admin.licenses.moduleGerente')}</option>
              <option value="escritorio">{t('admin.licenses.moduleEscritorio')}</option>
              <option value="fabrica">{t('admin.licenses.moduleFabrica')}</option>
              <option value="administrador">{t('admin.users.roleSuperAdmin')}</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
              {t('admin.audit.filterCommand')}
            </label>
            <Input
              value={commandFilter}
              onChange={(e) => setCommandFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
              {t('admin.audit.filterStatus')}
            </label>
            <Input
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
            {t('admin.audit.totalLogs')}: {filteredLogs.length}
          </span>
          <Button type="button" variant="ghost" onClick={clearFilters} style={{ fontSize: '0.75rem', padding: '4px 10px', border: '1px solid #CBD5E1' }}>
            {t('admin.audit.clearFilters')}
          </Button>
        </div>
      </Card>

      {/* Logs Table */}
      <Card style={{ padding: 0, backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table
            role="table"
            aria-label={t('admin.audit.title')}
            style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}
          >
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: 700 }}>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.audit.colTimestamp')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.audit.colCommand')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.audit.colTenant')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.audit.colProfile')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.audit.colStatus')}</th>
                <th scope="col" style={{ padding: '14px 16px' }}>{t('admin.audit.colDetails')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                    {t('admin.common.loading')}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                    {t('admin.audit.emptyLogs')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px', color: '#64748B', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {log.timestamp}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>
                      {log.command_type}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569', fontSize: '0.8rem' }}>
                      {log.tenant_id}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#0284C7', textTransform: 'capitalize' }}>
                      {log.profile_id}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: log.status.toLowerCase() === 'acked' ? '#DCFCE7' : '#FEE2E2',
                          color: log.status.toLowerCase() === 'acked' ? '#15803D' : '#B91C1C'
                        }}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedLog(log)}
                        style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #CBD5E1' }}
                      >
                        {t('admin.audit.inspectEnvelope')}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Inspector Modal */}
      <CommandInspectorModal
        log={selectedLog}
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};
