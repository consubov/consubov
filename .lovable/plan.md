# Bloco B — Consultor offline-first

Objetivo: uma visita pode ser iniciada, editada, fotografada e finalizada sem conexão. O PDF só é gerado depois que a fila de sincronização estiver zerada. Rotina, Confinamento e Fábrica usam a mesma infra.

Correção rápida já aplicada nesta rodada: escala "1…5" agora aparece 1× ao fim da lista em Fábrica (antes repetia por item). Segue o resto abaixo.

## O que muda para o usuário

- Ao abrir uma visita, o app baixa e guarda tudo que precisa (fazenda, pastos/currais, tópicos, avaliações, fotos já enviadas). Depois disso funciona offline.
- Fotos aparecem no grid **na hora** que a pessoa tira — sobem em background.
- Um contador "X pendentes" fica visível no topo da visita, com botão **Sincronizar agora**.
- O botão **Gerar PDF** fica desabilitado enquanto houver fotos/campos pendentes, com mensagem clara ("Sincronize antes de finalizar").
- Se o app for fechado no meio da visita, ao reabrir tudo volta como estava (rascunho local).

## Arquitetura técnica

Novo módulo `src/lib/consultorOffline/`:

- `db.ts` — Dexie (IndexedDB) com stores:
  - `visita_drafts` — snapshot da visita + tópicos + avaliações + notas (chave = `visita_id`)
  - `visita_foto_blobs` — `{ localId, visitaId, parentType, parentId, blob, mime, createdAt, remoteUrl? }`
  - `sync_queue` — `{ id, kind: 'foto'|'campo'|'topico'|'avaliacao', payload, tries, lastError, createdAt }`
- `snapshotLoader.ts` — ao abrir a visita: baixa e persiste tudo em `visita_drafts`; se offline, lê do IDB.
- `photoQueue.ts` — comprime local (já existe), salva blob no IDB, retorna `localId` para preview otimista, enfileira upload.
- `syncEngine.ts` — worker que processa `sync_queue` em ordem; expõe `pendingCount$` (subscribable) e `syncNow()`.
- `useVisitaOffline(visitaId)` — hook que abstrai leitura/escrita, retorna `{ draft, updateField, addPhoto, pending, syncing, syncNow }`.

Componentes tocados (aditivo, não muda API pública):

- `PhotoGrid.tsx` / `VisitaTopicosSection.tsx` — trocam upload direto por `photoQueue.enqueue`; renderizam `blob:` URL enquanto `remoteUrl` não chega.
- `ConfinamentoVisitaView.tsx`, `FabricaVisitaView.tsx`, `VisitaTecnicaPage.tsx` — usam `useVisitaOffline`; salvamentos passam pelo draft local + fila.
- `RevisaoVisitaPage.tsx` + `ConfinamentoRevisaoView.tsx` + `FabricaVisitaView.tsx` — botão "Gerar PDF" fica `disabled` quando `pending > 0`; mostra badge com contagem e link "Sincronizar agora".

Novo componente `SyncBadge.tsx` — barra fixa no topo da visita: ícone + "N pendentes" + botão. Some quando `pending === 0` e mostra "Tudo sincronizado ✓" por 3s.

## Ordem de entrega

1. Infra: `db.ts` + `syncEngine.ts` + `photoQueue.ts` + hook.
2. Migração de `PhotoGrid` e `VisitaTopicosSection` (fotos otimistas, fila).
3. Snapshot loader + persistência de rascunho nas 3 views de visita.
4. `SyncBadge` + bloqueio dos botões "Gerar PDF".
5. Bump `APP_VERSION` → `1.23.0`.

## Fora do escopo

- Não altero cálculos, fórmulas, PDFs, tabelas do Supabase ou fluxos de Rotina/Confinamento/Fábrica além do necessário para plugar a fila.
- Módulos fora do Consultor (Capataz, Gerente, Admin, Fábrica interna) ficam intocados.
- Não crio nova tabela no Supabase — a fila é 100% local; o backend já aceita os mesmos inserts/updates de hoje.

Confirma que posso executar essa sequência?
