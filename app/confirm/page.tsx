"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Zap,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Check,
  Server,
  ChevronRight,
  Lock,
  UserPlus,
  LogIn,
  X,
} from "lucide-react";

interface PoolPreset {
  id: string;
  name: string;
  url: string;
  recommended?: boolean;
}

const POOL_PRESETS: PoolPreset[] = [
  { id: "ViaBTC", name: "ViaBTC", url: "stratum+tcp://btc.viabtc.top:3333", recommended: true },
  { id: "F2Pool", name: "F2Pool", url: "stratum+tcp://btc.f2pool.com:3333" },
  { id: "AntPool", name: "AntPool", url: "stratum+tcp://pool.antpool.com:3333" },
  { id: "Binance", name: "Binance Pool", url: "stratum+tcp://bs.poolbinance.com:3333" },
  { id: "Braiins", name: "Braiins Pool", url: "stratum+tcp://stratum.braiins.com:3333" },
  { id: "Custom", name: "Custom Stratum", url: "" },
];

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // Read URL parameters passed from /buy or WordPress calculator widget
  const thParam = parseInt(searchParams.get("th") || "1000", 10);
  const daysParam = parseInt(searchParams.get("days") || "30", 10);
  const payParam = (searchParams.get("pay") || "USDT").toUpperCase();

  const [hashrateTh, setHashrateTh] = useState(isNaN(thParam) || thParam < 10 ? 1000 : thParam);
  const [durationDays, setDurationDays] = useState(isNaN(daysParam) || daysParam < 30 ? 30 : daysParam);
  const [paymentCurrency, setPaymentCurrency] = useState<"USDT" | "BTC">(payParam === "BTC" ? "BTC" : "USDT");

  // Keep state updated if URL params change
  useEffect(() => {
    if (searchParams.get("th")) {
      const parsed = parseInt(searchParams.get("th") || "", 10);
      if (!isNaN(parsed) && parsed >= 10) setHashrateTh(parsed);
    }
    if (searchParams.get("days")) {
      const parsed = parseInt(searchParams.get("days") || "", 10);
      if (!isNaN(parsed) && parsed >= 30) setDurationDays(parsed);
    }
    if (searchParams.get("pay")) {
      const parsed = searchParams.get("pay")?.toUpperCase();
      if (parsed === "BTC" || parsed === "USDT") setPaymentCurrency(parsed as any);
    }
  }, [searchParams]);

  // Destination Mining Pool inputs
  const [poolProvider, setPoolProvider] = useState<string>("Braiins");
  const [stratumUrl, setStratumUrl] = useState("stratum+tcp://stratum.braiins.com:3333");
  const [workerName, setWorkerName] = useState("");
  const [workerPassword, setWorkerPassword] = useState("x");
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Authoritative Pricing state
  const [baseRate, setBaseRate] = useState(0.0309966);
  const [btcPrice, setBtcPrice] = useState(65000);
  const [estDailyBtcPerTh, setEstDailyBtcPerTh] = useState(0.0000004738);

  const [user, setUser] = useState<any>(null);
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAuthChoiceModal, setShowAuthChoiceModal] = useState(false);

  // Fetch live authoritative pricing
  useEffect(() => {
    let isMounted = true;
    const fetchPricing = async () => {
      try {
        const res = await fetch("/api/public/pricing", { cache: "no-store" });
        const data = await res.json();
        if (data && data.success && isMounted) {
          if (data.baseRatePerThDay) setBaseRate(Number(data.baseRatePerThDay));
          if (data.btcPrice) setBtcPrice(Number(data.btcPrice));
          if (data.estDailyBtcPerTh) setEstDailyBtcPerTh(Number(data.estDailyBtcPerTh));
        }
      } catch {}
    };

    fetchPricing();
    const interval = setInterval(fetchPricing, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Check user session
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        let name = data.user.user_metadata?.full_name;
        if (!name) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", data.user.id)
            .maybeSingle();
          if (profile?.full_name) name = profile.full_name;
        }
        if (!name && data.user.email) {
          name = data.user.email.split("@")[0];
        }
        if (name) {
          setCustomerName(name);
          setWorkerName((prev) => (prev ? prev : name.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "tmf"));
        }
      }
    });

    // Restore saved pool info from localStorage if returning from login
    const savedPool = localStorage.getItem("tmf_pending_pool");
    if (savedPool) {
      try {
        const parsed = JSON.parse(savedPool);
        if (parsed.poolProvider) setPoolProvider(parsed.poolProvider);
        if (parsed.stratumUrl) setStratumUrl(parsed.stratumUrl);
        if (parsed.workerName) setWorkerName(parsed.workerName);
        if (parsed.workerPassword) setWorkerPassword(parsed.workerPassword);
      } catch {}
    }
  }, [supabase]);

  // Calculations
  const totalUsd = Math.round(hashrateTh * durationDays * baseRate * 100) / 100;
  const totalBtc = (totalUsd / (btcPrice || 65000)).toFixed(6);
  const estDailyBtc = (hashrateTh * estDailyBtcPerTh).toFixed(8);

  const handleProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!termsAccepted) {
      setErrorMessage("Please accept the terms acknowledging variable mining network conditions.");
      return;
    }

    // Validate Stratum URL
    if (!stratumUrl.startsWith("stratum+tcp://") && !stratumUrl.startsWith("stratum+ssl://")) {
      setErrorMessage("Stratum URL must begin with stratum+tcp:// or stratum+ssl://");
      return;
    }

    if (!workerName.trim()) {
      setErrorMessage("Original worker name is required.");
      return;
    }

    // Save pending package and pool to localStorage
    const pendingData = {
      hashrateTh,
      durationDays,
      paymentCurrency,
      poolProvider,
      stratumUrl,
      workerName,
      workerPassword,
    };
    localStorage.setItem("tmf_pending_pool", JSON.stringify(pendingData));

    // If user is not logged in, display Account Access selection (Step 2: Sign Up or Login)
    if (!user) {
      setShowAuthChoiceModal(true);
      return;
    }

    // User is logged in -> Create order via authoritative API
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          hashrate_th: hashrateTh,
          duration_days: durationDays,
          payment_currency: paymentCurrency === "BTC" ? "BTC" : "USDT_TRC20",
          terms_accepted: true,
          pool: {
            pool_provider: poolProvider,
            stratum_url: stratumUrl,
            worker_name: workerName.trim(),
            worker_password: workerPassword || "x",
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "Failed to create order. Please verify pool credentials.");
        setSubmitting(false);
        return;
      }

      // Store order ID and redirect to NOWPayments or secure payment session
      localStorage.setItem("tmf_active_order_id", data.orderId);
      if (data.invoiceUrl && !data.invoiceUrl.includes("/payment?orderId=")) {
        window.location.href = data.invoiceUrl;
      } else {
        window.location.href = `/payment?orderId=${data.orderId}`;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
      setSubmitting(false);
    }
  };

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
      {/* 4-STEP CHECKOUT PROGRESS BAR (COMPACT SLIM PILL)              */}
      {/* ============================================================= */}
      <nav aria-label="Checkout Progress" className="mb-4 sm:mb-5">
        <div className="p-1 sm:p-1.5 rounded-xl bg-[#090D14] border border-[#1A2332]">
          <div className="grid grid-cols-4 items-center gap-1 text-center font-mono">
            {/* Step 1: Select Hashrate */}
            <Link
              href={`/buy?th=${hashrateTh}&days=${durationDays}&pay=${paymentCurrency}`}
              className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-[#8CFF00] hover:bg-[#121926] transition-colors"
            >
              <Check className="w-3 h-3 text-[#8CFF00] shrink-0" />
              <span className="text-[11px] font-bold truncate">1. Hashrate</span>
            </Link>

            {/* Step 2: Pool Config (Active) */}
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg bg-[#8CFF00]/15 border border-[#8CFF00]/40 text-[#8CFF00]">
              <span className="w-3.5 h-3.5 rounded-full bg-[#8CFF00] text-black text-[9px] font-black flex items-center justify-center shrink-0">
                2
              </span>
              <span className="text-[11px] font-black truncate">2. Pool Config</span>
            </div>

            {/* Step 3: Account */}
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-slate-500">
              <span className="text-[10px] text-slate-600">3</span>
              <span className="text-[11px] font-medium truncate">3. Account</span>
            </div>

            {/* Step 4: Payment */}
            <div className="flex items-center justify-center gap-1 py-1 px-1 rounded-lg text-slate-500">
              <span className="text-[10px] text-slate-600">4</span>
              <span className="text-[11px] font-medium truncate">4. Payment</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ============================================================= */}
      {/* HEADER TITLE (CLEAN & CONCISE)                                */}
      {/* ============================================================= */}
      <div className="text-center mb-4 sm:mb-5 space-y-1">
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Confirm Hashrate &amp; Mining Pool
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-400 max-w-md mx-auto">
          Review your computing package and specify your external Stratum pool routing.
        </p>
      </div>

      <form onSubmit={handleProceed} className="space-y-3.5 sm:space-y-4">
        {/* ============================================================= */}
        {/* 1. HASHRATE CONTRACT SUMMARY (COMPACT CARD)                   */}
        {/* ============================================================= */}
        <section className="bg-[#0A0E17] border border-[#1A2536] rounded-xl p-3.5 sm:p-4 space-y-3 shadow-sm">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-2 border-b border-[#1A2536]">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#8CFF00] fill-[#8CFF00]" />
              <h2 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
                Selected Hashrate Contract
              </h2>
            </div>
            <Link
              href={`/buy?th=${hashrateTh}&days=${durationDays}&pay=${paymentCurrency}`}
              className="text-[11px] font-bold text-[#8CFF00] hover:underline flex items-center gap-0.5"
            >
              <span>Edit Package</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {/* 4 Compact Metric Cells */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#16202E]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Hashrate
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-white font-mono">
                  {hashrateTh.toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-[#8CFF00]">TH/s</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#16202E]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Duration
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-white font-mono">
                  {durationDays}
                </span>
                <span className="text-[10px] text-slate-400">Days</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#16202E]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Currency
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-black text-white font-mono">
                  {paymentCurrency}
                </span>
                <span className="text-[9px] text-slate-500 font-sans">
                  {paymentCurrency === "BTC" ? "Native" : "TRC20"}
                </span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-[#070A0F] border border-[#8CFF00]/30">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Total Cost
              </span>
              <div className="mt-0.5 truncate">
                <span className="text-base font-black text-[#8CFF00] font-mono">
                  {paymentCurrency === "BTC" ? `${totalBtc} BTC` : `$${totalUsd.toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-strip with Output & Base Rate */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
            <div>
              <span>Est. Daily Output: </span>
              <strong className="text-white font-bold">≈ {estDailyBtc} BTC / day</strong>
              <span className="text-slate-500 ml-1">(${((parseFloat(estDailyBtc) * btcPrice)).toFixed(2)}/d)</span>
            </div>
            <div className="text-[9px] text-slate-500">
              Base Rate: ${baseRate.toFixed(4)}/TH/day • Clean Energy Grid
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* 2. MINING POOL CONFIGURATION (COMPACT REDESIGN)               */}
        {/* ============================================================= */}
        <section className="bg-[#0A0E17] border border-[#1A2536] rounded-xl p-3.5 sm:p-4 space-y-3.5 shadow-sm">
          {/* Section Header */}
          <div className="pb-2 border-b border-[#1A2536] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-[#8CFF00]" />
              <h2 className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
                Destination Mining Pool Configuration
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
              Mined BTC credits to your pool
            </span>
          </div>

          {/* 1. Pool Provider Preset Chips (Compact Grid) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
              1. Select Supported Mining Pool
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {POOL_PRESETS.map((p) => {
                const isSelected = poolProvider === p.name;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPoolProvider(p.name);
                      if (p.url) setStratumUrl(p.url);
                    }}
                    className={`py-2 px-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-[#8CFF00]/10 border-[#8CFF00] text-white shadow-[0_0_10px_rgba(140,255,0,0.15)] ring-1 ring-[#8CFF00]/60"
                        : "bg-[#070A0F] border-[#16202E] hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="truncate pr-1">
                      <span className={`text-[11px] font-bold block truncate ${isSelected ? "text-[#8CFF00]" : "text-white"}`}>
                        {p.name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono block truncate">
                        {p.url ? p.url.replace("stratum+tcp://", "").split(":")[0] : "Custom Endpoint"}
                      </span>
                    </div>

                    {isSelected && (
                      <div className="w-3.5 h-3.5 rounded-full bg-[#8CFF00] text-black flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Stratum Pool URL Input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="stratum-url-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                2. Stratum Server URL <span className="text-[#8CFF00]">*</span>
              </label>
              <span className="text-[9px] font-mono text-slate-500">
                stratum+tcp:// or stratum+ssl://
              </span>
            </div>
            <input
              id="stratum-url-input"
              type="text"
              required
              value={stratumUrl}
              onChange={(e) => setStratumUrl(e.target.value)}
              placeholder="stratum+tcp://stratum.braiins.com:3333"
              className="w-full bg-[#070A0F] border border-[#16202E] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#8CFF00] font-mono transition-colors"
            />
          </div>

          {/* 3. Worker Name & Password Fields (Compact 2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Worker Name */}
            <div className="space-y-1">
              <label htmlFor="worker-name-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Original Worker Name <span className="text-[#8CFF00]">*</span>
              </label>
              <input
                id="worker-name-input"
                type="text"
                required
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. tmf"
                className="w-full bg-[#070A0F] border border-[#16202E] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#8CFF00] font-mono transition-colors"
              />
              <span className="text-[9px] text-slate-500 block font-mono">
                Your username on the pool (e.g. Braiins/ViaBTC).
              </span>
            </div>

            {/* Worker Password */}
            <div className="space-y-1">
              <label htmlFor="worker-password-input" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                Worker Password
              </label>
              <input
                id="worker-password-input"
                type="text"
                value={workerPassword}
                onChange={(e) => setWorkerPassword(e.target.value)}
                placeholder="x"
                className="w-full bg-[#070A0F] border border-[#16202E] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-[#8CFF00] font-mono transition-colors"
              />
              <span className="text-[9px] text-slate-500 block font-mono">
                Usually &apos;x&apos; or &apos;123&apos; for Stratum auth.
              </span>
            </div>
          </div>
        </section>

        {/* ============================================================= */}
        {/* ERROR NOTIFICATION                                            */}
        {/* ============================================================= */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* ============================================================= */}
        {/* CONFIRMATION CHECKBOX (COMPACT)                               */}
        {/* ============================================================= */}
        <div className="bg-[#0A0E17] border border-[#1A2536] rounded-xl p-3 shadow-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-gray-700 bg-black text-[#8CFF00] focus:ring-[#8CFF00] cursor-pointer"
            />
            <span className="text-[11px] text-slate-400 leading-normal">
              I verify my Stratum mining pool details and acknowledge that cloud mining power will be routed to this pool. Payouts are variable based on active Bitcoin network difficulty and are not guaranteed earnings.
            </span>
          </label>
        </div>

        {/* ============================================================= */}
        {/* PROMINENT SUBMIT BUTTON                                       */}
        {/* ============================================================= */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#8CFF00] hover:bg-[#7EE800] text-black font-black text-sm py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transform active:scale-[0.99]"
        >
          {submitting ? (
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <span>Creating Cloud Contract...</span>
            </div>
          ) : !user ? (
            <>
              <Zap className="w-4 h-4 fill-black" />
              <span>
                Proceed to Payment • {paymentCurrency === "BTC" ? `${totalBtc} BTC` : `$${totalUsd.toFixed(2)} USDT`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-black" />
              <span>
                Proceed to Payment • {paymentCurrency === "BTC" ? `${totalBtc} BTC` : `$${totalUsd.toFixed(2)} USDT`}
              </span>
            </>
          )}
        </button>

        {/* Trust Badges Footer Note */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-500 text-center pt-1 font-mono">
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
      </form>

      {/* ============================================================= */}
      {/* ACCOUNT ACCESS SELECTION MODAL (STEP 2: SIGN UP OR LOGIN)     */}
      {/* ============================================================= */}
      {showAuthChoiceModal && (
        <div
          onClick={() => setShowAuthChoiceModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0B0F17] border border-[#1A2536] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4 font-sans text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1A2536]">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#8CFF00] font-bold tracking-wider">
                  Step 2 of 4 • Account Access
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Continue Your Hashrate Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthChoiceModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              To link your <strong className="text-white">{hashrateTh.toLocaleString()} TH/s</strong> plan ({durationDays} days), please select your account status:
            </p>

            <div className="space-y-2.5">
              {/* Option 1: CREATE NEW ACCOUNT */}
              <button
                type="button"
                onClick={() => {
                  const returnUrl = encodeURIComponent(
                    `/confirm?th=${hashrateTh}&days=${durationDays}&pay=${paymentCurrency}`
                  );
                  window.location.href = `/register?checkout=true&returnUrl=${returnUrl}&th=${hashrateTh}&days=${durationDays}&pay=${paymentCurrency}`;
                }}
                className="w-full p-3.5 rounded-xl bg-[#121926] hover:bg-[#162133] border border-[#1E293B] hover:border-[#8CFF00]/50 transition-all text-left flex items-start gap-3 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-[#8CFF00]/15 border border-[#8CFF00]/30 text-[#8CFF00] flex items-center justify-center shrink-0 mt-0.5">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-white group-hover:text-[#8CFF00] transition-colors">
                      CREATE NEW ACCOUNT
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#8CFF00]/15 text-[#8CFF00] font-bold">
                      NEW CUSTOMER
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Quick signup. Instant email confirmation then direct to NOWPayments checkout.
                  </p>
                </div>
              </button>

              {/* Option 2: LOGIN TO EXISTING ACCOUNT */}
              <button
                type="button"
                onClick={() => {
                  const returnUrl = encodeURIComponent(
                    `/confirm?th=${hashrateTh}&days=${durationDays}&pay=${paymentCurrency}`
                  );
                  window.location.href = `/login?checkout=true&returnUrl=${returnUrl}&th=${hashrateTh}&days=${durationDays}&pay=${paymentCurrency}`;
                }}
                className="w-full p-3.5 rounded-xl bg-[#121926] hover:bg-[#162133] border border-[#1E293B] hover:border-[#8CFF00]/50 transition-all text-left flex items-start gap-3 group cursor-pointer"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 group-hover:text-white flex items-center justify-center shrink-0 mt-0.5">
                  <LogIn className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-white group-hover:text-[#8CFF00] transition-colors">
                      LOGIN TO EXISTING ACCOUNT
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                      EXISTING CUSTOMER
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Sign in to use your TMF Wallet balance or pay via NOWPayments.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400 font-mono">Loading confirmation...</div>}>
      <ConfirmContent />
    </Suspense>
  );
}
