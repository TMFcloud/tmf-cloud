import BuyHashrateCard from "@/components/BuyHashrateCard";
import { ShieldCheck, Activity, Lock } from "lucide-react";

export const metadata = {
  title: "Buy Bitcoin Hashrate | TMF Cloud",
  description: "Select your desired Bitcoin hashrate and contract duration. Clean Energy Infrastructure with live Stratum telemetry.",
};

export default function BuyPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-3 sm:px-6 py-8 sm:py-14 relative overflow-hidden transition-colors duration-150">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#8CFF00]/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Centered Buy Hashrate Card */}
      <div className="w-full relative z-10">
        <BuyHashrateCard />
      </div>

      {/* Trust Badges under the Card */}
      <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-slate-500 dark:text-gray-400 relative z-10 max-w-2xl text-center">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#8CFF00]" />
          <span>Dedicated Stratum Routing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-[#8CFF00]" />
          <span>Real-Time Hashrate Telemetry</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-4 h-4 text-[#8CFF00]" />
          <span>Zero-Downtime Fair Activation</span>
        </div>
      </div>
    </div>
  );
}
