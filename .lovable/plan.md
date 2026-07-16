Escopo aditivo no módulo Consultor. Divido em 2 blocos: correções rápidas (1-3) e offline-first (4-7).

## Bloco A — Correções de PDF/legenda (rápido)

1. **Legenda de escala uma única vez** — em `visitaPdf.ts` (Rotina + Fábrica) e `confinamentoPdf.ts`: `drawScoreRow` passa a mostrar apenas a descrição específica do quesito (sem sufixo). Após a última linha de score de cada bloco, imprimir uma linha itálica cinza: `"Escala: 1 = fora do esperado · 5 = dentro do esperado"`, imediatamente antes de "Média geral: X/5". Ajustar `scoreLegends.ts`: `getScoreLegend` deixa de anexar sufixo (só descrição) e exportar constante `SCORE_SCALE_HINT`. UI de revisão continua usando `getScoreLegend` (que agora vem sem sufixo — a escala já é evidente pelo input 1-5).

2. **Texto de "Organização geral da fábrica"** — em `scoreLegends.ts`, trocar `"Avalia limpeza, layout e fluxo de trabalho da fábrica."` por `"Avalia limpeza e fluxo de trabalho da fábrica."` nas chaves `organizacao_fabrica` e `organizacao_geral`.

3. **Logos com mesma altura** — em `visitaPdf.ts` e `confinamentoPdf.ts`: criar constante local `LOGO_MAX_H` e usar EXATAMENTE o mesmo valor para os dois lados em `drawLogoFitted`. Também garantir mesma largura máxima e limitar apenas pela altura (largura calculada proporcionalmente), evitando qualquer clamp de largura que reduza um dos lados.

## Bloco B — Offline-first para visitas (4-7)

Reaproveitar `offlineDb.ts` (IndexedDB já usado no capataz). Adicionar novos stores/tabelas via `openDB` versão bumped:

- `visita_drafts` — snapshot completo da visita em rascunho: `{ visitaId, tipo, fazendaSnapshot, consultorSnapshot, visita, pastos[], currais[], topicos[], fotos[], scores[], avaliacaoFabrica, updatedAt, pendingSync: boolean }`
- `visita_foto_blobs` — `{ id, visitaId, targetKind, targetId, ordem, blob, mime, ext, uploaded: boolean, remotePath?, attempts }`
- `visita_sync_queue` — fila de operações pendentes: `{ id, visitaId, op, payload, attempts, lastError }`

### 4. Compressão local + preview instantâneo + upload assíncrono
`PhotoGrid.tsx` já comprime e mostra preview otimista. Adicionar:
- Persistir o blob comprimido em `visita_foto_blobs` ANTES de tentar upload (já com `uploaded=false`).
- Preview lê do IndexedDB (URL.createObjectURL do blob) se ainda não sincronizado.
- Upload em background: novo módulo `src/lib/visitaSync.ts` com fila que processa `visita_foto_blobs` where `uploaded=false` quando `navigator.onLine`.
- Aplicar mesmo padrão em `VisitaTopicosSection.tsx` (fotos de tópicos).

### 5. Pré-carregamento ao iniciar visita
Interceptar o handler de "Iniciar Visita" (`ConsultorFazendaDetalhePage.tsx`). Após criar a visita no Supabase, buscar em uma única chamada tudo que a UI de visita usa (fazenda, dados do consultor, formulas/quesitos) e gravar em `visita_drafts`. Adicionar helper `preloadVisita(visitaId)` em `visitaSync.ts`.

### 6. Persistência entre sessões
Alterar `VisitaTecnicaPage.tsx`, `ConfinamentoVisitaView.tsx`, `FabricaVisitaView.tsx` e os modais (`PastoVisitaModal`, `CurralVisitaModal`, `VisitaTopicosSection`) para:
- Ler do `visita_drafts` primeiro; se não existir e houver rede, buscar do Supabase e cachear.
- Todo save (adicionar pasto/curral, editar score, mudar tópico, observações) atualiza o draft local imediatamente e enfileira op remota.
- Ao reabrir sem rede: draft continua acessível, UI funciona 100%.

### 7. Botão "Sincronizar" + bloqueio de PDF
- `ConsultorHistoricoPage.tsx`: badge "Pendente de sincronização" para visitas com `visita_drafts.pendingSync=true` ou blobs não enviados.
- Botão global "Sincronizar (N)" no topo quando houver pendências. Ao clicar: dispara `flushSyncQueue()` mostrando progresso via toast/`sonner`.
- Auto-sync em background: listener em `window.addEventListener('online', ...)` + intervalo leve (30s) quando `navigator.onLine`.
- Botão "Gerar PDF" em `RevisaoVisitaPage`, `ConfinamentoRevisaoView`, `FabricaVisitaView` fica desabilitado enquanto `pendingSync=true` para essa visita, com tooltip "Sincronize antes de gerar o PDF".

## Detalhes técnicos

- **Sem alterações de schema no Supabase** — nada muda no lado servidor, apenas nova camada local.
- **Compatibilidade**: usuários com dados existentes continuam funcionando; drafts só são criados a partir das próximas visitas.
- **Fotos existentes** (com URL do Storage) continuam via signed URL; só as novas passam pelo blob local.
- **APP_VERSION** → bump para `1.22.0`.

## Arquivos afetados

- `src/lib/scoreLegends.ts` (edit)
- `src/lib/visitaPdf.ts` (edit)
- `src/lib/confinamentoPdf.ts` (edit)
- `src/lib/offlineDb.ts` (edit — novos stores)
- `src/lib/visitaSync.ts` (NEW — fila, upload async, preload)
- `src/components/consultor/PhotoGrid.tsx` (edit — persistir blob local)
- `src/components/consultor/VisitaTopicosSection.tsx` (edit — persistir blob local)
- `src/pages/ConsultorFazendaDetalhePage.tsx` (edit — preload no "Iniciar Visita")
- `src/pages/VisitaTecnicaPage.tsx` (edit — hidratar do draft)
- `src/components/consultor/ConfinamentoVisitaView.tsx` (edit — draft + gate PDF)
- `src/components/consultor/FabricaVisitaView.tsx` (edit — draft + gate PDF)
- `src/pages/RevisaoVisitaPage.tsx` (edit — gate PDF)
- `src/pages/ConsultorHistoricoPage.tsx` (edit — badge + botão sync)
- `src/lib/appVersion.ts` (bump)

Confirma que posso prosseguir com esse escopo completo, ou prefere fatiar (ex: aplicar só Bloco A agora e Bloco B em turno seguinte)?