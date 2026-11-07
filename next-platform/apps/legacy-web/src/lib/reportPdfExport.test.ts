import { describe,it,expect,vi,afterEach } from "vitest";
import {fetchPdfBinaryWithTimeout,forEachLimited,prepareReportPdfDownload,downloadGeneratedPdf,ReportExportTimeoutError,withReportExportDeadline} from "./reportPdfExport";
afterEach(()=>vi.useRealTimers());
describe("export safeguards",()=>{
it("preserves results",async()=>{expect(await withReportExportDeadline(Promise.resolve({data:[1]}),"db",Date.now()+1000)).toEqual({data:[1]});});
it("expires hung requests",async()=>{vi.useFakeTimers();const promise=expect(withReportExportDeadline(new Promise(()=>{}),"db",Date.now()+1000)).rejects.toBeInstanceOf(ReportExportTimeoutError);await vi.advanceTimersByTimeAsync(1000);await promise;});
it("limits RPC concurrency",async()=>{let active=0,peak=0;await forEachLimited([1,2,3,4,5],2,async()=>{peak=Math.max(peak,++active);await Promise.resolve();active--;});expect(peak).toBeLessThanOrEqual(2);});
it("does not generate empty PDF downloads",()=>{expect(()=>prepareReportPdfDownload(new Blob([]),"report.pdf")).toThrow(/vazio/);});
});

it("rejects empty generated PDF",()=>{expect(()=>downloadGeneratedPdf(new Blob([]),"empty.pdf")).toThrow(/vazio/);});

describe("download with real timeout and transport errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a fetch that never settles, even when abort is ignored", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const expectation = expect(fetchPdfBinaryWithTimeout("/example.pdf", 1500))
      .rejects.toBeInstanceOf(ReportExportTimeoutError);
    await vi.advanceTimersByTimeAsync(1501);
    await expectation;
  });

  it("rejects HTTP errors without creating a download", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found", { status: 404 })));
    await expect(fetchPdfBinaryWithTimeout("/missing.pdf")).rejects.toThrow("HTTP 404");
  });

  it("rejects empty downloads", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));
    await expect(fetchPdfBinaryWithTimeout("/empty.pdf")).rejects.toThrow("Arquivo vazio");
  });
});
