/**
 * CapacitorSecureStorage — FASE 6.6
 * Contrato: apps/web/src/platform/contracts/index.ts :: SecureStorage
 *   interface SecureStorage {
 *     getSecret(key: string): Promise<string | undefined>;
 *     setSecret(key: string, value: string): Promise<void>;
 *   }
 * Plugin: @capacitor/preferences (Keychain/EncryptedSharedPreferences por trás).
 *
 * Segurança: valores nunca são logados; erros de plugin não ecoam o segredo.
 * Escopo é por instalação do app — a limpeza em logout/troca de usuário/tenant
 * é responsabilidade do fluxo de auth (FASE 6.6) chamando clear().
 */

export interface SecureStorage {
  getSecret(key: string): Promise<string | undefined>;
  setSecret(key: string, value: string): Promise<void>;
}

const NAMESPACE = "consubov.secure";

export function createCapacitorSecureStorage(): SecureStorage & { clear(): Promise<void> } {
  const memory = new Map<string, string>(); // fallback Web/testes

  async function prefs() {
    const mod = await import("@capacitor/preferences").catch(() => null);
    return mod?.Preferences ?? null;
  }

  return {
    async getSecret(key: string): Promise<string | undefined> {
      try {
        const p = await prefs();
        if (p) {
          const { value } = await p.get({ key: `${NAMESPACE}.${key}` });
          if (value !== null && value !== undefined) return value;
        }
      } catch {
        // Falha do plugin → cai para memória; nunca loga valor.
      }
      return memory.get(key);
    },

    async setSecret(key: string, value: string): Promise<void> {
      memory.set(key, value);
      try {
        const p = await prefs();
        if (p) await p.set({ key: `${NAMESPACE}.${key}`, value });
      } catch {
        // Mantém memória como fonte nesta sessão.
      }
    },

    /** Limpa segredos — chamado em logout / troca de usuário / troca de tenant. */
    async clear(): Promise<void> {
      const keys = [...memory.keys()];
      memory.clear();
      try {
        const p = await prefs();
        if (p) {
          for (const k of keys) await p.remove({ key: `${NAMESPACE}.${k}` });
        }
      } catch {
        // memória já limpa.
      }
    },
  };
}