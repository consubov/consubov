import { describe, it, expect } from "vitest";
import {
  classifyPublishedRelease,
  isNewerBuildTimestamp,
  isWaitingWorkerForPublishedRelease,
} from "./publishedUpdate";
const local = "1793286452000";

describe("PWA anti-downgrade policy", () => {
  it("rejects remote 1.155.0 when the loaded app is 2.0.0 even with a newer timestamp", () => {
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "1.155.0", version: "1793286453000" })).toBe("older");
  });
  it("rejects a stale build even when SemVer matches", () => {
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.0.0", version: "1793286451000" })).toBe("older");
  });
  it("accepts only a newer build of the same or greater product version", () => {
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.0.0", version: "1793286453000" })).toBe("newer");
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.1.0", version: "1793286453000" })).toBe("newer");
  });
  it("treats identical release as current", () => {
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.0.0", version: local })).toBe("current");
  });
  it("rejects missing and inconsistent metadata", () => {
    expect(classifyPublishedRelease("2.0.0", local, null)).toBe("invalid");
    expect(classifyPublishedRelease("2.0.0", local, { version: "1793286453000" })).toBe("invalid");
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.1.0", version: local })).toBe("invalid");
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.0.0", version: "not-a-build" })).toBe("invalid");
  });
  it("does not trust numerically unsafe or malformed SemVer values", () => {
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.0.0-rc.1", version: "1793286453000" })).toBe("invalid");
    expect(classifyPublishedRelease("2.0.0", local, { appVersion: "2.999999999999999999999.0", version: "1793286453000" })).toBe("invalid");
  });
  it("ignores stale SW activation messages", () => {
    expect(isNewerBuildTimestamp("1793286451000", local)).toBe(false);
    expect(isNewerBuildTimestamp("1793286453000", local)).toBe(true);
  });
  it("will activate only the verified same-origin SW build", () => {
    const origin = "https://app.consubov.com.br";
    expect(isWaitingWorkerForPublishedRelease(origin + "/sw.js?v=1793286453000", "1793286453000", origin)).toBe(true);
    expect(isWaitingWorkerForPublishedRelease(origin + "/sw.js?v=1793286451000", "1793286453000", origin)).toBe(false);
    expect(isWaitingWorkerForPublishedRelease("https://other.example/sw.js?v=1793286453000", "1793286453000", origin)).toBe(false);
  });
});
