/**
 * CONSUBOV 2.0 cross-origin transfer coordinator.
 *
 * IMPORTANT: this module never reads raw IndexedDB values, shares credentials,
 * deletes storage or talks to a remote service by itself. Those operations
 * require audited adapters and a server which returns durable receipts.
 * Without them the handoff MUST fail closed.
 */
export const LEGACY_APP_ORIGIN = "https://consubov.com.br";
export const NEW_APP_ORIGIN = "https://app.consubov.com.br";
export const CONSENT_TEXT_VERSION = "consubov-v2-transfer-v1";
export const MIGRATION_RELEASE_ID = "consubov-2.0.0";

export const LEGACY_DATABASES = [
  "consubov-capataz",
  "consubov-session",
  "consubov-consultor-offline",
  "mais-arrobas-offline",
  "mais-arrobas-sync",
  "consubov-fotos-salga",
] as const;

export type LegacyDatabase = (typeof LEGACY_DATABASES)[number];
export type TransferableDatabase = Exclude<LegacyDatabase, "consubov-session">;
export const TRANSFERABLE_DATABASES = LEGACY_DATABASES.filter(
  (name): name is TransferableDatabase => name !== "consubov-session",
);

export type MigrationPhase =
  | "checking"
  | "backup"
  | "syncing"
  | "verifying"
  | "opening";

export interface MigrationIdentity {
  tenantId: string;
  userId: string;
  deviceId: string;
}

export interface LocalDatabaseAudit {
  name: LegacyDatabase;
  inspected: boolean;
  pendingRecords: number;
  pendingAttachments: number;
}

export interface LocalAudit {
  databases: LocalDatabaseAudit[];
  criticalOperationActive: boolean;
}

export interface ConsentReceipt {
  id: string;
  identity: MigrationIdentity;
  textVersion: typeof CONSENT_TEXT_VERSION;
  releaseId: typeof MIGRATION_RELEASE_ID;
}

export interface LocalBackup {
  snapshotId: string;
  identity: MigrationIdentity;
  coveredDatabases: LegacyDatabase[];
  durableOnOriginalDevice: boolean;
  binaryAttachmentsPreserved: boolean;
}

export interface ServerMigrationReceipt {
  migrationId: string;
  snapshotId: string;
  identity: MigrationIdentity;
  consentReceiptId: string;
  acknowledgedDatabases: TransferableDatabase[];
  unacknowledgedRecords: number;
  unacknowledgedAttachments: number;
  durable: boolean;
  expiresAt: string;
}

export interface MigrationHandoff {
  /** Short-lived, single-use, non-authentication reference. Never a JWT. */
  code: string;
  expiresAt: string;
}

export interface MigrationPort {
  isOnline(): boolean;
  readAuthenticatedIdentity(): Promise<MigrationIdentity | null>;
  inspectAllLocalDatabases(identity: MigrationIdentity): Promise<LocalAudit>;
  recordExplicitConsent(input: {
    identity: MigrationIdentity;
    releaseId: typeof MIGRATION_RELEASE_ID;
    textVersion: typeof CONSENT_TEXT_VERSION;
    grantedAt: string;
  }): Promise<ConsentReceipt>;
  createNonDestructiveBackup(identity: MigrationIdentity): Promise<LocalBackup>;
  synchronizeEveryPendingDomain(input: {
    identity: MigrationIdentity;
    backup: LocalBackup;
    consent: ConsentReceipt;
  }): Promise<void>;
  verifyDurableServerAcks(input: {
    identity: MigrationIdentity;
    backup: LocalBackup;
    consent: ConsentReceipt;
  }): Promise<ServerMigrationReceipt>;
  createSingleUseHandoff(receipt: ServerMigrationReceipt): Promise<MigrationHandoff>;
}

export type MigrationResult =
  | { ok: true; url: string; migrationId: string }
  | { ok: false; code: string; message: string };

const BLOCKED_MESSAGE =
  "Não foi possível concluir agora. Seus dados continuam na versão atual. Tente novamente quando estiver conectado.";

function blocked(code: string): MigrationResult {
  return { ok: false, code, message: BLOCKED_MESSAGE };
}

function sameIdentity(a: MigrationIdentity, b: MigrationIdentity): boolean {
  return (
    a.tenantId === b.tenantId &&
    a.userId === b.userId &&
    a.deviceId === b.deviceId
  );
}

function validIdentity(value: MigrationIdentity | null): value is MigrationIdentity {
  return Boolean(
    value &&
    value.tenantId.trim() &&
    value.userId.trim() &&
    value.deviceId.trim(),
  );
}

function exactCoverage(
  names: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    names.length === expected.length &&
    new Set(names).size === names.length &&
    expected.every((name) => names.includes(name))
  );
}

function auditIsComplete(audit: LocalAudit): boolean {
  if (audit.criticalOperationActive) return false;
  if (!exactCoverage(audit.databases.map((db) => db.name), LEGACY_DATABASES)) return false;
  return audit.databases.every(
    (db) =>
      db.inspected &&
      Number.isSafeInteger(db.pendingRecords) &&
      db.pendingRecords >= 0 &&
      Number.isSafeInteger(db.pendingAttachments) &&
      db.pendingAttachments >= 0,
  );
}

function noPendingAfterSync(audit: LocalAudit): boolean {
  return (
    auditIsComplete(audit) &&
    audit.databases.every(
      (db) =>
        db.name === "consubov-session" ||
        (db.pendingRecords === 0 && db.pendingAttachments === 0),
    )
  );
}

function notExpired(value: string, now: Date): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now.getTime();
}

/** Only called from a user-initiated consent action. Never autoruns on mount. */
export class OneTouchMigrationFlow {
  private inFlight: Promise<MigrationResult> | null = null;

  constructor(
    private readonly port: MigrationPort,
    private readonly env: {
      origin: string;
      now?: () => Date;
    },
  ) {}

  run(
    userAuthorized: boolean,
    onProgress?: (phase: MigrationPhase) => void,
  ): Promise<MigrationResult> {
    if (this.inFlight) return this.inFlight;
    const task = this.perform(userAuthorized, onProgress).finally(() => {
      if (this.inFlight === task) this.inFlight = null;
    });
    this.inFlight = task;
    return task;
  }

  private async perform(
    userAuthorized: boolean,
    onProgress?: (phase: MigrationPhase) => void,
  ): Promise<MigrationResult> {
    if (!userAuthorized) return blocked("CONSENT_REQUIRED");
    if (this.env.origin !== LEGACY_APP_ORIGIN) return blocked("WRONG_SOURCE_ORIGIN");
    if (!this.port.isOnline()) return blocked("OFFLINE");

    try {
      onProgress?.("checking");
      const identity = await this.port.readAuthenticatedIdentity();
      if (!validIdentity(identity)) return blocked("LOGIN_REQUIRED");

      const initialAudit = await this.port.inspectAllLocalDatabases(identity);
      if (!auditIsComplete(initialAudit)) return blocked("INCOMPLETE_INVENTORY");

      const now = this.env.now?.() ?? new Date();
      const consent = await this.port.recordExplicitConsent({
        identity,
        releaseId: MIGRATION_RELEASE_ID,
        textVersion: CONSENT_TEXT_VERSION,
        grantedAt: now.toISOString(),
      });
      if (
        !consent.id ||
        !sameIdentity(consent.identity, identity) ||
        consent.textVersion !== CONSENT_TEXT_VERSION ||
        consent.releaseId !== MIGRATION_RELEASE_ID
      ) return blocked("CONSENT_NOT_CONFIRMED");

      onProgress?.("backup");
      const backup = await this.port.createNonDestructiveBackup(identity);
      if (
        !backup.snapshotId ||
        !sameIdentity(backup.identity, identity) ||
        !backup.durableOnOriginalDevice ||
        !backup.binaryAttachmentsPreserved ||
        !exactCoverage(backup.coveredDatabases, LEGACY_DATABASES)
      ) return blocked("BACKUP_INCOMPLETE");

      if (!this.port.isOnline()) return blocked("OFFLINE");
      onProgress?.("syncing");
      await this.port.synchronizeEveryPendingDomain({
        identity,
        backup,
        consent,
      });

      onProgress?.("verifying");
      const receipt = await this.port.verifyDurableServerAcks({
        identity,
        backup,
        consent,
      });

      if (
        !receipt.migrationId ||
        receipt.snapshotId !== backup.snapshotId ||
        receipt.consentReceiptId !== consent.id ||
        !sameIdentity(receipt.identity, identity) ||
        !receipt.durable ||
        receipt.unacknowledgedRecords !== 0 ||
        receipt.unacknowledgedAttachments !== 0 ||
        !exactCoverage(receipt.acknowledgedDatabases, TRANSFERABLE_DATABASES) ||
        !notExpired(receipt.expiresAt, this.env.now?.() ?? new Date())
      ) return blocked("SERVER_ACK_INCOMPLETE");

      // Prevent redirect if new offline commands or photos appeared mid-sync.
      const finalAudit = await this.port.inspectAllLocalDatabases(identity);
      if (!noPendingAfterSync(finalAudit)) return blocked("NEW_LOCAL_PENDING");

      if (!this.port.isOnline()) return blocked("OFFLINE");
      const handoff = await this.port.createSingleUseHandoff(receipt);
      if (
        !/^[a-zA-Z0-9_-]{20,160}$/.test(handoff.code) ||
        !notExpired(handoff.expiresAt, this.env.now?.() ?? new Date())
      ) return blocked("HANDOFF_INVALID");

      // Fragment only: never put credentials or a migration code in HTTP logs.
      // Receiving PWA must re-authenticate and redeem this one-time code.
      const url = new URL("/baixar", NEW_APP_ORIGIN);
      url.hash = "migration=" + encodeURIComponent(handoff.code);
      onProgress?.("opening");
      return { ok: true, url: url.toString(), migrationId: receipt.migrationId };
    } catch {
      // Fail closed; errors can contain secrets and must not be shown or logged.
      return blocked("MIGRATION_INTERRUPTED");
    }
  }
}
