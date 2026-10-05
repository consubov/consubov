import { supabase } from "@/integrations/supabase/client";

export async function requestPasswordRecovery(email: string, redirectTo: string) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function updateRecoveredPassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function clearRecoverySession() {
  return supabase.auth.signOut();
}
