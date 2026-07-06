# Módulo Consultor – Fase 1

Feature 100% aditiva. Nada existente (Admin/Gerente/Capataz/Fábrica, tabelas atuais, rotas atuais) é alterado ou removido.

## 1. Banco (uma única migração)

Novas tabelas em `public`, seguindo o padrão do projeto (SEM RLS, controle na aplicação, GRANTs para authenticated/service_role):

- `consultores` (id, user_id, nome, ativo, created_at)
- `fazendas_consultor` (id, consultor_id, nome_fazenda, proprietario, municipio, uf, latitude, longitude, created_at)
- `visitas_tecnicas` (id, consultor_id, fazenda_consultor_id, tipo `check ('rotina','confinamento')` default `'rotina'`, status `check ('rascunho','finalizada')` default `'rascunho'`, hora_inicio, hora_fim, observacoes_gerais, conclusao, created_at)
- `visita_pastos` (id, visita_id, letra, num_pasto, qtd_animais, tipo_produto, percentual_pv, consumo_kg_dia, observacao, ordem)
- `avaliacoes_score` (id, visita_pasto_id, tipo `check ('fezes','corporal','bebedouro')`, nota `check between 1 and 5`)

Funções auxiliares SECURITY DEFINER, mesmo padrão de `is_admin` / `is_operador_fabrica`:

- `is_consultor(_user_id uuid) returns boolean`
- `get_consultor_id(_user_id uuid) returns uuid`

Índices em FKs para performance. Sem triggers extras nesta fase.

## 2. Autenticação

- `src/hooks/useAuth.tsx`: adicionar `"consultor"` em `UserRole` e detectar em `detectRole` **antes** de administrador (mesmo padrão do operador_fabrica). `roleData` passa a incluir `consultorId`.
- `src/App.tsx`: nova rota `/consultor` (e sub-rotas) protegida por `["consultor"]`; `RoleRedirect` direciona consultor para `/consultor`.

## 3. Admin — cadastro de consultores (mínimo p/ conseguir logar)

Nova página `/admin/consultores` (`ConsultoresPage.tsx`), padrão idêntico ao `OperadoresFabricaPage`/`GerentesPage`:

- Lista + modal criar/editar (nome, email, senha, ativo)
- Usa a edge function `create-user` já existente e insere em `consultores` com o `user_id` retornado.
- Novo item no `AdminSidebar`: 🧑‍🌾 Consultores → `/admin/consultores`.

## 4. UI do Consultor (novas telas isoladas)

Layout dedicado `ConsultorLayout.tsx` com header padrão Consubov (logo, sino, refresh, versão, logout) — reaproveitando os componentes que já existem no dashboard atual.

Rotas dentro de `/consultor`:

- `/consultor` → **Minhas Fazendas** (`ConsultorFazendasPage.tsx`)
  - Lista `fazendas_consultor` do consultor logado.
  - Botão "+ Nova Fazenda" → modal com nome, proprietário, município, UF, lat/long opcionais.
  - Clicar numa fazenda → `/consultor/fazendas/:id`.

- `/consultor/fazendas/:id` → **Detalhe da Fazenda** (`ConsultorFazendaDetalhePage.tsx`)
  - Cabeçalho com dados + botão "Iniciar Visita".
  - Modal escolher tipo: **Rotina** (ativo) / **Confinamento** (desabilitado, "em breve").
  - Ao confirmar Rotina → cria `visitas_tecnicas` (`status='rascunho'`, `hora_inicio=now()`) e navega para `/consultor/visitas/:visitaId`.
  - Lista de visitas anteriores desta fazenda (link para leitura).

- `/consultor/visitas/:visitaId` → **Visita em Andamento** (`VisitaTecnicaPage.tsx`)
  - Header fixo: fazenda + hora de início.
  - Lista de pastos ordenada por `ordem` (A, B, C...). Cada card mostra letra, num pasto, produto, notas.
  - Botão "+ Adicionar Pasto" abre `PastoVisitaModal.tsx`:
    - Campos: letra (sugerida próxima livre, editável), num pasto, qtd animais, tipo_produto (select com opções fixas), %PV, consumo kg/dia, observação.
    - 3 seletores 1–5 (Fezes, Corporal, Bebedouro) — cinco botões redondos.
    - Salvar → insert em `visita_pastos` + 3 `avaliacoes_score` (upsert quando editar).
    - Reabrir card = mesmo modal em modo edição.
  - Botão "Finalizar Visita" → modal com `observacoes_gerais` + `conclusao`. Confirmar → update `status='finalizada'`, `hora_fim=now()`. Depois a página fica só-leitura (edição plena virá na Fase 2).

- `/consultor/historico` → **Histórico** (`ConsultorHistoricoPage.tsx`)
  - Lista de visitas do consultor, mais recentes primeiro (fazenda, tipo, data, status). Clicar abre a visita em modo leitura (mesma `VisitaTecnicaPage`).

Navegação interna via barra inferior/lateral simples (Fazendas / Histórico) dentro do `ConsultorLayout`.

## 5. Fora do escopo (Fase 2+)

Não implementar agora: fotos, preview editável, PDF, gráficos, fluxo Confinamento, avaliação de fábrica, notificações push específicas do consultor.

## Ordem de execução

1. Migração SQL (tabelas + funções `is_consultor` / `get_consultor_id` + GRANTs).
2. `useAuth` + `App.tsx` + `AdminSidebar` (novo item) + página admin `ConsultoresPage`.
3. `ConsultorLayout` + 4 páginas + `PastoVisitaModal`.
4. Bump `APP_VERSION`.

## Notas técnicas

- Padrão RLS: seguir o resto do projeto (RLS off, filtro por `consultor_id = get_consultor_id(auth.uid())` na aplicação).
- GRANT SELECT/INSERT/UPDATE/DELETE para `authenticated`, GRANT ALL para `service_role` em todas as 5 tabelas.
- Nenhuma alteração em tabelas/edge functions existentes.
