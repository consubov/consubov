# PRD-F00-F04-CONSOLIDACAO — Auditoria, correção e fechamento das FASES 0–4

## 1. Objetivo
Auditar novamente as FASES 0, 1, 2, 2A, 2B, 3 e 4 contra o Checklist Mestre e o código atual, corrigir regressões comprovadas, concluir a FASE 4 no escopo local/legado permitido e consolidar todo o trabalho em uma única linha Git.

## 2. Contexto
- Base operacional atual: `main@ebdd0712c10d55993c3d2625500fc4e294eeee1b`.
- Linha única escolhida: `fix/fase4-audit-20261005` / PR #36.
- FASES 0–3 constam como concluídas no Checklist, mas precisam ser revalidadas contra regressões posteriores.
- FASE 4 está em andamento.
- PR #35/FASE 5 é linha paralela e deverá ser encerrada/consolidada para eliminar trabalho paralelo.
- Ações remotas continuam proibidas: Supabase/PostgreSQL remoto da nova arquitetura, migrations remotas, Vercel/deploy, rotação de secrets.

## 3. Escopo
### FASES 0–3
- revalidar governança, ADRs, política estrutural e terceiros;
- revalidar hardening das Edge Functions e gates de segurança;
- revalidar contratos modulares/API/OpenAPI/tenancy/RBAC/auditoria;
- revalidar guardrails arquiteturais da Web/API e regressões offline;
- remover documentação/handoffs ativos que contradigam o estado concluído.

### FASE 4
- 4.1 autenticação/navegação: login, recuperação de senha, perfil, redirects, guards, loading/erro, expiração e logout;
- 4.2 administração/gerência: superfícies existentes, estados e responsividade preservados;
- 4.3 estrutura pecuária: fazenda/retiro/pasto/ciclos/mapas e hierarquia;
- 4.4 QR: emissão, conferência, identidade sem autorização, parser e casos válido/inválido/desconhecido;
- 4.5 nutrição/salga: inventário funcional, fórmulas legadas identificadas sem alterar parâmetros não validados;
- 4.6 estoque/transferências: inventário de writes/saldos e contratos futuros de autoridade, concorrência, idempotência e conflito;
- 4.7 animais/lotes: inventário e política de rastreabilidade/append-only;
- 4.8 visitas: inventário e política pós-finalização/versionamento;
- 4.9 fábrica: inventário e fronteiras transacionais/idempotência/concorrência futuras;
- 4.10 pecuarista/pesagem: inventário, local-first, histórico e limites de integração com balanças;
- 4.11 relatórios: inventário de indicadores/origem/período/filtros/timezone/arredondamento;
- 4.12 landing: landing/CMS/parceiros/leads/auth pública/SEO básico/abuso;
- 4.13 push/realtime: inventário, autorização de push e regra de realtime não autoritativo;
- 4.14 SyncVet: preservar/congelar, inventariar e backlog pós-produção;
- 4.15 Relatto/campanhas/IA: preservar fronteiras, sem expansão, backlog pós-produção.

## 4. Fora do escopo
- conectar a nova API a banco/storage/auth remoto;
- executar migrations/schema remoto;
- deploy/Vercel/release;
- inventar fórmula zootécnica;
- inventar grants RBAC;
- homologar balança sem modelo/protocolo;
- expandir SyncVet, Relatto, campanhas ou IA;
- concluir FASE 5.

## 5. Áreas esperadas
`.github/workflows/**`, `apps/api/**`, `apps/web/**`, `supabase/functions/**`, `docs/**`, `instructions/active/**`, `scripts/**`.

## 6. Regras de segurança e integridade
- frontend nunca é autoridade final de tenant/RBAC;
- QR identifica recurso, não concede acesso;
- estoque/transferências/pesagens não usam LWW genérico;
- operação crítica futura deve usar comando idempotente, versão conhecida e transação/coordenação server-side;
- nenhuma credencial real em teste;
- nenhuma chamada remota nova;
- não mascarar divergência numérica;
- não alterar fórmula não validada;
- não apagar funcionalidade legado apenas para simplificar.

## 7. Critérios de aceite
- [ ] auditoria FASES 0–3 sem regressão material aberta;
- [ ] somente um PRD e um handoff ativos;
- [ ] recuperação de senha Web materializada com provider legado sem segredo;
- [ ] redirects/guards/logout/loading/erro testados;
- [ ] hierarquia fazenda→retiro→pasto validada;
- [ ] QR parser e recurso desconhecido cobertos;
- [ ] contratos 4.5–4.11 documentados com evidência e sem regra inventada;
- [ ] push/realtime e módulos congelados inventariados;
- [ ] qualidade local reproduzível e CI/security verdes;
- [ ] diff revisado e sem arquivo acidental;
- [ ] Checklist Mestre atualizado;
- [ ] QA final `AUDITORIA DE QUALIDADE` aprovado para FASES 0–4;
- [ ] PR consolidado mergeado após gates;
- [ ] branches paralelos/supersedidos removidos, restando somente `main`.

## 8. Testes obrigatórios
- `bun run check`;
- suíte Edge Functions;
- smoke HTTP/OpenAPI;
- testes Web de auth/guards/QR/hierarquia;
- testes estruturais/contratuais dos invariantes FASE 4;
- Playwright local sem credencial real para superfícies públicas/proteção de rota quando integrado;
- SAST, dependency scan e secret scan;
- repetir todos os gates após a consolidação final.

## 9. Validações obrigatórias
- comparar Checklist x código x docs;
- revisar diff;
- verificar ausência de segredo/PII/debug;
- verificar que nenhuma conexão remota nova foi criada;
- verificar que FASES 0–3 continuam compatíveis;
- verificar branches/PRs antes de remoção.

## 10. Documentação
Atualizar:
- documento permanente de fechamento FASES 0–4;
- docs de hierarquia/auth/contratos Web quando aplicável;
- índice `docs/README.md`;
- Checklist Mestre no Notion;
- handoff ativo;
- Handoff global do Projeto ao final.

## 11. Ações proibidas
Sem deploy, release, migration remota, schema remoto, rotação de secrets, force push, reset hard, drop/truncate ou expansão de módulos congelados.

## 12. Convivência
A partir deste PRD não haverá trabalho paralelo intencional nas FASES 0–4. PR #35 e branches supersedidos serão encerrados somente depois de registrar o motivo e preservar qualquer evidência necessária.

## 13. Gate de QA
Track: `AUDITORIA DE QUALIDADE`.

Resultado final:
- `QA: APROVADO — FASES 0–4`; ou
- `QA: REPROVADO`.

Se reprovado, corrigir e repetir gates antes do merge.

## 14. Regras de Git
- única linha de trabalho: `fix/fase4-audit-20261005`;
- base: `main`;
- sem criar nova branch;
- sem force push/reset hard;
- merge somente quando os gates estiverem verdes;
- após merge, remover branches supersedidos e a própria branch de trabalho para deixar somente `main`.

## 15. Relatório final
Resultado por fase, mudanças, testes, QA, Notion, PR/SHAs, branches removidos, pendências externas legítimas e estado do handoff.

## 16. Prompt de execução
Audite e corrija com evidência. Preserve o legado funcional. Feche a FASE 4 sem antecipar FASE 5 e sem inventar regra de negócio. Trate pendências externas genuínas como limites documentados, não como autorização para inventar comportamento.
