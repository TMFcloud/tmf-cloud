/**
 * TMF CLOUD MINING: EQUALIZER READ-ONLY API CLIENT
 * 
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Equalizer is the absolute source of truth for physical miner hardware status and telemetry.
 * 2. TMF MUST NEVER modify Equalizer configurations through its API.
 * 3. NO POST, PUT, PATCH, or DELETE requests are EVER sent to Equalizer.
 * 4. All API keys and endpoints remain strictly server-side.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getDecryptedSecrets, EqualizerSecrets } from "@/lib/services/integrations-vault";

export interface EqualizerMinerTelemetry {
  miner_id: string; // e.g. "MIN-001"
  hostname: string;
  ip_address: string;
  pool_url: string;
  worker_name: string;
  hashrate_th: number;
  status: "ONLINE" | "OFFLINE" | "REBOOTING" | "ERROR";
  temperature: number;
  uptime_seconds: number;
  last_seen: string;
}

export interface EqualizerApiResponse {
  success: boolean;
  miners: EqualizerMinerTelemetry[];
  facility_name?: string;
  cluster_name?: string;
  total_hashrate_th: number;
  timestamp: string;
  error?: string;
  isConfigured?: boolean;
}

/**
 * Standard fleet is populated strictly from the live Equalizer READ-ONLY API.
 * When the Segments Equalizer API is not connected or credentials are missing,
 * this array remains strictly empty to prevent displaying fabricated telemetry.
 */
export const MOCK_EQUALIZER_MINERS: EqualizerMinerTelemetry[] = [];

/**
 * Executes a strictly READ-ONLY poll to Equalizer API.
 * Never performs mutating operations.
 * If credentials are not configured or the API is unreachable, returns success: false
 * with 0 miners and an authentic disconnected state.
 */
export async function fetchEqualizerMinerTelemetry(): Promise<EqualizerApiResponse> {
  let apiUrl = process.env.EQUALIZER_API_URL || process.env.SEGMENTS_EQUALIZER_BASE_URL;
  let apiKey = process.env.EQUALIZER_API_KEY || process.env.SEGMENTS_EQUALIZER_API_KEY;

  // Check secure vault if environment variables are not set or to use rotated credentials
  if (!apiUrl || !apiKey) {
    try {
      const vaultConfig = await getDecryptedSecrets<EqualizerSecrets>("equalizer", "production");
      if (vaultConfig?.secrets?.apiKey) {
        apiKey = vaultConfig.secrets.apiKey;
        apiUrl = vaultConfig.config?.endpointUrl || apiUrl;
      }
    } catch {}
  }

  // If credentials missing, honestly report disconnected state (NEVER return mock data)
  if (!apiUrl || !apiKey) {
    return {
      success: false,
      miners: [],
      facility_name: "Segments Equalizer (Unconfigured)",
      total_hashrate_th: 0,
      timestamp: new Date().toISOString(),
      error: "Segments Equalizer API is not connected. API key is not configured in environment variables or secure vault.",
      isConfigured: false,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${apiUrl}/api/v1/miners`, {
      method: "GET", // Enforce GET only
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        "User-Agent": "TMF-CloudMining-ReadOnly-Client/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const minersList: EqualizerMinerTelemetry[] = Array.isArray(data.miners)
        ? data.miners
        : Array.isArray(data)
        ? data
        : [];
      const totalHash = minersList.reduce(
        (acc, m) => acc + (m.status === "ONLINE" ? Number(m.hashrate_th || 0) : 0),
        0
      );
      return {
        success: true,
        miners: minersList,
        facility_name: data.facility_name || data.cluster_name || "TMF Enterprise Facility",
        total_hashrate_th: Math.round(totalHash * 100) / 100,
        timestamp: new Date().toISOString(),
        isConfigured: true,
      };
    } else {
      console.warn(`Equalizer API responded with HTTP ${response.status}.`);
      return {
        success: false,
        miners: [],
        facility_name: "TMF Enterprise Facility",
        total_hashrate_th: 0,
        timestamp: new Date().toISOString(),
        error: `Segments Equalizer API returned HTTP error ${response.status}.`,
        isConfigured: true,
      };
    }
  } catch (err: any) {
    console.error("Equalizer API network error:", err);
    return {
      success: false,
      miners: [],
      facility_name: "TMF Enterprise Facility",
      total_hashrate_th: 0,
      timestamp: new Date().toISOString(),
      error: err.message || "Failed to establish network connection with Segments Equalizer endpoint.",
      isConfigured: true,
    };
  }
}

/**
 * Upserts Equalizer miner telemetry into the database equalizer_miners table.
 * Preserves existing customer allocations.
 */
export async function syncEqualizerMinersToDatabase(
  supabase: SupabaseClient,
  miners: EqualizerMinerTelemetry[]
): Promise<{ upsertedCount: number; onlineCount: number }> {
  if (!miners || miners.length === 0) {
    return { upsertedCount: 0, onlineCount: 0 };
  }

  let onlineCount = 0;

  for (const m of miners) {
    if (m.status === "ONLINE") onlineCount++;

    // Check existing record to preserve manual allocation
    const { data: existing } = await supabase
      .from("equalizer_miners")
      .select("allocation_status, allocated_contract_id, allocated_customer_id, allocated_at")
      .eq("miner_id", m.miner_id)
      .maybeSingle();

    const allocationStatus = existing?.allocation_status || "UNALLOCATED";
    const allocatedContractId = existing?.allocated_contract_id || null;
    const allocatedCustomerId = existing?.allocated_customer_id || null;
    const allocatedAt = existing?.allocated_at || null;

    await supabase.from("equalizer_miners").upsert(
      {
        miner_id: m.miner_id,
        hostname: m.hostname,
        ip_address: m.ip_address,
        pool_url: m.pool_url,
        worker_name: m.worker_name,
        hashrate_th: m.hashrate_th,
        status: m.status,
        temperature: m.temperature,
        uptime_seconds: m.uptime_seconds,
        last_seen: m.last_seen || new Date().toISOString(),
        allocation_status: allocationStatus,
        allocated_contract_id: allocatedContractId,
        allocated_customer_id: allocatedCustomerId,
        allocated_at: allocatedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "miner_id" }
    );
  }

  return {
    upsertedCount: miners.length,
    onlineCount,
  };
}
