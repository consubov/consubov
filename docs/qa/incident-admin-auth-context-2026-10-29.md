# INC-010 — Administrador valido com dashboard bloqueado por verificacao duplicada
Data: 2026-10-29. Sintoma: mensagem 'Sessao ou acesso de administrador nao validado' na tela principal.

## Diagnostico
- SQL de producao em transacao READ ONLY e JWT simulado do cadastro afetado: administrador ativo, vinculo Auth existente, is_admin true, uma linha self e 8 fazendas/19 retiros/489 pastos visiveis sob RLS.
- A tela introduziu supabase.auth.getUser() em paralelo ao AuthProvider ja montado na rota protegida. Essa chamada secundaria pode falhar independentemente de PostgREST. O erro exato na sessao real do desktop ainda depende de observacao autenticada.
- Houve um deploy automatico de main SHA 08bb63a durante a investigacao que substituiu hotfixes de administracao/PWA/PDF. Nao promover main antiga sem reconciliar o baseline de producao.

## Correcao segura
- Dashboard utiliza o user.id ja estabelecido por AuthProvider unicamente para filtrar o cadastro; um SELECT de administradores com JWT/RLS do backend continua obrigatorio antes de consultar indicadores. Nenhum perfil em cache pode conceder acesso.
- Mantem os controles de timeout, retry, falha 401/403, ausencia de dados e nao converter erro de consulta em zero.
- Testes de regressao: Auth endpoint secundario indisponivel, admin sem vinculo, ausencia de sessao, RLS 403 e falha de rede.
- Sem alteracoes de banco, GRANT, RLS, secrets ou IndexedDB.

## QA e release
- Validar typecheck, build, Vitest e preview de SHA exato com manifesto/instalador/JS/CSS/SW 200; conferir alias final no dominio app.consubov.com.br.
- Simulacao SQL nao comprova que a sessao verdadeira do navegador foi restaurada. Confirmar depois do deploy com administrador afetado.
- F12 permanece NO-GO e handoff/checklist/Obsidian obrigatorios; bloqueio de deploy automatizado da main ate reconciliacao requer decisao operacional.