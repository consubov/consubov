# INC-P0 CONSUBOV 2.0.38 — gerente e timeout de consumo (2026-11-02)

## Causa reproduzida no app instalado na VPS (2.0.37)
- Pela visualização como Gerente da sessão administrativa, painel exibia
  'Não foi possível confirmar os dados das fazendas'.
- Requisições READ-ONLY de gerentes, gerentes_fazendas, fazendas, retiros,
  ciclos, pastos, view_consumo_tempo_real, produtos_fazendas, produtos e
  observacoes responderam HTTP 200.
- RPC POST /rest/v1/rpc/get_consumo_mineral retornou HTTP 500,
  SQLSTATE 57014 (statement timeout), aproximadamente 20 segundos.
- useGerenteData propagava o erro opcional e seu loading para bloquear
  a tela toda, apesar de existir leitura principal válida.
- Não foram armazenados dados pessoais, tokens ou credenciais.

## Implementação
1. useGerenteData isola erro e loading da RPC de consumo, com retry próprio.
2. GerenteDashboard mostra dados confirmados e aviso de indisponibilidade,
   com custos e indicadores sem confirmação exibidos como N/D.
3. Em erro da RPC, soma de sacos vem dos lançamentos da view confirmada.
4. Consulta de vínculos sem nested join: principal autenticada funciona
   isoladamente em erro de associações, sem conceder fazendas extras.
5. Sem SQL, RLS, DML, migrations, limpeza offline ou alteração de usuários.

## Gates
- TypeScript PASS, 10 testes unitários de escopo de gerente PASS.
- E2E Playwright reproduz RPC 500 com 57014; painel segue visível,
  aviso é exibido: 1/1 PASS com fixture local em Chromium desktop.
- Pendente: QA completo no SHA de release e readback real pós-deploy.
- Otimização de get_consumo_mineral no backend é uma frente separada;
  este hotfix não afirma resolver a causa de performance no banco.

## QA final para candidato 2.0.38 (VPS/VS Code)
- Base Git: 9acf4e57 (main publicada anterior); árvore WIP isolada.
- TypeScript, build e testes Web: task qa:check PASS, 347/347 Web em 70 arquivos,
  API e typecheck PASS. Recibo .qa/gerente-2038-check.log / .qa/runs.
- Regressões: task qa:regressions PASS 484/484 após copiar o scanner
  Gitleaks 8.30.1 verificado por SHA-256 de outra worktree da VPS.
  Primeira tentativa não executou os casos de scanner por binário ausente.
- E2E Playwright completo: 183/183 PASS desktop/tablet/mobile,
  com 3 casos novos para RPC 57014 simulada, sem rede externa
  e sem dados reais. Log .qa/gerente-2038-e2e.log.
- task qa:pwa:build-preflight PASS, 343/343 assets de precache;
  task qa:security PASS; offline core 61/61 PASS;
  offline browser 22/22 PASS; PWA upgrade 44/44 PASS.
- Nenhuma conta real usada neste QA automatizado. Os testes reais
  com sessão já aberta serão feitos apenas após deploy, somente leitura.
