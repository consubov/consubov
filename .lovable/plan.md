## Fluxo único "Novo Manejo" — SyncVet (Fase 10 UI)

Reaproveita o schema já criado (`syncvet_manejos.tipo_manejo`, `fonte_protocolo`, `fonte_semen`, `semen_id`, `semen_descricao_fazenda`, `hora_inicio` + trigger `syncvet_prenhez_historico`). Nenhuma migração nova.

### 1. Ponto de entrada — tela de Fazenda › aba Lotes
- Em `SyncVetFazendaDetalhePage.tsx`, adicionar botão fixo **"+ Novo manejo"** no topo da aba Lotes.
- Abre `/syncvet/fazendas/:fazendaId/novo-manejo` (nova página).

### 2. Nova página `SyncVetNovoManejoPage.tsx` (wizard 4 etapas)
- **Etapa A — Lotes + tipo por lote**: lista os lotes da fazenda com checkbox; para cada lote marcado, escolher tipo (`DG/US` | `IATF` | `Retirada`). Múltiplos lotes, tipos diferentes, mesma data.
- **Etapa B — Configuração por tipo**:
  - DG/US → só data.
  - IATF/Retirada → `fonte_protocolo` (veterinário/fazenda) + `protocolo_id` (só se veterinário) + `fonte_semen` (veterinário/fazenda) + `semen_id` OU `semen_descricao_fazenda`.
- **Etapa C — Data + responsável único** (equipe da empresa) para todo o batch.
- **Etapa D — Resumo + "Salvar"**: cria 1 linha `syncvet_manejos` por lote com `tipo_manejo`, `fonte_*`, `data_prevista`, `responsavel_id`, `lote_id`, `fazenda_id`, `origem='novo_manejo'`, `status='pendente'`. Sem `lote_ciclo_id` (fluxo independente do ciclo). Aparece automaticamente na Agenda.

### 3. Execução (responsável)
- Novo cartão de ação nos manejos com `tipo_manejo IN ('dg_us','iatf','retirada')` na `SyncVetAgendaPage`: botão **"Iniciar/Continuar"** abre `/syncvet/manejos/:id/executar`.
- `SyncVetManejoExecucaoPage.tsx`:
  - **Resumo inicial** (fazenda, lote, tipo, qtd animais) + botão **"Iniciar"** → `UPDATE syncvet_manejos SET hora_inicio=now(), status='em_andamento'`.
  - **Execução**: input número do animal + Confirmar. Cria/reusa animal em `syncvet_animais` (via `lote_id` + `numero`).
    - DG/US: botões **C** (prenha) / **V** (vazia) → insert em `syncvet_manejo_resultados`.
    - IATF/Retirada: Confirmar já grava `resultado='realizado'`.
  - Lista lateral dos já registrados; botão **"Próximo"** limpa e refoca o input.
  - Rodapé com contadores e taxa de prenhez ao vivo (DG/US).
- **Finalização**: dois botões:
  - **"Finalizar Manejo"** → `status='concluido', data_execucao=now()` (dispara trigger de histórico de prenhez para DG/US).
  - **"Finalizar e Gerar PDF"** → mesmo update + `syncvetManejoPdf.ts` gera PDF (identidade Consubov: verde `#14432B`, dourado `#C9A84C`) com fazenda, lote, tipo, responsável, tabela de animais (número/categoria/diagnóstico) e taxa de prenhez. Usa Web Share API quando disponível.

### 4. Gráficos de prenhez
- `SyncVetDashboardPage.tsx`: adicionar gráfico de linha (Recharts) por mês a partir de `syncvet_prenhez_historico` (empresa toda), respeitando filtros já existentes (fazenda/vet/protocolo).
- "Meu Painel" do membro (dashboard restrito): idem, filtrado por `veterinario_id = ownEquipeId`. Perfil restrito continua caindo em `/syncvet/agenda` — Meu Painel fica opcional, mas gráfico é adicionado à agenda como card do topo para o restrito.

### 5. Vínculo com Agenda
- Nenhuma nova tela — `SyncVetAgendaPage.tsx` já lê `syncvet_manejos` com filtro por responsável. Os manejos criados no wizard aparecem automaticamente. Ajuste mínimo: renderizar `tipo_manejo` (DG/US/IATF/Retirada) como badge quando `etapa_id` for null.

### Detalhes técnicos
- Nova rota em `App.tsx`: `/syncvet/fazendas/:fazendaId/novo-manejo`, `/syncvet/manejos/:id/executar`.
- Novo lib `src/lib/syncvetManejoPdf.ts` (baseado em `syncvetServicoPdf.ts`).
- `APP_VERSION` → `1.37.0`.
- Nada em outros módulos é tocado.

Aprova para eu implementar?