"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mail,
  User,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Building,
  KeyRound,
  ExternalLink,
  Cpu,
  Sparkles,
} from "lucide-react";
import {
  isValidAdminEmail,
  isPublicEmailDomain,
  setStoredAdminUser,
  getStoredAdminUser,
  ALLOWED_ADMIN_DOMAINS,
  AdminUser,
} from "@/lib/admin-auth";

function AdminAuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const returnUrl = searchParams.get("returnUrl") || "/admin";
  const emailParam = searchParams.get("email") || "";

  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already logged in with valid enterprise email, allow direct forward (unless logging in with a specific invite email)
  useEffect(() => {
    const existing = getStoredAdminUser();
    if (existing && isValidAdminEmail(existing.email) && !emailParam) {
      // Check if user came explicitly to switch or log in
      if (!searchParams.get("reauth")) {
        router.push(returnUrl);
      }
    }
  }, [router, returnUrl, searchParams, emailParam]);

  // Real-time domain validation status
  const emailLower = email.trim().toLowerCase();
  const hasAt = emailLower.includes("@");
  const isDomainAllowed = hasAt && isValidAdminEmail(emailLower);
  const isDomainDisallowed = hasAt && (isPublicEmailDomain(emailLower) || (!isDomainAllowed && emailLower.split("@")[1]?.includes(".")));

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

    // 1. Client-side Domain Rule Enforcement
    if (!emailLower) {
      setErrorMessage("Please enter an email address.");
      return;
    }

    if (isPublicEmailDomain(emailLower)) {
      setErrorMessage(
        "ACCESS DENIED: Public email providers (@gmail.com, @outlook.com, @yahoo.com, etc.) are strictly prohibited. You must use an authorized organizational account ending with @theminingfuture.com."
      );
      return;
    }

    if (!isValidAdminEmail(emailLower)) {
      setErrorMessage(
        `ACCESS RESTRICTED: Only organizational emails ending with @theminingfuture.com (or @themingfuture.com) are permitted to access the TMF Admin Operations Console.`
      );
      return;
    }

    if (activeTab === "register" && password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long for admin security.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: activeTab,
          email: emailLower,
          password,
          fullName: activeTab === "register" ? fullName : undefined,
          role: "operations",
          department: "Clean Energy Operations",
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

      setSuccessMessage(
        activeTab === "login"
          ? "Access granted! Redirecting to TMF Operations Console..."
          : "Admin account registered successfully! Redirecting..."
      );

      setTimeout(() => {
        router.push(returnUrl);
        router.refresh();
      }, 700);
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
          {/* SECURITY BADGE CARD */}
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#101622] border border-[#1A2536] text-[11px] font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#8CFF00] animate-pulse" />
              <span>Domain Whitelist Enforced:</span>
              <strong className="text-[#8CFF00]">@theminingfuture.com</strong>
            </div>
          </div>

          <div className="bg-[#0B0F17] border border-[#1A2536] rounded-2xl p-6 sm:p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
            {/* Top Green Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#8CFF00] to-transparent opacity-80" />

            {/* TAB SELECTOR: SIGN IN / REGISTER */}
            <div className="flex rounded-xl bg-[#070A0F] p-1 border border-[#1A2536] mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("login");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "login"
                    ? "bg-[#8CFF00] text-black shadow-[0_0_12px_rgba(140,255,0,0.3)] font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("register");
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === "register"
                    ? "bg-[#8CFF00] text-black shadow-[0_0_12px_rgba(140,255,0,0.3)] font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Register Admin</span>
              </button>
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
              {/* Full Name (Register tab only) */}
              {activeTab === "register" && (
                <div>
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Staff Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Subesh Mullasery"
                      className="w-full bg-[#070A0F] border border-[#1A2536] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8CFF00] transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Enterprise Email Address with Domain Badge */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Enterprise Admin Email
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">@theminingfuture.com only</span>
                </div>

                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@theminingfuture.com"
                    className={`w-full bg-[#070A0F] border rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors font-mono ${
                      isDomainDisallowed
                        ? "border-red-500/80 focus:border-red-500 bg-red-950/10"
                        : isDomainAllowed
                        ? "border-[#8CFF00] focus:border-[#8CFF00] bg-[#8CFF00]/5"
                        : "border-[#1A2536] focus:border-[#8CFF00]"
                    }`}
                  />
                </div>

                {/* Real-time Domain Feedback Pill */}
                {isDomainDisallowed && (
                  <div className="mt-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[10px] text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                    <span>
                      <strong>Disallowed Domain:</strong> Personal emails (@gmail, @outlook, etc.) are strictly prohibited.
                    </span>
                  </div>
                )}

                {isDomainAllowed && (
                  <div className="mt-1.5 p-1.5 rounded-lg bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-[10px] text-[#8CFF00] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#8CFF00]" />
                    <span>Verified enterprise domain: <strong>@theminingfuture.com</strong></span>
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    {activeTab === "register" ? "Create Admin Password (Min 8 Chars)" : "Admin Password"}
                  </label>
                </div>
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
                disabled={loading || isDomainDisallowed}
                className="w-full mt-2 bg-[#8CFF00] text-black font-extrabold text-xs py-3 rounded-xl hover:bg-[#7EE800] transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Authenticating Credentials...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {activeTab === "login" ? "Authorize & Open Admin Console" : "Register Admin Account"}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* QUICK DEMO ACCESS HELPER */}
            {activeTab === "login" && (
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
            )}
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

      {/* FOOTER BAR */}
      <footer className="border-t border-[#151D2A] bg-[#0A0E17]/60 px-4 py-3 text-center text-[11px] text-slate-400 font-mono relative z-10">
        THE MINING FUTURE • EQUALIZER PLATFORM FLEET INTEGRATION • CLOUD MINING OPERATIONS CONSOLE
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
