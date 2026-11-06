import React, { useEffect, useState } from 'react';
import { useTranslation } from '@consubov/ui';
import { getUpdateCoordinator } from './registerServiceWorker';

export const UpdateConsentNotice: React.FC = () => {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(() => getUpdateCoordinator()?.isPending() ?? false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const show = () => setAvailable(true);
    const hide = () => setAvailable(false);
    window.addEventListener('consubov:update-available', show);
    window.addEventListener('consubov:update-current', hide);
    return () => { window.removeEventListener('consubov:update-available', show); window.removeEventListener('consubov:update-current', hide); };
  }, []);
  if (!available) return null;
  const activate = async () => {
    setBusy(true);
    try {
      const activated = await getUpdateCoordinator()?.activateWaitingWorker();
      if (activated) setAvailable(false);
    } finally { setBusy(false); }
  };
  return <div role="status" aria-live="polite" style={{ position: 'fixed', zIndex: 1000, insetInline: 16, bottom: 16, marginInline: 'auto', maxWidth: 640, padding: 16, background: 'white', border: '1px solid #667085', borderRadius: 8, boxShadow: '0 4px 16px #0002' }}>
    <span>{t('pwa.updateAvailable', 'Há uma atualização do Aplicativo pronta para instalar.')}</span>
    <button type="button" disabled={busy} onClick={() => void activate()} style={{ marginInlineStart: 12, minHeight: 44, padding: '10px 14px', maxWidth: '100%' }}>
      {busy ? t('state.loading', 'Aguarde…') : t('pwa.installUpdate', 'Instalar atualização')}
    </button>
  </div>;
};
