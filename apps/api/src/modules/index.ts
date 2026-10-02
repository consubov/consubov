/**
 * Superfície pública dos módulos da API (FASE 2.1 do PRD-ARC-02).
 *
 * Cada módulo é importado pelo seu próprio `index.ts`. Aqui eles aparecem como
 * namespace para que dois módulos nunca colidam por nome exportado e para que o
 * consumidor escolha explicitamente o módulo de onde importa.
 *
 * `observability/` e `shared/` existem na árvore por trabalho anterior e não
 * fazem parte dos 15 módulos desta fase; por isso não são exportados aqui. Ver
 * `docs/02-arquitetura.md` para o registro dessa decisão.
 */

export * as identityTenancy from "./identity-tenancy";
export * as farms from "./farms";
export * as pastures from "./pastures";
export * as nutrition from "./nutrition";
export * as inventory from "./inventory";
export * as visits from "./visits";
export * as feedMill from "./feed-mill";
export * as livestock from "./livestock";
export * as weighing from "./weighing";
export * as reporting from "./reporting";
export * as notifications from "./notifications";
export * as files from "./files";
export * as sync from "./sync";
export * as saasAdmin from "./saas-admin";
export * as integrations from "./integrations";
