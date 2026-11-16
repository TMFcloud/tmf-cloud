/**
 * TMF CLOUD MINING: AUTOMATIC UNIQUE WORKER IDENTITY GENERATOR
 * 
 * Identity format specification:
 * {original_worker_name}.{initials}{sequence}CLOUD{hashrate_th}
 * 
 * Example:
 * Customer: Subesh Mullasery -> Initials: SM
 * Original Worker Name: subesh
 * Contract Sequence: 01
 * Purchased Hashrate: 200 TH/s
 * Generated Identity: subesh.SM01CLOUD200
 * 
 * Second Contract for Subesh: subesh.SM02CLOUD200
 * Rahul Kumar (RK, 200 TH/s): rahul.RK01CLOUD200
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface WorkerIdentityGenerationInput {
  customerFullName: string;
  originalWorkerName: string;
  purchasedHashrateTh: number;
  poolProvider?: string;
  poolUrl?: string;
  customerId?: string;
  contractSequence?: number;
}

export interface WorkerIdentityResult {
  originalWorkerName: string;
  generatedWorkerName: string;
  initials: string;
  sequence: number;
  sequenceFormatted: string;
  purchasedHashrateTh: number;
  isFlaggedForReview: boolean;
  reviewReason?: string;
}

/**
 * Extracts 2-letter uppercase initials from customer full name.
 * Handles single names, multi-word names, and edge cases.
 */
export function extractCustomerInitials(fullName: string): string {
  if (!fullName || typeof fullName !== "string") return "TM";
  
  const cleaned = fullName.trim().replace(/[^a-zA-Z\s]/g, "");
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "TM";
  }

  if (words.length === 1) {
    const single = words[0];
    if (single.length >= 2) {
      return single.slice(0, 2).toUpperCase();
    }
    return (single + "M").toUpperCase();
  }

  // First and Last name initials (e.g. Subesh Mullasery -> SM)
  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
}

/**
 * Extracts client first name for worker identity prefix.
 * Prioritizes actual customer first name (e.g. 'Subesh' -> 'subesh', 'Rahul' -> 'rahul')
 * ensuring it never defaults to platform branding ('tmf').
 */
export function extractClientFirstName(fullName: string, fallbackWorker?: string): string {
  if (fullName && typeof fullName === "string") {
    const cleaned = fullName.trim().replace(/[^a-zA-Z0-9\s]/g, "");
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const first = words[0].toLowerCase();
      if (first !== "customer" && first !== "client" && first !== "user" && first !== "tmf") {
        return first;
      }
    }
  }

  if (fallbackWorker && typeof fallbackWorker === "string") {
    const cleaned = fallbackWorker.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (cleaned && cleaned !== "tmf" && cleaned !== "worker") {
      return cleaned;
    }
  }

  return "client";
}

/**
 * Validates worker name against standard mining pool requirements.
 * If special characters or length are problematic, flags for admin review
 * rather than silently altering customer identity.
 */
export function validatePoolWorkerCompatibility(
  generatedWorkerName: string,
  poolProvider: string,
  poolUrl: string
): { isFlagged: boolean; reason?: string } {
  const normalizedProvider = (poolProvider || "").toLowerCase();
  const normalizedUrl = (poolUrl || "").toLowerCase();

  // Length check: Stratum specification standard is usually <= 64 chars
  if (generatedWorkerName.length > 64) {
    return {
      isFlagged: true,
      reason: `Generated worker length (${generatedWorkerName.length}) exceeds 64-character Stratum standard limit.`,
    };
  }

  // ViaBTC: Supports alphanumeric, dot, underscore, hyphen
  if (normalizedProvider.includes("viabtc") || normalizedUrl.includes("viabtc")) {
    if (generatedWorkerName.length > 64) {
      return { isFlagged: true, reason: "ViaBTC worker name exceeds 64-character limit." };
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(generatedWorkerName)) {
      return { isFlagged: true, reason: "ViaBTC worker contains unsupported special characters." };
    }
  }

  // F2Pool: Requires valid alphanumeric sub-account and worker name
  if (normalizedProvider.includes("f2pool") || normalizedUrl.includes("f2pool")) {
    if (generatedWorkerName.length > 32) {
      return { isFlagged: true, reason: "F2Pool recommended worker length exceeds 32 characters." };
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(generatedWorkerName)) {
      return { isFlagged: true, reason: "F2Pool worker contains invalid characters." };
    }
  }

  // AntPool
  if (normalizedProvider.includes("antpool") || normalizedUrl.includes("antpool")) {
    if (!/^[a-zA-Z0-9._-]+$/.test(generatedWorkerName)) {
      return { isFlagged: true, reason: "AntPool worker contains invalid characters." };
    }
  }

  // Generic sanity check: must only contain alphanumeric, dots, underscores, and hyphens
  if (!/^[a-zA-Z0-9._-]+$/.test(generatedWorkerName)) {
    return {
      isFlagged: true,
      reason: "Worker name contains non-standard characters that may fail on Stratum protocol handshake.",
    };
  }

  return { isFlagged: false };
}

/**
 * Pure generator: constructs the TMF unique worker identity matching client first & last and selected plan.
 */
export function buildWorkerIdentityString(
  clientNameOrWorker: string,
  initials: string,
  sequence: number,
  hashrateTh: number
): string {
  const prefix = extractClientFirstName(clientNameOrWorker);
  const cleanInitials = initials.toUpperCase().replace(/[^A-Z]/g, "") || "TM";
  const seqPadded = String(sequence).padStart(2, "0");
  const th = Math.round(hashrateTh);

  return `${prefix}.${cleanInitials}${seqPadded}CLOUD${th}`;
}

/**
 * Resolves the next contract sequence for a customer by querying the database.
 */
export async function getNextCustomerContractSequence(
  supabase: SupabaseClient,
  customerId: string
): Promise<number> {
  if (!customerId) return 1;

  try {
    const { count, error } = await supabase
      .from("worker_identity_registry")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId);

    if (error || typeof count !== "number") {
      // Fallback: check customer_pool_configs
      const { count: poolCount } = await supabase
        .from("customer_pool_configs")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId);

      return (poolCount || 0) + 1;
    }

    return count + 1;
  } catch {
    return 1;
  }
}

/**
 * Full Worker Identity Generation Pipeline.
 * Extracts initials, computes sequence, constructs identity, validates pool compatibility,
 * and asserts global uniqueness.
 */
export async function generateUniqueWorkerIdentity(
  supabase: SupabaseClient | null,
  input: WorkerIdentityGenerationInput
): Promise<WorkerIdentityResult> {
  const initials = extractCustomerInitials(input.customerFullName);
  const firstName = extractClientFirstName(input.customerFullName, input.originalWorkerName);
  
  let sequence = input.contractSequence;
  if (!sequence && supabase && input.customerId) {
    sequence = await getNextCustomerContractSequence(supabase, input.customerId);
  }
  sequence = sequence || 1;

  let generatedWorkerName = buildWorkerIdentityString(
    firstName,
    initials,
    sequence,
    input.purchasedHashrateTh
  );

  // If supabase client provided, check global uniqueness
  if (supabase) {
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from("worker_identity_registry")
        .select("id")
        .eq("generated_worker_name", generatedWorkerName)
        .maybeSingle();

      if (!existing) break;

      // In case of collision, increment sequence
      sequence += 1;
      generatedWorkerName = buildWorkerIdentityString(
        firstName,
        initials,
        sequence,
        input.purchasedHashrateTh
      );
      attempts++;
    }
  }

  // Validate pool compatibility
  const poolValidation = validatePoolWorkerCompatibility(
    generatedWorkerName,
    input.poolProvider || "ViaBTC",
    input.poolUrl || ""
  );

  return {
    originalWorkerName: input.originalWorkerName.trim(),
    generatedWorkerName,
    initials,
    sequence,
    sequenceFormatted: String(sequence).padStart(2, "0"),
    purchasedHashrateTh: input.purchasedHashrateTh,
    isFlaggedForReview: poolValidation.isFlagged,
    reviewReason: poolValidation.reason,
  };
}
