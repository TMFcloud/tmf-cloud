"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Hash, Calendar, CreditCard, Check, Zap } from "lucide-react";

interface BuyHashrateCardProps {
  initialTh?: number;
  initialDays?: number;
  initialPay?: "USDT" | "BTC";
  onSelect?: (th: number, days: number, pay: string) => void;
  ctaText?: string;
  showCta?: boolean;
}

export default function BuyHashrateCard({
  initialTh = 1000,
  initialDays = 30,
  initialPay = "USDT",
  onSelect,
  ctaText = "BUY HASHRATE",
  showCta = true,
}: BuyHashrateCardProps) {
  const router = useRouter();

  const [th, setTh] = useState<number>(initialTh);
  const [days, setDays] = useState<number>(initialDays);
  const [pay, setPay] = useState<"USDT" | "BTC">(initialPay);

  const [baseRate, setBaseRate] = useState<number>(0.0309966);
  const [btcPrice, setBtcPrice] = useState<number>(65000);
  const [estDailyBtcPerTh, setEstDailyBtcPerTh] = useState<number>(0.0000004738);

  // Real-time live pricing and 1-hour authoritative BTC oracle synchronization
  useEffect(() => {
    let isMounted = true;

    const syncLivePricing = async () => {
      // Fetch live authoritative platform pricing & 1-hour auto-refreshed BTC oracle price
      try {
        const serverRes = await fetch("/api/public/pricing", { cache: "no-store" });
        if (serverRes.ok) {
          const sData = await serverRes.json();
          if (sData?.success && isMounted) {
            if (sData.baseRatePerThDay != null) setBaseRate(Number(sData.baseRatePerThDay));
            if (sData.estDailyBtcPerTh != null) setEstDailyBtcPerTh(Number(sData.estDailyBtcPerTh));
            if (sData.btcPrice != null) {
              setBtcPrice(Number(sData.btcPrice));
            }
          }
        }
      } catch {}
    };

    // Initial immediate load
    syncLivePricing();

    // Live background polling every 15 seconds to catch hourly refreshes or admin rate changes
    const interval = setInterval(syncLivePricing, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Sync props if changed
  useEffect(() => {
    if (initialTh) setTh(initialTh);
    if (initialDays) setDays(initialDays);
    if (initialPay) setPay(initialPay);
  }, [initialTh, initialDays, initialPay]);

  // Calculations
  const totalUsd = Math.round(th * days * baseRate * 100) / 100;
  const totalBtc = (totalUsd / (btcPrice || 65000)).toFixed(6);
  const estDailyBtc = (th * estDailyBtcPerTh).toFixed(8);

  // Slider progress percentages for neon green filled track
  const minTh = 10;
  const maxTh = 20000;
  const thPercent = Math.min(100, Math.max(0, ((th - minTh) / (maxTh - minTh)) * 100));

  const minDays = 30;
  const maxDays = 365;
  const daysPercent = Math.min(100, Math.max(0, ((days - minDays) / (maxDays - minDays)) * 100));

  const handleAction = () => {
    if (onSelect) {
      onSelect(th, days, pay);
    } else {
      window.location.href = `/confirm?th=${th}&days=${days}&pay=${pay}`;
    }
  };

  return (
    <div className="relative w-full max-w-[500px] mx-auto rounded-[28px] p-6 sm:p-7 bg-[#07090E] border-2 border-[#8CFF00] shadow-[0_0_40px_rgba(140,255,0,0.22)] font-sans text-white select-none overflow-hidden">
      {/* Background Top Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#8CFF00]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Header: Logo and Graphic */}
      <div className="flex items-start justify-between relative z-10 mb-4">
        {/* TMF Brand Header */}
        <div className="flex items-center gap-3">
          <img
            src="/tmf-logo.png"
            alt="The Mining Future"
            className="h-9 sm:h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(140,255,0,0.3)]"
          />
        </div>

        {/* Bitcoin & Server Visual Icon Badge */}
        <div className="relative w-24 h-16 flex items-center justify-end">
          <div className="absolute right-0 top-0 flex items-center gap-1">
            {/* Server Rack Illustration */}
            <div className="flex gap-0.5 opacity-70">
              <div className="w-1.5 h-10 bg-gray-800 rounded-sm border border-gray-700 flex flex-col justify-between py-1 px-0.5">
                <span className="w-full h-0.5 bg-[#8CFF00] rounded-full animate-pulse" />
                <span className="w-full h-0.5 bg-[#8CFF00] rounded-full" />
                <span className="w-full h-0.5 bg-gray-600 rounded-full" />
              </div>
              <div className="w-1.5 h-12 bg-gray-800 rounded-sm border border-gray-700 flex flex-col justify-between py-1 px-0.5">
                <span className="w-full h-0.5 bg-[#8CFF00] rounded-full" />
                <span className="w-full h-0.5 bg-[#8CFF00] rounded-full animate-pulse" />
                <span className="w-full h-0.5 bg-[#8CFF00] rounded-full" />
              </div>
            </div>

            {/* Glowing Golden Bitcoin Icon */}
            <div className="relative -ml-3 z-10">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#E67E22] via-[#F39C12] to-[#F1C40F] p-0.5 shadow-[0_0_15px_rgba(243,156,18,0.7)] flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-yellow-200/60 flex items-center justify-center bg-gradient-to-b from-[#F39C12] to-[#D68910]">
                  <span className="text-white font-black text-xl drop-shadow">₿</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-2 mb-2 relative z-10">
        <span className="bg-[#8CFF00] text-black font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider">
          BUY BITCOIN HASHRATE
        </span>
        <span className="bg-[#121620] border border-gray-700 text-white font-bold text-[11px] px-3 py-1 rounded-full uppercase tracking-wider">
          FROM $10
        </span>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-gray-300 font-medium mb-6 relative z-10">
        Start mining instantly with Clean Energy Infrastructure
      </p>

      {/* Section 1: Choose Hashrate */}
      <div className="mb-5 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#121622] border border-gray-700 flex items-center justify-center text-gray-400">
              <Hash className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <span className="text-sm font-semibold text-white">Choose Hashrate</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#8CFF00] font-mono tracking-tight">
              {th.toLocaleString()}
            </span>
            <span className="text-sm font-black text-[#8CFF00]">TH/s</span>
          </div>
        </div>

        {/* Custom Track Slider */}
        <div className="relative w-full h-6 flex items-center">
          <input
            type="range"
            min={minTh}
            max={maxTh}
            step={10}
            value={th}
            onChange={(e) => setTh(parseInt(e.target.value, 10))}
            style={{
              background: `linear-gradient(to right, #8CFF00 0%, #8CFF00 ${thPercent}%, #1E2533 ${thPercent}%, #1E2533 100%)`,
            }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer focus:outline-none transition-all duration-75 slider-neon-thumb"
          />
        </div>

        <div className="flex justify-between text-[11px] text-gray-400 italic mt-0.5">
          <span>Min: {minTh} TH/s</span>
          <span>Max: {maxTh.toLocaleString()} TH/s</span>
        </div>
      </div>

      {/* Section 2: Choose Duration */}
      <div className="mb-6 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#121622] border border-gray-700 flex items-center justify-center text-gray-400">
              <Calendar className="w-3.5 h-3.5 text-gray-300" />
            </div>
            <span className="text-sm font-semibold text-white">Choose Duration</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[#8CFF00] font-mono tracking-tight">
              {days}
            </span>
            <span className="text-sm font-black text-[#8CFF00]">days</span>
          </div>
        </div>

        {/* Custom Track Slider */}
        <div className="relative w-full h-6 flex items-center">
          <input
            type="range"
            min={minDays}
            max={maxDays}
            step={1}
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            style={{
              background: `linear-gradient(to right, #8CFF00 0%, #8CFF00 ${daysPercent}%, #1E2533 ${daysPercent}%, #1E2533 100%)`,
            }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer focus:outline-none transition-all duration-75 slider-neon-thumb"
          />
        </div>

        <div className="flex justify-between text-[11px] text-gray-400 italic mt-0.5">
          <span>Min: {minDays} days</span>
          <span>Max: {maxDays} days</span>
        </div>
      </div>

      {/* Section 3: Payment Option */}
      <div className="mb-6 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-gray-300" />
          <span className="text-sm font-semibold text-white">Payment Option</span>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {/* USDT Option */}
          <button
            type="button"
            onClick={() => setPay("USDT")}
            className={`relative p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 ${
              pay === "USDT"
                ? "border-2 border-[#8CFF00] bg-[#0E1515] shadow-[0_0_15px_rgba(140,255,0,0.15)]"
                : "border border-gray-800 bg-[#0C1019] hover:border-gray-700"
            }`}
          >
            {/* Selected Checkmark Badge */}
            {pay === "USDT" && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#8CFF00] text-black flex items-center justify-center font-black shadow-md">
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
            )}

            {/* Tether Icon */}
            <div className="w-9 h-9 rounded-full bg-[#26A17B] flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white font-black text-lg">₮</span>
            </div>

            <div>
              <div className="text-base font-extrabold text-white">USDT</div>
              <div className="text-[10px] text-gray-400 font-medium">TRC20 / ERC20</div>
            </div>
          </button>

          {/* BTC Option */}
          <button
            type="button"
            onClick={() => setPay("BTC")}
            className={`relative p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 ${
              pay === "BTC"
                ? "border-2 border-[#8CFF00] bg-[#16140D] shadow-[0_0_15px_rgba(140,255,0,0.15)]"
                : "border border-gray-800 bg-[#0C1019] hover:border-gray-700"
            }`}
          >
            {/* Selected Checkmark Badge */}
            {pay === "BTC" && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#8CFF00] text-black flex items-center justify-center font-black shadow-md">
                <Check className="w-3.5 h-3.5 stroke-[3.5]" />
              </div>
            )}

            {/* Bitcoin Icon */}
            <div className="w-9 h-9 rounded-full bg-[#F7931A] flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white font-black text-lg">₿</span>
            </div>

            <div>
              <div className="text-base font-extrabold text-white">BTC</div>
              <div className="text-[10px] text-gray-400 font-medium italic">Bitcoin Network</div>
            </div>
          </button>
        </div>
      </div>

      {/* Summary Box: Total Cost & Est. Daily Payout */}
      <div className="mb-6 p-4 rounded-2xl bg-[#06080D] border border-gray-800 grid grid-cols-2 gap-4 relative z-10">
        {/* Left Column: Total Cost */}
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">
            TOTAL COST
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-black text-[#8CFF00] font-mono tracking-tight">
              {pay === "BTC" ? `${totalBtc} BTC` : `$${totalUsd.toFixed(2)}`}
            </span>
            <span className="text-xs font-bold text-white uppercase">
              {pay === "BTC" ? `≈ $${totalUsd.toFixed(2)}` : pay}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="absolute top-3 bottom-3 left-1/2 w-[1px] bg-gray-800" />

        {/* Right Column: Est Daily Payout */}
        <div className="pl-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1">
            EST. DAILY PAYOUT
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">
              {estDailyBtc}
            </span>
            <span className="text-xs font-bold text-white">BTC</span>
          </div>
        </div>
      </div>

      {/* Action Button: BUY HASHRATE */}
      {showCta && (
        <button
          type="button"
          onClick={handleAction}
          className="w-full bg-[#8CFF00] text-black font-black text-base py-4 rounded-2xl hover:bg-[#7EE800] transition-all transform active:scale-[0.99] shadow-[0_0_25px_rgba(140,255,0,0.4)] flex items-center justify-center gap-2 relative z-10"
        >
          <Zap className="w-5 h-5 fill-black text-black stroke-[2.5]" />
          <span>{ctaText}</span>
        </button>
      )}

      {/* Live Market BTC Ticker & Platform Lease Rate */}
      <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between text-[12px] text-gray-400 relative z-10 px-1 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#8CFF00] animate-pulse" />
          <span>
            Live BTC:{" "}
            <strong className="text-white text-xs font-black">
              ${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </span>
        </div>
        <div className="text-[11px] text-gray-400">
          Rate: <strong className="text-[#8CFF00] font-black">${baseRate.toFixed(4)}</strong>/TH/d
        </div>
      </div>
    </div>
  );
}
