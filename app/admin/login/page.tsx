"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  isValidAdminEmail,
  setStoredAdminUser,
  getStoredAdminUser,
} from "@/lib/admin-auth";

function AdminAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/admin";
  const emailParam = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already logged in, allow direct forward (unless logging in with a specific invite email)
  useEffect(() => {
    const existing = getStoredAdminUser();
    if (existing && isValidAdminEmail(existing.email) && !emailParam) {
      if (!searchParams.get("reauth")) {
        router.push(returnUrl);
      }
    }
  }, [router, returnUrl, searchParams, emailParam]);

  const emailLower = email.trim().toLowerCase();

  // Demo fill helper for testing
  const handleFillDemoAdmin = () => {
    setEmail("subesh@theminingfuture.com");
    setPassword("TmfOps2026!#Secure");
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!emailLower) {
      setErrorMessage("Please enter an email address.");
      return;
    }

    if (!isValidAdminEmail(emailLower)) {
      setErrorMessage("Please enter a valid email address format.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your admin password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          email: emailLower,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMessage(json.error || "Authentication failed. Please verify credentials.");
        setLoading(false);
        return;
      }

      // Store verified admin session
      if (json.user) {
        setStoredAdminUser(json.user);
      }

      setSuccessMessage("Access granted! Redirecting to TMF Operations Console...");

      setTimeout(() => {
        router.push(returnUrl);
        router.refresh();
      }, 600);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected network error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col justify-between selection:bg-[#8CFF00] selection:text-black">
      {/* Background Cyber Grid Accent */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#8CFF00_1px,transparent_1px),linear-gradient(to_bottom,#8CFF00_1px,transparent_1px)] bg-[size:4rem_4rem]" />

      {/* TOP BRAND HEADER */}
      <header className="border-b border-[#151D2A] bg-[#0A0E17]/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <img
              src="/tmf-logo.png"
              alt="The Mining Future"
              className="h-8 sm:h-9 w-auto object-contain drop-shadow-[0_0_12px_rgba(140,255,0,0.3)]"
            />
          </Link>
          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#8CFF00]/20 text-[#8CFF00] border border-[#8CFF00]/30 font-mono">
            ADMIN CONSOLE
          </span>
        </div>

        <Link
          href="/dashboard"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors font-mono"
        >
          <span>Customer Portal</span>
          <ExternalLink className="w-3 h-3 text-[#8CFF00]" />
        </Link>
      </header>

      {/* MAIN AUTHENTICATION CONTAINER */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-[#0B0F17] border border-[#1A2536] rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Top Green Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8CFF00] to-transparent opacity-80" />

            {/* Header: Admin Sign In */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/20 text-[#8CFF00] mb-3 shadow-[0_0_15px_rgba(140,255,0,0.15)]">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white">Admin Sign In</h1>
              <p className="text-xs text-slate-400 mt-1">
                Enter your staff credentials to access operations management
              </p>
            </div>

            {/* ERROR BANNER */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2.5 leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div>
                  <strong className="block text-red-300 font-bold mb-0.5">Authorization Error</strong>
                  <span>{errorMessage}</span>
                </div>
              </div>
            )}

            {/* SUCCESS BANNER */}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-xs text-[#8CFF00] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {/* INVITE NOTICE BANNER */}
            {emailParam && !errorMessage && !successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-xs text-[#8CFF00] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Invited Staff Sign-In: Enter your initial passcode to access your operations console.</span>
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Admin Email */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#070A0F] border border-[#1A2536] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8CFF00] font-mono transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Admin Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#070A0F] border border-[#1A2536] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8CFF00] font-mono transition-colors"
                  />
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full mt-2 bg-[#8CFF00] text-black font-extrabold text-xs py-3 rounded-xl hover:bg-[#7EE800] transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Authenticating Credentials...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Authorize & Open Admin Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* QUICK DEMO ACCESS HELPER */}
            <div className="mt-4 pt-3.5 border-t border-[#151D2A] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Need immediate operations review?</span>
              <button
                type="button"
                onClick={handleFillDemoAdmin}
                className="text-[#8CFF00] hover:underline font-bold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Fill Demo Admin</span>
              </button>
            </div>
          </div>

          {/* FOOTER NOTICE & CUSTOMER REDIRECT */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-xs text-slate-400">
              Are you a client or customer looking for your contracts?
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8CFF00] hover:underline"
            >
              <span>Go to Customer Sign In Portal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>

      {/* MINIMAL FOOTER */}
      <footer className="border-t border-[#151D2A] bg-[#0A0E17]/60 px-4 py-3 text-center text-[11px] text-slate-500 font-mono relative z-10">
        © The Mining Future. All rights reserved.
      </footer>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070A0F] p-8 text-center text-xs text-slate-400">Loading operations portal...</div>}>
      <AdminAuthForm />
    </Suspense>
  );
}
