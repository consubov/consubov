/**
 * Isolamento da sessão de DEMONSTRAÇÃO (Relatto) em relação à sessão real.
 *
 * Problema: a demo fazia `signInWithPassword` no mesmo cliente Supabase,
 * gravando o token na MESMA chave de storage da conta real. Em navegadores
 * que compartilham storage com o PWA instalado (Android/Chrome), isso
 * sobrescrevia a sessão real — o app abria em modo Demo ou exibia
 * "Usuário sem perfil configurado".
 *
 * Solução: antes de entrar na demo, fazemos backup da sessão real em uma
 * chave própria (`relatto:real_session_backup`); ao encerrar a demo (ou ao
 * detectar uma sessão demo em um contexto que não é o da demo — ex.: PWA
 * instalado), restauramos a sessão real. Caches derivados (role/IndexedDB)
 * nunca guardam dados da conta demo.
 */
import { supabase } from "@/integrations/supabase/client";
import { clearAuthSession } from "@/lib/offlineSession";

const BACKUP_KEY = "relatto:real_session_backup";
const DEMO_FLAG_KEY = "relatto_demo";
const CACHED_ROLE_KEY = "consubov:cached-role";
const DEMO_EMAIL_SUFFIX = "@relatto-demo.app";

function ls(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function isDemoEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}

export function isDemoFlagActive(): boolean {
  return ls()?.getItem(DEMO_FLAG_KEY) === "1";
}

export function markDemoActive() {
  ls()?.setItem(DEMO_FLAG_KEY, "1");
}

export function clearDemoFlag() {
  ls()?.removeItem(DEMO_FLAG_KEY);
}

/** PWA instalado (standalone) — contexto que NUNCA deve rodar a demo. */
export function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (window.navigator as any)?.standalone === true
    );
  } catch {
    return false;
  }
}

function clearDerivedCaches() {
  ls()?.removeItem(CACHED_ROLE_KEY);
  void clearAuthSession();
}

/** Chamado ANTES do login da demo: preserva a sessão real, se houver. */
export async function beginDemoSession(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (s && !isDemoEmail(s.user.email)) {
      ls()?.setItem(
        BACKUP_KEY,
        JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token }),
      );
      await supabase.auth.signOut({ scope: "local" } as any);
    }
  } catch {
    /* best-effort */
  }
  clearDerivedCaches();
  markDemoActive();
}

/** Encerra a demo e restaura a sessão real (se existir backup). */
export async function endDemoSession(): Promise<boolean> {
  const raw = ls()?.getItem(BACKUP_KEY) ?? null;
  clearDemoFlag();
  clearDerivedCaches();

  try {
    await supabase.auth.signOut({ scope: "local" } as any);
  } catch {
    /* ignore */
  }

  if (!raw) return false;
  ls()?.removeItem(BACKUP_KEY);

  try {
    const backup = JSON.parse(raw) as { access_token: string; refresh_token: string };
    if (!backup?.access_token || !backup?.refresh_token) return false;
    const { error } = await supabase.auth.setSession({
      access_token: backup.access_token,
      refresh_token: backup.refresh_token,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Executado no boot do app: garante que uma sessão demo jamais permaneça
 * ativa fora do contexto da demonstração.
 */
export async function reconcileDemoSession(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;

    if (!s) {
      clearDemoFlag();
      return;
    }

    if (!isDemoEmail(s.user.email)) {
      // Sessão real ativa — não há demo pendente.
      clearDemoFlag();
      ls()?.removeItem(BACKUP_KEY);
      return;
    }

    // Sessão demo: só é válida no navegador comum e com a flag da demo.
    if (!isDemoFlagActive() || isStandaloneApp()) {
      await endDemoSession();
    }
  } catch {
    /* ignore */
  }
}
