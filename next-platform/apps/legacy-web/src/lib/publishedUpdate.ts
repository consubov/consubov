/** PWA update metadata must NEVER be treated as an upgrade solely because it differs. */
export type PublishedRelease = { version?: unknown; appVersion?: unknown };
export type PublishedReleaseState = "newer" | "current" | "older" | "invalid";

function parseSemanticVersion(value: unknown): number[] | null {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value)) return null;
  const numbers = value.split(".").map(Number);
  return numbers.every(Number.isSafeInteger) ? numbers : null;
}

function parseBuildTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{12,15}$/.test(value)) return null;
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

function compareSemanticVersion(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

export function classifyPublishedRelease(
  localAppVersion: string,
  localBuildVersion: string,
  published: PublishedRelease | null | undefined,
): PublishedReleaseState {
  const localApp = parseSemanticVersion(localAppVersion);
  const remoteApp = parseSemanticVersion(published?.appVersion);
  const localBuild = parseBuildTimestamp(localBuildVersion);
  const remoteBuild = parseBuildTimestamp(published?.version);
  if (!localApp || !remoteApp || localBuild === null || remoteBuild === null) return "invalid";
  const compareApp = compareSemanticVersion(remoteApp, localApp);
  if (compareApp < 0 || remoteBuild < localBuild) return "older";
  if (compareApp === 0 && remoteBuild === localBuild) return "current";
  // An allegedly newer app with the same build ID is inconsistent metadata.
  if (remoteBuild === localBuild) return "invalid";
  return "newer";
}

export function isNewerBuildTimestamp(candidate: unknown, current: string): boolean {
  const newer = parseBuildTimestamp(candidate);
  const loaded = parseBuildTimestamp(current);
  return newer !== null && loaded !== null && newer > loaded;
}

/** A waiting SW can be applied only if its script URL identifies this verified build. */
export function isWaitingWorkerForPublishedRelease(
  scriptUrl: string | undefined,
  remoteBuildVersion: string,
  currentOrigin: string,
): boolean {
  if (!scriptUrl || parseBuildTimestamp(remoteBuildVersion) === null) return false;
  try {
    const url = new URL(scriptUrl, currentOrigin);
    return url.origin === currentOrigin && url.pathname === "/sw.js" && url.searchParams.get("v") === remoteBuildVersion;
  } catch {
    return false;
  }
}

/** Avoid repeating an OS update notification for the same published build across tabs/restarts. */
export function shouldNotifyPublishedBuild(waitingBuild: unknown, localBuild: string, previouslyNotified: string | null): boolean {
  return typeof waitingBuild === "string" &&
    isNewerBuildTimestamp(waitingBuild, localBuild) &&
    waitingBuild !== previouslyNotified;
}
