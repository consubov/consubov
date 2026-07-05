
# Módulo Fábrica – Consubov

Adicionar novo módulo consumindo as tabelas já existentes (`fabricas`, `fabrica_destinos`, `operadores_fabrica`, `materias_primas`, `entradas_materias_primas`). Nada existente será alterado.

## 1. Banco (mínimo necessário)

Uma única migração para viabilizar o funcionamento sem quebrar o que já existe:

- Sequência `fabrica_codigo_seq` + trigger para preencher `fabricas.codigo` no formato `FAB-000001` automaticamente na inserção.
- Trigger em `entradas_materias_primas` (AFTER INSERT) que soma `quantidade` em `materias_primas.estoque_atual`.
- GRANTs + RLS coerentes com o padrão do projeto:
  - `fabricas`, `fabrica_destinos`, `materias_primas`, `entradas_materias_primas`, `operadores_fabrica`: leitura/gravação para `authenticated`; policies liberando `is_admin(auth.uid())`. Gerente também pode ler/gravar em `materias_primas` e `entradas_materias_primas`. Operador de fábrica pode ler apenas sua própria fábrica/destinos.
- Função `is_operador_fabrica(_user_id uuid)` + `get_operador_fabrica_id(_user_id uuid)` (SECURITY DEFINER, padrão dos demais roles).

Nenhuma coluna nova em tabelas já existentes. Nenhuma alteração em tabelas existentes.

## 2. Autenticação — novo perfil `operador_fabrica`

- `src/hooks/useAuth.tsx`: adicionar `"operador_fabrica"` ao tipo `UserRole` e novo check no `detectRole` (antes de administrador), consultando `operadores_fabrica` por `user_id + ativo`. `roleData` passa a incluir `fabricaId`.
- `src/App.tsx`: adicionar rota `/fabrica` protegida por `["operador_fabrica"]`, e `RoleRedirect` passa a mandar operador para `/fabrica`.
- `src/pages/FabricaDashboard.tsx` (novo): dashboard placeholder mostrando nome/código da fábrica vinculada e botão sair.

## 3. Telas Admin (novo menu no `AdminSidebar`)

Todas seguem o padrão visual/estrutural de `GerentesPage`/`ProdutosPage` (Card + Table + Dialog + shadcn).

- **`/admin/fabricas` — `FabricasPage.tsx`**
  - Lista fábricas (código, nome, descrição, status).
  - Modal criar/editar (nome, descrição, ativo). `codigo` e `qr_code` gerados no backend/trigger; após insert, atualiza `qr_code` com o UUID.
  - Botão "Destinos autorizados" abre modal com checkboxes de fazendas e retiros (grava/deleta em `fabrica_destinos`).
  - Botão "QR Code" abre preview + download PDF usando o mesmo layout de `QrCodePrintPDF` (1 card = fábrica).
- **`/admin/operadores-fabrica` — `OperadoresFabricaPage.tsx`**
  - Lista operadores. Modal criar/editar com nome, telefone, email, senha, fábrica (Select), ativo.
  - Criação chama a edge function `create-user` (reaproveitando; ela já retorna `user.id` quando não é admin) e depois insere em `operadores_fabrica` com `user_id`.

Novos itens no `AdminSidebar`:
- 🏭 Fábricas → `/admin/fabricas`
- 👥 Operadores de Fábrica → `/admin/operadores-fabrica`
- 📦 Matérias-Primas → `/admin/materias-primas`
- ⬇️ Entrada de Matérias-Primas → `/admin/entrada-materias-primas`

## 4. Matérias-primas (Admin + Gerente)

- **`/admin/materias-primas` — `MateriasPrimasPage.tsx`**
  - Lista (nome, unidade, peso_por_saco, estoque_atual, estoque_minimo, ativo).
  - Modal criar/editar (nome, unidade, peso_por_saco, estoque_minimo, ativo). `estoque_atual` somente leitura.
- **`/admin/entrada-materias-primas` — `EntradaMateriasPrimasPage.tsx`**
  - Formulário: matéria-prima (Select), fábrica (Select), quantidade, data, observação, foto opcional (upload no bucket `mapas` reaproveitado ou string base64 comprimida via `imageCompression.ts`).
  - Salva em `entradas_materias_primas` com `registrado_por = auth.uid()`. Trigger cuida do estoque.
  - Lista abaixo com últimas entradas.

Ambas telas também expostas ao gerente através do próprio painel do gerente (adicionar dois botões/atalhos no `GerenteDashboard` que apontam para as mesmas rotas; as rotas são protegidas por `["administrador","gerente"]`).

## 5. Não mexer

- Nenhuma alteração em: Admin/Gerente/Capataz atuais, Pastos, Pesagens, Salga, tabelas existentes, fluxo de login atual.
- `QrCodesPage` (pastos) permanece intacta; o QR da fábrica usa um novo componente derivado que compartilha o mesmo estilo.

## Notas técnicas

- Novo role no `useAuth` deve ser detectado **antes** de admin/gerente para que um operador nunca acabe caindo em outro perfil.
- `create-user` edge function não precisa alterar: já suporta criar somente o usuário no Auth (`role = "usuario"`) e devolve `user.id`.
- Bucket para foto de entrada de matéria-prima: reutilizar `mapas` (já público) com prefixo `materias-primas/`. Sem novo bucket.
- Tudo em PT-BR, cores do design system (primary `#1B4332`, secondary `#D4A017`), mobile-first.

## Ordem de execução

1. Migração SQL (sequência, triggers, RLS, funções de role).
2. Atualizar `useAuth` + `App.tsx` + `AdminSidebar` + `GerenteDashboard` atalhos.
3. Criar as 5 páginas novas + `FabricaDashboard`.
4. Verificar build.
