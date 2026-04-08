## Correção: Isolamento de Ciclos

### 1. Migration: Adicionar `ciclo_id` na tabela `lancamentos`
- `ALTER TABLE lancamentos ADD COLUMN ciclo_id uuid REFERENCES ciclos(id)`
- Preencher registros existentes com base em mes_referencia/ano_referencia/fazenda_id

### 2. Corrigir sincronização no CapatazDashboard
- Ao salvar lancamento (handleSaveSalga), incluir `ciclo_id` do ciclo selecionado
- Na sync (handleSync), usar `mes_referencia`/`ano_referencia` do ciclo (não de `new Date()`)
- Bloquear salga se o ciclo selecionado estiver fechado ou não existir

### 3. Bloquear operações sem ciclo aberto
- Na tela de salga, verificar se existe ciclo aberto antes de permitir registro
- Exibir toast de erro: "Inicie o mês antes de registrar a salga"

### 4. Filtrar dados por ciclo_id nos painéis/mapa
- usePainelData, useMapaData, useGerenteData já filtram por mes/ano — adicionar filtro por ciclo_id quando disponível
