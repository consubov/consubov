# INC-005 — Admin/Fazendas: carregamento infinito no desktop

Base: ceadec93c687d826b9f6ee1bb9440a40a9b2ec6d (FazendasPage blob 85a814646e3f6a4ce4c3a76dc92223f2ff18e48d)
Data: 2026-10-29. Status: PR draft, QA parcial, sem deploy.

## Causa comprovada no código
O loading dependia de uma requisição `supabase.from("fazendas").select("*").order("nome")` sem deadline ou cancelamento. Se a promessa não assentar (rede/auth), o estado `loading` não é finalizado e o spinner fica infinito. A causa específica da requisição do desktop não foi reproduzida sem sessão/logs de rede do usuário.

## Correção
- Adicionar deadline de 12 s com cancelamento do fetch e limpeza na desmontagem.
- Evitar respostas tardias sobrescrevendo a tela após navegação/retry.
- Exibir erro recuperável e botão "Tentar novamente".
- Buscar somente colunas usadas na listagem; impedir "Nova Fazenda" enquanto dados indisponíveis.
- Não alterar Auth, RLS, tabelas nem dados offline.

## QA
- Node 22 standalone, função com promises simuladas: 7/7 PASS (sucesso, timeout, abort, erro, resultado tardio, timers).
- TypeScript 5.8.3: helper `tsc --noEmit --strict` PASS; transpile sintático helper/test/page 3/3 PASS.
- Pendente: Vitest real, typecheck/build completos, Desktop Chromium/Edge E2E, Auth/JWT e rede reais.
- Último check remoto deverá ser associado ao HEAD do PR, sem herdar checks de outros SHA.

## Prevenção obrigatória
Toda consulta remota que bloqueia uma tela administrativa precisa: prazo finito, cancelamento por navegação, estados loading/error/empty/success, retry, teste de promessa pendente e teste de permissão 401/403. Nunca exibir dados de outro tenant como fallback. Nunca apagar caches/IndexedDB como solução genérica.

## Fora do escopo
Sem deploy, sem modificação de banco, sem credenciais, sem mudanças em PRs paralelos. Handoff estático deve ser atualizado após homologação.
