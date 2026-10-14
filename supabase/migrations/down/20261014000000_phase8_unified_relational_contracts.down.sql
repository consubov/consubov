-- Reversible Rollback: 20261014000000_phase8_unified_relational_contracts.down.sql
-- FASE 8: PostgreSQL Local Dry-Run & Unified Relational Contracts (Rollback)

DROP POLICY IF EXISTS "user_access_atomic_command_log" ON public.atomic_command_log;
DROP POLICY IF EXISTS "tenant_isolation_atomic_command_log" ON public.atomic_command_log;

DROP INDEX IF EXISTS public.idx_atomic_commands_kind;
DROP INDEX IF EXISTS public.idx_atomic_commands_user;
DROP INDEX IF EXISTS public.idx_atomic_commands_tenant_status;
DROP INDEX IF EXISTS public.uq_atomic_commands_tenant_command;
DROP INDEX IF EXISTS public.uq_atomic_commands_tenant_idempotency;

DROP TABLE IF EXISTS public.atomic_command_log CASCADE;
