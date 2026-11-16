"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Zap, AlertCircle, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("next") || searchParams.get("returnUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "verification_failed") {
      setErrorMessage("Verification link expired or invalid. Please sign in or request a new confirmation.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Restore pending package ONLY if customer came from checkout flow
      const isCheckoutLogin = Boolean(
        searchParams.get("checkout") === "true" ||
          searchParams.get("th") ||
          returnUrl.includes("/confirm") ||
          returnUrl.includes("/payment")
      );

      if (isCheckoutLogin && typeof window !== "undefined") {
        const pendingRaw = localStorage.getItem("tmf_pending_pool");
        if (pendingRaw) {
          try {
            const pending = JSON.parse(pendingRaw);
            if (pending && pending.hashrateTh) {
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              const res = await fetch("/api/orders/create", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  hashrate_th: pending.hashrateTh,
                  duration_days: pending.durationDays,
                  payment_currency: pending.paymentCurrency === "BTC" ? "BTC" : "USDT_TRC20",
                  terms_accepted: true,
                  pool: {
                    pool_provider: pending.poolProvider || "ViaBTC",
                    stratum_url: pending.stratumUrl,
                    worker_name: pending.workerName,
                    worker_password: pending.workerPassword || "x",
                  },
                }),
              });
              const data = await res.json();
              if (data && data.orderId) {
                localStorage.removeItem("tmf_pending_pool");
                localStorage.setItem("tmf_active_order_id", data.orderId);
                router.push(`/payment?orderId=${data.orderId}`);
                router.refresh();
                return;
              }
            }
          } catch (e) {
            console.warn("[LOGIN RESTORE] Error restoring pending order:", e);
          }
        }
      }

      router.push(returnUrl);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md w-full px-3 sm:px-6 py-8 sm:py-16 transition-colors duration-150">
      <div className="bg-white dark:bg-[#07090E] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 sm:p-8 shadow-sm dark:shadow-[0_0_30px_rgba(140,255,0,0.12)]">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
            <img
              src="/tmf-logo.png"
              alt="The Mining Future"
              className="h-9 sm:h-10 w-auto mx-auto object-contain drop-shadow-[0_0_15px_rgba(140,255,0,0.25)]"
            />
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Log In to TMF Cloud</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Access your active hashrate contracts and real-time telemetry
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="text-xs text-slate-700 dark:text-gray-300 font-bold block mb-1">EMAIL ADDRESS</label>
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
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-700 dark:text-gray-300 font-bold">PASSWORD</label>
              <Link href="/forgot-password" className="text-[11px] text-[#8CFF00] font-bold hover:underline">
                Forgot password?
              </Link>
            </div>
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
              <span>Signing In...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-gray-800 text-center text-xs text-slate-500 dark:text-gray-400 space-y-2">
          <div>
            Don&apos;t have an account?{" "}
            <Link
              href={`/register${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
              className="text-[#8CFF00] font-bold hover:underline ml-1"
            >
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading sign in...</div>}>
      <LoginForm />
    </Suspense>
  );
}
