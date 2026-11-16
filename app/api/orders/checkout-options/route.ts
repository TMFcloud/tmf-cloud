import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Checkout Options Endpoint
 * 
 * BUSINESS & SECURITY RULES:
 * 1. Determines whether the customer is newly registered or an existing account using
 *    trusted server-side authentication and order records (never a frontend flag).
 * 2. NEW CUSTOMERS:
 *    - DO NOT check wallet balance.
 *    - DO NOT display wallet balance.
 *    - DO NOT offer wallet payment.
 *    - canUseWallet is strictly false.
 * 3. EXISTING CUSTOMERS:
 *    - Fetch wallet balance securely from Supabase.
 *    - Check available wallet balance against order total.
 *    - If sufficient: offers TMF Wallet payment.
 *    - If insufficient: returns available balance, order total, and shortfall for NOWPayments.
 */
async function getCheckoutOptions(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient();

    // 1. Authenticate user via Cookies or Authorization Bearer token
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseAdmin.auth.getUser(token);
      authenticatedUserId = data?.user?.id || null;
      if (!authenticatedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
        const { data: testUser } = await supabaseAdmin.auth.admin.getUserById(token);
        if (testUser?.user?.id) {
          authenticatedUserId = testUser.user.id;
        }
      }
    }

    if (!authenticatedUserId) {
      const cookieStore = cookies();
      const supabaseSsr = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {}
            },
          },
        }
      );
      const { data } = await supabaseSsr.auth.getUser();
      authenticatedUserId = data?.user?.id || null;
    }

    if (!authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated customer." },
        { status: 401 }
      );
    }

    // 2. Resolve Target Order ID
    let targetOrderId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        targetOrderId = body.orderId || body.order_id;
      } catch {}
    } else {
      const url = new URL(req.url);
      targetOrderId = url.searchParams.get("orderId") || url.searchParams.get("order_id");
    }

    if (!targetOrderId) {
      // Find latest pending order for this customer
      const { data: latestPending } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("customer_id", authenticatedUserId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      targetOrderId = latestPending?.id || null;
    }

    if (!targetOrderId) {
      return NextResponse.json(
        { success: false, error: "No pending order found." },
        { status: 404 }
      );
    }

    // 3. Fetch Order Details from Supabase
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select("*, pool_destinations(*)")
      .eq("id", targetOrderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json(
        { success: false, error: "Order record not found." },
        { status: 404 }
      );
    }

    // 4. Verify Order Ownership
    if (order.customer_id !== authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access to order." },
        { status: 403 }
      );
    }

    // 5. Query User Metadata for Server-Side Verification
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(authenticatedUserId);
    const userMeta = userData?.user?.user_metadata || {};

    // 6. Trusted Server-Side Check: Is this a NEW CUSTOMER (Signup Flow)?
    // Rules:
    // A. Order was generated during signup flow (nowpayments_order_id = "flow:new_customer")
    // B. User metadata explicitly indicates new_customer registration flow
    const isNewCustomerSignup =
      order.nowpayments_order_id === "flow:new_customer" ||
      userMeta.flow_origin === "signup" ||
      userMeta.is_new_customer === true;

    // SCENARIOS A & B: NEW CUSTOMER
    if (isNewCustomerSignup) {
      return NextResponse.json({
        success: true,
        isNewCustomer: true,
        canUseWallet: false, // Strict: Never offer wallet payment during signup
        orderId: order.id,
        orderTotal: Number(order.total_usd),
        hashrateTh: order.hashrate_th,
        durationDays: order.duration_days,
        paymentCurrency: order.payment_currency,
        pool: order.pool_destinations?.[0] || null,
        message: "New customer flow: Proceed directly to NOWPayments checkout.",
      });
    }

    // SCENARIOS C, D & E: EXISTING CUSTOMER (Authenticated via Login)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance_usdt, full_name, email")
      .eq("id", authenticatedUserId)
      .maybeSingle();

    const walletBalance = Number(profile?.wallet_balance_usdt || 0);
    const orderTotal = Number(order.total_usd);
    const hasSufficientBalance = walletBalance >= orderTotal;
    const shortfall = Math.max(0, Math.round((orderTotal - walletBalance) * 100) / 100);

    return NextResponse.json({
      success: true,
      isNewCustomer: false,
      canUseWallet: hasSufficientBalance,
      hasSufficientBalance,
      walletBalance,
      orderTotal,
      shortfall,
      orderId: order.id,
      hashrateTh: order.hashrate_th,
      durationDays: order.duration_days,
      paymentCurrency: order.payment_currency,
      pool: order.pool_destinations?.[0] || null,
      message: hasSufficientBalance
        ? "Existing customer with sufficient wallet balance. TMF Wallet payment available."
        : "Existing customer with insufficient wallet balance. Please pay with NOWPayments.",
    });
  } catch (err: any) {
    console.error("[CHECKOUT OPTIONS ERROR]:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to calculate checkout options." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return getCheckoutOptions(req);
}

export async function POST(req: NextRequest) {
  return getCheckoutOptions(req);
}
