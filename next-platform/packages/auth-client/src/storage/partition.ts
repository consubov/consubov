/**
 * Gera a chave canônica única de partição de sessão e isolamento IndexedDB (FASE 05):
 * Formato padronizado: ${tenant_id}:${user_id}:${fazenda_id}:${profile_id}
 */
export function buildPartitionKey(
  tenantId: string,
  userId: string,
  fazendaId: string,
  profileId: string
): string {
  return `${tenantId}:${userId}:${fazendaId}:${profileId}`;
}

export function parsePartitionKey(partitionKey: string): {
  tenantId: string;
  userId: string;
  fazendaId: string;
  profileId: string;
} | null {
  const parts = partitionKey.split(':');
  if (parts.length !== 4) return null;
  const [tenantId, userId, fazendaId, profileId] = parts;
  if (!tenantId || !userId || !fazendaId || !profileId) return null;
  return { tenantId, userId, fazendaId, profileId };
}
