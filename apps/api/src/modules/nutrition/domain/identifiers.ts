/**
 * Identificador do produto no catálogo.
 *
 * O catálogo é global e compartilhado entre fazendas — a associação produto↔fazenda
 * vive em outra tabela — por isso o identificador não carrega tenant
 * (colunas de produtos: tipo gerado do cliente web).
 */
export type ProdutoId = string & { readonly __brand: "ProdutoId" };
