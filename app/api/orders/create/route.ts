import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { CreateOrderSchema } from "@/lib/validations/order";
import {
  getLiveBtcPrice,
  calculateAuthoritativeQuote,
  DEFAULT_BASE_RATE_PER_TH_DAY,
} from "@/lib/services/pricing";
import { generateUniqueWorkerIdentity } from "@/lib/services/workerIdentity";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Strict Input Validation (Zod)
    const validationResult = CreateOrderSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { hashrate_th, duration_days, payment_currency, payment_method = "CRYPTO", pool } = validationResult.data;

    const supabase = getAdminClient();

    // 2. Authenticate the User
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id || null;
    }

    // If no Bearer token, check if customer_id was provided (or guest checkout mapping)
    if (!userId && body.customer_id) {
      userId = body.customer_id;
    }

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required to finalize order. Please login or register.",
          requiresAuth: true,
        },
        { status: 401 }
      );
    }

    // 3. Query Authoritative Base Price from Database
    let baseRate = DEFAULT_BASE_RATE_PER_TH_DAY;
    const { data: pricingData } = await supabase
      .from("system_pricing_settings")
      .select("base_rate_per_th_day, min_hashrate_th, max_hashrate_th, min_duration_days, max_duration_days")
      .eq("id", 1)
      .single();

    if (pricingData) {
      baseRate = Number(pricingData.base_rate_per_th_day);
      if (hashrate_th < pricingData.min_hashrate_th || hashrate_th > pricingData.max_hashrate_th) {
        return NextResponse.json(
          { success: false, error: `Hashrate must be between ${pricingData.min_hashrate_th} and ${pricingData.max_hashrate_th} TH/s` },
          { status: 400 }
        );
      }
      if (duration_days < pricingData.min_duration_days || duration_days > pricingData.max_duration_days) {
        return NextResponse.json(
          { success: false, error: `Duration must be between ${pricingData.min_duration_days} and ${pricingData.max_duration_days} days` },
          { status: 400 }
        );
      }
    }

    // 4. Calculate Server-Side Authoritative Quote
    const btcPrice = await getLiveBtcPrice();
    const quote = calculateAuthoritativeQuote({
      hashrateTh: hashrate_th,
      durationDays: duration_days,
      baseRatePerThDay: baseRate,
      btcPrice,
    });

    // 5. Fetch Customer Profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, wallet_balance_usdt")
      .eq("id", userId)
      .maybeSingle();

    const customerFullName = profile?.full_name || "Customer User";
    const currentWalletBalance = Number(profile?.wallet_balance_usdt || 0);

    // CASE A: Pay with Wallet Balance
    if (payment_method === "WALLET") {
      if (currentWalletBalance < quote.totalUsd) {
        return NextResponse.json(
          {
            success: false,
            insufficientBalance: true,
            error: `Insufficient wallet balance. You have $${currentWalletBalance.toFixed(2)} available, but this plan requires $${quote.totalUsd.toFixed(2)}.`,
            required: quote.totalUsd,
            available: currentWalletBalance,
            shortfall: Math.round((quote.totalUsd - currentWalletBalance) * 100) / 100,
          },
          { status: 400 }
        );
      }

      const newBalance = Math.round((currentWalletBalance - quote.totalUsd) * 100) / 100;

      // 1. Deduct balance from profile
      await supabase
        .from("profiles")
        .update({
          wallet_balance_usdt: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      // 2. Insert PAID order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: userId,
          hashrate_th,
          duration_days,
          base_rate_applied: baseRate,
          total_usd: quote.totalUsd,
          payment_currency: "USDT_TRC20",
          status: "PAID",
          payment_status: "wallet_deducted",
          ipn_verified_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (orderError || !order) {
        console.error("Order creation error:", orderError);
        return NextResponse.json(
          { success: false, error: "Failed to create order record." },
          { status: 500 }
        );
      }

      // 3. Generate unique worker identity
      const poolProvider = pool.pool_provider || "ViaBTC";
      const workerIdentity = await generateUniqueWorkerIdentity(supabase, {
        customerFullName,
        originalWorkerName: pool.worker_name,
        purchasedHashrateTh: hashrate_th,
        poolProvider,
        poolUrl: pool.stratum_url,
        customerId: userId,
      });

      // 4. Save into customer_pool_configs
      await supabase.from("customer_pool_configs").insert({
        customer_id: userId,
        order_id: order.id,
        pool_provider: poolProvider,
        pool_url: pool.stratum_url,
        original_worker_name: workerIdentity.originalWorkerName,
        generated_worker_name: workerIdentity.generatedWorkerName,
        identity_initials: workerIdentity.initials,
        contract_sequence: workerIdentity.sequence,
        purchased_hashrate_th: hashrate_th,
        configuration_status: "Configuration Pending",
        is_flagged_for_review: workerIdentity.isFlaggedForReview,
        review_reason: workerIdentity.reviewReason,
      });

      // 5. Save into worker_identity_registry
      await supabase.from("worker_identity_registry").insert({
        customer_id: userId,
        customer_full_name: customerFullName,
        original_worker_name: workerIdentity.originalWorkerName,
        generated_worker_name: workerIdentity.generatedWorkerName,
        pool_provider: poolProvider,
        pool_url: pool.stratum_url,
        contract_sequence: workerIdentity.sequence,
        purchased_hashrate_th: hashrate_th,
        identity_status: "PENDING_CONFIG",
      });

      // 6. Lock pool destination
      await supabase.from("pool_destinations").insert({
        order_id: order.id,
        customer_id: userId,
        stratum_url: pool.stratum_url,
        account_username: pool.account_username || pool.worker_name,
        worker_name: workerIdentity.generatedWorkerName,
        worker_password: pool.worker_password || "x",
        is_locked: true,
        locked_at: new Date().toISOString(),
      });

      // 7. Create contract in WAITING_TO_ASSIGN state
      const { data: contract } = await supabase
        .from("contracts")
        .insert({
          order_id: order.id,
          customer_id: userId,
          hashrate_th,
          duration_days,
          status: "WAITING_TO_ASSIGN",
          live_hashrate_th: 0,
          worker_status: "PENDING_ALLOCATION",
        })
        .select("id")
        .single();

      // 8. Log activity event
      await supabase.from("detection_activity_feed").insert({
        event_time: new Date().toISOString(),
        event_type: "ORDER_PAID",
        message: `Order for ${hashrate_th} TH/s paid from wallet balance ($${quote.totalUsd}). Waiting for Equalizer allocation.`,
        customer_name: customerFullName,
      });

      // 9. Admin audit log
      await supabase.from("admin_audit_logs").insert({
        admin_id: "00000000-0000-0000-0000-000000000000",
        action: "WALLET_BALANCE_PURCHASE",
        target_entity: "contracts",
        target_id: contract?.id || order.id,
        details: {
          customer_id: userId,
          hashrate_th,
          duration_days,
          deducted_usd: quote.totalUsd,
          previous_balance: currentWalletBalance,
          new_balance: newBalance,
        },
      });

      return NextResponse.json({
        success: true,
        paidViaWallet: true,
        orderId: order.id,
        contractId: contract?.id,
        newBalance,
        quote,
        workerIdentity: {
          original: workerIdentity.originalWorkerName,
          generated: workerIdentity.generatedWorkerName,
          initials: workerIdentity.initials,
          sequence: workerIdentity.sequenceFormatted,
        },
        message: `Successfully purchased ${hashrate_th} TH/s cloud hashrate contract using your wallet balance! Your contract is queued for Equalizer allocation.`,
      });
    }

    // CASE B: Pay with Crypto (NOWPayments)
    const nowpaymentsApiKey = process.env.NOWPAYMENTS_API_KEY;
    const isSandbox = process.env.NOWPAYMENTS_SANDBOX === "true" || !nowpaymentsApiKey;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const dbCurrency = payment_currency === "WALLET" ? "USDT_TRC20" : payment_currency;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: userId,
        hashrate_th,
        duration_days,
        base_rate_applied: baseRate,
        total_usd: quote.totalUsd,
        payment_currency: dbCurrency,
        status: "PENDING",
        payment_status: "waiting",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("Order insertion error:", orderError);
      return NextResponse.json(
        { success: false, error: "Failed to create order record in database" },
        { status: 500 }
      );
    }

    const poolProvider = pool.pool_provider || "ViaBTC";
    const workerIdentity = await generateUniqueWorkerIdentity(supabase, {
      customerFullName,
      originalWorkerName: pool.worker_name,
      purchasedHashrateTh: hashrate_th,
      poolProvider,
      poolUrl: pool.stratum_url,
      customerId: userId,
    });

    await supabase.from("customer_pool_configs").insert({
      customer_id: userId,
      order_id: order.id,
      pool_provider: poolProvider,
      pool_url: pool.stratum_url,
      original_worker_name: workerIdentity.originalWorkerName,
      generated_worker_name: workerIdentity.generatedWorkerName,
      identity_initials: workerIdentity.initials,
      contract_sequence: workerIdentity.sequence,
      purchased_hashrate_th: hashrate_th,
      configuration_status: "Configuration Pending",
      is_flagged_for_review: workerIdentity.isFlaggedForReview,
      review_reason: workerIdentity.reviewReason,
    });

    await supabase.from("worker_identity_registry").insert({
      customer_id: userId,
      customer_full_name: customerFullName,
      original_worker_name: workerIdentity.originalWorkerName,
      generated_worker_name: workerIdentity.generatedWorkerName,
      pool_provider: poolProvider,
      pool_url: pool.stratum_url,
      contract_sequence: workerIdentity.sequence,
      purchased_hashrate_th: hashrate_th,
      identity_status: "PENDING_CONFIG",
    });

    await supabase.from("pool_destinations").insert({
      order_id: order.id,
      customer_id: userId,
      stratum_url: pool.stratum_url,
      account_username: pool.account_username || pool.worker_name,
      worker_name: workerIdentity.generatedWorkerName,
      worker_password: pool.worker_password || "x",
      is_locked: true,
      locked_at: new Date().toISOString(),
    });

    let nowpaymentsPaymentId: string | null = null;
    let nowpaymentsOrderId: string | null = null;
    let payAddress: string | null = null;
    let payAmount: number = quote.totalUsdt;
    let invoiceUrl = `https://nowpayments.io/payment/?order_id=${order.id}&amount=${quote.totalUsd}&currency=${dbCurrency === "BTC" ? "btc" : "usdttrc20"}`;

    if (!isSandbox && nowpaymentsApiKey) {
      try {
        const invoiceRes = await fetch("https://api.nowpayments.io/v1/invoice", {
          method: "POST",
          headers: {
            "x-api-key": nowpaymentsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price_amount: quote.totalUsd,
            price_currency: "usd",
            pay_currency: dbCurrency === "BTC" ? "btc" : "usdttrc20",
            order_id: order.id,
            order_description: `TMF Cloud Hashrate ${hashrate_th} TH/s for ${duration_days} days`,
            ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
            success_url: `${siteUrl}/dashboard?payment=success&order_id=${order.id}`,
            cancel_url: `${siteUrl}/dashboard?payment=cancel`,
          }),
        });

        if (invoiceRes.ok) {
          const npData = await invoiceRes.json();
          nowpaymentsPaymentId = npData.id;
          nowpaymentsOrderId = npData.order_id;
          if (npData.invoice_url) {
            invoiceUrl = npData.invoice_url;
          }
        }
      } catch (err) {
        console.error("NOWPayments invoice error:", err);
      }
    } else {
      nowpaymentsPaymentId = `sandbox_${order.id.slice(0, 8)}`;
      payAddress = dbCurrency === "BTC" ? "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" : "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
      payAmount = dbCurrency === "BTC" ? quote.totalBtc : quote.totalUsdt;
    }

    await supabase
      .from("orders")
      .update({
        nowpayments_payment_id: nowpaymentsPaymentId,
        pay_address: payAddress,
        pay_amount: payAmount,
      })
      .eq("id", order.id);

    return NextResponse.json({
      success: true,
      paidViaWallet: false,
      orderId: order.id,
      invoiceUrl,
      quote,
      workerIdentity: {
        original: workerIdentity.originalWorkerName,
        generated: workerIdentity.generatedWorkerName,
        initials: workerIdentity.initials,
        sequence: workerIdentity.sequenceFormatted,
      },
      payment: {
        currency: dbCurrency,
        amount: payAmount,
        address: payAddress,
        paymentId: nowpaymentsPaymentId,
        invoiceUrl,
        isSandbox,
      },
    });
  } catch (error) {
    console.error("Create order unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while processing order" },
      { status: 500 }
    );
  }
}
