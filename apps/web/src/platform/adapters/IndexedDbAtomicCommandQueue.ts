import {
  assertCommandOwner,
  beginCommandAttempt,
  markCommandConflict,
  retryAfterUncertainDelivery,
  type CommandOwner,
  type LocalCommand,
} from "../offline/commandPolicy";
import type { AtomicCommandQueue } from "../offline/localSyncRound";

/**
 * Isolated VNext queue. Never upgrades, reads or deletes legacy field databases.
 * A single readwrite IndexedDB transaction covers each compare-and-set transition:
 * browsers serialize those transactions across tabs for the same object store.
 *
 * This is NOT backend authorization. Caller must use a verified tenant/user.
 */
export const NEXT_COMMAND_QUEUE_DB_NAME = "consubov-vnext-command-queue";
const DB_VERSION = 1;
const STORE = "commands";
const BY_OWNER_STATUS = "byOwnerStatus";
const BY_IDEMPOTENCY = "byIdempotency";

type Key = [string, string, string];
type Stored<T> = {
  key: Key;
  ownerStatus: Key;
  idempotencyScope: Key;
  command: LocalCommand<T>;
};

function required(part: string, label: string): string {
  if (typeof part !== "string" || !part.trim() || part !== part.trim()) {
    throw new TypeError(label + " is required and must be normalized");
  }
  return part;
}

function scope(owner: CommandOwner): [string, string] {
  return [required(owner.tenantId, "tenantId"), required(owner.userId, "userId")];
}

function commandKey(owner: CommandOwner, id: string): Key {
  const [tenantId, userId] = scope(owner);
  return [tenantId, userId, required(id, "commandId")];
}

function persisted<T>(command: LocalCommand<T>): Stored<T> {
  return {
    key: commandKey(command, command.commandId),
    ownerStatus: [...scope(command), command.status],
    idempotencyScope: [...scope(command), required(command.idempotencyKey, "idempotencyKey")],
    command,
  };
}

/** No automatic inflight expiry: arbitrary leases could duplicate writes. */
export class IndexedDbAtomicCommandQueue<T = unknown> implements AtomicCommandQueue<T> {
  private opened: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly factory: IDBFactory | undefined =
      typeof indexedDB === "undefined" ? undefined : indexedDB,
  ) {}

  private async database(): Promise<IDBDatabase> {
    if (!this.factory) throw new Error("IndexedDB unavailable: offline command not persisted");
    if (!this.opened) {
      this.opened = new Promise<IDBDatabase>((resolve, reject) => {
        let req: IDBOpenDBRequest;
        try {
          req = this.factory!.open(NEXT_COMMAND_QUEUE_DB_NAME, DB_VERSION);
        } catch (error) {
          reject(error);
          return;
        }
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) {
            const records = req.result.createObjectStore(STORE, { keyPath: "key" });
            records.createIndex(BY_OWNER_STATUS, "ownerStatus", { unique: false });
            // A second command with the same idempotency key for this owner
            // must fail instead of silently becoming an additional write.
            records.createIndex(BY_IDEMPOTENCY, "idempotencyScope", { unique: true });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction(STORE, "readonly");
            const records = tx.objectStore(STORE);
            if (records.keyPath !== "key" || records.autoIncrement ||
                !records.indexNames.contains(BY_OWNER_STATUS) ||
                !records.indexNames.contains(BY_IDEMPOTENCY)) {
              throw new Error("incompatible local command queue schema");
            }
            const byStatus = records.index(BY_OWNER_STATUS);
            const byIdempotency = records.index(BY_IDEMPOTENCY);
            if (byStatus.keyPath !== "ownerStatus" || byStatus.unique || byStatus.multiEntry ||
                byIdempotency.keyPath !== "idempotencyScope" ||
                !byIdempotency.unique || byIdempotency.multiEntry) {
              throw new Error("incompatible local command queue schema");
            }
          } catch (error) {
            db.close();
            reject(error);
            return;
          }
          db.onversionchange = () => {
            db.close();
            this.opened = null;
          };
          resolve(db);
        };
        req.onerror = () => reject(req.error ?? new Error("command queue open failed"));
        req.onblocked = () => reject(new Error("command queue database blocked by another tab"));
      }).catch((error) => {
        this.opened = null;
        throw error;
      });
    }
    return this.opened;
  }

  /** Promise only resolves after IndexedDB transaction.oncomplete, never at request.onsuccess. */
  private async transaction<R>(
    mode: IDBTransactionMode,
    body: (
      store: IDBObjectStore,
      setResult: (value: R) => void,
      abort: (error: unknown) => void,
    ) => void,
  ): Promise<R> {
    const db = await this.database();
    return new Promise<R>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE, mode);
      } catch (error) {
        reject(error);
        return;
      }
      let result!: R;
      let problem: unknown;
      const abort = (error: unknown) => {
        problem = error;
        try { tx.abort(); } catch { reject(error); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(problem ?? tx.error ?? new Error("offline queue transaction aborted"));
      // Do not call preventDefault; request errors must abort an invalid write.
      try {
        body(tx.objectStore(STORE), (value) => { result = value; }, abort);
      } catch (error) {
        abort(error);
      }
    });
  }

  private async modify(
    owner: CommandOwner,
    commandId: string,
    decide: (stored: LocalCommand<T> | null) => LocalCommand<T> | null,
  ): Promise<LocalCommand<T> | null> {
    const key = commandKey(owner, commandId);
    return this.transaction("readwrite", (store, setResult, abort) => {
      const req = store.get(key);
      req.onsuccess = () => {
        try {
          const existing = (req.result as Stored<T> | undefined)?.command ?? null;
          if (existing) {
            assertCommandOwner(existing, owner);
            if (existing.commandId !== commandId) throw new Error("queue key mismatch");
          }
          const next = decide(existing);
          if (next) {
            assertCommandOwner(next, owner);
            if (next.commandId !== commandId) throw new Error("command identity changed");
            store.put(persisted(next));
          }
          setResult(next);
        } catch (error) {
          abort(error);
        }
      };
    });
  }

  /** Never overwrite an existing command, including ACKed or conflicted records. */
  async enqueue(owner: CommandOwner, command: LocalCommand<T>): Promise<void> {
    assertCommandOwner(command, owner);
    if (command.status !== "pending" || command.attemptCount !== 0) {
      throw new Error("enqueue only accepts a new pending command");
    }
    // Capture the accepted operation before opening IndexedDB asynchronously.
    // UI drafts may change while the open/transaction waits on another tab.
    const entry = persisted(structuredClone(command));
    await this.transaction<void>("readwrite", (store) => {
      store.add(entry);
    });
  }

  async get(owner: CommandOwner, commandId: string): Promise<LocalCommand<T> | null> {
    const key = commandKey(owner, commandId);
    return this.transaction("readonly", (store, setResult, abort) => {
      const req = store.get(key);
      req.onsuccess = () => {
        try {
          const command = (req.result as Stored<T> | undefined)?.command ?? null;
          if (command) assertCommandOwner(command, owner);
          setResult(command);
        } catch (error) { abort(error); }
      };
    });
  }

  async listPending(owner: CommandOwner): Promise<LocalCommand<T>[]> {
    const [tenantId, userId] = scope(owner);
    return this.transaction("readonly", (store, setResult, abort) => {
      const req = store.index(BY_OWNER_STATUS).getAll([tenantId, userId, "pending"]);
      req.onsuccess = () => {
        try {
          const commands = (req.result as Stored<T>[]).map((item) => item.command);
          commands.forEach((command) => assertCommandOwner(command, owner));
          setResult(commands);
        } catch (error) { abort(error); }
      };
    });
  }

  /** Atomic read-and-reserve, safe against two tabs claiming the same command. */
  async claimPending(owner: CommandOwner, commandId: string): Promise<LocalCommand<T> | null> {
    return this.modify(owner, commandId, (stored) =>
      stored?.status === "pending" ? beginCommandAttempt(stored, owner) : null,
    );
  }

  private assertSameAttempt(
    owner: CommandOwner,
    stored: LocalCommand<T> | null,
    incoming: LocalCommand<T>,
    expectedStatus: "inflight" | "acked",
  ): LocalCommand<T> {
    assertCommandOwner(incoming, owner);
    if (!stored || stored.status !== "inflight" ||
        incoming.status !== expectedStatus ||
        stored.commandId !== incoming.commandId ||
        stored.idempotencyKey !== incoming.idempotencyKey ||
        stored.deviceId !== incoming.deviceId ||
        stored.attemptCount !== incoming.attemptCount) {
      throw new Error("stale or mismatched offline command transition");
    }
    return stored;
  }

  async acknowledge(owner: CommandOwner, confirmed: LocalCommand<T>): Promise<void> {
    await this.modify(owner, confirmed.commandId, (existing) => {
      const current = this.assertSameAttempt(owner, existing, confirmed, "acked");
      return { ...current, status: "acked" };
    });
  }

  async markConflict(owner: CommandOwner, attempted: LocalCommand<T>): Promise<void> {
    await this.modify(owner, attempted.commandId, (existing) => {
      const current = this.assertSameAttempt(owner, existing, attempted, "inflight");
      return markCommandConflict(current, owner);
    });
  }

  async releaseForRetry(owner: CommandOwner, attempted: LocalCommand<T>): Promise<void> {
    await this.modify(owner, attempted.commandId, (existing) => {
      const current = this.assertSameAttempt(owner, existing, attempted, "inflight");
      return retryAfterUncertainDelivery(current, owner);
    });
  }

  /**
   * Explicit recovery after a crashed sending tab has been confirmed stopped.
   * Same commandId/idempotencyKey; never an automatic time-based lease.
   */
  async recoverUnconfirmed(
    owner: CommandOwner,
    commandId: string,
    expectedAttemptCount: number,
    confirmedNoActiveSender: true,
  ): Promise<void> {
    if (confirmedNoActiveSender !== true || !Number.isSafeInteger(expectedAttemptCount) ||
        expectedAttemptCount < 1) {
      throw new Error("recovery requires explicit sender-stop confirmation and persisted attempt");
    }
    await this.modify(owner, commandId, (current) => {
      if (!current || current.status !== "inflight" ||
          current.attemptCount !== expectedAttemptCount) {
        throw new Error("inflight command changed before recovery");
      }
      return retryAfterUncertainDelivery(current, owner);
    });
  }

  async close(): Promise<void> {
    if (this.opened) {
      const db = await this.opened;
      db.close();
      this.opened = null;
    }
  }
}
