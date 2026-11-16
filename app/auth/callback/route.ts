import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase Auth Callback Route
 * Validates the email verification token and completes authentication.
 * 
 * Flow A (Direct Registration):
 * - User verified email after signing up from Homepage / Navbar
 * - No pending checkout order exists
 * - Redirects directly to the TMF Customer Dashboard (/dashboard)
 * 
 * Flow B (Checkout-Initiated Registration):
 * - User verified email after selecting a package and configuring pool
 * - Validates server-side pending order ownership
 * - Redirects to /email-verified?orderId=... to resume payment with NOWPayments
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const flowParam = requestUrl.searchParams.get("flow");
  const orderIdParam =
    requestUrl.searchParams.get("orderId") ||
    requestUrl.searchParams.get("order_id");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://srgfsjyopuujhpljfpkw.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_Vj8W3awA7qBfac8TlnxFXA_KJrVkifR",
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
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 1. Get authenticated user
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      const flowOrigin = user?.user_metadata?.flow_origin;
      const isDirectRegistration = flowParam === "direct" || flowOrigin === "direct_signup";

      let targetOrderId: string | null = null;

      // 2. Only inspect/restore pending order if NOT an explicit direct registration
      if (!isDirectRegistration && user) {
        const supabaseAdmin = getAdminClient();

        // 2A. If orderId was in URL, verify that it belongs to this customer and is PENDING
        if (orderIdParam) {
          try {
            const { data: orderRecord } = await supabaseAdmin
              .from("orders")
              .select("id, customer_id, status")
              .eq("id", orderIdParam)
              .maybeSingle();

            if (orderRecord && orderRecord.customer_id === user.id && orderRecord.status === "PENDING") {
              targetOrderId = orderRecord.id;
            }
          } catch (dbErr) {
            console.warn("[AUTH CALLBACK] Error verifying order param:", dbErr);
          }
        }

        // 2B. If no orderId in URL (or opened on another device), check if checkout signup has pending order
        if (!targetOrderId && (flowParam === "checkout" || flowOrigin === "checkout_signup")) {
          try {
            const { data: latestPending } = await supabaseAdmin
              .from("orders")
              .select("id")
              .eq("customer_id", user.id)
              .eq("status", "PENDING")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (latestPending?.id) {
              targetOrderId = latestPending.id;
            }
          } catch (dbErr) {
            console.warn("[AUTH CALLBACK] Could not query pending order:", dbErr);
          }
        }
      }

      // 3. ROUTE SEPARATION:
      // If customer has a verified pending checkout order, resume checkout
      if (targetOrderId) {
        const verifiedUrl = new URL("/email-verified", requestUrl.origin);
        verifiedUrl.searchParams.set("orderId", targetOrderId);
        console.log(`[AUTH CALLBACK] Verified customer with pending order ${targetOrderId}. Redirecting to /email-verified`);
        return NextResponse.redirect(verifiedUrl);
      }

      // Direct homepage registration -> REDIRECT DIRECTLY TO CUSTOMER DASHBOARD
      console.log(`[AUTH CALLBACK] Verified customer ${user?.email} via direct registration. Redirecting to /dashboard`);
      const dashboardUrl = new URL("/dashboard", requestUrl.origin);
      dashboardUrl.searchParams.set("verified", "true");
      return NextResponse.redirect(dashboardUrl);
    }

    console.error("[AUTH CALLBACK] Code exchange error:", error);
    // If token invalid/expired, route to login with explicit error state
    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", "verification_failed");
    return NextResponse.redirect(errorUrl);
  }

  // Fallback if no code provided
  return NextResponse.redirect(
    new URL("/login?error=verification_failed", requestUrl.origin)
  );
}
