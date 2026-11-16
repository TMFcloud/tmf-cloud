import { getAdminClient } from "@/lib/supabase/admin";

// In-memory cache for live crypto prices
export interface CachedPrice {
  btcUsd: number;
  timestamp: number;
  source: string;
}

let cachedPrice: CachedPrice | null = null;
export const BTC_ORACLE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (auto refresh every 1 hr)

export const DEFAULT_BASE_RATE_PER_TH_DAY = 0.0309966; // $0.0309966 / TH / Day (~$92.99 for 100TH/30D)
export const DEFAULT_BTC_PRICE_FALLBACK = 67000.0;
export const DEFAULT_EST_DAILY_BTC_PER_TH = 0.0000004738; // ~0.00004738 BTC for 100 TH

export interface SystemPricingConfig {
  baseRatePerThDay: number;
  minHashrateTh: number;
  maxHashrateTh: number;
  minDurationDays: number;
  maxDurationDays: number;
  estDailyBtcPerTh: number;
  overrideBtcPrice: number | null; // null = use live oracle
  updatedAt: string;
}

// Active singleton pricing configuration (persists in memory across requests)
let memoryPricingConfig: SystemPricingConfig = {
  baseRatePerThDay: DEFAULT_BASE_RATE_PER_TH_DAY,
  minHashrateTh: 10,
  maxHashrateTh: 20000,
  minDurationDays: 30,
  maxDurationDays: 365,
  estDailyBtcPerTh: DEFAULT_EST_DAILY_BTC_PER_TH,
  overrideBtcPrice: null,
  updatedAt: new Date().toISOString(),
};

/**
 * Helper to fetch a fresh BTC price directly from external oracles
 */
async function fetchFromExternalOracles(): Promise<{ price: number; source: string } | null> {
  // 1. Primary: Binance Public Ticker
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.price) {
        const price = parseFloat(data.price);
        if (!isNaN(price) && price > 0) {
          return { price, source: "Binance Oracle" };
        }
      }
    }
  } catch (err) {
    console.warn("Binance oracle fetch failed, trying CoinGecko fallback...", err);
  }

  // 2. Secondary: CoinGecko Public API
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.usd) {
        const price = Number(data.bitcoin.usd);
        if (!isNaN(price) && price > 0) {
          return { price, source: "CoinGecko Oracle" };
        }
      }
    }
  } catch (err) {
    console.warn("CoinGecko price fetch failed, trying Coinbase fallback...", err);
  }

  // 3. Tertiary: Coinbase API
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/BTC-USD/spot", {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.amount) {
        const price = parseFloat(data.data.amount);
        if (!isNaN(price) && price > 0) {
          return { price, source: "Coinbase Oracle" };
        }
      }
    }
  } catch (err) {
    console.warn("Coinbase oracle fetch failed", err);
  }

  return null;
}

/**
 * Returns raw live oracle price with strict 1-hour auto-refresh cache
 */
export async function getOracleBtcPrice(forceRefresh: boolean = false): Promise<{
  price: number;
  source: string;
  timestamp: number;
  lastUpdated: string;
  nextRefresh: string;
  ttlRemainingSeconds: number;
}> {
  const now = Date.now();

  // If memory cache is not present, check Supabase for persisted 1-hour price
  if (!cachedPrice && !forceRefresh) {
    try {
      const supabase = getAdminClient();
      const { data } = await supabase
        .from("system_pricing_settings")
        .select("btc_price_fallback, updated_at")
        .eq("id", 1)
        .single();

      if (data?.btc_price_fallback && data?.updated_at) {
        const dbTimestamp = new Date(data.updated_at).getTime();
        if (!isNaN(dbTimestamp) && now - dbTimestamp < BTC_ORACLE_CACHE_TTL_MS) {
          cachedPrice = {
            btcUsd: Number(data.btc_price_fallback),
            timestamp: dbTimestamp,
            source: "Binance Oracle",
          };
        }
      }
    } catch {}
  }

  // If cached price is still valid (< 1 hr) and not forced, return cached price
  if (!forceRefresh && cachedPrice && now - cachedPrice.timestamp < BTC_ORACLE_CACHE_TTL_MS) {
    const nextRefreshMs = cachedPrice.timestamp + BTC_ORACLE_CACHE_TTL_MS;
    return {
      price: cachedPrice.btcUsd,
      source: cachedPrice.source,
      timestamp: cachedPrice.timestamp,
      lastUpdated: new Date(cachedPrice.timestamp).toISOString(),
      nextRefresh: new Date(nextRefreshMs).toISOString(),
      ttlRemainingSeconds: Math.max(0, Math.floor((nextRefreshMs - now) / 1000)),
    };
  }

  // 1-hour has elapsed or forced refresh requested -> fetch fresh price from external oracles
  const fresh = await fetchFromExternalOracles();
  if (fresh) {
    cachedPrice = {
      btcUsd: fresh.price,
      timestamp: now,
      source: fresh.source,
    };

    // Persist fresh 1-hour price to Supabase
    try {
      const supabase = getAdminClient();
      await supabase
        .from("system_pricing_settings")
        .update({
          btc_price_fallback: fresh.price,
          updated_at: new Date(now).toISOString(),
        })
        .eq("id", 1);
    } catch (err) {
      console.warn("Failed to persist refreshed BTC price to Supabase:", err);
    }

    const nextRefreshMs = now + BTC_ORACLE_CACHE_TTL_MS;
    return {
      price: fresh.price,
      source: fresh.source,
      timestamp: now,
      lastUpdated: new Date(now).toISOString(),
      nextRefresh: new Date(nextRefreshMs).toISOString(),
      ttlRemainingSeconds: Math.floor(BTC_ORACLE_CACHE_TTL_MS / 1000),
    };
  }

  // Fallback if network calls failed
  const fallbackPrice = cachedPrice?.btcUsd || DEFAULT_BTC_PRICE_FALLBACK;
  const fallbackTimestamp = cachedPrice?.timestamp || now;
  const nextRefreshMs = fallbackTimestamp + BTC_ORACLE_CACHE_TTL_MS;

  return {
    price: fallbackPrice,
    source: cachedPrice?.source || "Multi-Oracle Fallback",
    timestamp: fallbackTimestamp,
    lastUpdated: new Date(fallbackTimestamp).toISOString(),
    nextRefresh: new Date(nextRefreshMs).toISOString(),
    ttlRemainingSeconds: Math.max(0, Math.floor((nextRefreshMs - now) / 1000)),
  };
}

/**
 * Fetches live BTC price with 1-hour auto-refresh cache and admin override support
 */
export async function getLiveBtcPrice(forceRefresh: boolean = false): Promise<number> {
  // If admin has set an explicit price override, return it directly
  if (memoryPricingConfig.overrideBtcPrice && memoryPricingConfig.overrideBtcPrice > 0) {
    return memoryPricingConfig.overrideBtcPrice;
  }

  const oracleInfo = await getOracleBtcPrice(forceRefresh);
  return oracleInfo.price;
}

/**
 * Get the current active pricing configuration
 */
export function getPricingConfig(): SystemPricingConfig {
  return { ...memoryPricingConfig };
}

/**
 * Update the active platform pricing configuration
 */
export function updatePricingConfig(updates: Partial<SystemPricingConfig>): SystemPricingConfig {
  if (updates.baseRatePerThDay !== undefined && updates.baseRatePerThDay > 0) {
    memoryPricingConfig.baseRatePerThDay = Number(updates.baseRatePerThDay);
  }
  if (updates.minHashrateTh !== undefined && updates.minHashrateTh > 0) {
    memoryPricingConfig.minHashrateTh = Number(updates.minHashrateTh);
  }
  if (updates.maxHashrateTh !== undefined && updates.maxHashrateTh > 0) {
    memoryPricingConfig.maxHashrateTh = Number(updates.maxHashrateTh);
  }
  if (updates.minDurationDays !== undefined && updates.minDurationDays > 0) {
    memoryPricingConfig.minDurationDays = Number(updates.minDurationDays);
  }
  if (updates.maxDurationDays !== undefined && updates.maxDurationDays > 0) {
    memoryPricingConfig.maxDurationDays = Number(updates.maxDurationDays);
  }
  if (updates.estDailyBtcPerTh !== undefined && updates.estDailyBtcPerTh > 0) {
    memoryPricingConfig.estDailyBtcPerTh = Number(updates.estDailyBtcPerTh);
  }
  if (updates.overrideBtcPrice !== undefined) {
    memoryPricingConfig.overrideBtcPrice = updates.overrideBtcPrice && updates.overrideBtcPrice > 0 ? Number(updates.overrideBtcPrice) : null;
  }
  memoryPricingConfig.updatedAt = new Date().toISOString();
  return { ...memoryPricingConfig };
}

/**
 * Calculates authoritative server-side cost and payouts
 */
export function calculateAuthoritativeQuote(params: {
  hashrateTh: number;
  durationDays: number;
  baseRatePerThDay?: number;
  btcPrice: number;
}) {
  const baseRate = params.baseRatePerThDay ?? memoryPricingConfig.baseRatePerThDay;
  
  // Total USD: TH * Days * Rate
  const totalUsdRaw = params.hashrateTh * params.durationDays * baseRate;
  const totalUsd = Math.round(totalUsdRaw * 100) / 100; // Round to 2 decimal places

  // Crypto equivalents
  const totalBtc = Number((totalUsd / params.btcPrice).toFixed(6));
  const totalUsdt = totalUsd;

  // Estimated daily payout in BTC
  const estDailyBtc = Number((params.hashrateTh * (memoryPricingConfig.estDailyBtcPerTh || DEFAULT_EST_DAILY_BTC_PER_TH)).toFixed(8));

  return {
    baseRatePerThDay: baseRate,
    totalUsd,
    totalUsdt,
    totalBtc,
    btcPrice: params.btcPrice,
    estDailyBtc,
    disclaimer: "Estimated daily payout is variable based on Bitcoin network difficulty and mining pool luck. Mining rewards are not guaranteed earnings.",
  };
}
