import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getLiveBtcPrice,
  calculateAuthoritativeQuote,
  DEFAULT_BASE_RATE_PER_TH_DAY,
} from "@/lib/services/pricing";
import { generateUniqueWorkerIdentity } from "@/lib/services/workerIdentity";

/**
 * Preserves a pending hashrate order in the server-side database
 * when a user reviews a purchase or registers, ensuring the original
 * purchase journey is preserved without relying solely on client localStorage.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_id,
      hashrate_th = 1000,
      duration_days = 30,
      payment_currency = "USDT_TRC20",
      pool = {},
    } = body;

    const supabase = getAdminClient();

    // Authenticate user: from Authorization header or explicit customer_id from auth signup
    let userId = customer_id;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Customer ID is required to preserve pending order." },
        { status: 401 }
      );
    }

    // 1. Fetch Authoritative Pricing
    let baseRate = DEFAULT_BASE_RATE_PER_TH_DAY;
    const { data: pricingData } = await supabase
      .from("system_pricing_settings")
      .select("base_rate_per_th_day, min_hashrate_th, max_hashrate_th, min_duration_days, max_duration_days")
      .eq("id", 1)
      .maybeSingle();

    if (pricingData?.base_rate_per_th_day) {
      baseRate = Number(pricingData.base_rate_per_th_day);
    }

    const btcPrice = await getLiveBtcPrice();
    const quote = calculateAuthoritativeQuote({
      hashrateTh: Number(hashrate_th),
      durationDays: Number(duration_days),
      baseRatePerThDay: baseRate,
      btcPrice,
    });

    // 2. Fetch Customer Details
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    const customerFullName = profile?.full_name || "Valued Customer";

    // 3. Check for existing PENDING order with matching parameters (idempotent reuse)
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, total_usd, status, nowpayments_invoice_url, hashrate_th, duration_days")
      .eq("customer_id", userId)
      .eq("status", "PENDING")
      .eq("hashrate_th", hashrate_th)
      .eq("duration_days", duration_days)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        isReused: true,
        quote,
        totalUsd: existingOrder.total_usd,
      });
    }

    // 4. Create new PENDING order in Supabase
    const dbCurrency =
      payment_currency === "BTC"
        ? "BTC"
        : payment_currency === "USDT_ERC20"
        ? "USDT_ERC20"
        : "USDT_TRC20";

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        hashrate_th: Number(hashrate_th),
        duration_days: Number(duration_days),
        base_rate_applied: baseRate,
        total_usd: quote.totalUsd,
        payment_currency: dbCurrency,
        status: "PENDING",
        payment_status: "waiting",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[PRESERVE PENDING] Order creation error:", orderError);
      return NextResponse.json(
        { success: false, error: "Failed to preserve pending order in database." },
        { status: 500 }
      );
    }

    // 5. Generate and attach Worker Identity & Pool Destinations
    const poolProvider = pool.pool_provider || "ViaBTC";
    const stratumUrl = pool.stratum_url || "stratum+tcp://btc.viabtc.top:3333";
    const workerName = pool.worker_name || "worker1";
    const workerPassword = pool.worker_password || "x";

    try {
      const workerIdentity = await generateUniqueWorkerIdentity(supabase, {
        customerFullName,
        originalWorkerName: workerName,
        purchasedHashrateTh: Number(hashrate_th),
        poolProvider,
        poolUrl: stratumUrl,
        customerId: userId,
      });

      await supabase.from("customer_pool_configs").insert({
        customer_id: userId,
        order_id: order.id,
        pool_provider: poolProvider,
        pool_url: stratumUrl,
        original_worker_name: workerIdentity.originalWorkerName,
        generated_worker_name: workerIdentity.generatedWorkerName,
        identity_initials: workerIdentity.initials,
        contract_sequence: workerIdentity.sequence,
        purchased_hashrate_th: Number(hashrate_th),
        configuration_status: "Configuration Pending",
      });

      await supabase.from("pool_destinations").insert({
        order_id: order.id,
        customer_id: userId,
        stratum_url: stratumUrl,
        account_username: workerName,
        worker_name: workerIdentity.generatedWorkerName,
        worker_password: workerPassword,
        is_locked: true,
      });
    } catch (poolErr) {
      console.warn("[PRESERVE PENDING] Non-blocking pool setup error:", poolErr);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      isReused: false,
      quote,
      totalUsd: quote.totalUsd,
    });
  } catch (err: any) {
    console.error("[PRESERVE PENDING] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
