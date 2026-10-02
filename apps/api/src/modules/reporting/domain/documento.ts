/**
 * Bucket único compartilhado por pesagem, visita e relatório de despesas
 * (apps/web/src/lib/visitaPdf.ts:16; apps/web/src/hooks/useOfflinePesagem.ts:113-116;
 * apps/web/src/pages/ConsultorDespesasPage.tsx:219-230).
 */
export const BUCKET_RELATORIOS = "relatorios";

/**
 * Bucket de comprovantes de despesa, distinto do bucket de relatórios
 * (apps/web/src/pages/ConsultorDespesasPage.tsx:95,126).
 */
export const BUCKET_FOTOS_DESPESAS = "despesas-consultor-fotos";

/**
 * Formatos de caminho comprovados dentro de `BUCKET_RELATORIOS`. A montagem do
 * valor final acontece no adaptador; aqui fica apenas a forma observada.
 */
export const CAMINHO_PDF_VISITA =
  "visitas-consultor/${consultorId}/${visitaId}/${fileName}";

export const CAMINHO_PDF_PESAGEM =
  "pesagens/${fazendaId}/${pesagemId}/${fileName}";

export const CAMINHO_PDF_PESAGEM_PECUARISTA =
  "pecuarista/pesagens/${pesagemId}-${epochMillis}.pdf";

export const CAMINHO_PDF_DESPESAS = "${consultorId}/relatorios/${epochMillis}.pdf";

/**
 * Referência a um documento já gerado. As colunas `pdf_url` existem em
 * `pesagens_lote_pecuarista`, `pesagens_compra`, `visitas_tecnicas` e
 * `relatorios_despesas` (types.ts:3817,3699,6424,4188): cada módulo é dono do
 * seu documento e apenas guarda o caminho, mas a forma da referência é a mesma e
 * por isso é compartilhada aqui.
 */
export type RelatorioDocumentoRef = {
  bucket: string;
  path: string;
  url: string;
};