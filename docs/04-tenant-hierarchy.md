# Hierarquia operacional Fazenda -> Retiro -> Pasto

## Estado

Este documento descreve somente a hierarquia comprovada no Web legado e sua relação com o modelo canônico de tenancy.

## Tenancy

O tenant representa a organização/empresa contratante. **Tenant não é usuário e não é fazenda.** Um tenant pode possuir múltiplas fazendas.

Na arquitetura nova, autorização tenant-scoped deve ser resolvida no backend por contexto explícito. Navegação, menu, parâmetros de rota ou filtros no frontend não substituem RBAC nem isolamento server-side.

[PENDENTE] O mapeamento definitivo entre o tenant canônico e as tabelas legadas de fazendas só será consolidado quando houver evidência suficiente do schema/migração. Não inferir esse vínculo a partir de `user_id` ou do perfil logado.

## Hierarquia operacional comprovada no Web

```text
fazenda
  -> retiro (`retiros.fazenda_id`)
      -> pasto (`pastos.retiro_id`)
```

A rota administrativa materializa a mesma cadeia:

```text
/admin/fazendas/:fazendaId/retiros/:retiroId/pastos/:pastoId
```

O Web deve validar a coerência entre os IDs carregados antes de renderizar uma combinação de ancestrais. Essa validação evita breadcrumb/contexto misturado, mas **não é uma autorização de segurança**.

## IDs

Os identificadores devem ser tratados como estáveis e opacos. A estratégia arquitetural de IDs independentes de provider já está documentada em `docs/18-identificadores-tempo.md`.

Este documento não afirma versão de UUID, origem de geração nem cardinalidade `user -> fazenda` sem evidência específica.

## Regras para a FASE 4

- preservar as rotas e telas existentes;
- validar `retiro.fazenda_id === fazendaId` quando a rota carregar ambos;
- validar `pasto.retiro_id === retiroId` quando a rota carregar ambos;
- validar `pasto.fazenda_id === fazendaId` quando esse campo existir no registro legado;
- não usar a validação frontend como substituta de tenant/RBAC server-side;
- não inventar permissões por papel a partir da estrutura de URL;
- manter testes com o componente real para ancestralidade válida e inconsistente.

## Referências

- `docs/10-auth-tenancy-contracts.md`;
- `docs/18-identificadores-tempo.md`;
- `docs/21-tenancy-rbac-auth-auditoria.md`;
- `docs/22-baseline-funcional-web.md`;
- `apps/web/src/pages/PastoDetailPage.tsx`.

Data da revisão: 2026-10-05.
