# Funcionalidade: Conferência via QR Code

Nova área independente para Administrador e Gerente lerem o QR do pasto direto no campo e visualizarem a situação atual do lote, com checklist opcional de auditoria física.

## 1. Banco de Dados (Supabase)

Duas novas tabelas:

### `audit_conferencias` (log automático de toda leitura)
- `id`, `fazenda_id`, `retiro_id`, `pasto_id`, `user_id`, `qr_code`, `latitude`, `longitude`, `created_at`
- RLS: admin vê tudo; gerente vê apenas suas fazendas; insert permitido para admin e gerente autenticados.

### `conferencias_checklist` (checklist opcional preenchido pelo gerente)
- `id`, `fazenda_id`, `retiro_id`, `pasto_id`, `user_id`
- Booleans: `cocho_abastecido`, `cocho_parcial`, `cocho_vazio`, `cocho_danificado`, `placa_qr_presente`, `placa_qr_danificada`, `qtd_compativel`, `qtd_divergente`, `necessita_atencao`
- `observacoes` (text), `fotos` (text[] – URLs no bucket), `created_at`
- RLS análoga.

### Storage
- Reutilizar bucket existente `mapas` (público) com pasta `conferencias/` OU criar bucket público novo `conferencias`. Vou usar **`conferencias`** público para isolar.

## 2. Frontend — Nova página `/conferencia`

Acessível a `administrador` e `gerente` (rota protegida).

Fluxo de telas:
1. **Tela inicial** — título "Conferência" + botão grande "Iniciar Conferência".
2. **Scanner QR** — reaproveita `src/components/capataz/QrScanner.tsx`.
3. **Validação** — busca pasto pelo `qr_code` (Supabase). Se inválido → toast "QR Code não encontrado ou inativo." e volta ao passo 1.
4. **Resultado** — card com: fazenda, retiro, pasto, nº animais, peso médio, categoria, sexo, consumo médio mineral, última salga (data + responsável), última movimentação, produto mineral, dias desde última salga/movimentação, eventos do mês, status nutricional com badge 🟢🟡🔴.
   - **Histórico rápido** abaixo: últimos 5 eventos combinados (salgas, movimentações, mortes, transferências, ajustes peso).
   - Botão opcional **"Registrar Conferência"**.
5. **Checklist** — formulário com 9 checkboxes, observações, upload até 5 fotos. Salvar → toast sucesso → volta à tela inicial.

Auditoria automática: assim que QR valida, gravar em `audit_conferencias` (com geolocalização via `navigator.geolocation` quando disponível, sem bloquear).

## 3. Navegação / Menus

- Adicionar item **"Conferência"** (ícone `ScanLine`) em:
  - `src/components/AdminSidebar.tsx` (admin)
  - Painel do gerente (`GerenteDashboard.tsx`) — botão visível no topo.
- Adicionar rota `/conferencia` em `src/App.tsx`, protegida para `["administrador","gerente"]`.

## 4. Offline

- Consulta exige rede (necessária para leitura de dados atualizados).
- Checklist offline: salvar payload em `localStorage` (`pendingConferencias`) quando `navigator.onLine === false`, e sincronizar via listener `online` enviando ao Supabase. Fotos pendentes ficam como dataURLs até upload.

## 5. Arquivos a criar/editar

**Criar:**
- `src/pages/ConferenciaPage.tsx` — orquestra os 4 estados (idle/scan/resultado/checklist).
- `src/components/conferencia/ConferenciaResultado.tsx`
- `src/components/conferencia/ConferenciaChecklist.tsx`
- `src/lib/conferenciaOffline.ts` — fila + sync.

**Editar:**
- `src/App.tsx` — nova rota.
- `src/components/AdminSidebar.tsx` — novo item de menu.
- `src/pages/GerenteDashboard.tsx` — botão de acesso.

Nenhum outro arquivo é alterado.

## Detalhes técnicos

- Reutiliza `QrScanner` existente (mesmo leitor do capataz).
- Status nutricional: usa `pastos.status_consumo` / `lancamentos.status_consumo` mais recente do mês.
- Eventos do mês: conta linhas em `lancamentos`, `mortalidades`, `movimentacoes_animais`, `pesagens` filtradas por `pasto_id` e mês corrente.
- Fotos: upload para bucket `conferencias` em `{user_id}/{conferencia_id}/{n}.jpg`.

Pronto para implementar após sua aprovação.
