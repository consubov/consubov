import { AuthorizedContext } from '../identity/context';

export function hasCapability(context: AuthorizedContext | null, requiredCapability: string): boolean {
  if (!context) return false;
  return context.capabilities.includes(requiredCapability);
}

export function canAccessModule(context: AuthorizedContext | null, moduleId: string): boolean {
  if (!context) return false;
  if (context.profile_id === 'administrador') return true;
  return context.profile_id === moduleId;
}
