/** Defenses for PDF reports; no report calculations are changed. */
export const REPORT_EXPORT_DEADLINE_MS = 120_000;
export const REPORT_EXPORT_QUERY_TIMEOUT_MS = 25_000;
export class ReportExportTimeoutError extends Error {
  constructor(readonly stage: string) { super("Tempo limite excedido: " + stage); this.name = "ReportExportTimeoutError"; }
}
export function withReportExportDeadline<T>(operation: PromiseLike<T>, stage: string, deadlineAt: number, stepLimitMs = REPORT_EXPORT_QUERY_TIMEOUT_MS): Promise<T> {
  const remaining = Math.min(deadlineAt - Date.now(), stepLimitMs);
  if (remaining <= 0) return Promise.reject(new ReportExportTimeoutError(stage));
  return new Promise<T>((resolve,reject) => {
    const timer = setTimeout(() => reject(new ReportExportTimeoutError(stage)), remaining);
    Promise.resolve(operation).then(value => { clearTimeout(timer); resolve(value); },error => { clearTimeout(timer); reject(error); });
  });
}
export async function forEachLimited<T>(items: readonly T[], limit: number, visit: (item:T) => Promise<void>): Promise<void> {
  if(!Number.isInteger(limit)||limit<1) throw new RangeError("Concurrency must be positive");
  let cursor=0;let failed=false;let firstError: unknown;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(!failed&&cursor<items.length){
      const item=items[cursor++];
      try { await visit(item); } catch(error) { if(!failed){failed=true;firstError=error;} }
    }
  }));
  if(failed) throw firstError;
}
export interface ReportPdfDownload { url:string; filename:string }
export function prepareReportPdfDownload(blob:Blob,filename:string):ReportPdfDownload {
  if(blob.size===0) throw new Error("O arquivo PDF gerado está vazio.");
  return {url:URL.createObjectURL(blob),filename:filename.endsWith(".pdf")?filename:filename+".pdf"};
}
export function triggerReportPdfDownload(file:ReportPdfDownload):void {
  const link=document.createElement("a");link.href=file.url;link.download=file.filename;link.rel="noopener";link.style.display="none";
  document.body.appendChild(link);try{link.click();}finally{link.remove();}
}
export function releaseReportPdfDownload(file:ReportPdfDownload):void {window.setTimeout(()=>URL.revokeObjectURL(file.url),120_000);}

export async function fetchPdfBinaryWithTimeout(url: string, timeoutMs = REPORT_EXPORT_QUERY_TIMEOUT_MS): Promise<Blob> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} ao obter arquivo`);
    const blob = await response.blob();
    if (!blob.size) throw new Error("Arquivo vazio");
    return blob;
  } finally { clearTimeout(timer); }
}
export function downloadGeneratedPdf(blob: Blob, filename: string): void {
  const file = prepareReportPdfDownload(blob, filename);
  try { triggerReportPdfDownload(file); }
  finally { releaseReportPdfDownload(file); }
}
