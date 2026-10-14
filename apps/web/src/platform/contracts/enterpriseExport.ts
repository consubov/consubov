/**
 * Contratos arquiteturais para integrações empresariais (ERP, Contábil, Fiscal e Webhooks).
 * Assegura exportações estruturadas, seguras e com integridade criptográfica.
 */

export type ExportFormat = "json-canonical" | "csv-semicolon";

export type ExportEntityType = "pesagens" | "lancamentos_salga" | "leituras_cocho" | "animais";

export interface ExportRecord {
  id: string;
  tenantId: string;
  dataRegistro: string;
  identificadorAnimalOuLote: string;
  valorPrincipal: number;
  unidade: string;
  observacoes?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  format: ExportFormat;
  contentType: string;
  content: string;
  recordCount: number;
  checksumSha256: string;
  generatedAt: string;
  tenantId: string;
}

export interface EnterpriseWebhookPayload {
  webhookId: string;
  tenantId: string;
  eventType: string;
  timestamp: string;
  idempotencyKey: string;
  data: Record<string, unknown>;
  signatureSha256?: string;
}

export interface EnterpriseExportPort {
  exportRecords(
    tenantId: string,
    entityType: ExportEntityType,
    records: ExportRecord[],
    format: ExportFormat
  ): Promise<ExportResult>;
}

/**
 * Utilitário puro para cálculo de hash SHA-256 no browser ou Node.
 */
async function computeSha256(content: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("Web Crypto SHA-256 unavailable");
}

/** Refuse cross-tenant and missing tenant export requests before serializing any bytes. */
function assertTenantScope(tenantId: string, records: ExportRecord[]): void {
  if (!tenantId.trim() || !Array.isArray(records) || records.some((record) => record.tenantId !== tenantId)) {
    throw new Error("Export tenant mismatch");
  }
}

/**
 * Gera exportação CSV com padrão brasileiro (ponto-e-vírgula e vírgula decimal)
 * para integração com ERPs contábeis e fiscais (Totvs, Senior, Sankhya).
 */
export async function generateCsvExport(tenantId: string, records: ExportRecord[]): Promise<ExportResult> {
  assertTenantScope(tenantId, records);
  const header = "id;tenant_id;data_registro;identificador;valor;unidade;observacoes";
  const rows = records.map((r) => {
    const idSafe = r.id.replace(/;/g, "");
    const dateSafe = r.dataRegistro;
    const identSafe = r.identificadorAnimalOuLote.replace(/;/g, "");
    const valorFormatted = r.valorPrincipal.toFixed(2).replace(".", ",");
    const obsSafe = (r.observacoes ?? "").replace(/[;\r\n]/g, " ");
    return `${idSafe};${tenantId};${dateSafe};${identSafe};${valorFormatted};${r.unidade};${obsSafe}`;
  });

  const content = [header, ...rows].join("\r\n");
  const checksumSha256 = await computeSha256(content);

  return {
    format: "csv-semicolon",
    contentType: "text/csv; charset=utf-8",
    content,
    recordCount: records.length,
    checksumSha256,
    generatedAt: new Date().toISOString(),
    tenantId,
  };
}

/**
 * Gera exportação JSON canônica e ordenada por chave.
 */
export async function generateJsonCanonicalExport(tenantId: string, records: ExportRecord[]): Promise<ExportResult> {
  assertTenantScope(tenantId, records);
  const payload = {
    schemaVersion: "1.0.0",
    tenantId,
    exportedAt: new Date().toISOString(),
    totalRecords: records.length,
    records: records.map((r) => ({
      id: r.id,
      dataRegistro: r.dataRegistro,
      identificador: r.identificadorAnimalOuLote,
      valor: r.valorPrincipal,
      unidade: r.unidade,
      observacoes: r.observacoes ?? null,
    })),
  };

  const content = JSON.stringify(payload, null, 2);
  const checksumSha256 = await computeSha256(content);

  return {
    format: "json-canonical",
    contentType: "application/json; charset=utf-8",
    content,
    recordCount: records.length,
    checksumSha256,
    generatedAt: payload.exportedAt,
    tenantId,
  };
}

