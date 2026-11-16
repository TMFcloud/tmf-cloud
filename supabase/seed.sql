-- =========================================================================
-- THE MINING FUTURE (TMF) CLOUD PLATFORM
-- PRODUCTION SEED DATA FOR SUPABASE
-- Run this in the Supabase SQL Editor after applying schema.sql
-- =========================================================================

-- 1. SYSTEM PRICING SETTINGS (Default: $0.0309966 / TH / Day)
INSERT INTO public.system_pricing_settings (
  id,
  base_rate_per_th_day,
  min_hashrate_th,
  max_hashrate_th,
  min_duration_days,
  max_duration_days,
  btc_price_fallback,
  est_daily_btc_per_th,
  is_active
)
VALUES (
  1,
  0.0309966,
  10,
  20000,
  30,
  365,
  67221.00,
  0.0000004738,
  true
)
ON CONFLICT (id) DO UPDATE SET
  base_rate_per_th_day = EXCLUDED.base_rate_per_th_day,
  updated_at = now();

-- 2. EQUALIZER PHYSICAL MINERS FLEET (Master Facility Worker Architecture)
-- All physical hardware operates under unified datacenter worker: tmf_datacenter_pool.uae04
INSERT INTO public.equalizer_miners (
  miner_id,
  hostname,
  ip_address,
  pool_url,
  worker_name,
  hashrate_th,
  status,
  temperature,
  uptime_seconds,
  allocation_status
)
VALUES
  ('MIN-001', 'antminer-s21-001.uae04.tmf', '10.240.4.11', 'stratum+tcp://btc.viabtc.top:3333', 'tmf_datacenter_pool.uae04', 100.70, 'ONLINE', 62.4, 1234500, 'ALLOCATED'),
  ('MIN-002', 'antminer-s21-002.uae04.tmf', '10.240.4.12', 'stratum+tcp://btc.viabtc.top:3333', 'tmf_datacenter_pool.uae04', 100.70, 'ONLINE', 64.1, 1234400, 'ALLOCATED'),
  ('MIN-003', 'antminer-s21-003.uae04.tmf', '10.240.4.13', 'stratum+tcp://btc.viabtc.top:3333', 'tmf_datacenter_pool.uae04', 200.50, 'ONLINE', 61.8, 984500, 'ALLOCATED'),
  ('MIN-004', 'antminer-s21-004.uae04.tmf', '10.240.4.14', 'stratum+tcp://btc.viabtc.top:3333', 'tmf_datacenter_pool.uae04', 0.00, 'OFFLINE', 0.0, 0, 'UNALLOCATED'),
  ('MIN-005', 'antminer-s21-005.uae04.tmf', '10.240.4.15', 'stratum+tcp://btc.viabtc.top:3333', 'tmf_datacenter_pool.uae04', 200.00, 'ONLINE', 63.2, 1234500, 'UNALLOCATED'),
  ('MIN-006', 'antminer-s21-006.uae04.tmf', '10.240.4.16', 'stratum+tcp://btc.viabtc.top:3333', 'tmf_datacenter_pool.uae04', 0.00, 'ONLINE', 42.0, 1234500, 'UNALLOCATED')
ON CONFLICT (miner_id) DO UPDATE SET
  hostname = EXCLUDED.hostname,
  ip_address = EXCLUDED.ip_address,
  pool_url = EXCLUDED.pool_url,
  worker_name = EXCLUDED.worker_name,
  hashrate_th = EXCLUDED.hashrate_th,
  status = EXCLUDED.status,
  temperature = EXCLUDED.temperature,
  allocation_status = EXCLUDED.allocation_status,
  updated_at = now();

-- 3. EQUALIZER SYNC HISTORY LOG
INSERT INTO public.equalizer_sync_history (
  id,
  sync_started_at,
  sync_completed_at,
  duration_ms,
  status,
  miners_discovered,
  miners_online,
  matches_detected,
  telemetry_updated,
  sync_summary
)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  now() - INTERVAL '5 minutes',
  now() - INTERVAL '5 minutes' + INTERVAL '412 milliseconds',
  412,
  'SUCCESS',
  6,
  5,
  2,
  6,
  '{"cluster": "uae04", "master_worker": "tmf_datacenter_pool.uae04", "active_hashrate_th": 601.9}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 4. DETECTION ACTIVITY FEED EVENTS
INSERT INTO public.detection_activity_feed (
  id,
  event_time,
  event_type,
  miner_id,
  worker_name,
  message,
  metadata
)
VALUES
  (
    'f1a2b3c4-1111-4444-8888-000000000001',
    now() - INTERVAL '12 minutes',
    'MINER_DISCOVERED',
    'MIN-001',
    'tmf_datacenter_pool.uae04',
    'Hardware telemetry matched with Equalizer facility worker tmf_datacenter_pool.uae04',
    '{"hashrate_th": 100.7, "status": "ONLINE"}'::jsonb
  ),
  (
    'f1a2b3c4-1111-4444-8888-000000000002',
    now() - INTERVAL '8 minutes',
    'ALLOCATION_APPROVED',
    'MIN-001',
    'subesh.SM01CLOUD200',
    'Admin approved allocation: 201.4 TH/s allocated to Subesh Mullasery',
    '{"hashrate_th": 201.4, "customer": "Subesh Mullasery"}'::jsonb
  ),
  (
    'f1a2b3c4-1111-4444-8888-000000000003',
    now() - INTERVAL '5 minutes',
    'WAITING_APPROVAL',
    'MIN-003',
    'rahul.RK01CLOUD200',
    'MATCH FOUND - Waiting for admin approval (rahul.RK01CLOUD200 -> 200 TH/s Contract)',
    '{"hashrate_th": 200.5, "customer": "Rahul Kumar"}'::jsonb
  ),
  (
    'f1a2b3c4-1111-4444-8888-000000000004',
    now() - INTERVAL '2 minutes',
    'STATUS_UPDATED',
    'MIN-005',
    'tmf_datacenter_pool.uae04',
    'Reserve miner MIN-005 online (200.0 TH/s ready for new customer purchases)',
    '{"reserve_th": 200.0}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 5. SUPPORT TICKETS SEED
INSERT INTO public.support_tickets (
  id,
  ticket_code,
  customer_name,
  customer_email,
  customer_phone,
  customer_whatsapp,
  subject,
  message,
  ticket_type,
  status,
  priority
)
VALUES
  (
    'e1a2b3c4-2222-4444-8888-000000000001',
    'TICKET-914',
    'Subesh Mullasery',
    'subesh.m@theminingfuture.com',
    '+971 50 123 4567',
    '971501234567',
    'Request +100 TH/s Enterprise Hashrate Upgrade',
    'Looking to expand my current 200 TH/s contract by adding an extra 100 TH/s on UAE Cluster 04. What is the best available rate for renewal?',
    'HASHRATE_ISSUE',
    'In Progress',
    'High'
  ),
  (
    'e1a2b3c4-2222-4444-8888-000000000002',
    'TICKET-908',
    'Rahul Kumar',
    'rahul.k@theminingfuture.com',
    '+971 55 987 6543',
    '971559876543',
    'Equalizer Worker Telemetry Sync Check',
    'Can operations verify if rahul.RK01CLOUD200 has completed hashrate allocation on F2Pool?',
    'GENERAL',
    'In Progress',
    'Normal'
  ),
  (
    'e1a2b3c4-2222-4444-8888-000000000003',
    'TICKET-882',
    'Subesh Mullasery',
    'subesh.m@theminingfuture.com',
    '+971 50 123 4567',
    '971501234567',
    'Pool Configuration via ViaBTC Stratum',
    'Confirmed stratum connectivity for ViaBTC port 3333. Working smoothly.',
    'POOL_CHANGE_REQUEST',
    'Resolved',
    'Normal'
  )
ON CONFLICT (id) DO NOTHING;
