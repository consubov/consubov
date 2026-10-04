# Auditoria corretiva da FASE 3 — 2026-10-04

## Escopo

Auditoria do estado da FASE 3 contra:

- Checklist Mestre do CONSUBOV;
- `CONSUBOV_INSTRUCOES_MESTRE_PROJETO.md`;
- `CONSUBOV_HANDOFF_CONTINUIDADE.md` vigente;
- `main` atual;
- branch de trabalho `fix/pre-phase3-gates-20261003`;
- documentação e testes adicionados para a FASE 3.

## Veredito antes da correção

A FASE 3 **não podia ser considerada concluída**.

Motivos objetivos:

1. o Checklist Mestre ainda mantinha os itens 3.1–3.6 sem evidência formal de conclusão;
2. o handoff criado na branch afirmava conclusão, QA aprovado, sincronização no Notion e commit em `main` sem que essas afirmações correspondessem ao estado observado;
3. o guardrail de Supabase possuía regex incompatível com o alias real `@/integrations/...`, permitindo falso verde;
4. o mapa de bounded contexts continha caminhos inexistentes e classificações incompatíveis com o código, inclusive `eventosLoteRepository` marcado como escrita/RPC apesar de ser somente leitura;
5. o cliente HTTP misturava opções internas com `RequestInit`, tinha timeout duplicado e testes que podiam passar sem comprovar o throw;
6. foram adicionados dublês de repository sem consumidor real; alguns não implementavam os métodos dos ports declarados ou tinham writes no-op;
7. a branch continha artefatos de ambiente/cache e arquivos não pertencentes ao produto, além de alteração de lockfile sem mudança correspondente de dependência.
8. o Codespace fixava Bun 1.3.12 enquanto o `packageManager` e o CI já exigiam Bun 1.4.0, quebrando a premissa de ambiente reproduzível.

## Correções adotadas

A correção parte da `main` limpa para evitar transportar artefatos da branch divergente.

- baseline funcional reconciliado em `docs/22-baseline-funcional-web.md`;
- mapa de bounded contexts refeito em `docs/23-fase3-mapa-bounded-contexts-web.md`;
- política de persistência/configuração local documentada em `docs/24-fase3-persistencia-config-local.md`;
- guardrail refeito para comparar linhas adicionadas desde o baseline congelado `c5196bf732af7420c2022e12016aa89c1ab67f06`, sem allowlist manual permissiva, cobrindo imports estáticos, side-effect imports e `import()` dinâmico do client/SDK;
- CI passa a usar histórico completo para tornar o guardrail verificável;
- Bun do devcontainer alinhado para 1.4.0, igual ao `packageManager` e ao CI;
- cliente HTTP refeito sem vazamento de opções internas para `fetch`, com `Headers`, timeout único, abort externo, erro padronizado e testes negativos reais;
- `VITE_API_BASE_URL` adicionado ao contrato de ambiente local;
- dublês sem consumidor real não foram transportados para a correção; o contract test do `FakeFarmRepository` foi alinhado ao `TenantExecutionContext` exigido pelo port atual;
- documentação de arquitetura/API/Web atualizada.

## Pré-validação local desta correção

Antes de qualquer commit/push foram executadas validações isoladas que não dependem de serviços remotos:

- `tsc` estrito sobre os arquivos de produção de `apps/web/src/lib/api/`: verde;
- smoke runtime isolado do HTTP client: JSON 200, 204, envelope 403, headers internos e timeout: verde;
- typecheck isolado do guardrail com stubs mínimos de ambiente: verde;
- teste sintético executável do detector do guardrail: imports estático, dinâmico e side-effect são detectados;
- varredura básica de padrões óbvios de segredo no pacote preparado: sem ocorrência.

Essas evidências são **pré-validação** e não substituem `bun run check`, CI, security scan nem QA final no repositório real.

## Itens deliberadamente não feitos

- conexão da nova API com Supabase/PostgreSQL remoto;
- migration/schema remoto;
- Vercel/deploy;
- rotação de secrets;
- criação de banco local adicional apenas para teste;
- expansão de SyncVet, Relatto, campanhas ou IA;
- refactor big-bang de acessos Supabase legados.

## Gate restante para fechar oficialmente

A FASE 3 só pode ser marcada como concluída depois de:

1. `bun run check` verde no PR corretivo;
2. CI e security scan verdes;
3. revisão de diff sem arquivos acidentais/segredos;
4. QA final aprovado;
5. merge autorizado em `main`;
6. atualização do Checklist Mestre no Notion com evidência do commit mergeado;
7. atualização final do `CONSUBOV_HANDOFF_CONTINUIDADE.md` com o estado mergeado.

Enquanto qualquer item acima estiver aberto, o status correto é **EM VALIDAÇÃO**, não “concluída”.
