-- =========================================================================
-- TMF CLOUD MINING: EQUALIZER INTEGRATION & WORKER IDENTITY SCHEMA
-- Migration: 20261114_equalizer_identity_system.sql
-- =========================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. CUSTOMER POOL CONFIGURATIONS
-- Stores customer submitted mining pool details and generated worker identities
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_pool_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  pool_provider TEXT NOT NULL DEFAULT 'ViaBTC',
  pool_url TEXT NOT NULL,
  original_worker_name TEXT NOT NULL,
  generated_worker_name TEXT NOT NULL UNIQUE,
  identity_initials TEXT NOT NULL,
  contract_sequence INTEGER NOT NULL DEFAULT 1,
  purchased_hashrate_th INTEGER NOT NULL,
  configuration_status TEXT NOT NULL DEFAULT 'Configuration Pending' 
    CHECK (configuration_status IN (
      'Configuration Pending',
      'Configured in Equalizer',
      'Miner Connecting',
      'Match Found',
      'Active',
      'Interrupted',
      'Flagged For Review'
    )),
  is_flagged_for_review BOOLEAN NOT NULL DEFAULT false,
  review_reason TEXT,
  configured_at TIMESTAMPTZ,
  configured_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pool_configs_customer ON public.customer_pool_configs(customer_id);
CREATE INDEX IF NOT EXISTS idx_pool_configs_gen_worker ON public.customer_pool_configs(generated_worker_name);
CREATE INDEX IF NOT EXISTS idx_pool_configs_status ON public.customer_pool_configs(configuration_status);

-- -------------------------------------------------------------------------
-- 2. WORKER IDENTITY REGISTRY
-- Authoritative, immutable registry of all generated worker identities in TMF
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_identity_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  customer_full_name TEXT NOT NULL,
  original_worker_name TEXT NOT NULL,
  generated_worker_name TEXT NOT NULL UNIQUE,
  pool_provider TEXT NOT NULL,
  pool_url TEXT NOT NULL,
  contract_sequence INTEGER NOT NULL,
  purchased_hashrate_th INTEGER NOT NULL,
  identity_status TEXT NOT NULL DEFAULT 'ACTIVE' 
    CHECK (identity_status IN ('ACTIVE', 'PENDING_CONFIG', 'ALLOCATED', 'FLAGGED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_reg_cust_seq ON public.worker_identity_registry(customer_id, contract_sequence);
CREATE INDEX IF NOT EXISTS idx_identity_reg_gen_worker ON public.worker_identity_registry(generated_worker_name);

-- -------------------------------------------------------------------------
-- 3. EQUALIZER MINERS INVENTORY
-- Cached representation of physical miners retrieved from Equalizer READ-ONLY API
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equalizer_miners (
  miner_id TEXT PRIMARY KEY, -- e.g. "MIN-001"
  hostname TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  pool_url TEXT,
  worker_name TEXT, -- Currently configured worker name in Equalizer
  hashrate_th NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'REBOOTING', 'ERROR')),
  temperature NUMERIC(5, 1) DEFAULT 60.0,
  uptime_seconds BIGINT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Allocation state
  allocation_status TEXT NOT NULL DEFAULT 'UNALLOCATED' CHECK (allocation_status IN ('UNALLOCATED', 'ALLOCATED', 'RESERVED')),
  allocated_contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  allocated_customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eq_miners_status ON public.equalizer_miners(status);
CREATE INDEX IF NOT EXISTS idx_eq_miners_alloc ON public.equalizer_miners(allocation_status);
CREATE INDEX IF NOT EXISTS idx_eq_miners_worker ON public.equalizer_miners(worker_name);

-- -------------------------------------------------------------------------
-- 4. MINER DETECTION LOGS
-- Logs automatic matching events when Equalizer reports a worker matching a customer identity
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.miner_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equalizer_miner_id TEXT NOT NULL REFERENCES public.equalizer_miners(miner_id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detected_worker_name TEXT NOT NULL,
  detected_pool_url TEXT,
  detected_hashrate NUMERIC(10, 2) NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'MATCH_FOUND' 
    CHECK (match_status IN (
      'MATCH_FOUND',
      'WAITING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'UNMATCHED',
      'AMBIGUOUS'
    )),
  confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_detection_logs_status ON public.miner_detection_logs(match_status);
CREATE INDEX IF NOT EXISTS idx_detection_logs_miner ON public.miner_detection_logs(equalizer_miner_id);
CREATE INDEX IF NOT EXISTS idx_detection_logs_worker ON public.miner_detection_logs(detected_worker_name);

-- -------------------------------------------------------------------------
-- 5. MINER ALLOCATIONS
-- Immutable historical and active records of customer-to-miner assignments
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.miner_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  miner_id TEXT NOT NULL REFERENCES public.equalizer_miners(miner_id) ON DELETE RESTRICT,
  allocated_hashrate_th NUMERIC(10, 2) NOT NULL,
  allocated_by UUID REFERENCES auth.users(id),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISCONNECTED', 'TERMINATED')),
  unallocated_at TIMESTAMPTZ,
  unallocated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_contract ON public.miner_allocations(contract_id);
CREATE INDEX IF NOT EXISTS idx_allocations_customer ON public.miner_allocations(customer_id);
CREATE INDEX IF NOT EXISTS idx_allocations_miner ON public.miner_allocations(miner_id);

-- Enforce that a physical miner cannot have multiple ACTIVE allocations simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_miner_allocation 
  ON public.miner_allocations(miner_id) 
  WHERE status = 'ACTIVE';

-- -------------------------------------------------------------------------
-- 6. EQUALIZER SYNCHRONIZATION HISTORY
-- Tracks every synchronization cycle with Equalizer Read-Only API
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.equalizer_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILED', 'PARTIAL')),
  miners_discovered INTEGER NOT NULL DEFAULT 0,
  miners_online INTEGER NOT NULL DEFAULT 0,
  matches_detected INTEGER NOT NULL DEFAULT 0,
  telemetry_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  sync_summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 7. DETECTION ACTIVITY FEED
-- Live chronological timeline of detection, matching, verification, and allocation
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.detection_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'MINER_DISCOVERED',
    'WORKER_MATCHED',
    'POOL_VERIFIED',
    'WAITING_APPROVAL',
    'ALLOCATION_APPROVED',
    'ALLOCATION_REVOKED',
    'TELEMETRY_ALERT',
    'STATUS_UPDATED'
  )),
  miner_id TEXT,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  worker_name TEXT,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_time ON public.detection_activity_feed(event_time DESC);

-- -------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Strict multi-tenant isolation: Customers see ONLY their own records
-- Admins have full read/write management across all operational tables
-- -------------------------------------------------------------------------
ALTER TABLE public.customer_pool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_identity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equalizer_miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equalizer_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detection_activity_feed ENABLE ROW LEVEL SECURITY;

-- Customer Pool Configs
CREATE POLICY "Customers view own pool configs" 
  ON public.customer_pool_configs FOR SELECT 
  USING (auth.uid() = customer_id OR public.is_admin());

CREATE POLICY "Customers insert own pool configs" 
  ON public.customer_pool_configs FOR INSERT 
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Admins manage pool configs" 
  ON public.customer_pool_configs FOR ALL 
  USING (public.is_admin());

-- Worker Identity Registry
CREATE POLICY "Customers view own worker identities" 
  ON public.worker_identity_registry FOR SELECT 
  USING (auth.uid() = customer_id OR public.is_admin());

CREATE POLICY "Admins manage worker identities" 
  ON public.worker_identity_registry FOR ALL 
  USING (public.is_admin());

-- Equalizer Miners Inventory (Admin Only - Customers never see global inventory)
CREATE POLICY "Admins manage equalizer miners" 
  ON public.equalizer_miners FOR ALL 
  USING (public.is_admin());

-- Miner Detection Logs (Admin Only)
CREATE POLICY "Admins manage detection logs" 
  ON public.miner_detection_logs FOR ALL 
  USING (public.is_admin());

-- Miner Allocations: Customer can see their own allocated miners; Admin can manage all
CREATE POLICY "Customers view own miner allocations" 
  ON public.miner_allocations FOR SELECT 
  USING (auth.uid() = customer_id OR public.is_admin());

CREATE POLICY "Admins manage miner allocations" 
  ON public.miner_allocations FOR ALL 
  USING (public.is_admin());

-- Equalizer Sync History (Admin Only)
CREATE POLICY "Admins view sync history" 
  ON public.equalizer_sync_history FOR ALL 
  USING (public.is_admin());

-- Detection Activity Feed (Admin Only)
CREATE POLICY "Admins view activity feed" 
  ON public.detection_activity_feed FOR ALL 
  USING (public.is_admin());
