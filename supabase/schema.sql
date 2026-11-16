-- =========================================================================
-- THE MINING FUTURE (TMF) CLOUD HASHRATE PLATFORM
-- PRODUCTION POSTGRESQL SCHEMA FOR SUPABASE
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. PROFILES (Extends Supabase auth.users)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  telegram_username TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'superadmin', 'operations')),
  wallet_balance_usdt NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  custom_offers JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to create profile automatically on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, whatsapp, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -------------------------------------------------------------------------
-- 2. SYSTEM PRICING SETTINGS (Managed by Admin Dashboard)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_pricing_settings (
  id SERIAL PRIMARY KEY,
  base_rate_per_th_day NUMERIC(12, 7) NOT NULL DEFAULT 0.0309966, -- $0.0309966 / TH / Day (~$92.99 for 100TH/30D)
  min_hashrate_th INTEGER NOT NULL DEFAULT 10,
  max_hashrate_th INTEGER NOT NULL DEFAULT 20000,
  min_duration_days INTEGER NOT NULL DEFAULT 30,
  max_duration_days INTEGER NOT NULL DEFAULT 365,
  btc_price_fallback NUMERIC(12, 2) NOT NULL DEFAULT 65000.00,
  est_daily_btc_per_th NUMERIC(16, 10) NOT NULL DEFAULT 0.0000004738,
  volume_discounts JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"min_th": 1000, "discount_pct": 5}]
  duration_discounts JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"min_days": 180, "discount_pct": 5}]
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default row if empty
INSERT INTO public.system_pricing_settings (id, base_rate_per_th_day, min_hashrate_th, max_hashrate_th, min_duration_days, max_duration_days)
SELECT 1, 0.0309966, 10, 20000, 30, 365
WHERE NOT EXISTS (SELECT 1 FROM public.system_pricing_settings WHERE id = 1);

-- Audit log for pricing modifications
CREATE TABLE IF NOT EXISTS public.pricing_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by UUID REFERENCES auth.users(id),
  old_base_rate NUMERIC(12, 7) NOT NULL,
  new_base_rate NUMERIC(12, 7) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 3. ORDERS & PAYMENTS (Crypto Checkout with NOWPayments)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hashrate_th INTEGER NOT NULL CHECK (hashrate_th >= 10 AND hashrate_th <= 20000),
  duration_days INTEGER NOT NULL CHECK (duration_days >= 30 AND duration_days <= 365),
  base_rate_applied NUMERIC(12, 7) NOT NULL,
  total_usd NUMERIC(12, 2) NOT NULL,
  payment_currency TEXT NOT NULL CHECK (payment_currency IN ('USDT_TRC20', 'USDT_ERC20', 'BTC')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED')),
  nowpayments_order_id TEXT,
  nowpayments_payment_id TEXT,
  pay_address TEXT,
  pay_amount NUMERIC(18, 8),
  payment_status TEXT DEFAULT 'waiting',
  ipn_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 4. POOL DESTINATIONS (Strict Customer Lock)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pool_destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  stratum_url TEXT NOT NULL,
  account_username TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  worker_password TEXT NOT NULL DEFAULT 'x',
  is_locked BOOLEAN NOT NULL DEFAULT true,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 5. CONTRACTS (Hashrate Allocation Lifecycle)
-- -------------------------------------------------------------------------
-- Status model:
--   'WAITING_TO_ASSIGN': Customer paid, waiting for admin to configure Segments Equalizer
--   'ACTIVE': Assigned in Equalizer, stratum routing hashrate, countdown clock running
--   'COMPLETED': Normal duration completed
--   'SUSPENDED': Temporarily paused
--   'CANCELLED': Cancelled or refunded
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  hashrate_th INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING_TO_ASSIGN' CHECK (status IN ('WAITING_TO_ASSIGN', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'SUSPENDED', 'CANCELLED')),
  
  -- Manual allocation tracking
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  equalizer_worker_id TEXT, -- The worker or allocation ID configured in Segments Equalizer
  
  -- Timing clock (only starts once allocated/active!)
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Live telemetry summary (updated by 5-min Read-Only poller)
  live_hashrate_th NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  average_24h_hashrate_th NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  delivery_ratio_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  worker_status TEXT NOT NULL DEFAULT 'STARTING' CHECK (worker_status IN ('STARTING', 'ONLINE', 'LOW_HASHRATE', 'OFFLINE')),
  last_stats_update TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 6. WORKER TELEMETRY (Read-Only API Polling Samples)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_telemetry_5m (
  id BIGSERIAL PRIMARY KEY,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  equalizer_worker_id TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hashrate_th NUMERIC(10, 2) NOT NULL,
  shares_accepted BIGINT DEFAULT 0,
  shares_rejected BIGINT DEFAULT 0,
  worker_status TEXT NOT NULL DEFAULT 'ONLINE'
);

CREATE INDEX IF NOT EXISTS idx_telemetry_contract_time ON public.worker_telemetry_5m(contract_id, recorded_at DESC);

-- -------------------------------------------------------------------------
-- 7. SUPPORT TICKETS (Pool Change Requests & Assistance)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT UNIQUE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
  ticket_type TEXT NOT NULL DEFAULT 'GENERAL',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_whatsapp TEXT,
  subject TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'In Progress',
  priority TEXT NOT NULL DEFAULT 'Normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 8. ADMIN AUDIT LOGS
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_telemetry_5m ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Customer can read & update their own profile; Admin can read all
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- System Pricing Settings: Anyone can SELECT (public pricing); Only Admin can UPDATE
CREATE POLICY "Public read pricing" ON public.system_pricing_settings FOR SELECT USING (true);
CREATE POLICY "Admin update pricing" ON public.system_pricing_settings FOR UPDATE USING (public.is_admin());

-- Orders: Customers read own orders; Admins read all
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Users insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Pool Destinations: Customers read own; Cannot update (LOCKED); Admin can update via ticket
CREATE POLICY "Users read own pool" ON public.pool_destinations FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Users insert own pool" ON public.pool_destinations FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admin manage pool" ON public.pool_destinations FOR UPDATE USING (public.is_admin());

-- Contracts: Customer read own; Admin full manage
CREATE POLICY "Users read own contracts" ON public.contracts FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Admin manage contracts" ON public.contracts FOR ALL USING (public.is_admin());

-- Worker Telemetry: Customer read own contract telemetry; Admin read all
CREATE POLICY "Users read own telemetry" ON public.worker_telemetry_5m FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.contracts WHERE contracts.id = worker_telemetry_5m.contract_id AND contracts.customer_id = auth.uid())
  OR public.is_admin()
);

-- Support Tickets & Messages: Customer reads own; Admin reads all
CREATE POLICY "Users read own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Users create own tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admin manage tickets" ON public.support_tickets FOR ALL USING (public.is_admin());

CREATE POLICY "Users read ticket messages" ON public.support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.customer_id = auth.uid())
  OR public.is_admin()
);
CREATE POLICY "Users insert ticket messages" ON public.support_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
);


-- =========================================================================
-- 10. EQUALIZER INTEGRATION & AUTOMATIC WORKER IDENTITY EXTENSION
-- =========================================================================

-- CUSTOMER POOL CONFIGURATIONS
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

-- WORKER IDENTITY REGISTRY
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

-- EQUALIZER MINERS INVENTORY
CREATE TABLE IF NOT EXISTS public.equalizer_miners (
  miner_id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  pool_url TEXT,
  worker_name TEXT,
  hashrate_th NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE', 'REBOOTING', 'ERROR')),
  temperature NUMERIC(5, 1) DEFAULT 60.0,
  uptime_seconds BIGINT NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- MINER DETECTION LOGS
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

-- MINER ALLOCATIONS
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_miner_allocation 
  ON public.miner_allocations(miner_id) 
  WHERE status = 'ACTIVE';

-- EQUALIZER SYNC HISTORY
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

-- DETECTION ACTIVITY FEED
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

-- RLS
ALTER TABLE public.customer_pool_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_identity_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equalizer_miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_detection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miner_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equalizer_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detection_activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own pool configs" ON public.customer_pool_configs FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Customers insert own pool configs" ON public.customer_pool_configs FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admins manage pool configs" ON public.customer_pool_configs FOR ALL USING (public.is_admin());

CREATE POLICY "Customers view own worker identities" ON public.worker_identity_registry FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Admins manage worker identities" ON public.worker_identity_registry FOR ALL USING (public.is_admin());

CREATE POLICY "Admins manage equalizer miners" ON public.equalizer_miners FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage detection logs" ON public.miner_detection_logs FOR ALL USING (public.is_admin());

CREATE POLICY "Customers view own miner allocations" ON public.miner_allocations FOR SELECT USING (auth.uid() = customer_id OR public.is_admin());
CREATE POLICY "Admins manage miner allocations" ON public.miner_allocations FOR ALL USING (public.is_admin());

CREATE POLICY "Admins view sync history" ON public.equalizer_sync_history FOR ALL USING (public.is_admin());
CREATE POLICY "Admins view activity feed" ON public.detection_activity_feed FOR ALL USING (public.is_admin());
