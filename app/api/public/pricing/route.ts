import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getLiveBtcPrice,
  getOracleBtcPrice,
  getPricingConfig,
  updatePricingConfig,
} from "@/lib/services/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getPricingConfig();

    // Check if Supabase has custom persistent overrides
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from("system_pricing_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (!error && data) {
        if (data.base_rate_per_th_day != null) {
          config.baseRatePerThDay = Number(data.base_rate_per_th_day);
        }
        if (data.min_hashrate_th != null) config.minHashrateTh = Number(data.min_hashrate_th);
        if (data.max_hashrate_th != null) config.maxHashrateTh = Number(data.max_hashrate_th);
        if (data.min_duration_days != null) config.minDurationDays = Number(data.min_duration_days);
        if (data.max_duration_days != null) config.maxDurationDays = Number(data.max_duration_days);
        if (data.est_daily_btc_per_th != null) config.estDailyBtcPerTh = Number(data.est_daily_btc_per_th);
      }
    } catch {
      // Fallback cleanly to in-memory config
    }

    const oracleInfo = await getOracleBtcPrice();
    const btcPrice = config.overrideBtcPrice && config.overrideBtcPrice > 0 ? config.overrideBtcPrice : oracleInfo.price;

    return NextResponse.json(
      {
        success: true,
        baseRatePerThDay: config.baseRatePerThDay,
        minTh: config.minHashrateTh,
        maxTh: config.maxHashrateTh,
        minDays: config.minDurationDays,
        maxDays: config.maxDurationDays,
        btcPrice: btcPrice || 67000,
        estDailyBtcPerTh: config.estDailyBtcPerTh,
        overrideBtcPrice: config.overrideBtcPrice,
        oracleSource: oracleInfo.source,
        oracleLastUpdated: oracleInfo.lastUpdated,
        oracleNextRefresh: oracleInfo.nextRefresh,
        oracleAutoRefreshIntervalMinutes: 60,
        currency: "USD",
        disclaimer: "Estimated daily payout is calculated based on current Bitcoin network difficulty and is not guaranteed.",
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
        },
      }
    );
  } catch (error) {
    const config = getPricingConfig();
    return NextResponse.json(
      {
        success: true,
        baseRatePerThDay: config.baseRatePerThDay,
        minTh: config.minHashrateTh,
        maxTh: config.maxHashrateTh,
        minDays: config.minDurationDays,
        maxDays: config.maxDurationDays,
        btcPrice: 67000,
        estDailyBtcPerTh: config.estDailyBtcPerTh,
        currency: "USD",
      },
      { status: 200 }
    );
  }
}
