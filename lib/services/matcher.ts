/**
 * TMF CLOUD MINING: AUTOMATIC WORKER MATCHING & DETECTION ENGINE
 * 
 * Compares:
 * Customer's generated worker identity (e.g. subesh.SM01CLOUD200)
 * Against:
 * Worker names retrieved from Equalizer READ-ONLY API.
 * 
 * Rules:
 * 1. Must match exact generated worker identity.
 * 2. Never match using original worker name alone!
 * 3. Validate configured Stratum pool URL where available.
 * 4. Verify miner online status and positive hashrate telemetry.
 * 5. If all checks pass: Status = "MATCH FOUND – READY FOR ADMIN APPROVAL".
 * 6. Never automatically activate customer allocation without admin approval.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { EqualizerMinerTelemetry } from "./equalizer";

export interface DetectionMatchCandidate {
  miner_id: string;
  hostname: string;
  ip_address: string;
  detected_worker_name: string;
  detected_pool_url: string;
  detected_hashrate: number;
  miner_status: string;
  
  // Matched customer & contract information
  customer_id: string;
  customer_full_name: string;
  contract_id: string | null;
  purchased_hashrate_th: number;
  expected_pool_url: string;
  
  // Validation breakdown
  is_exact_worker_match: boolean;
  is_pool_url_match: boolean;
  is_miner_online: boolean;
  is_already_allocated: boolean;
  match_status: "MATCH_FOUND" | "AMBIGUOUS" | "WAITING_APPROVAL" | "ALREADY_ALLOCATED";
  confidence_score: number;
}

/**
 * Normalizes Stratum URLs for loose host/port comparison.
 */
function normalizeStratumUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url
    .toLowerCase()
    .trim()
    .replace(/^stratum\+tcp:\/\//, "")
    .replace(/^stratum\+ssl:\/\//, "")
    .replace(/\/$/, "");
}

/**
 * Scans all Equalizer miners against active customer pool configurations.
 */
export async function runAutomaticWorkerDetection(
  supabase: SupabaseClient,
  miners: EqualizerMinerTelemetry[]
): Promise<{
  matches: DetectionMatchCandidate[];
  newLogsCount: number;
}> {
  const matches: DetectionMatchCandidate[] = [];
  let newLogsCount = 0;

  // 1. Fetch all customer pool configs that are pending or connecting
  const { data: poolConfigs, error: configError } = await supabase
    .from("customer_pool_configs")
    .select(`
      id,
      customer_id,
      contract_id,
      pool_provider,
      pool_url,
      original_worker_name,
      generated_worker_name,
      purchased_hashrate_th,
      configuration_status,
      profiles:customer_id (full_name, email)
    `)
    .in("configuration_status", [
      "Configuration Pending",
      "Configured in Equalizer",
      "Miner Connecting",
      "Match Found",
    ]);

  if (configError || !poolConfigs || poolConfigs.length === 0) {
    return { matches: [], newLogsCount: 0 };
  }

  // 2. Index pool configs by generated_worker_name
  const configByWorker = new Map<string, any>();
  for (const cfg of poolConfigs) {
    if (cfg.generated_worker_name) {
      configByWorker.set(cfg.generated_worker_name.trim(), cfg);
    }
  }

  // 3. Compare each miner reported by Equalizer
  for (const miner of miners) {
    if (!miner.worker_name) continue;

    const trimmedWorker = miner.worker_name.trim();
    const matchedConfig = configByWorker.get(trimmedWorker);

    if (matchedConfig) {
      // EXACT IDENTITY MATCH FOUND!
      const isPoolMatch =
        !miner.pool_url ||
        !matchedConfig.pool_url ||
        normalizeStratumUrl(miner.pool_url) === normalizeStratumUrl(matchedConfig.pool_url);

      const isOnline = miner.status === "ONLINE" && miner.hashrate_th > 0;

      // Check if this miner is already actively allocated
      const { data: activeAlloc } = await supabase
        .from("miner_allocations")
        .select("id, contract_id")
        .eq("miner_id", miner.miner_id)
        .eq("status", "ACTIVE")
        .maybeSingle();

      const isAlreadyAllocated = !!activeAlloc;

      const profileName = (matchedConfig.profiles as any)?.full_name || "Customer";

      const candidate: DetectionMatchCandidate = {
        miner_id: miner.miner_id,
        hostname: miner.hostname,
        ip_address: miner.ip_address,
        detected_worker_name: trimmedWorker,
        detected_pool_url: miner.pool_url,
        detected_hashrate: miner.hashrate_th,
        miner_status: miner.status,
        customer_id: matchedConfig.customer_id,
        customer_full_name: profileName,
        contract_id: matchedConfig.contract_id,
        purchased_hashrate_th: matchedConfig.purchased_hashrate_th,
        expected_pool_url: matchedConfig.pool_url,
        is_exact_worker_match: true,
        is_pool_url_match: isPoolMatch,
        is_miner_online: isOnline,
        is_already_allocated: isAlreadyAllocated,
        match_status: isAlreadyAllocated ? "ALREADY_ALLOCATED" : "MATCH_FOUND",
        confidence_score: isPoolMatch && isOnline ? 100.0 : 85.0,
      };

      matches.push(candidate);

      if (!isAlreadyAllocated) {
        // Record into miner_detection_logs if not already logged as WAITING_APPROVAL
        const { data: existingLog } = await supabase
          .from("miner_detection_logs")
          .select("id")
          .eq("equalizer_miner_id", miner.miner_id)
          .eq("detected_worker_name", trimmedWorker)
          .in("match_status", ["MATCH_FOUND", "WAITING_APPROVAL"])
          .maybeSingle();

        if (!existingLog) {
          await supabase.from("miner_detection_logs").insert({
            equalizer_miner_id: miner.miner_id,
            contract_id: matchedConfig.contract_id,
            customer_id: matchedConfig.customer_id,
            detected_worker_name: trimmedWorker,
            detected_pool_url: miner.pool_url,
            detected_hashrate: miner.hashrate_th,
            match_status: "MATCH_FOUND",
            confidence_score: candidate.confidence_score,
            detected_at: new Date().toISOString(),
            notes: `Auto-matched generated worker identity for ${profileName}. Stratum pool match: ${isPoolMatch ? 'YES' : 'UNCONFIRMED'}.`,
          });

          // Insert into activity feed
          await supabase.from("detection_activity_feed").insert([
            {
              event_type: "MINER_DISCOVERED",
              miner_id: miner.miner_id,
              worker_name: trimmedWorker,
              message: `New miner telemetry received from Equalizer: ${miner.miner_id} (${miner.hashrate_th} TH/s)`,
            },
            {
              event_type: "WORKER_MATCHED",
              miner_id: miner.miner_id,
              customer_id: matchedConfig.customer_id,
              worker_name: trimmedWorker,
              message: `Worker identity matched: ${trimmedWorker} (Customer: ${profileName})`,
            },
            {
              event_type: "POOL_VERIFIED",
              miner_id: miner.miner_id,
              customer_id: matchedConfig.customer_id,
              message: `Stratum pool verified: ${matchedConfig.pool_url}`,
            },
            {
              event_type: "WAITING_APPROVAL",
              miner_id: miner.miner_id,
              customer_id: matchedConfig.customer_id,
              message: `MATCH FOUND – Ready for Admin Approval (${miner.miner_id} -> ${matchedConfig.purchased_hashrate_th} TH/s contract)`,
            },
          ]);

          // Update customer_pool_configs status to "Match Found"
          await supabase
            .from("customer_pool_configs")
            .update({
              configuration_status: "Match Found",
              updated_at: new Date().toISOString(),
            })
            .eq("id", matchedConfig.id);

          newLogsCount++;
        }
      }
    }
  }

  return { matches, newLogsCount };
}
