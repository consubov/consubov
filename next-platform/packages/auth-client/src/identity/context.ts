import { ProductId, UserProfileId } from '@consubov/contracts';

export interface AuthorizedContext {
  context_id: string;          // Hash determinístico único do contexto
  tenant_id: string;           // UUID do tenant
  tenant_nome: string;
  product_id: ProductId;
  fazenda_id: string;          // UUID da fazenda
  fazenda_nome: string;
  retiro_id: string | null;    // UUID do retiro (se aplicável)
  retiro_nome: string | null;
  profile_id: UserProfileId;   // Perfil selecionado
  capabilities: readonly string[]; // Lista imutável de permissões concedidas
}

export interface MembershipRecord {
  membership_id: string;
  tenant_id: string;
  tenant_nome: string;
  fazenda_id: string;
  fazenda_nome: string;
  retiro_id: string | null;
  retiro_nome: string | null;
  profile_id: UserProfileId;
  is_active: boolean;
}

export interface SyntheticUserSession {
  session_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  profile_id: UserProfileId;
  memberships: readonly MembershipRecord[];
  active_context: AuthorizedContext | null; // NULO até que haja seleção consciente!
  issued_at: string;  // ISO 8601
  expires_at: string; // ISO 8601
  device_id: string;
}
