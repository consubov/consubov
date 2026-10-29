import { describe,it,expect,vi,afterEach } from "vitest";
import {forEachLimited,prepareReportPdfDownload,downloadGeneratedPdf,ReportExportTimeoutError,withReportExportDeadline} from "./reportPdfExport";
afterEach(()=>vi.useRealTimers());
describe("export safeguards",()=>{
it("preserves results",async()=>{expect(await withReportExportDeadline(Promise.resolve({data:[1]}),"db",Date.now()+1000)).toEqual({data:[1]});});
it("expires hung requests",async()=>{vi.useFakeTimers();const promise=expect(withReportExportDeadline(new Promise(()=>{}),"db",Date.now()+1000)).rejects.toBeInstanceOf(ReportExportTimeoutError);await vi.advanceTimersByTimeAsync(1000);await promise;});
it("limits RPC concurrency",async()=>{let active=0,peak=0;await forEachLimited([1,2,3,4,5],2,async()=>{peak=Math.max(peak,++active);await Promise.resolve();active--;});expect(peak).toBeLessThanOrEqual(2);});
it("does not generate empty PDF downloads",()=>{expect(()=>prepareReportPdfDownload(new Blob([]),"report.pdf")).toThrow(/vazio/);});
});

it("rejects empty generated PDF",()=>{expect(()=>downloadGeneratedPdf(new Blob([]),"empty.pdf")).toThrow(/vazio/);});
