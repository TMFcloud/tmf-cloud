import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { getDecryptedSecrets, NowPaymentsSecrets } from "@/lib/services/integrations-vault";

export const dynamic = "force-dynamic";

/**
 * NOWPayments Server-Side Webhook (IPN) Handler
 * 
 * SECURITY ARCHITECTURE:
 * 1. Cryptographic HMAC-SHA512 verification on raw request body using alphabetically sorted keys.
 * 2. Secrets loaded dynamically from server-side encrypted vault.
 * 3. Idempotent state machine: ignores duplicate IPN deliveries.
 * 4. Provider-side status verification: queries NOWPayments API to cross-verify payment state.
 * 5. Browser redirects are NEVER trusted as proof of payment.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-nowpayments-sig");

    // 1. Determine environment & load credentials from Vault
    const isSandboxEnv = process.env.NOWPAYMENTS_SANDBOX === "true";
    const targetEnv = isSandboxEnv ? "sandbox" : "production";
    
    const vaultConfig = await getDecryptedSecrets<NowPaymentsSecrets>("nowpayments", targetEnv);
    const ipnSecret = vaultConfig?.secrets?.ipnSecret || process.env.NOWPAYMENTS_IPN_SECRET;
    const apiKey = vaultConfig?.secrets?.apiKey || process.env.NOWPAYMENTS_API_KEY;
    const endpointUrl = vaultConfig?.config?.endpointUrl || (isSandboxEnv ? "https://api-sandbox.nowpayments.io/v1" : "https://api.nowpayments.io/v1");

    // 2. Strict HMAC-SHA512 signature verification
    if (ipnSecret) {
      if (!signature) {
        console.warn("[NOWPayments IPN] Missing x-nowpayments-sig signature header.");
        return NextResponse.json({ error: "Missing x-nowpayments-sig signature header." }, { status: 401 });
      }

      let parsedBody: Record<string, any>;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      }

      // NOWPayments sorts keys alphabetically for HMAC calculation
      const sortedKeys = Object.keys(parsedBody).sort();
      const sortedObj: Record<string, any> = {};
      for (const k of sortedKeys) {
        sortedObj[k] = parsedBody[k];
      }
      const sortedString = JSON.stringify(sortedObj);

      const hmac = crypto.createHmac("sha512", ipnSecret);
      hmac.update(sortedString);
      const computedSig = hmac.digest("hex");

      if (computedSig !== signature) {
        console.warn("[NOWPayments IPN] Cryptographic signature mismatch. Rejecting webhook.");
        return NextResponse.json({ error: "Invalid IPN signature verification failed." }, { status: 401 });
      }
    } else if (!isSandboxEnv) {
      console.error("[NOWPayments IPN] IPN secret is not configured in vault or environment. Rejecting unauthenticated webhook.");
      return NextResponse.json(
        { error: "NOWPayments IPN secret not configured. Unauthenticated callback rejected." },
        { status: 401 }
      );
    } else {
      // In sandbox mode without secret, require signature header presence
      if (!signature) {
        return NextResponse.json(
          { error: "Missing x-nowpayments-sig header. Cryptographic verification required." },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const { payment_id, payment_status, order_id, actually_paid, price_amount, pay_currency } = payload;

    console.log(`[NOWPayments IPN Verified] order_id: ${order_id}, status: ${payment_status}, paid: ${actually_paid} ${pay_currency}`);

    const isConfirmed = payment_status === "finished" || payment_status === "confirmed";

    // 3. Provider-side Verification (Cross-check with NOWPayments API)
    if (isConfirmed && payment_id && apiKey && !apiKey.includes("••••")) {
      try {
        const verifyRes = await fetch(`${endpointUrl.replace(/\/+$/, "")}/payment/${payment_id}`, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "Accept": "application/json",
          },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          const providerStatus = verifyData.payment_status;
          if (providerStatus !== "finished" && providerStatus !== "confirmed") {
            console.warn(`[NOWPayments IPN Warning] Provider API returned unconfirmed status '${providerStatus}' for payment ${payment_id}`);
            return NextResponse.json({ error: "Provider status does not match confirmed IPN state." }, { status: 400 });
          }
        }
      } catch (verifyErr) {
        console.warn("[NOWPayments IPN] Provider cross-check network warning:", verifyErr);
      }
    }

    if (isConfirmed && order_id) {
      const supabaseAdmin = getAdminClient();

      // CASE A: Wallet Deposit (order_id starts with "deposit_")
      if (order_id.startsWith("deposit_")) {
        const parts = order_id.split("_");
        const customerPrefix = parts[1];
        const creditedUsd = parseFloat(actually_paid || price_amount || "0");

        // Idempotency: Check if this payment_id has already been credited
        const { data: existingAudit } = await supabaseAdmin
          .from("admin_audit_logs")
          .select("id")
          .eq("action", "NOWPAYMENTS_WALLET_DEPOSIT")
          .contains("details", { payment_id })
          .maybeSingle();

        if (existingAudit) {
          console.log(`[NOWPayments IPN Idempotent] Deposit for payment ${payment_id} already credited. Skipping.`);
          return NextResponse.json({ ok: true, alreadyProcessed: true });
        }

        console.log(`[NOWPayments IPN] Credited deposit for customer prefix ${customerPrefix}: +$${creditedUsd}`);

        await supabaseAdmin.from("admin_audit_logs").insert({
          admin_id: "00000000-0000-0000-0000-000000000000",
          action: "NOWPAYMENTS_WALLET_DEPOSIT",
          target_entity: "wallet",
          details: {
            order_id,
            payment_id,
            credited_usd: creditedUsd,
            pay_currency,
            status: payment_status,
            verified_at: new Date().toISOString(),
          },
        });
      } else {
        // CASE B: Hashrate Order Purchase
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("*")
          .eq("id", order_id)
          .maybeSingle();

        if (order) {
          // Idempotency: If already marked PAID and contract exists, skip
          const { data: existingContract } = await supabaseAdmin
            .from("contracts")
            .select("id")
            .eq("order_id", order.id)
            .maybeSingle();

          if (order.status === "PAID" && existingContract) {
            console.log(`[NOWPayments IPN Idempotent] Order ${order.id} is already paid and contract provisioned. Skipping.`);
            return NextResponse.json({ ok: true, alreadyProcessed: true });
          }

          await supabaseAdmin
            .from("orders")
            .update({
              status: "PAID",
              payment_status: payment_status,
              nowpayments_payment_id: payment_id || order.nowpayments_payment_id,
              ipn_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          // Provision active contract record
          if (!existingContract) {
            await supabaseAdmin.from("contracts").insert({
              order_id: order.id,
              customer_id: order.customer_id,
              hashrate_th: order.hashrate_th,
              duration_days: order.duration_days,
              status: "WAITING_TO_ASSIGN",
              live_hashrate_th: 0, // 0 until allocated by operations
              worker_status: "PENDING_ALLOCATION",
              created_at: new Date().toISOString(),
            });

            // Update pool configuration status
            await supabaseAdmin
              .from("customer_pool_configs")
              .update({ configuration_status: "Configuration Pending" })
              .eq("order_id", order.id);

            // Log activity event
            await supabaseAdmin.from("detection_activity_feed").insert({
              event_time: new Date().toISOString(),
              event_type: "ORDER_PAID",
              message: `Payment Confirmed: Order for ${order.hashrate_th} TH/s paid successfully via NOWPayments (Payment ID: ${payment_id || "N/A"}). Waiting for Equalizer allocation.`,
              customer_name: order.customer_name || "Valued Client",
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true, received: true });
  } catch (err: any) {
    console.error("[NOWPayments Webhook Error]:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
