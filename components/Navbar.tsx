"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Zap, ShieldCheck, User, LogOut, ExternalLink, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  // If on Dashboard or Admin, hide the marketing navbar so the app header is primary
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin")) {
    return null;
  }

  useEffect(() => {
    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      } catch {
        // Unauthenticated
      } finally {
        setLoading(false);
      }
    }
    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const wpUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://www.theminingfuture.com";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-gray-800 bg-white/95 dark:bg-[#07090E]/95 backdrop-blur-md transition-colors duration-150">
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/tmf-logo.png"
              alt="The Mining Future"
              className="h-8 sm:h-9 w-auto object-contain group-hover:opacity-95 transition-opacity"
            />
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-[#8CFF00]/15 text-[#8CFF00] tracking-wider uppercase border border-[#8CFF00]/30 font-mono">
              Cloud Portal
            </span>
          </Link>

          {/* Return to marketing website */}
          <a
            href={wpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <span>theminingfuture.com</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Center / Right Links */}
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/buy"
            className="text-xs font-bold text-slate-700 hover:text-[#8CFF00] dark:text-gray-300 dark:hover:text-[#8CFF00] transition-colors px-2.5 py-1.5 rounded-lg"
          >
            Buy Hashrate
          </Link>

          {/* Light / Dark Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-800 transition-colors"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-yellow-400 fill-yellow-400/20" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700 fill-slate-700/20" />
            )}
          </button>

          {loading ? (
            <div className="h-8 w-16 bg-slate-200 dark:bg-gray-800 animate-pulse rounded-md" />
          ) : user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-black text-black bg-[#8CFF00] px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg hover:bg-[#7EE800] transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)]"
              >
                <ShieldCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline">Dashboard</span>
              </Link>
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-gray-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                href="/login"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 text-xs font-black text-black bg-[#8CFF00] px-3 py-1.5 sm:py-2 rounded-lg hover:bg-[#7EE800] transition-all shadow-[0_0_15px_rgba(140,255,0,0.25)]"
              >
                <User className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
