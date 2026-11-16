"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function CheckoutRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const th = searchParams.get("th") || "1000";
    const days = searchParams.get("days") || "30";
    const pay = searchParams.get("pay") || "USDT";
    window.location.href = `/confirm?th=${th}&days=${days}&pay=${pay}`;
  }, [searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-xs text-gray-400">
      Redirecting to confirmation...
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading...</div>}>
      <CheckoutRedirect />
    </Suspense>
  );
}
