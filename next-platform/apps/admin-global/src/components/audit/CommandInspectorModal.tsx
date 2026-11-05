import React, { useState } from 'react';
import { useTranslation, Button, Dialog } from '@consubov/ui';
import type { AuditLogRecord } from '../../store/adminStore';

export interface CommandInspectorModalProps {
  log: AuditLogRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CommandInspectorModal: React.FC<CommandInspectorModalProps> = ({
  log,
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !log) return null;

  const jsonString = JSON.stringify(log.envelope || log, null, 2);

  const handleCopy = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(jsonString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // noop
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin.audit.inspectorTitle')}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '640px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
          {t('admin.audit.inspectorSubtitle')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px' }}>
          <div>
            <span style={{ color: '#64748B' }}>{t('admin.audit.colCommand')}: </span>
            <strong>{log.command_type}</strong>
          </div>
          <div>
            <span style={{ color: '#64748B' }}>{t('admin.audit.colStatus')}: </span>
            <strong>{log.status}</strong>
          </div>
          <div>
            <span style={{ color: '#64748B' }}>{t('admin.audit.colTenant')}: </span>
            <span>{log.tenant_id}</span>
          </div>
          <div>
            <span style={{ color: '#64748B' }}>{t('admin.audit.colProfile')}: </span>
            <span>{log.profile_id}</span>
          </div>
        </div>

        <pre
          style={{
            maxHeight: '320px',
            overflowY: 'auto',
            padding: '12px',
            backgroundColor: '#0F172A',
            color: '#38BDF8',
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            margin: 0
          }}
        >
          {jsonString}
        </pre>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={handleCopy} style={{ border: '1px solid #CBD5E1' }}>
            {copied ? t('admin.licenses.tokenCopied') : t('admin.audit.copyJson')}
          </Button>

          <Button type="button" onClick={onClose} style={{ backgroundColor: '#0284C7', color: '#FFFFFF' }}>
            {t('admin.audit.closeInspector')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
