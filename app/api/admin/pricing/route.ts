import { NextRequest, NextResponse } from "next/server";
import {
  getPricingConfig,
  updatePricingConfig,
  getLiveBtcPrice,
  getOracleBtcPrice,
  calculateAuthoritativeQuote,
} from "@/lib/services/pricing";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const config = getPricingConfig();

    // Sync from Supabase system_pricing_settings if available
    try {
      const supabase = getAdminClient();
      const { data, error } = await supabase
        .from("system_pricing_settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (!error && data) {
        if (data.base_rate_per_th_day != null) config.baseRatePerThDay = Number(data.base_rate_per_th_day);
        if (data.min_hashrate_th != null) config.minHashrateTh = Number(data.min_hashrate_th);
        if (data.max_hashrate_th != null) config.maxHashrateTh = Number(data.max_hashrate_th);
        if (data.min_duration_days != null) config.minDurationDays = Number(data.min_duration_days);
        if (data.max_duration_days != null) config.maxDurationDays = Number(data.max_duration_days);
        if (data.est_daily_btc_per_th != null) config.estDailyBtcPerTh = Number(data.est_daily_btc_per_th);
        updatePricingConfig(config);
      }
    } catch {}

    const oracleInfo = await getOracleBtcPrice();
    const effectiveBtcPrice = await getLiveBtcPrice();

    const sample1000Th = calculateAuthoritativeQuote({
      hashrateTh: 1000,
      durationDays: 30,
      baseRatePerThDay: config.baseRatePerThDay,
      btcPrice: effectiveBtcPrice,
    });

    const sample100Th = calculateAuthoritativeQuote({
      hashrateTh: 100,
      durationDays: 30,
      baseRatePerThDay: config.baseRatePerThDay,
      btcPrice: effectiveBtcPrice,
    });

    return NextResponse.json({
      success: true,
      config,
      oracle: {
        price: effectiveBtcPrice,
        livePrice: oracleInfo.price,
        effectivePrice: effectiveBtcPrice,
        source: oracleInfo.source,
        timestamp: oracleInfo.timestamp,
        lastUpdated: oracleInfo.lastUpdated,
        nextRefresh: oracleInfo.nextRefresh,
        ttlRemainingSeconds: oracleInfo.ttlRemainingSeconds,
        refreshIntervalMinutes: 60,
        isOverridden: config.overrideBtcPrice !== null,
      },
      samples: {
        sample100Th,
        sample1000Th,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if refresh live price was requested
    if (body.refreshLivePrice) {
      const oracleInfo = await getOracleBtcPrice(true);
      return NextResponse.json({
        success: true,
        message: `Live BTC price refreshed from ${oracleInfo.source}: $${oracleInfo.price.toLocaleString()} USD (Auto-refreshes every 1 hr)`,
        liveBtcPrice: oracleInfo.price,
        source: oracleInfo.source,
        timestamp: oracleInfo.timestamp,
        lastUpdated: oracleInfo.lastUpdated,
        nextRefresh: oracleInfo.nextRefresh,
        ttlRemainingSeconds: oracleInfo.ttlRemainingSeconds,
      });
    }

    // Update settings in memory
    const updated = updatePricingConfig({
      baseRatePerThDay: body.baseRatePerThDay != null ? Number(body.baseRatePerThDay) : undefined,
      minHashrateTh: body.minHashrateTh != null ? Number(body.minHashrateTh) : undefined,
      maxHashrateTh: body.maxHashrateTh != null ? Number(body.maxHashrateTh) : undefined,
      minDurationDays: body.minDurationDays != null ? Number(body.minDurationDays) : undefined,
      maxDurationDays: body.maxDurationDays != null ? Number(body.maxDurationDays) : undefined,
      estDailyBtcPerTh: body.estDailyBtcPerTh != null ? Number(body.estDailyBtcPerTh) : undefined,
      overrideBtcPrice: body.overrideBtcPrice !== undefined ? (body.overrideBtcPrice ? Number(body.overrideBtcPrice) : null) : undefined,
    });

    // Try to update Supabase if configured
    try {
      const supabase = getAdminClient();
      await supabase
        .from("system_pricing_settings")
        .upsert({
          id: 1,
          base_rate_per_th_day: updated.baseRatePerThDay,
          min_hashrate_th: updated.minHashrateTh,
          max_hashrate_th: updated.maxHashrateTh,
          min_duration_days: updated.minDurationDays,
          max_duration_days: updated.maxDurationDays,
          est_daily_btc_per_th: updated.estDailyBtcPerTh,
          updated_at: new Date().toISOString(),
        });
    } catch {
      // Memory state is already authoritative
    }

    const effectiveBtcPrice = await getLiveBtcPrice();

    return NextResponse.json({
      success: true,
      message: "Platform hashrate pricing and live BTC settings updated successfully!",
      config: updated,
      effectiveBtcPrice,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
