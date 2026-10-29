# Plano de Ativação de RLS (Row Level Security) - F12

## 1. Objetivo
Implementar isolamento multitenant estrito nas 107 tabelas do sistema CONSUBOV via RLS (Row Level Security) do PostgreSQL/Supabase, garantindo conformidade com a arquitetura estabelecida e preservando o funcionamento offline-first.

## 2. Princípios de Segurança
- **Tenant First:** Todo acesso a dados deve ser escopado por `tenant_id`.
- **RBAC Integrado:** A política de acesso considerará `auth.uid()` para isolar dados do usuário dentro do seu tenant.
- **Configuração via RLS:** Uso de `app.current_tenant_id` como variável de sessão, seguindo o padrão de `atomic_command_log`.
- **Preservação de Performance:** Criação de índices compostos em todas as tabelas (tenant_id + outros filtros comuns).

## 3. Plano de Ação
1. **Auditoria:** Mapear cada uma das 107 tabelas e identificar a coluna de `tenant_id` (ou ancestrais que levem ao `tenant_id`).
2. **DDL (Migração):** 
   - Adicionar coluna `tenant_id UUID` onde faltar (se aplicável, seguindo a hierarquia).
   - Aplicar `ENABLE ROW LEVEL SECURITY`.
   - Definir políticas padrão.
3. **Rollback:** Script de desativação (DISABLE RLS, DROP POLICIES).
4. **Validadores:** Testes de integração em ambiente local (`task db:test`).

## 4. Estrutura de Políticas (Exemplo Padrão)
```sql
ALTER TABLE public.NOME_TABELA ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON public.NOME_TABELA
  FOR ALL
  TO authenticated
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

## 5. Tabelas Críticas para FASE 1
- `atomic_command_log` (Já implementada como modelo).
- `capatazes`
- `fazendas`
- `retiros`
- `pastos`
- `pesagens`
- `eventos_sanitarios`
- `movimentacoes_animais`

## 6. Riscos
- Quebra de sincronização offline-first: Garantir que os triggers de sync (se houverem) respeitem o RLS.
- Performance: Falta de índices nas colunas `tenant_id` causará timeout.
