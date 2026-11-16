"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  AlertCircle,
  CheckCircle2,
  Mail,
  ExternalLink,
  ShieldCheck,
  Lock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";

  // Check whether registration was explicitly initiated from hashrate checkout
  const isCheckout = Boolean(
    searchParams.get("checkout") === "true" ||
      (searchParams.get("th") && searchParams.get("days"))
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success state: hides form and shows dedicated "Check Your Inbox" state
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Resend cooldown state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const [pendingPackage, setPendingPackage] = useState<any | null>(null);

  // Restore pending package info ONLY if coming from checkout flow
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isCheckout) {
        // Read from query params first
        const thQuery = parseInt(searchParams.get("th") || "", 10);
        const daysQuery = parseInt(searchParams.get("days") || "", 10);
        const payQuery = searchParams.get("pay") || "USDT";

        const pendingRaw = localStorage.getItem("tmf_pending_pool");
        let poolData: any = null;
        if (pendingRaw) {
          try {
            poolData = JSON.parse(pendingRaw);
          } catch {}
        }

        const resolvedTh = !isNaN(thQuery) && thQuery >= 10 ? thQuery : poolData?.hashrateTh || 1000;
        const resolvedDays = !isNaN(daysQuery) && daysQuery >= 30 ? daysQuery : poolData?.durationDays || 30;
        const resolvedPay = payQuery === "BTC" || poolData?.paymentCurrency === "BTC" ? "BTC" : "USDT_TRC20";

        setPendingPackage({
          hashrateTh: resolvedTh,
          durationDays: resolvedDays,
          paymentCurrency: resolvedPay,
          poolProvider: poolData?.poolProvider || "ViaBTC",
          stratumUrl: poolData?.stratumUrl || "stratum+tcp://btc.viabtc.top:3333",
          workerName: poolData?.workerName || "worker1",
          workerPassword: poolData?.workerPassword || "x",
        });
      } else {
        // Direct homepage registration: clear any stale pending package from localStorage
        localStorage.removeItem("tmf_pending_pool");
        localStorage.removeItem("tmf_active_order_id");
        setPendingPackage(null);
      }
    }
  }, [isCheckout, searchParams]);

  // Handle Resend Cooldown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Dynamic platform base lease rate
  const [baseRate, setBaseRate] = useState<number>(0.0309966);

  useEffect(() => {
    fetch("/api/public/pricing", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.baseRatePerThDay) {
          setBaseRate(Number(data.baseRatePerThDay));
        }
      })
      .catch(() => {});
  }, []);

  // Calculated package price (only applicable if isCheckout is true)
  const planHashrate = Number(pendingPackage?.hashrateTh || 0);
  const planDuration = Number(pendingPackage?.durationDays || 0);
  const estimatedPriceUsd = (planHashrate * planDuration * baseRate).toFixed(2);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    try {
      // Direct registration passes flow: "direct" and pendingPackage: null
      // Checkout registration passes flow: "checkout" and preserved package
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          flow: isCheckout ? "checkout" : "direct",
          pendingPackage:
            isCheckout && pendingPackage
              ? {
                  hashrateTh: planHashrate,
                  durationDays: planDuration,
                  paymentCurrency: pendingPackage?.paymentCurrency || "USDT_TRC20",
                  poolProvider: pendingPackage?.poolProvider || "ViaBTC",
                  stratumUrl: pendingPackage?.stratumUrl || "stratum+tcp://btc.viabtc.top:3333",
                  workerName: pendingPackage?.workerName || "worker1",
                  workerPassword: pendingPackage?.workerPassword || "x",
                }
              : null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to create customer account.");
        setLoading(false);
        return;
      }

      // If this was a checkout registration, persist the newly created pending order
      if (isCheckout && data.orderId) {
        setCreatedOrderId(data.orderId);
        localStorage.setItem("tmf_active_order_id", data.orderId);
      }

      // Transition UI to dedicated "Check Your Inbox" state
      setSubmittedEmail(email.trim().toLowerCase());
      setSubmittedSuccess(true);
      setResendCooldown(45);
      setLoading(false);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected network error occurred.");
      setLoading(false);
    }
  };

  // Handle Resend Verification Email
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resending || !submittedEmail) return;
    setResending(true);
    setResendNotice(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: submittedEmail,
          password,
          fullName,
          flow: isCheckout ? "checkout" : "direct",
          pendingPackage: isCheckout ? pendingPackage : null,
        }),
      });
      const data = await res.json();
      setResending(false);
      setResendCooldown(60);
      setResendNotice("Verification link re-sent! Please check your inbox.");
      setTimeout(() => setResendNotice(null), 5000);
    } catch {
      setResending(false);
      setResendNotice("Failed to resend. Please try again shortly.");
    }
  };

  // Identify webmail URL for one-click button
  const getWebmailUrl = (emailStr: string) => {
    const domain = emailStr.split("@")[1]?.toLowerCase() || "";
    if (domain === "gmail.com" || domain === "googlemail.com") {
      return { name: "Open Gmail", url: "https://mail.google.com" };
    }
    if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com") {
      return { name: "Open Outlook", url: "https://outlook.live.com" };
    }
    if (domain === "yahoo.com" || domain === "ymail.com") {
      return { name: "Open Yahoo Mail", url: "https://mail.yahoo.com" };
    }
    if (domain === "icloud.com" || domain === "me.com") {
      return { name: "Open iCloud Mail", url: "https://www.icloud.com/mail" };
    }
    return { name: "Open Email Client", url: "mailto:" };
  };

  const webmail = getWebmailUrl(submittedEmail);

  return (
    <div className="mx-auto max-w-md w-full px-3 sm:px-6 py-8 sm:py-14 transition-colors duration-150">
      <div className="bg-white dark:bg-[#07090E] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 sm:p-8 shadow-sm dark:shadow-[0_0_30px_rgba(140,255,0,0.12)]">
        {/* ============================================================= */}
        {/* STATE A: DEDICATED "CHECK YOUR INBOX" STATE (FORM HIDDEN)     */}
        {/* ============================================================= */}
        {submittedSuccess ? (
          <div className="text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Logo Header */}
            <div className="flex justify-center mb-1">
              <Link href="/" className="hover:opacity-90 transition-opacity">
                <img
                  src="/tmf-logo.png"
                  alt="The Mining Future"
                  className="h-9 sm:h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(140,255,0,0.25)]"
                />
              </Link>
            </div>

            {/* Glowing Mail Icon */}
            <div className="relative mx-auto w-16 h-16 rounded-2xl bg-[#8CFF00]/15 border border-[#8CFF00]/40 flex items-center justify-center text-[#8CFF00] shadow-[0_0_30px_rgba(140,255,0,0.3)]">
              <Mail className="w-8 h-8 stroke-[2.2]" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8CFF00] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#8CFF00]"></span>
              </span>
            </div>

            {/* Headline */}
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Check Your Inbox
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                We sent a secure verification link to:
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#0E1522] border border-slate-200 dark:border-gray-800 text-xs font-mono font-bold text-slate-900 dark:text-[#8CFF00] break-all">
                {submittedEmail}
              </div>
            </div>

            {/* Context Notice */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0A0F18] border border-slate-200 dark:border-gray-800 text-left text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#8CFF00] shrink-0" />
                <span>
                  {isCheckout ? "Hashrate Order Preserved" : "Account Created Successfully"}
                </span>
              </div>
              <p className="text-slate-500 dark:text-gray-400 text-[11px] leading-relaxed">
                {isCheckout
                  ? "Click the button in your confirmation email to verify your address. You will be redirected directly to NOWPayments checkout to finalize your contract."
                  : "Click the verification link sent to your email to verify your address and access your TMF Customer Dashboard."}
              </p>
            </div>

            {/* Primary Action: Open Webmail */}
            <a
              href={webmail.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#8CFF00] hover:bg-[#7EE800] text-black font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-[0_0_18px_rgba(140,255,0,0.3)] flex items-center justify-center gap-2"
            >
              <span>{webmail.name}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Resend Notice */}
            {resendNotice && (
              <div className="p-2.5 rounded-lg bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-[11px] text-[#8CFF00] flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{resendNotice}</span>
              </div>
            )}

            {/* Resend Link and Reset Email */}
            <div className="pt-2 flex flex-col items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
              <button
                type="button"
                disabled={resendCooldown > 0 || resending}
                onClick={handleResendEmail}
                className="hover:text-white underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
              >
                {resending ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Resending email...</span>
                  </>
                ) : resendCooldown > 0 ? (
                  <span>Resend email in {resendCooldown}s</span>
                ) : (
                  <span>Didn&apos;t receive email? Resend verification</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubmittedSuccess(false);
                  setErrorMessage(null);
                }}
                className="text-slate-400 hover:text-[#8CFF00] text-[11px] underline"
              >
                Entered wrong address? Use another email
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================= */
          /* STATE B: REGISTRATION FORM                                    */
          /* ============================================================= */
          <div>
            <div className="text-center mb-6">
              <Link href="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
                <img
                  src="/tmf-logo.png"
                  alt="The Mining Future"
                  className="h-9 sm:h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(140,255,0,0.25)]"
                />
              </Link>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Create TMF Account
              </h1>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                {isCheckout
                  ? "Register to activate cloud hashrate and connect your stratum pool"
                  : "Register for your personal TMF Cloud portal and computing account"}
              </p>

              {/* Selected Plan Badge (ONLY SHOWN IF INITIATED FROM CHECKOUT) */}
              {isCheckout && pendingPackage && planHashrate > 0 && (
                <div className="mt-3 py-1.5 px-3 rounded-lg bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-[#8CFF00] text-[11px] font-mono font-bold flex items-center justify-center gap-1.5">
                  <span>Selected Plan:</span>
                  <span>
                    {planHashrate.toLocaleString()} TH/s · {planDuration} Days · ${estimatedPriceUsd} USD
                  </span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-700 dark:text-gray-300 font-bold block mb-1">
                  FULL NAME
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Satoshi Nakamoto"
                  className="w-full bg-slate-50 dark:bg-[#0C1019] border border-slate-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8CFF00]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-gray-300 font-bold block mb-1">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 dark:bg-[#0C1019] border border-slate-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8CFF00]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 dark:text-gray-300 font-bold block mb-1">
                  PASSWORD (8+ CHARACTERS)
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-[#0C1019] border border-slate-300 dark:border-gray-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8CFF00]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-[#8CFF00] text-black font-extrabold text-xs py-3 rounded-xl hover:bg-[#7EE800] transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Creating Account...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-gray-800 text-center text-xs text-slate-500 dark:text-gray-400 space-y-2">
              <div>
                Already have an account?{" "}
                <Link
                  href={`/login${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}${isCheckout ? "&checkout=true" : ""}`}
                  className="text-[#8CFF00] font-bold hover:underline ml-1"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-mono">
          Loading registration...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
