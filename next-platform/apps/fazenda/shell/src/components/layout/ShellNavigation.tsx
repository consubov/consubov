import React from 'react';
import { useAuth } from '../../auth/useAuth';
import { useTranslation, colorTokens } from '@consubov/ui';
import { UserProfileId } from '@consubov/contracts';

interface NavItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  icon: string;
  profile: UserProfileId;
}

const PROFILE_NAV_ITEMS: Record<UserProfileId, NavItem[]> = {
  gerente: [
    { id: 'home', labelKey: 'role.gerente', defaultLabel: 'Visão Geral', icon: '📊', profile: 'gerente' },
    { id: 'gmd', labelKey: 'domain.gmd', defaultLabel: 'Curvas de GMD', icon: '📈', profile: 'gerente' },
    { id: 'lote', labelKey: 'domain.lote', defaultLabel: 'Lotes e Animais', icon: '🐂', profile: 'gerente' }
  ],
  capataz: [
    { id: 'home', labelKey: 'role.capataz', defaultLabel: 'Painel Campo', icon: '📋', profile: 'capataz' },
    { id: 'cocho', labelKey: 'domain.cocho', defaultLabel: 'Escore de Cocho', icon: '🌾', profile: 'capataz' },
    { id: 'salga', labelKey: 'domain.salga', defaultLabel: 'Salga e Ronda', icon: '🧂', profile: 'capataz' }
  ],
  escritorio: [
    { id: 'home', labelKey: 'role.escritorio', defaultLabel: 'Painel Escritório', icon: '🏢', profile: 'escritorio' },
    { id: 'notas', labelKey: 'domain.nota_fiscal', defaultLabel: 'Notas Fiscais', icon: '📑', profile: 'escritorio' },
    { id: 'ordens', labelKey: 'domain.ordem_compra', defaultLabel: 'Ordens de Compra', icon: '🛒', profile: 'escritorio' }
  ],
  fabrica: [
    { id: 'home', labelKey: 'role.fabrica', defaultLabel: 'Painel Fábrica', icon: '⚙️', profile: 'fabrica' },
    { id: 'batidas', labelKey: 'domain.batida', defaultLabel: 'Batidas de Ração', icon: '🥣', profile: 'fabrica' },
    { id: 'silos', labelKey: 'domain.silo', defaultLabel: 'Estoque de Silos', icon: '🏭', profile: 'fabrica' }
  ],
  administrador: [
    { id: 'home', labelKey: 'role.administrador', defaultLabel: 'Administração', icon: '🛡️', profile: 'administrador' }
  ]
};

export interface ShellNavigationProps {
  activeTab?: string;
  onSelectTab?: (tabId: string) => void;
}

export const ShellNavigation: React.FC<ShellNavigationProps> = ({ activeTab = 'home', onSelectTab }) => {
  const { activeContext } = useAuth();
  const { t } = useTranslation();

  if (!activeContext) return null;

  const items = PROFILE_NAV_ITEMS[activeContext.profile_id] ?? [];

  return (
    <nav
      aria-label="Navegação Operacional"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTop: `1px solid ${colorTokens.surface.border}`,
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 90
      }}
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab?.(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 56,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? colorTokens.brand.primary : colorTokens.text.secondary,
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.75rem',
              padding: '6px 4px',
              touchAction: 'manipulation'
            }}
          >
            <span style={{ fontSize: '1.25rem', marginBottom: 2 }}>{item.icon}</span>
            <span>{t(item.labelKey, item.defaultLabel)}</span>
          </button>
        );
      })}
    </nav>
  );
};
