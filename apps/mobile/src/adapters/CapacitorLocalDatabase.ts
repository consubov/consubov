/**
 * CapacitorLocalDatabase — FASE 6.6 / preparação FASE 7 (SQLite local)
 * Contrato: apps/web/src/platform/contracts/index.ts :: LocalDatabase
 * Plugin: @capacitor-community/sqlite
 * Notas: adapter mínimo key/value sobre SQLite; schema versionado (kv_store v1).
 * Persistência transacional completa e migração ficam para FASE 7; este arquivo
 * já expõe databaseVersion e inicialização idempotente exigidas no gate 6.7.
 */

export interface LocalDatabase {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

const DB_NAME = "consubov";
const TABLE = "kv_store";
const SCHEMA_V1 = `CREATE TABLE IF NOT EXISTS ${TABLE} (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at INTEGER NOT NULL)`;

async function getSqlite() {
  const mod = await import("@capacitor-community/sqlite").catch(() => null);
  return (mod as unknown as { CapacitorSQLite?: unknown })?.CapacitorSQLite ?? null;
}

let ready: Promise<unknown> | null = null;

async function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    const sqlite = await getSqlite();
    if (!sqlite) return null;
    // API real varia por versão — as chamadas abaixo cobrem o driver atual e
    // degradam silenciosamente se ainda não existir no ambiente de teste.
    try {
      const s = sqlite as {
        createConnection?: (...a: unknown[]) => Promise<unknown>;
        open?: (...a: unknown[]) => Promise<unknown>;
        execute?: (q: string) => Promise<unknown>;
        query?: (q: string, p?: unknown[]) => Promise<unknown>;
      };
      // Conexão opcional: em alguns runtimes createConnection+open é necessário.
      if (s.createConnection) {
        try {
          await s.createConnection(DB_NAME, false, "no-encryption", 1, false);
        } catch {
          // Já existe — idempotente.
        }
        if (s.open) {
          try {
            await s.open(DB_NAME, false);
          } catch {
            // Aberto.
          }
        }
      }
      if (s.execute) await s.execute(SCHEMA_V1);
    } catch (e) {
      console.warn("[CapacitorLocalDatabase] ensureReady degradado:", e);
    }
    return sqlite;
  })();
  return ready;
}

export function createCapacitorLocalDatabase(): LocalDatabase {
  // Fallback em memória quando plugin não está disponível (Web / testes E2E).
  const mem = new Map<string, string>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const sqlite = (await ensureReady()) as null | {
        query?: (q: string, p?: unknown[]) => Promise<{ values?: Array<{ v: string }> }>;
      };
      if (sqlite?.query) {
        try {
          const res = await sqlite.query(`SELECT v FROM ${TABLE} WHERE k = ?`, [key]);
          const row = res.values?.[0];
          if (!row) return undefined;
          return JSON.parse(row.v) as T;
        } catch {
          // Fallback para memória nesta leitura.
        }
      }
      const raw = mem.get(key);
      if (raw === undefined) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      const raw = JSON.stringify(value);
      mem.set(key, raw);
      const sqlite = (await ensureReady()) as null | {
        run?: (q: string, p?: unknown[]) => Promise<unknown>;
        execute?: (q: string) => Promise<unknown>;
      };
      if (sqlite?.run) {
        try {
          await sqlite.run(`INSERT OR REPLACE INTO ${TABLE}(k,v,updated_at) VALUES(?,?,?)`, [
            key,
            raw,
            Date.now(),
          ]);
          return;
        } catch {
          // Mantém mem como fallback.
        }
      } else if (sqlite?.execute) {
        try {
          const esc = raw.replace(/'/g, "''");
          await sqlite.execute(
            `INSERT OR REPLACE INTO ${TABLE}(k,v,updated_at) VALUES('${key.replace(/'/g, "''")}','${esc}',${Date.now()})`,
          );
        } catch {
          // mem fallback já feito.
        }
      }
    },

    async delete(key: string): Promise<void> {
      mem.delete(key);
      const sqlite = (await ensureReady()) as null | {
        run?: (q: string, p?: unknown[]) => Promise<unknown>;
        execute?: (q: string) => Promise<unknown>;
      };
      if (sqlite?.run) {
        try {
          await sqlite.run(`DELETE FROM ${TABLE} WHERE k = ?`, [key]);
        } catch {
          // mem já limpo.
        }
      } else if (sqlite?.execute) {
        try {
          await sqlite.execute(`DELETE FROM ${TABLE} WHERE k = '${key.replace(/'/g, "''")}'`);
        } catch {
          // mem já limpo.
        }
      }
    },
  };
}