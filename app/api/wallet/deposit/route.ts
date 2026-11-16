import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await req.json();
    const { amount, currency = "usdttrc20", isCryptoAmount = false } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid deposit amount." },
        { status: 400 }
      );
    }

    // Currency min deposit checks as per NOWPayments terms
    const minMap: Record<string, { min: number; label: string }> = {
      usdttrc20: { min: 5, label: "5 USDT" },
      usdterc20: { min: 15, label: "15 USDT" },
      btc: { min: 0.0002, label: "0.0002 BTC (≈ $15 USD)" },
      ltc: { min: 0.05, label: "0.05 LTC" },
      eth: { min: 0.005, label: "0.005 ETH" },
      sol: { min: 0.05, label: "0.05 SOL" },
      trx: { min: 20, label: "20 TRX" },
    };

    const curKey = currency.toLowerCase();
    const rule = minMap[curKey];
    if (rule && numAmount < rule.min) {
      return NextResponse.json(
        {
          success: false,
          error: `Minimum deposit for ${currency.toUpperCase()} is ${rule.label} according to NOWPayments network rules.`,
        },
        { status: 400 }
      );
    }

    const customerId = user?.id || "guest_deposit";
    const depositOrderId = `deposit_${customerId.slice(0, 8)}_${Date.now()}`;
    const nowpaymentsApiKey = process.env.NOWPAYMENTS_API_KEY;
    const isSandbox = process.env.NOWPAYMENTS_SANDBOX === "true" || !nowpaymentsApiKey;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Call live NOWPayments API invoice creation if key is present
    if (!isSandbox && nowpaymentsApiKey) {
      const npRes = await fetch("https://api.nowpayments.io/v1/invoice", {
        method: "POST",
        headers: {
          "x-api-key": nowpaymentsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: numAmount,
          price_currency: isCryptoAmount ? curKey : "usd",
          pay_currency: curKey,
          order_id: depositOrderId,
          order_description: `TMF Cloud Wallet Deposit: ${numAmount} ${currency.toUpperCase()}`,
          ipn_callback_url: `${siteUrl}/api/webhooks/nowpayments`,
          success_url: `${siteUrl}/dashboard?deposit=success`,
          cancel_url: `${siteUrl}/dashboard?deposit=cancel`,
        }),
      });

      if (npRes.ok) {
        const npData = await npRes.json();
        return NextResponse.json({
          success: true,
          invoice_url: npData.invoice_url,
          payment_id: npData.id,
          order_id: depositOrderId,
          amount: numAmount,
          currency: currency.toUpperCase(),
        });
      } else {
        const errText = await npRes.text();
        console.error("NOWPayments invoice creation error:", errText);
      }
    }

    // Sandbox / Mock fallback response for instant testing
    const mockInvoiceUrl = `https://nowpayments.io/payment/?order_id=${depositOrderId}&amount=${numAmount}&currency=${curKey}`;
    return NextResponse.json({
      success: true,
      invoice_url: mockInvoiceUrl,
      payment_id: `sandbox_${Date.now()}`,
      order_id: depositOrderId,
      amount: numAmount,
      currency: currency.toUpperCase(),
      is_sandbox: true,
      message: "NOWPayments sandbox checkout created successfully.",
    });
  } catch (err: any) {
    console.error("Deposit error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to initiate deposit" },
      { status: 500 }
    );
  }
}
