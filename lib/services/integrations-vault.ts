import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";

// ============================================================================
// TMF ENTERPRISE SECURE INTEGRATIONS VAULT
// Server-Side AES-256-GCM Encrypted Storage for Third-Party API Credentials
// ============================================================================

export type IntegrationProvider = "nowpayments" | "equalizer";
export type IntegrationEnvironment = "production" | "sandbox" | "staging";

export interface NowPaymentsSecrets {
  apiKey: string;
  ipnSecret: string;
}

export interface NowPaymentsConfig {
  endpointUrl: string;
  isSandbox: boolean;
  ipnCallbackUrl?: string;
}

export interface EqualizerSecrets {
  apiKey: string;
  apiSecret?: string;
}

export interface EqualizerConfig {
  endpointUrl: string;
  clusterId: string;
  timeoutMs: number;
  readOnlyEnforced: boolean;
}

export interface StoredIntegrationRecord {
  id: string;
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  maskedPreview: Record<string, string>;
  config: Record<string, any>;
  lastTestedAt: string | null;
  lastTestStatus: "SUCCESS" | "FAILED" | "PENDING" | null;
  lastTestMessage: string | null;
  lastTestLatencyMs: number | null;
  updatedBy: string;
  updatedAt: string;
  createdAt: string;
}

export interface TestResult {
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Derive a resilient 32-byte master encryption key from server secrets
function getVaultMasterKey(): Buffer {
  const secretSource =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_VAULT_ENCRYPTION_KEY ||
    "tmf-enterprise-clean-grid-vault-secret-key-2026";
  return crypto.createHash("sha256").update(secretSource).digest();
}

/**
 * Encrypt sensitive secret payload with AES-256-GCM
 */
export function encryptVaultPayload(data: Record<string, any>): string {
  const key = getVaultMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify(data);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag}:${ciphertext}`;
}

/**
 * Decrypt sensitive secret payload with AES-256-GCM
 */
export function decryptVaultPayload(encryptedString: string): Record<string, any> | null {
  try {
    const parts = encryptedString.split(":");
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, ciphertext] = parts;
    const key = getVaultMasterKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (err) {
    console.error("[Vault Decrypt Error] Failed to decrypt secrets:", err);
    return null;
  }
}

/**
 * Masks sensitive API keys and secrets for secure display
 * Examples:
 *   "nwp_live_79a2fbc89104" -> "nwp_••••••••••••9104"
 *   "TmfOps2026"            -> "Tm••••26"
 */
export function maskSecretValue(secret: string): string {
  if (!secret || typeof secret !== "string") return "••••••••";
  const trimmed = secret.trim();
  if (trimmed.length <= 6) return "••••••••";
  if (trimmed.length <= 12) {
    return `${trimmed.slice(0, 2)}••••••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}••••••••••••${trimmed.slice(-4)}`;
}

// In-memory runtime cache for server persistence and fallback
const runtimeVaultStore: Record<string, { encryptedSecrets: string; record: StoredIntegrationRecord }> = {};

// Initialize fallback defaults from environment variables
function initDefaultsFromEnv(): void {
  const now = new Date().toISOString();

  // 1. NOWPayments Production
  const nwpProdKey = process.env.NOWPAYMENTS_API_KEY || "";
  const nwpProdIpn = process.env.NOWPAYMENTS_IPN_SECRET || "";
  if (!runtimeVaultStore["nowpayments_production"]) {
    runtimeVaultStore["nowpayments_production"] = {
      encryptedSecrets: encryptVaultPayload({ apiKey: nwpProdKey, ipnSecret: nwpProdIpn }),
      record: {
        id: "nowpayments_production",
        provider: "nowpayments",
        environment: "production",
        maskedPreview: {
          apiKey: nwpProdKey ? maskSecretValue(nwpProdKey) : "Not Configured",
          ipnSecret: nwpProdIpn ? maskSecretValue(nwpProdIpn) : "Not Configured",
        },
        config: {
          endpointUrl: "https://api.nowpayments.io/v1",
          isSandbox: false,
          ipnCallbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/webhooks/nowpayments`,
        },
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        lastTestLatencyMs: null,
        updatedBy: "system (environment)",
        updatedAt: now,
        createdAt: now,
      },
    };
  }

  // 2. NOWPayments Sandbox
  if (!runtimeVaultStore["nowpayments_sandbox"]) {
    runtimeVaultStore["nowpayments_sandbox"] = {
      encryptedSecrets: encryptVaultPayload({ apiKey: "", ipnSecret: "" }),
      record: {
        id: "nowpayments_sandbox",
        provider: "nowpayments",
        environment: "sandbox",
        maskedPreview: {
          apiKey: "Not Configured",
          ipnSecret: "Not Configured",
        },
        config: {
          endpointUrl: "https://api-sandbox.nowpayments.io/v1",
          isSandbox: true,
          ipnCallbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/webhooks/nowpayments`,
        },
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        lastTestLatencyMs: null,
        updatedBy: "system (environment)",
        updatedAt: now,
        createdAt: now,
      },
    };
  }

  // 3. Equalizer Production
  const eqProdUrl = process.env.EQUALIZER_API_URL || process.env.SEGMENTS_EQUALIZER_BASE_URL || "";
  const eqProdKey = process.env.EQUALIZER_API_KEY || process.env.SEGMENTS_EQUALIZER_API_KEY || "";
  if (!runtimeVaultStore["equalizer_production"]) {
    runtimeVaultStore["equalizer_production"] = {
      encryptedSecrets: encryptVaultPayload({ apiKey: eqProdKey, apiSecret: "" }),
      record: {
        id: "equalizer_production",
        provider: "equalizer",
        environment: "production",
        maskedPreview: {
          apiKey: eqProdKey ? maskSecretValue(eqProdKey) : "Not Configured",
          apiSecret: "Not Configured",
        },
        config: {
          endpointUrl: eqProdUrl || "https://equalizer-fleet.theminingfuture.com",
          clusterId: "Cluster 04 Clean Grid",
          timeoutMs: 5000,
          readOnlyEnforced: true,
        },
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        lastTestLatencyMs: null,
        updatedBy: "system (environment)",
        updatedAt: now,
        createdAt: now,
      },
    };
  }

  // 4. Equalizer Staging
  if (!runtimeVaultStore["equalizer_staging"]) {
    runtimeVaultStore["equalizer_staging"] = {
      encryptedSecrets: encryptVaultPayload({ apiKey: "", apiSecret: "" }),
      record: {
        id: "equalizer_staging",
        provider: "equalizer",
        environment: "staging",
        maskedPreview: {
          apiKey: "Not Configured",
          apiSecret: "Not Configured",
        },
        config: {
          endpointUrl: "https://staging-equalizer.theminingfuture.com",
          clusterId: "Staging Test Cluster",
          timeoutMs: 5000,
          readOnlyEnforced: true,
        },
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        lastTestLatencyMs: null,
        updatedBy: "system (environment)",
        updatedAt: now,
        createdAt: now,
      },
    };
  }
}

initDefaultsFromEnv();

/**
 * Retrieve decrypted secrets for backend usage.
 * NEVER exposes decrypted secrets to the client.
 */
export async function getDecryptedSecrets<T = Record<string, string>>(
  provider: IntegrationProvider,
  environment: IntegrationEnvironment = "production"
): Promise<{ secrets: T; config: Record<string, any> } | null> {
  const supabase = getAdminClient();
  const id = `${provider}_${environment}`;

  try {
    const { data, error } = await supabase
      .from("system_integration_secrets")
      .select("*")
      .eq("provider", provider)
      .eq("environment", environment)
      .maybeSingle();

    if (!error && data && data.encrypted_secrets) {
      const decrypted = decryptVaultPayload(data.encrypted_secrets);
      if (decrypted) {
        return {
          secrets: decrypted as T,
          config: data.config || {},
        };
      }
    }
  } catch (err) {
    // Supabase table query failed, fall back to runtime vault store
  }

  // Fallback to runtime store
  const cached = runtimeVaultStore[id];
  if (cached) {
    const decrypted = decryptVaultPayload(cached.encryptedSecrets);
    if (decrypted) {
      return {
        secrets: decrypted as T,
        config: cached.record.config,
      };
    }
  }

  return null;
}

/**
 * Retrieve masked integration record safe for front-end consumption
 */
export async function getIntegrationSummary(
  provider: IntegrationProvider,
  environment: IntegrationEnvironment = "production"
): Promise<StoredIntegrationRecord | null> {
  const supabase = getAdminClient();
  const id = `${provider}_${environment}`;

  try {
    const { data, error } = await supabase
      .from("system_integration_secrets")
      .select("id, provider, environment, masked_preview, config, last_tested_at, last_test_status, last_test_message, last_test_latency_ms, updated_by, updated_at, created_at")
      .eq("provider", provider)
      .eq("environment", environment)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        provider: data.provider,
        environment: data.environment,
        maskedPreview: data.masked_preview || {},
        config: data.config || {},
        lastTestedAt: data.last_tested_at,
        lastTestStatus: data.last_test_status,
        lastTestMessage: data.last_test_message,
        lastTestLatencyMs: data.last_test_latency_ms,
        updatedBy: data.updated_by || "system",
        updatedAt: data.updated_at,
        createdAt: data.created_at,
      };
    }
  } catch (err) {
    // Fall back to runtime store
  }

  const cached = runtimeVaultStore[id];
  return cached ? { ...cached.record } : null;
}

/**
 * Retrieve all integration summaries (safe for UI display)
 */
export async function getAllIntegrationSummaries(): Promise<StoredIntegrationRecord[]> {
  const providers: IntegrationProvider[] = ["nowpayments", "equalizer"];
  const environments: IntegrationEnvironment[] = ["production", "sandbox", "staging"];

  const results: StoredIntegrationRecord[] = [];
  for (const p of providers) {
    const envs = p === "nowpayments" ? (["production", "sandbox"] as IntegrationEnvironment[]) : (["production", "staging"] as IntegrationEnvironment[]);
    for (const e of envs) {
      const summary = await getIntegrationSummary(p, e);
      if (summary) {
        results.push(summary);
      }
    }
  }

  return results;
}

/**
 * Save and encrypt credentials in the vault
 */
export async function saveIntegrationSecrets(params: {
  provider: IntegrationProvider;
  environment: IntegrationEnvironment;
  secrets: Record<string, string | undefined>;
  config: Record<string, any>;
  updatedBy: string;
}): Promise<{ success: boolean; record: StoredIntegrationRecord; error?: string }> {
  const { provider, environment, secrets, config, updatedBy } = params;
  const id = `${provider}_${environment}`;
  const now = new Date().toISOString();

  // 1. Fetch current decrypted secrets to preserve unmodified fields
  const current = await getDecryptedSecrets<Record<string, string>>(provider, environment);
  const mergedSecrets: Record<string, string> = { ...(current?.secrets || {}) };

  // Update only fields that were actually provided (not blank, not masked placeholder)
  for (const [key, value] of Object.entries(secrets)) {
    if (value && typeof value === "string") {
      const trimmed = value.trim();
      // Ignore if user submitted the masked representation
      if (!trimmed.includes("••••") && trimmed !== "Not Configured") {
        mergedSecrets[key] = trimmed;
      }
    }
  }

  // 2. Build masked preview for safe display
  const maskedPreview: Record<string, string> = {};
  for (const [key, value] of Object.entries(mergedSecrets)) {
    maskedPreview[key] = value ? maskSecretValue(value) : "Not Configured";
  }

  // 3. Encrypt the secret payload with AES-256-GCM
  const encryptedSecrets = encryptVaultPayload(mergedSecrets);

  // 4. Update runtime cache
  const record: StoredIntegrationRecord = {
    id,
    provider,
    environment,
    maskedPreview,
    config,
    lastTestedAt: current ? null : null,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestLatencyMs: null,
    updatedBy,
    updatedAt: now,
    createdAt: now,
  };

  runtimeVaultStore[id] = { encryptedSecrets, record };

  // 5. Persist to Supabase table if available
  const supabase = getAdminClient();
  try {
    await supabase.from("system_integration_secrets").upsert(
      {
        id,
        provider,
        environment,
        encrypted_secrets: encryptedSecrets,
        masked_preview: maskedPreview,
        config,
        updated_by: updatedBy,
        updated_at: now,
      },
      { onConflict: "provider,environment" }
    );
  } catch (err) {
    console.warn("[Vault Persist Warning] Supabase storage fallback to memory:", err);
  }

  return { success: true, record };
}

/**
 * Record connection test outcome in vault and audit history
 */
export async function updateTestOutcome(
  provider: IntegrationProvider,
  environment: IntegrationEnvironment,
  testResult: TestResult
): Promise<void> {
  const id = `${provider}_${environment}`;
  const now = new Date().toISOString();

  if (runtimeVaultStore[id]) {
    runtimeVaultStore[id].record.lastTestedAt = testResult.timestamp;
    runtimeVaultStore[id].record.lastTestStatus = testResult.success ? "SUCCESS" : "FAILED";
    runtimeVaultStore[id].record.lastTestMessage = testResult.message;
    runtimeVaultStore[id].record.lastTestLatencyMs = testResult.latencyMs;
  }

  const supabase = getAdminClient();
  try {
    await supabase
      .from("system_integration_secrets")
      .update({
        last_tested_at: testResult.timestamp,
        last_test_status: testResult.success ? "SUCCESS" : "FAILED",
        last_test_message: testResult.message,
        last_test_latency_ms: testResult.latencyMs,
        updated_at: now,
      })
      .eq("provider", provider)
      .eq("environment", environment);
  } catch (err) {
    // Silent catch
  }
}

/**
 * Test NOWPayments API connectivity
 */
export async function testNowPaymentsConnection(
  apiKey: string,
  endpointUrl: string = "https://api.nowpayments.io/v1"
): Promise<TestResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  if (!apiKey || apiKey.includes("••••") || apiKey === "Not Configured") {
    return {
      success: false,
      latencyMs: 0,
      message: "API Key is required to test NOWPayments connection.",
      timestamp,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    // Call official NOWPayments /status endpoint
    const cleanEndpoint = endpointUrl.replace(/\/+$/, "");
    const response = await fetch(`${cleanEndpoint}/status`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const json = await response.json().catch(() => ({}));
      return {
        success: true,
        statusCode: response.status,
        latencyMs,
        message: `NOWPayments API is operational (HTTP ${response.status}). Gateway responsive.`,
        details: { statusMessage: json.message || "OK" },
        timestamp,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        statusCode: response.status,
        latencyMs,
        message: `Authentication Failed (HTTP ${response.status}): Invalid NOWPayments API key.`,
        timestamp,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      latencyMs,
      message: `NOWPayments returned unexpected status HTTP ${response.status}.`,
      timestamp,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    if (err.name === "AbortError") {
      return {
        success: false,
        latencyMs,
        message: "Connection timed out after 6000ms. Please check your network or endpoint URL.",
        timestamp,
      };
    }
    return {
      success: false,
      latencyMs,
      message: `Network Error: ${err.message || "Could not connect to NOWPayments endpoint."}`,
      timestamp,
    };
  }
}

/**
 * Test Segments Equalizer Telemetry API connectivity
 */
export async function testEqualizerConnection(
  endpointUrl: string,
  apiKey: string,
  timeoutMs: number = 5000
): Promise<TestResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  if (!endpointUrl) {
    return {
      success: false,
      latencyMs: 0,
      message: "Equalizer API endpoint URL is required.",
      timestamp,
    };
  }

  if (!apiKey || apiKey.includes("••••") || apiKey === "Not Configured") {
    return {
      success: false,
      latencyMs: 0,
      message: "Equalizer Bearer API Key is required to test connection.",
      timestamp,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 5000);

    const cleanEndpoint = endpointUrl.replace(/\/+$/, "");
    const response = await fetch(`${cleanEndpoint}/api/v1/miners`, {
      method: "GET", // Enforce READ-ONLY GET
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
        "User-Agent": "TMF-CloudMining-Integrations-Test/1.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const minersList = Array.isArray(data.miners) ? data.miners : Array.isArray(data) ? data : [];
      const onlineMiners = minersList.filter((m: any) => m.status === "ONLINE").length;

      return {
        success: true,
        statusCode: response.status,
        latencyMs,
        message: `Equalizer Telemetry API connected successfully (HTTP ${response.status}). ${onlineMiners} online miner(s) detected.`,
        details: {
          facilityName: data.facility_name || data.cluster_name || "TMF Enterprise Facility",
          totalMiners: minersList.length,
          onlineMiners,
        },
        timestamp,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        statusCode: response.status,
        latencyMs,
        message: `Equalizer Authentication Failed (HTTP ${response.status}): Invalid Bearer Token.`,
        timestamp,
      };
    }

    return {
      success: false,
      statusCode: response.status,
      latencyMs,
      message: `Equalizer API returned HTTP error ${response.status}.`,
      timestamp,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    if (err.name === "AbortError") {
      return {
        success: false,
        latencyMs,
        message: `Equalizer connection timed out after ${timeoutMs}ms.`,
        timestamp,
      };
    }
    return {
      success: false,
      latencyMs,
      message: `Equalizer Connection Error: ${err.message || "Failed to reach endpoint."}`,
      timestamp,
    };
  }
}
