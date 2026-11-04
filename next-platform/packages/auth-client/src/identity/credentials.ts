import { UserProfileId } from '@consubov/contracts';
import { MembershipRecord, SyntheticUserSession } from './context';

export interface AuthCredentials {
  email: string;
  password?: string;
  device_id?: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number; // segundos
}

export interface AuthResult {
  success: boolean;
  session?: SyntheticUserSession;
  tokens?: TokenPair;
  requires_context_selection?: boolean;
  available_memberships?: readonly MembershipRecord[];
  error?: string;
}

export interface LabUserRecord {
  user_id: string;
  email: string;
  password_hash: string;
  name: string;
  device_id: string;
  primary_profile: UserProfileId;
  memberships: readonly MembershipRecord[];
}
