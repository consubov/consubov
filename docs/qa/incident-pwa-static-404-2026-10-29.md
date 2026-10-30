# INC-009 — Manifest 404 e JS antigo 404 após deploy

Data: 2026-10-29. Impacto: PWA Consubov 2.0 em app.consubov.com.br.

## Causa comprovada
Vercel Project Routes LIVE para `consubov-app` incluem:
- Host app.consubov.com.br `/manifest.json` -> `/manifest-consubov-v2.json` (404 no build de produção `dcc59be2` porque o arquivo não estava em apps/web/public).
- `/baixar` -> `/instalar-consubov-v2.html` (mesmo defeito: destino removido do build).
O HTML de /app responde HTTP 200 com script novo `/assets/index-BLZSjslp.js`; script novo e CSS correspondentes responderam HTTP 200, mas cliente reportou 404 para hash antigo `/assets/index-VW_JJAJi.js`. Isto é consistente com referência antiga de cache HTML/SW ou aba antiga — sem HAR/inspeção do SW do cliente, não provar mecanismo exato. NÃO servimos um bundle novo sob hash antigo.

## Correção mínima
Restaurados EXATAMENTE os dois arquivos estáticos de build previamente publicado no Git commit `6bb8dfed31eb2c848cf586d617fdcbb8382f815a`. Mantidos `id: "/"` no manifesto Consubov 2.0 e arquivos de instalação; sem alteração em Auth/RLS/DB/IndexedDB, SW ou políticas de armazenamento. Novo teste Vitest confere os targets de project routes, manifesto, identidade e ícones. O fix deve ser publicado a partir do SHA de produção atual, preservando correções de admin/PDF/appVersion.

## Critérios de aceite / QA de release
- No deployment candidate: HTTP 200 + JSON validado em `/manifest-consubov-v2.json`; HTML `/instalar-consubov-v2.html`; JS/CSS do HTML retornam HTTP 200.
- No domínio **app.consubov.com.br** após promoção, `/manifest.json` retorna HTTP 200, name Consubov 2.0, e `/baixar` retorna HTTP 200.
- `/app`, assets JS/CSS do novo HTML, `/sw.js`, `/version.json` HTTP 200; `/baixar?app=relatto` não perde isolamento.
- Não considerar sucesso só porque HTML SPA /app=200.
- Verificar browser atualizado no desktop e SW antigo com cuidado: nunca apagar IndexedDB/filas/offline nem forçar atualização quando operação crítica está ativa.
- Gate pendente: QA real usuário desktop e app instalado; CI completo do SHA. Se falhar produção, rollback ao deploy anterior verificado preservando dados.
- Handoff Obsidian/Notion + checklist devem refletir estado real de CI, release, HTTP e pendências.
