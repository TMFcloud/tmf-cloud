import { ShieldCheck, Activity, ArrowRight, Lock } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import HeroLaunchButton from "@/components/HeroLaunchButton";

export default async function HomePage() {
  const wpUrl = process.env.NEXT_PUBLIC_WORDPRESS_URL || "https://www.theminingfuture.com";

  let isAuthed = false;
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    isAuthed = Boolean(data.user);
  } catch {
    isAuthed = false;
  }

  return (
    <div className="flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20 transition-colors duration-150">
      {/* Brand Hero Emblem */}
      <div className="mb-6 flex justify-center">
        <img
          src="/tmf-logo.png"
          alt="The Mining Future"
          className="h-12 sm:h-16 w-auto object-contain drop-shadow-[0_0_25px_rgba(140,255,0,0.35)]"
        />
      </div>

      {/* Hero Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0C1019] text-xs text-slate-600 dark:text-gray-400 mb-6 sm:mb-8 shadow-xs">
        <span className="flex h-2 w-2 rounded-full bg-[#8CFF00] animate-pulse" />
        <span className="text-slate-900 dark:text-white font-medium">Enterprise Stratum Hashrate Routing</span>
      </div>

      {/* Main Headline */}
      <h1 className="text-center text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight">
        High-Performance Bitcoin Hashrate Powered by <span className="text-[#8CFF00]">Clean Energy</span>
      </h1>

      <p className="mt-4 sm:mt-6 text-center text-sm sm:text-base lg:text-lg text-slate-600 dark:text-gray-400 max-w-2xl leading-relaxed">
        Direct stratum allocation from Clean Energy Infrastructure facilities. Real-time telemetry, dedicated pool destinations, and transparent daily mining outputs.
      </p>

      {/* Primary Actions */}
      <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
        <HeroLaunchButton initialIsAuthed={isAuthed} />

        <a
          href={wpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-gray-800 bg-white dark:bg-[#0C1019] text-slate-800 dark:text-white font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#111624] transition-colors shadow-xs"
        >
          <span>Explore Facilities</span>
          <ArrowRight className="h-4 w-4 text-slate-500 dark:text-gray-400" />
        </a>
      </div>

      {/* Feature Highlights Grid */}
      <div className="mt-14 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl w-full">
        <div className="bg-white dark:bg-[#07090E] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 hover:border-[#8CFF00]/40 transition-colors shadow-sm dark:shadow-none">
          <div className="h-9 w-9 rounded-xl bg-[#8CFF00]/10 flex items-center justify-center border border-[#8CFF00]/30 text-[#8CFF00] mb-3.5">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5">Verified Stratum Pool</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
            Your destination pool is confirmed and permanently secured upon purchase. Unauthorized pool changes are blocked to guarantee fraud prevention.
          </p>
        </div>

        <div className="bg-white dark:bg-[#07090E] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 hover:border-[#8CFF00]/40 transition-colors shadow-sm dark:shadow-none">
          <div className="h-9 w-9 rounded-xl bg-[#8CFF00]/10 flex items-center justify-center border border-[#8CFF00]/30 text-[#8CFF00] mb-3.5">
            <Activity className="h-4 w-4" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5">Live Telemetry</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
            Direct telemetry integration tracks live TH/s, 24-hour averages, and worker uptime status refreshed every 5 minutes.
          </p>
        </div>

        <div className="bg-white dark:bg-[#07090E] border border-slate-200 dark:border-gray-800 rounded-2xl p-5 sm:p-6 hover:border-[#8CFF00]/40 transition-colors shadow-sm dark:shadow-none">
          <div className="h-9 w-9 rounded-xl bg-[#8CFF00]/10 flex items-center justify-center border border-[#8CFF00]/30 text-[#8CFF00] mb-3.5">
            <Lock className="h-4 w-4" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-1.5">Fair Activation Clock</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 leading-relaxed">
            Your contract duration timer does not start until hashrate is actively assigned and accepted by your pool. Zero downtime losses.
          </p>
        </div>
      </div>
    </div>
  );
}
