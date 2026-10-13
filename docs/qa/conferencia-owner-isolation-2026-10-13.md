# FASE 7 — isolamento local da fila da Conferência (2026-10-13)

**Escopo:** `conferenciaOffline.ts`, chamada única em `ConferenciaPage.tsx`, regressões. O sync anterior enviava itens `pendingConferencias` de outra conta após login diferente, pois não recebia identidade do usuário.

**Correção:** exigir `userId` no sync, ignorar itens cujo `item.user_id` difere, retornar sem acesso quando ID ausente, serializar solicitações de usuários diferentes e abortar novos envios no cleanup do componente. Preservados IDs, ACK, dados antigos, UI, armazenamento e chamadas de API existentes.

**RED:** teste isolado Node v22.16.0 com fonte remota de hash Git `44023ca77e483f242207d459be0ae9ee3a0d9ecd`: 2/3 cenários falharam (mistura de usuários e sessão ausente).

**GREEN:** fonte candidata em harness isolado: Node 9/9 PASS, exit 0, e TypeScript strict/noEmit ES2022 DOM PASS. Cobertos IDs, ACK, fila concorrente, falha remota, JSON ilegível, troca de usuário, abort e serialização; regressões Vitest registradas, ainda **não executadas no Codespace**.

**PENDENTE:** Vitest completo, `task qa:check`, `task qa:regressions`, Playwright Chromium/WebKit e validação de autenticação/tenant do backend. Filtro cliente não substitui RLS/RBAC. Abort não desfaz requisição iniciada nem substitui coordenação multiaba. Não usar CI hospedado, banco remoto, deploy ou migrations. Não marcar FASE 7 como aprovada.

## Ajuste na retomada da mesma conta apos aborto — 2026-10-13

- [x] RED reproduzido em teste Node: ao desmontar/reabrir tela rapidamente, a nova instancia podia compartilhar a promise abortada, deixando item seguinte sem sync.
- [x] Agora a trava registra tambem o AbortSignal da tentativa; requisição da mesma conta com sinal antigo abortado aguarda a finalizacao e abre uma nova rodada. O mesmo usuario com sinal vigente ainda compartilha a mesma promise sem duplicar.
- [x] Testes Node isolados **10/10 PASS**, TypeScript strict/noEmit exit 0, fonte candidata validada por hash Git `f77442eb94dee91b1e7f897942f024b807cbcf44`. Vitest no repositorio ainda nao executado por indisponibilidade do Codespace.
- [ ] Testes integrados e multiabas, RBAC server-side e homologacao; nenhuma fase integral aprovada.

