/**
 * Contratos de arquivo/anexo.
 *
 * Evidência do legado (não há provider conectado nesta fase):
 * - O bucket de comprovantes exige o primeiro segmento do caminho igual ao
 *   usuário autenticado: supabase/migrations/20260713182610_*.sql:4-16, com o
 *   caminho montado como `${user.id}/${timestamp}-${rand}.${ext}` em
 *   apps/web/src/pages/ConsultorDespesasPage.tsx:124-126.
 * - O bucket de relatórios é compartilhado entre pesagem, visita e despesas,
 *   com leitura pública e escrita autenticada:
 *   supabase/migrations/20260416093205_*.sql:3-5, e o bucket em
 *   apps/web/src/lib/visitaPdf.ts:16.
 * - Caminhos comprovados: `pesagens/${fazendaId}/${pesagemId}/${fileName}`
 *   (apps/web/src/hooks/useOfflinePesagem.ts:113-116),
 *   `pecuarista/pesagens/${pesagemId}-${Date.now()}.pdf`
 *   (apps/web/src/pages/PecuaristaPesagemExecPage.tsx:638-640),
 *   `${folder}/${parentId}/${ordem}-${localId}.jpg`
 *   (apps/web/src/lib/consultorOffline/photoQueue.ts:354-361),
 *   `${fazenda_id}/${lancamento_id}/auditoria.jpg`
 *   (apps/web/src/lib/fotoSalgaQueue.ts:16),
 *   `fabrica/${fabricaId}/batidas/${ts}-${rand}-${fileName}`
 *   (apps/web/src/components/fabrica/ProducaoTab.tsx:275-279).
 *
 * Não existe limite de tamanho nem lista de tipos permitidos em nenhuma
 * migration do legado; a validação existente acontece no cliente
 * (apps/web/src/lib/imageCompression.ts:99). Por isso este módulo não declara
 * nenhuma regra de tamanho ou de tipo.
 */

export type ArquivoCaminho = string & { readonly __brand: "ArquivoCaminho" };

/**
 * Como o arquivo é isolado. Os dois modelos coexistem no legado e não podem ser
 * misturados: um exige pasta do usuário, o outro não exige pasta nenhuma.
 */
export type ArquivoEscopo =
  | { readonly kind: "usuario"; readonly usuarioId: string }
  | { readonly kind: "compartilhado" };

/** Caminho derivado do escopo, no formato usado pelo bucket que exige pasta. */
export function caminhoDoEscopo(
  escopo: ArquivoEscopo,
  nomeArquivo: string,
): ArquivoCaminho {
  return (
    escopo.kind === "usuario"
      ? `${escopo.usuarioId}/${nomeArquivo}`
      : nomeArquivo
  ) as ArquivoCaminho;
}

export type ArquivoReferencia = {
  readonly caminho: ArquivoCaminho;
  /**
   * Produzida pelo adaptador: pode ser URL pública ou URL assinada. O domínio
   * não decide qual das duas, e não guarda segredo de assinatura.
   */
  readonly url: string;
};

export type StoreFileCommand = {
  readonly escopo: ArquivoEscopo;
  readonly nomeArquivo: string;
  readonly conteudo: Uint8Array;
  /**
   * O legado envia o tipo em quase todos os fluxos, mas o comprovante de
   * despesa segue sem ele (apps/web/src/pages/ConsultorDespesasPage.tsx:124-126).
   */
  readonly contentType?: string | null;
};
