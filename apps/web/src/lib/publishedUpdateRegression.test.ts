import { describe, expect, test } from "vitest";
import {
  classifyPublishedRelease, isNewerBuildTimestamp, isWaitingWorkerForPublishedRelease, shouldNotifyPublishedBuild,
} from "./publishedUpdate";

const current = "1793286452000";
const origin = "https://app.consubov.com.br";
describe("INC-011 nonrepeating update acceptance", () => {
  test("same build and older versions never offer an update", () => {
    expect(classifyPublishedRelease("2.0.0", current, {appVersion:"2.0.0",version:current})).toBe("current");
    expect(classifyPublishedRelease("2.0.0", current, {appVersion:"1.155.0",version:"1793286453000"})).toBe("older");
    expect(classifyPublishedRelease("2.0.0", current, {appVersion:"2.0.0",version:"1793286451000"})).toBe("older");
  });
  test("a build must be newer AND worker waiting must match its origin/build", () => {
    const future = "1793286453000";
    expect(classifyPublishedRelease("2.0.0",current,{appVersion:"2.0.0",version:future})).toBe("newer");
    expect(isWaitingWorkerForPublishedRelease(origin+"/sw.js?v="+future,future,origin)).toBe(true);
    expect(isWaitingWorkerForPublishedRelease(origin+"/sw.js?v="+current,future,origin)).toBe(false);
    expect(isWaitingWorkerForPublishedRelease("https://other.example/sw.js?v="+future,future,origin)).toBe(false);
  });
  test("notification for one build is not repeated after reopening the installed PWA", () => {
    const future = "1793286453000";
    const storage = new Map();
    const permitted = shouldNotifyPublishedBuild(future,current,storage.get("notified")??null);
    expect(permitted).toBe(true);
    storage.set("notified",future);
    expect(shouldNotifyPublishedBuild(future,current,storage.get("notified"))).toBe(false);
    expect(shouldNotifyPublishedBuild("1793286454000",current,storage.get("notified"))).toBe(true);
  });
  test("malformed metadata and offline responses do not generate a false prompt", () => {
    expect(classifyPublishedRelease("2.0.0",current,{appVersion:"2.0.0",version:"corrupt"})).toBe("invalid");
    expect(classifyPublishedRelease("2.0.0",current,null)).toBe("invalid");
    expect(isNewerBuildTimestamp("bad",current)).toBe(false);
    expect(shouldNotifyPublishedBuild(current,current,null)).toBe(false);
  });
});
