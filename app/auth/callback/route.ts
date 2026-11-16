import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase Auth Callback Route
 * Validates the email verification token and completes authentication.
 * CRITICAL BUSINESS RULE:
 * After verification, DO NOT redirect to /dashboard.
 * Redirect directly to the TMF Email Verified celebration page (/email-verified)
 * restoring the customer's original pending order.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const orderIdParam =
    requestUrl.searchParams.get("orderId") ||
    requestUrl.searchParams.get("order_id");

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
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

      let targetOrderId = orderIdParam;

      // 2. If no orderId in URL, query the database for this customer's latest PENDING order
      if (!targetOrderId && user) {
        try {
          const supabaseAdmin = getAdminClient();
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

      // 3. Build verified destination URL (DO NOT redirect to /dashboard)
      const verifiedUrl = new URL("/email-verified", requestUrl.origin);
      if (targetOrderId) {
        verifiedUrl.searchParams.set("orderId", targetOrderId);
      }

      console.log(`[AUTH CALLBACK] Email verified successfully for user ${user?.email}. Redirecting to ${verifiedUrl.pathname}`);
      return NextResponse.redirect(verifiedUrl);
    }

    console.error("[AUTH CALLBACK] Code exchange error:", error);
    // If token invalid/expired, route to email-verified page with explicit error state
    const errorUrl = new URL("/email-verified", requestUrl.origin);
    errorUrl.searchParams.set("error", "invalid_token");
    return NextResponse.redirect(errorUrl);
  }

  // Fallback if no code provided
  return NextResponse.redirect(
    new URL("/login?error=verification_failed", requestUrl.origin)
  );
}
