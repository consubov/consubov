# INC-006 — Dashboard admin zerado por falhas silenciosas
Data: 2026-10-29 | PR: #72 (ampliada no mesmo fluxo admin), sem produção nesta etapa.

## Evidências
A página AdminDashboard.tsx na main inicializa 8 indicadores como zero e faz Promise.all de consultas head=count; todos usam `count ?? 0` sem verificar `error`/status e nem validam JWT. Erro/RLS/sessão inválida resulta em 0 falso; screenshot do responsável reproduz todos os indicadores zerados.
Projeto Supabase identificado pelo `VITE_SUPABASE_URL` Vercel produção, `zptkqeiyvkqogrimbvna`. Leitura SQL somente: fazendas 8, retiros 19, pastos 489, produtos 4, ciclos 51, lançamentos 1431, fábricas 4. Quatro administradores ativos com login e `is_admin(user_id)` true. Em sessão SQL somente leitura, com ROLE authenticated + claim UUID de um admin ativo, RLS devolveu 8 fazendas, 19 retiros, 489 pastos. Isso NÃO reproduz a sessão real do usuário e NÃO comprova a causa raiz do navegador.
Vercel app publicado em SHA ceadec93, variáveis de produção `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` presentes; nenhuma chave exposta.

## Mudanças
Verifica token via `supabase.auth.getUser()` e registro de admin ativo antes das leituras; sem acesso se inválido. Leitura em paralelo com deadline de 12s e abort, proteção contra resultados tardios, contador estrito (0 apenas resposta realmente 0), estados erro/empty/loading, retry, RLS negada = mensagem para reautenticar, debounce realtime e cleanup. Nenhuma mudança de SQL, grants, Auth, dados offline ou permissões.

## Testes, prevenção e release
Helper de validação: Node22 10/10 assertivas PASS, tsc strict PASS, Vitest 5 casos versionados. QA integrado Chromium/Edge autenticado, matriz task qa:check, teste sessão expirada, falha 401/403, rede pendente, JWT válido, RLS multi-tenant, Vercel build e CI do SHA atual necessários para release. Não declarar produção restaurada sem smoke com admin real. Checklist Obsidian e Notion devem acompanhar. Rollback Vercel ao deploy anterior caso haja erro e nunca limpar cache/IndexedDB de usuários de campo.
