"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/login?reset=success`
          : "https://theminingfuture.com/login";

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send reset link. Please try again.");
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Reset Password</h1>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Enter your account email to receive a password recovery link
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#8CFF00]/10 border border-[#8CFF00]/30 text-xs text-slate-800 dark:text-gray-200 space-y-2">
              <div className="flex items-center gap-2 text-[#8CFF00] font-bold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                <span>Reset Link Dispatched</span>
              </div>
              <p>
                We have sent a password reset link to <strong className="text-white">{email}</strong>. Please check your inbox and spam folder.
              </p>
            </div>

            <Link
              href="/login"
              className="w-full bg-[#8CFF00] text-black font-extrabold text-xs py-3 rounded-xl hover:bg-[#7EE800] transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="text-xs text-slate-700 dark:text-gray-300 font-bold block mb-1">
                ACCOUNT EMAIL ADDRESS
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 dark:bg-[#0C1019] border border-slate-300 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#8CFF00]"
                />
                <Mail className="h-4 w-4 text-slate-400 dark:text-gray-500 absolute left-3 top-2.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8CFF00] text-black font-extrabold text-xs py-3 rounded-xl hover:bg-[#7EE800] transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Sending Reset Link...</span>
              ) : (
                <>
                  <span>Send Recovery Email</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="text-xs text-slate-500 dark:text-gray-400 hover:text-[#8CFF00] transition-colors inline-flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
