// A transferência entre retiros é a única entidade de inventário com id próprio
// usado como `referencia_id` pelas duas movimentações que ela origina
// (useEstoqueData.ts:269-270).
export type TransferenciaEstoqueId =
  string & { readonly __brand: "TransferenciaEstoqueId" };