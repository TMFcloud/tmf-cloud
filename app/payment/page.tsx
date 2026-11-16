"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Zap,
  ShieldCheck,
  CreditCard,
  Wallet,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Server,
  Lock,
  ExternalLink,
} from "lucide-react";

function PaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [checkoutData, setCheckoutData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingWallet, setPayingWallet] = useState(false);
  const [payingNowpayments, setPayingNowpayments] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      // 1. Check user authentication
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        const orderIdParam = searchParams.get("orderId");
        router.push(`/login?returnUrl=${encodeURIComponent(`/payment${orderIdParam ? `?orderId=${orderIdParam}` : ""}`)}`);
        return;
      }

      const orderIdParam = searchParams.get("orderId");

      try {
        const res = await fetch(
          `/api/orders/checkout-options${orderIdParam ? `?orderId=${orderIdParam}` : ""}`
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load checkout options.");
          setLoading(false);
          return;
        }

        setCheckoutData(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Network error loading checkout options.");
        setLoading(false);
      }
    }

    loadOptions();
  }, [searchParams, router, supabase]);

  // Handle NOWPayments Checkout
  const handlePayNowpayments = async () => {
    if (payingNowpayments || !checkoutData?.orderId) return;
    setPayingNowpayments(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/nowpayments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: checkoutData.orderId }),
      });
      const data = await res.json();

      if (data && data.invoiceUrl) {
        window.location.href = data.invoiceUrl;
        return;
      }
      if (data && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      setError(data.error || "Unable to generate NOWPayments invoice. Please try again.");
    } catch (err: any) {
      setError(err.message || "Failed to initiate NOWPayments payment.");
    } finally {
      setPayingNowpayments(false);
    }
  };

  // Handle TMF Wallet Payment (Existing Customers Only)
  const handlePayWallet = async () => {
    if (payingWallet || !checkoutData?.orderId) return;
    setPayingWallet(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/pay-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: checkoutData.orderId }),
      });
      const data = await res.json();

      if (data && data.success) {
        router.push(data.redirectUrl || "/dashboard?payment=wallet_success");
        return;
      }

      setError(data.error || "Failed to process wallet payment.");
    } catch (err: any) {
      setError(err.message || "Network error while completing wallet payment.");
    } finally {
      setPayingWallet(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 transition-colors duration-150">
        <Loader2 className="w-8 h-8 text-[#8CFF00] animate-spin mb-3" />
        <h2 className="text-base font-bold text-white">Loading Authoritative Checkout...</h2>
        <p className="text-xs text-slate-400 mt-1">Verifying customer status and order parameters</p>
      </div>
    );
  }

  if (error && !checkoutData) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-[#0B0F17] border border-red-500/40 rounded-2xl text-center shadow-lg space-y-4">
        <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-5 h-5" />
        </div>
        <h2 className="text-base font-bold text-red-400">Unable to Load Checkout</h2>
        <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        <button
          onClick={() => router.push("/buy")}
          className="bg-[#8CFF00] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl hover:bg-[#7EE800] transition-colors"
        >
          Return to Hashrate Selection
        </button>
      </div>
    );
  }

  const { isNewCustomer, canUseWallet, hasSufficientBalance, walletBalance, orderTotal, shortfall, pool } = checkoutData;

  return (
    <div className="w-full max-w-[620px] mx-auto px-3 sm:px-4 py-4 sm:py-7 transition-colors duration-200">
      {/* Brand Logo Header */}
      <div className="flex justify-center mb-4 sm:mb-5">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <img
            src="/tmf-logo.png"
            alt="The Mining Future"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(140,255,0,0.25)]"
          />
        </Link>
      </div>

      {/* ============================================================= */}
      {/* 4-STEP CHECKOUT PROGRESS BAR (STEP 4: PAYMENT)                */}
      {/* ============================================================= */}
      <nav aria-label="Checkout Progress" className="mb-4 sm:mb-5">
        <div className="p-1 sm:p-1.5 rounded-xl bg-[#090D14] border border-[#1A2332]">
          <div className="grid grid-cols-4 items-center gap-1 text-center font-mono">
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[#8CFF00]">
              <span className="text-[11px] font-bold truncate">1. Hashrate</span>
            </div>
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[#8CFF00]">
              <span className="text-[11px] font-bold truncate">2. Pool Config</span>
            </div>
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[#8CFF00]">
              <span className="text-[11px] font-bold truncate">3. Account</span>
            </div>
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-[#8CFF00]/15 border border-[#8CFF00]/40 text-[#8CFF00]">
              <span className="w-3.5 h-3.5 rounded-full bg-[#8CFF00] text-black text-[9px] font-black flex items-center justify-center shrink-0">
                4
              </span>
              <span className="text-[11px] font-black truncate">4. Payment</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="text-center mb-4 sm:mb-5 space-y-1">
        <span className="text-[10px] font-mono uppercase text-[#8CFF00] font-bold tracking-wider">
          {isNewCustomer ? "New Customer Settlement" : "Enterprise Account Settlement"}
        </span>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Complete Hashrate Order
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-400 max-w-md mx-auto">
          {isNewCustomer
            ? "Your account email is verified. Complete payment via NOWPayments to activate your cloud contract."
            : "Review your payment options and confirm your hashrate computing contract."}
        </p>
      </div>

      <div className="space-y-3.5 sm:space-y-4">
        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* 1. ORDER SUMMARY CARD */}
        <section className="bg-[#0A0E17] border border-[#1A2536] rounded-xl p-3.5 sm:p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-[#1A2536]">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#8CFF00] fill-[#8CFF00]" />
              <h2 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
                Order #{checkoutData.orderId?.slice(0, 8)}
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold border border-yellow-500/30">
              Awaiting Settlement
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#16202E]">
              <span className="text-[9px] text-slate-500 uppercase block">Compute Power</span>
              <span className="font-bold text-white text-sm">{checkoutData.hashrateTh} TH/s</span>
            </div>
            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#16202E]">
              <span className="text-[9px] text-slate-500 uppercase block">Lease Duration</span>
              <span className="font-bold text-white text-sm">{checkoutData.durationDays} Days</span>
            </div>
            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#8CFF00]/30 col-span-2 sm:col-span-1">
              <span className="text-[9px] text-slate-500 uppercase block">Total Cost</span>
              <span className="font-black text-[#8CFF00] text-sm">${orderTotal?.toFixed(2)} USDT</span>
            </div>
          </div>

          {pool && (
            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#16202E] text-[11px] font-mono flex items-center justify-between gap-2">
              <span className="text-slate-500">Stratum Routing:</span>
              <span className="text-slate-200 truncate max-w-[280px]">
                {pool.worker_name} @ {pool.stratum_url}
              </span>
            </div>
          )}
        </section>

        {/* ============================================================= */}
        {/* DIFFERENTIATED PAYMENT LOGIC (NEW VS EXISTING CUSTOMERS)      */}
        {/* ============================================================= */}

        {/* BRANCH 1: NEW CUSTOMER (Signup Flow) */}
        {/* Strictly: DO NOT check wallet, DO NOT display wallet, DO NOT offer wallet */}
        {isNewCustomer && (
          <section className="bg-[#0A0E17] border border-[#1A2536] rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center gap-2 pb-2 border-b border-[#1A2536]">
              <CreditCard className="w-4 h-4 text-[#8CFF00]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Direct Crypto Gateway Settlement
              </h3>
            </div>

            <div className="p-3 rounded-lg bg-[#070A0F] border border-[#16202E] space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#8CFF00]" />
                <span>Email Address Verified • TMF Account Ready</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                As a new customer, your cloud mining contract will be settled directly via our verified NOWPayments crypto gateway. Mined Bitcoin will be routed directly to your configured Stratum pool.
              </p>
            </div>

            {/* Prominent NOWPayments Button */}
            <button
              type="button"
              onClick={handlePayNowpayments}
              disabled={payingNowpayments}
              className="w-full bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-sm py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.99]"
            >
              {payingNowpayments ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to NOWPayments Gateway...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-black" />
                  <span>Pay with NOWPayments • ${orderTotal?.toFixed(2)} USDT</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-500 font-mono">
              Supports USDT (TRC20 / ERC20) and BTC (Bitcoin Network)
            </p>
          </section>
        )}

        {/* BRANCH 2: EXISTING CUSTOMER (Login Flow) */}
        {!isNewCustomer && (
          <section className="bg-[#0A0E17] border border-[#1A2536] rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-[#1A2536]">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#8CFF00]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Payment Method Selection
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Existing Customer Account
              </span>
            </div>

            {/* Wallet Balance Status Display */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                hasSufficientBalance
                  ? "bg-[#8CFF00]/5 border-[#8CFF00]/40"
                  : "bg-amber-500/5 border-amber-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Available TMF Wallet Balance
                </span>
                <span
                  className={`text-sm font-black font-mono ${
                    hasSufficientBalance ? "text-[#8CFF00]" : "text-amber-400"
                  }`}
                >
                  ${walletBalance?.toFixed(2)} USDT
                </span>
              </div>

              {hasSufficientBalance ? (
                <div className="text-[11px] text-slate-300 leading-relaxed font-mono flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#8CFF00] shrink-0" />
                  <span>
                    Wallet balance is sufficient to cover this contract. Remaining balance after payment:{" "}
                    <strong className="text-white">${(walletBalance - orderTotal).toFixed(2)} USDT</strong>.
                  </span>
                </div>
              ) : (
                <div className="text-[11px] text-amber-300/90 leading-relaxed font-mono pt-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Insufficient wallet balance. Shortfall:{" "}
                      <strong className="text-white">${shortfall?.toFixed(2)} USDT</strong>.
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-sans">
                    No funds will be deducted from your wallet. Please settle the full order amount (${orderTotal?.toFixed(2)} USDT) securely via NOWPayments.
                  </p>
                </div>
              )}
            </div>

            {/* ACTIONS: SUFFICIENT WALLET */}
            {hasSufficientBalance ? (
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePayWallet}
                  disabled={payingWallet}
                  className="w-full bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-sm py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.99]"
                >
                  {payingWallet ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing Atomic Wallet Deduction...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-black" />
                      <span>Pay using TMF Wallet • ${orderTotal?.toFixed(2)} USDT</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handlePayNowpayments}
                    disabled={payingNowpayments}
                    className="text-xs text-slate-400 hover:text-white underline font-mono transition-colors"
                  >
                    Or pay full amount via NOWPayments Crypto Gateway &rarr;
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIONS: INSUFFICIENT WALLET -> OFFER NOWPAYMENTS FOR FULL AMOUNT */
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePayNowpayments}
                  disabled={payingNowpayments}
                  className="w-full bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-sm py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.99]"
                >
                  {payingNowpayments ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting to NOWPayments Gateway...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-black" />
                      <span>Pay with NOWPayments • ${orderTotal?.toFixed(2)} USDT</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-500 font-mono">
                  Full order amount (${orderTotal?.toFixed(2)} USDT) will be billed via NOWPayments invoice.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Trust Badges Footer */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-500 text-center pt-2 font-mono">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#8CFF00]" />
            <span>Dedicated Stratum Routing</span>
          </div>
          <div className="flex items-center gap-1">
            <Server className="w-3.5 h-3.5 text-[#8CFF00]" />
            <span>Clean Energy Grid Hardware</span>
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-[#8CFF00]" />
            <span>Anti-Tamper Security</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-mono">
          Loading payment session...
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}
