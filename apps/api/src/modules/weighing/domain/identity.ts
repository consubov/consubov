/**
 * Identificadores da pesagem.
 *
 * O peso é sempre gravado em kg; a arroba é apresentação e pagamento
 * (pesagemCompra.ts:33-34). A marca de `PesagemId` cobre as pesagens de evento
 * (`pesagens`), de compra (`pesagens_compra`) e de lote do pecuarista
 * (`pesagens_lote_pecuarista`), que são tabelas distintas com o mesmo papel:
 * registrar pesos medidos.
 */
export type PesagemId = string & { readonly __brand: "PesagemId" };

/**
 * O lote de pesagem é o pasto no fluxo de evento do capataz
 * (`pesagens.lote_id` → `pastos.id`, types.ts:3683-3688) e o lote do pecuarista
 * no fluxo da balança (`pesagens_lote_pecuarista.lote_id` →
 * `lotes_pecuarista.id`, types.ts:3852-3857). São contextos diferentes com o
 * mesmo nome de campo; a marca cobre o identificador de lote, não a sua origem.
 */
export type LoteId = string & { readonly __brand: "LoteId" };

export type AnimalId = string & { readonly __brand: "AnimalId" };

export type LeituraBalancaoId = string & { readonly __brand: "LeituraBalancaoId" };

/**
 * Só existem dois tipos de balança, ambos explícitos nas telas:
 * `PecuaristaPesagemExecPage.tsx:88`, `PesadorPesagemExecPage.tsx:30,244` e
 * `PecuaristaLoteDetalhePage.tsx:163-164`. Não há tipo genérico de balança nem
 * adaptadores de equipamento.
 */
export type TipoBalanca = "individual" | "balancao";

export const TIPOS_BALANCA: readonly TipoBalanca[] = [
  "individual",
  "balancao",
];

export function isTipoBalanca(valor: string | null | undefined): valor is TipoBalanca {
  return (
    valor === "individual" ||
    valor === "balancao"
  );
}