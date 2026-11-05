import { UserProfileId } from '@consubov/contracts';
import { AuthorizedContext, SyntheticUserSession } from '@consubov/auth-client';

export type ShellRoutePath =
  | '/login'
  | '/context-select'
  | '/access-denied'
  | '/fazenda/gerente'
  | '/fazenda/capataz'
  | '/fazenda/escritorio'
  | '/fazenda/fabrica';

export interface ShellNavigationItem {
  id: string;
  labelKey: string;
  defaultLabel: string;
  path: string;
  icon: string;
  requiredProfile?: UserProfileId;
}

export interface ShellSessionState {
  session: SyntheticUserSession | null;
  activeContext: AuthorizedContext | null;
  isAuthenticated: boolean;
  requiresContextSelection: boolean;
  isOnline: boolean;
}
