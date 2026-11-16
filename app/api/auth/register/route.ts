import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  getLiveBtcPrice,
  calculateAuthoritativeQuote,
  DEFAULT_BASE_RATE_PER_TH_DAY,
} from "@/lib/services/pricing";
import { generateUniqueWorkerIdentity } from "@/lib/services/workerIdentity";
import { sendCustomerVerificationEmail } from "@/lib/services/email";

/**
 * Customer Registration Route
 * 
 * Flow A (Direct Registration):
 * - User signs up directly from Homepage / Navbar
 * - No pending order is created
 * - No hashrate plans or calculation
 * - Verification link points directly to /dashboard
 * 
 * Flow B (Checkout Registration):
 * - User came from package selection & review (/confirm)
 * - Stores customer's pending order in Supabase BEFORE email dispatch
 * - Verification link points to /email-verified?orderId=... to resume payment
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, fullName, flow, pendingPackage } = body;

    const rawEmail = (email || "").trim().toLowerCase();
    const cleanName = (fullName || "").trim();

    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (!cleanName) {
      return NextResponse.json(
        { success: false, error: "Please enter your full name." },
        { status: 400 }
      );
    }

    // Determine whether this registration was initiated from hashrate checkout
    const isCheckout = Boolean(
      flow === "checkout" &&
        pendingPackage &&
        Number(pendingPackage.hashrateTh) > 0
    );

    const supabaseAdmin = getAdminClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin || "http://localhost:3000";

    // 1. Check if customer already exists in Supabase
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = userList?.users?.find(
      (u) => u.email?.toLowerCase() === rawEmail
    );

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email address already exists. Please sign in.",
          alreadyRegistered: true,
        },
        { status: 409 }
      );
    }

    // 2. Create customer user in Supabase Auth (unconfirmed initially)
    const { data: createdUserData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: rawEmail,
        password,
        email_confirm: false,
        user_metadata: {
          full_name: cleanName,
          role: "customer",
          is_new_customer: true,
          flow_origin: isCheckout ? "checkout_signup" : "direct_signup",
        },
      });

    if (createError || !createdUserData?.user) {
      console.error("[CUSTOMER REGISTRATION] User creation error:", createError);
      return NextResponse.json(
        { success: false, error: createError?.message || "Failed to create customer account." },
        { status: 500 }
      );
    }

    const newUserId = createdUserData.user.id;

    // 3. STORE ORIGINAL ORDER IN SUPABASE (ONLY FOR CHECKOUT FLOW)
    let orderId: string | null = null;
    let quoteTotalUsd: number = 0;
    let hashrateTh: number | undefined = undefined;
    let durationDays: number | undefined = undefined;

    if (isCheckout) {
      hashrateTh = Number(pendingPackage.hashrateTh);
      durationDays = Number(pendingPackage.durationDays || 30);
      const paymentCurrency = pendingPackage.paymentCurrency || "USDT_TRC20";

      try {
        // 3A. Fetch Authoritative Pricing
        let baseRate = DEFAULT_BASE_RATE_PER_TH_DAY;
        const { data: pricingData } = await supabaseAdmin
          .from("system_pricing_settings")
          .select("base_rate_per_th_day")
          .eq("id", 1)
          .maybeSingle();

        if (pricingData?.base_rate_per_th_day) {
          baseRate = Number(pricingData.base_rate_per_th_day);
        }

        const btcPrice = await getLiveBtcPrice();
        const quote = calculateAuthoritativeQuote({
          hashrateTh,
          durationDays,
          baseRatePerThDay: baseRate,
          btcPrice,
        });
        quoteTotalUsd = quote.totalUsd;

        // 3B. Insert PENDING order in Supabase
        const dbCurrency =
          paymentCurrency === "BTC"
            ? "BTC"
            : paymentCurrency === "USDT_ERC20"
            ? "USDT_ERC20"
            : "USDT_TRC20";

        const { data: order, error: orderErr } = await supabaseAdmin
          .from("orders")
          .insert({
            customer_id: newUserId,
            hashrate_th: hashrateTh,
            duration_days: durationDays,
            base_rate_applied: baseRate,
            total_usd: quote.totalUsd,
            payment_currency: dbCurrency,
            status: "PENDING",
            payment_status: "waiting",
            nowpayments_order_id: "flow:new_customer",
          })
          .select("id")
          .single();

        if (order && !orderErr) {
          orderId = order.id;

          // 3C. Provision Pool Destination & Worker Identity
          const poolProvider = pendingPackage?.poolProvider || "ViaBTC";
          const stratumUrl = pendingPackage?.stratumUrl || "stratum+tcp://btc.viabtc.top:3333";
          const workerName = pendingPackage?.workerName || "worker1";
          const workerPassword = pendingPackage?.workerPassword || "x";

          const workerIdentity = await generateUniqueWorkerIdentity(supabaseAdmin, {
            customerFullName: cleanName,
            originalWorkerName: workerName,
            purchasedHashrateTh: hashrateTh,
            poolProvider,
            poolUrl: stratumUrl,
            customerId: newUserId,
          });

          await supabaseAdmin.from("customer_pool_configs").insert({
            customer_id: newUserId,
            order_id: order.id,
            pool_provider: poolProvider,
            pool_url: stratumUrl,
            original_worker_name: workerIdentity.originalWorkerName,
            generated_worker_name: workerIdentity.generatedWorkerName,
            identity_initials: workerIdentity.initials,
            contract_sequence: workerIdentity.sequence,
            purchased_hashrate_th: hashrateTh,
            configuration_status: "Configuration Pending",
          });

          await supabaseAdmin.from("pool_destinations").insert({
            order_id: order.id,
            customer_id: newUserId,
            stratum_url: stratumUrl,
            account_username: workerName,
            worker_name: workerIdentity.generatedWorkerName,
            worker_password: workerPassword,
            is_locked: true,
          });

          console.log(`[CUSTOMER REGISTRATION] Successfully stored checkout order ${order.id} for user ${newUserId} before dispatching email.`);
        }
      } catch (orderStoreErr) {
        console.warn("[CUSTOMER REGISTRATION] Order pre-storage warning:", orderStoreErr);
      }
    }

    // 4. GENERATE VERIFICATION LINK
    // Direct registration routes to /dashboard
    // Checkout registration routes to /email-verified?orderId=... to resume payment
    const redirectUrl =
      isCheckout && orderId
        ? `${siteUrl}/auth/callback?flow=checkout&orderId=${orderId}`
        : `${siteUrl}/auth/callback?flow=direct&next=/dashboard`;

    let verificationLink = redirectUrl;
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email: rawEmail,
        password,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (linkData?.properties?.action_link) {
        verificationLink = linkData.properties.action_link;
      }
    } catch (linkErr) {
      console.warn("[CUSTOMER REGISTRATION] generateLink fallback:", linkErr);
    }

    // 5. DISPATCH EMAIL TO CUSTOMER
    const emailResult = await sendCustomerVerificationEmail({
      toEmail: rawEmail,
      fullName: cleanName,
      verificationLink,
      isCheckout,
      hashrateTh,
      durationDays,
      totalUsd: isCheckout ? quoteTotalUsd : undefined,
    });

    return NextResponse.json({
      success: true,
      userId: newUserId,
      email: rawEmail,
      orderId,
      flow: isCheckout ? "checkout" : "direct",
      emailProvider: emailResult.provider,
      verificationLink: process.env.NODE_ENV === "development" ? verificationLink : undefined,
      message: isCheckout
        ? `Account created for ${rawEmail}! Verification email dispatched with restored order context.`
        : `Account created for ${rawEmail}! Verification email dispatched. Check your inbox to access dashboard.`,
    });
  } catch (err: any) {
    console.error("[CUSTOMER REGISTRATION] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process registration." },
      { status: 500 }
    );
  }
}
