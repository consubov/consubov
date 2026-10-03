import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SYNC_COMMAND,
  MAX_AUTO_RETRIES,
  MAX_DEFERRED_ROUNDS,
  MAX_LOCAL_LOT_CODE,
  PARENT_TABLE_BY_SYNC_PARENT_KIND,
  SYNC_ATTEMPTS,
  SYNC_DRAIN_BACKOFF_BASE_MS,
  SYNC_DRAIN_MAX_ROUNDS,
  SYNC_NETWORK_TIMEOUT_MS,
  SYNC_PHOTO_CONFIRM_TIMEOUT_MS,
  SYNC_PHOTO_UPLOAD_TIMEOUT_MS,
  SYNC_RETRY_DELAY_BASE_MS,
  SYNC_RETRY_DELAY_CAP_MS,
  SYNC_UPSERT_DEFAULT_CONFLICT_TARGET,
  type SyncCommand,
  evaluateTombstonePurge,
} from "./index";

describe("sync contracts preserved from the running queue", () => {
  test("keeps the proven retry and deferral ceilings", () => {
    expect(MAX_AUTO_RETRIES).toBe(3);
    expect(MAX_DEFERRED_ROUNDS).toBe(2);
    expect(SYNC_DRAIN_MAX_ROUNDS).toBe(200);
    expect(SYNC_DRAIN_BACKOFF_BASE_MS).toBe(650);
  });

  test("keeps the proven network timings", () => {
    expect(SYNC_RETRY_DELAY_BASE_MS).toBe(700);
    expect(SYNC_RETRY_DELAY_CAP_MS).toBe(4_000);
    expect(SYNC_NETWORK_TIMEOUT_MS).toBe(30_000);
    expect(SYNC_PHOTO_UPLOAD_TIMEOUT_MS).toBe(90_000);
    expect(SYNC_PHOTO_CONFIRM_TIMEOUT_MS).toBe(60_000);
    expect(SYNC_ATTEMPTS).toBe(3);
  });

  test("keeps the upsert conflict default that makes a replay idempotent", () => {
    expect(SYNC_UPSERT_DEFAULT_CONFLICT_TARGET).toBe("id");
  });

  test("maps each parent kind to the table that holds it", () => {
    expect(PARENT_TABLE_BY_SYNC_PARENT_KIND).toEqual({
      pasto: "visita_pastos",
      curral: "visita_currais",
      topico: "visita_topicos",
    });
  });

  test("keeps the local lot code range", () => {
    expect(MAX_LOCAL_LOT_CODE).toBe(999);
  });

  test("never purges tombstones without canonical checkpoint evidence", () => {
    expect(evaluateTombstonePurge({
      hasCanonicalCheckpoint: false,
      allKnownClientsAdvanced: true,
    })).toEqual({ allowed: false, reason: "checkpoint-unavailable" });

    expect(evaluateTombstonePurge({
      hasCanonicalCheckpoint: true,
      allKnownClientsAdvanced: false,
    })).toEqual({ allowed: false, reason: "clients-not-advanced" });

    expect(evaluateTombstonePurge({
      hasCanonicalCheckpoint: true,
      allKnownClientsAdvanced: true,
    })).toEqual({ allowed: true });
  });

  test("describes a remote sync command with its default command text", () => {
    const command: SyncCommand = {
      id: "cmd-1",
      targetUserId: "user-1",
      senderUserId: null,
      command: DEFAULT_SYNC_COMMAND,
      createdAt: "2026-01-01T00:00:00.000Z",
      acknowledgedAt: null,
    };

    expect(command.command).toBe("sync");
    expect(command.senderUserId).toBeNull();
    expect(command.acknowledgedAt).toBeNull();
  });
});

