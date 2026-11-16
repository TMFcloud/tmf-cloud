import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getDecryptedSecrets, NowPaymentsSecrets } from "@/lib/services/integrations-vault";

/**
 * NOWPayments Checkout Endpoint
 * Retrieves or creates a NOWPayments invoice for a verified pending order.
 * Strictly prevents duplicate invoices and preserves original order parameters.
 */
async function handleCheckout(req: NextRequest, orderIdParam?: string | null) {
  try {
    const supabaseAdmin = getAdminClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin || "http://localhost:3000";

    // 1. Resolve Authenticated User (via Cookies or Authorization header)
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseAdmin.auth.getUser(token);
      authenticatedUserId = data?.user?.id || null;
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

    // 2. Identify Target Order ID
    let targetOrderId = orderIdParam;
    if (!targetOrderId && req.method === "POST") {
      try {
        const body = await req.json();
        targetOrderId = body.orderId || body.order_id;
      } catch {}
    }

    if (!targetOrderId && authenticatedUserId) {
      // Find latest pending order for this customer
      const { data: latestPending } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("customer_id", authenticatedUserId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPending) {
        targetOrderId = latestPending.id;
      }
    }

    if (!targetOrderId) {
      return NextResponse.json(
        { success: false, error: "No pending order found. Please select a hashrate package." },
        { status: 404 }
      );
    }

    // 3. Query Order from Database
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

    // 4. Verify Ownership if user is logged in
    if (authenticatedUserId && order.customer_id !== authenticatedUserId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access to order." },
        { status: 403 }
      );
    }

    // 5. If Order is Already Paid, redirect to customer dashboard
    if (order.status === "PAID") {
      const dashboardUrl = `${siteUrl}/dashboard?payment=success&order_id=${order.id}`;
      if (req.method === "GET") {
        return NextResponse.redirect(dashboardUrl);
      }
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        redirectUrl: dashboardUrl,
        message: "Payment already confirmed. Redirecting to dashboard.",
      });
    }

    // 6. Check for Existing Valid NOWPayments Invoice (Idempotency)
    if (order.nowpayments_invoice_url) {
      if (req.method === "GET") {
        return NextResponse.redirect(order.nowpayments_invoice_url);
      }
      return NextResponse.json({
        success: true,
        invoiceUrl: order.nowpayments_invoice_url,
        orderId: order.id,
        isReused: true,
      });
    }

    // 7. Generate or Retrieve NOWPayments Invoice
    let nowpaymentsApiKey = process.env.NOWPAYMENTS_API_KEY;
    let endpointUrl = "https://api.nowpayments.io/v1";
    let isSandbox = process.env.NOWPAYMENTS_SANDBOX === "true";

    try {
      const vaultConfig = await getDecryptedSecrets<NowPaymentsSecrets>("nowpayments", isSandbox ? "sandbox" : "production");
      if (vaultConfig?.secrets?.apiKey) {
        nowpaymentsApiKey = vaultConfig.secrets.apiKey;
        endpointUrl = vaultConfig.config?.endpointUrl || endpointUrl;
      }
    } catch {}

    isSandbox = isSandbox || !nowpaymentsApiKey;
    const payCurrency = order.payment_currency === "BTC" ? "btc" : "usdttrc20";

    let invoiceUrl = `${siteUrl}/payment?orderId=${order.id}`;
    let nowpaymentsPaymentId: string | null = null;

    if (!isSandbox && nowpaymentsApiKey) {
      try {
        const response = await fetch(`${endpointUrl.replace(/\/+$/, "")}/invoice`, {
          method: "POST",
          headers: {
            "x-api-key": nowpaymentsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            price_amount: order.total_usd,
            price_currency: "usd",
            pay_currency: payCurrency,
            order_id: order.id,
            order_description: `TMF Cloud Hashrate ${order.hashrate_th} TH/s (${order.duration_days} Days)`,
            ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
            success_url: `${siteUrl}/dashboard?payment=success&order_id=${order.id}`,
            cancel_url: `${siteUrl}/payment?orderId=${order.id}&status=cancelled`,
          }),
        });

        if (response.ok) {
          const npData = await response.json();
          if (npData.invoice_url) {
            invoiceUrl = npData.invoice_url;
          }
          if (npData.id) {
            nowpaymentsPaymentId = npData.id;
          }
        } else {
          console.warn("[NOWPayments Checkout] Invoice creation returned:", await response.text());
        }
      } catch (err) {
        console.error("[NOWPayments Checkout] Gateway error:", err);
      }
    }

    // Save invoice URL to database for idempotency
    await supabaseAdmin
      .from("orders")
      .update({
        nowpayments_invoice_url: invoiceUrl,
        nowpayments_payment_id: nowpaymentsPaymentId || order.nowpayments_payment_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (req.method === "GET") {
      return NextResponse.redirect(invoiceUrl);
    }

    return NextResponse.json({
      success: true,
      invoiceUrl,
      orderId: order.id,
      isReused: false,
      order: {
        id: order.id,
        hashrate_th: order.hashrate_th,
        duration_days: order.duration_days,
        total_usd: order.total_usd,
        payment_currency: order.payment_currency,
      },
    });
  } catch (err: any) {
    console.error("[NOWPayments Checkout] Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process checkout" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  return handleCheckout(req, orderId);
}

export async function POST(req: NextRequest) {
  return handleCheckout(req);
}
