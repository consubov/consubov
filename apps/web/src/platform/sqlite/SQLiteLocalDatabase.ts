import { CapacitorSQLite } from '@capacitor-community/sqlite';
import type { LocalDatabase } from '@/platform/contracts';

const DATABASE_NAME = 'consubov_local';
const SCHEMA_VERSION = 1;

/**
 * SQLite implementation of the LocalDatabase port.
 *
 * This class uses the Capacitor SQLite plugin to provide a key-value store
 * with JSON serialization. Database lifecycle is managed by the Capacitor
 * plugin's connection management.
 */
export class SQLiteLocalDatabase implements LocalDatabase {
  private db: any = null;

  private async ensureDatabase(): Promise<any> {
    if (this.db) {
      return this.db;
    }

    await CapacitorSQLite.createConnection({
      database: DATABASE_NAME,
      version: SCHEMA_VERSION,
      encrypted: false,
      mode: 'rw',
      readonly: false,
    });

    await CapacitorSQLite.open({ database: DATABASE_NAME });

    // Create kv_store table if it doesn't exist
    await CapacitorSQLite.run({
      database: DATABASE_NAME,
      statement: `
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `,
      values: [],
    });

    this.db = DATABASE_NAME;
    return this.db;
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ensureDatabase();
    const result = await CapacitorSQLite.query({
      database: DATABASE_NAME,
      statement: `SELECT value FROM kv_store WHERE key = ?`,
      values: [key],
    });
    const row = result?.values?.[0];
    return row?.value ? (JSON.parse(row.value) as T) : undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.ensureDatabase();
    const serialized = JSON.stringify(value);
    await CapacitorSQLite.run({
      database: DATABASE_NAME,
      statement: `
        INSERT OR REPLACE INTO kv_store (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
      `,
      values: [key, serialized],
    });
  }

  async delete(key: string): Promise<void> {
    await this.ensureDatabase();
    await CapacitorSQLite.run({
      database: DATABASE_NAME,
      statement: `DELETE FROM kv_store WHERE key = ?`,
      values: [key],
    });
  }
}
