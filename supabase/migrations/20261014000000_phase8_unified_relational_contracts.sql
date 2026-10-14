-- Migration: 20261014000000_phase8_unified_relational_contracts.sql
-- FASE 8: PostgreSQL Local Dry-Run & Unified Relational Contracts
-- Table: public.atomic_command_log
-- Purpose: Canonical server-side command audit, idempotency enforcement and multi-tenant RLS

CREATE TABLE IF NOT EXISTS public.atomic_command_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  command_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  server_applied_at TIMESTAMP WITH TIME ZONE,
  error_detail TEXT,
  conflict_resolution JSONB
);

-- Unique idempotency and command uniqueness constraints per tenant
CREATE UNIQUE INDEX IF NOT EXISTS uq_atomic_commands_tenant_idempotency 
  ON public.atomic_command_log (tenant_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_atomic_commands_tenant_command 
  ON public.atomic_command_log (tenant_id, command_id);

-- Performance indices for query draining, sync status and user filtering
CREATE INDEX IF NOT EXISTS idx_atomic_commands_tenant_status 
  ON public.atomic_command_log (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atomic_commands_user 
  ON public.atomic_command_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_atomic_commands_kind 
  ON public.atomic_command_log (tenant_id, kind);

-- Row Level Security (RLS) Enablement
ALTER TABLE public.atomic_command_log ENABLE ROW LEVEL SECURITY;

-- PostgreSQL combines permissive policies with OR. A tenant-only policy
-- would bypass the user_id check in the user-specific policy.
-- Drop any stale tenant-only policy and keep one tenant + user policy.
DROP POLICY IF EXISTS "tenant_isolation_atomic_command_log" ON public.atomic_command_log;

-- User-scoped access policy for device-level command submission and queries
DROP POLICY IF EXISTS "user_access_atomic_command_log" ON public.atomic_command_log;
CREATE POLICY "user_access_atomic_command_log" ON public.atomic_command_log
  FOR ALL
  TO authenticated
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND user_id = auth.uid()
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    AND user_id = auth.uid()
  );
