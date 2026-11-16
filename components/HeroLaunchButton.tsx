"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPurchaseHref } from "@/lib/navigation";

export default function HeroLaunchButton({
  initialIsAuthed = false,
}: {
  initialIsAuthed?: boolean;
}) {
  const [isAuthed, setIsAuthed] = useState(initialIsAuthed);
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data } = await supabase.auth.getUser();
        setIsAuthed(Boolean(data.user));
      } catch {
        setIsAuthed(false);
      }
    }
    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthed(Boolean(session?.user));
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <Link
      href={getPurchaseHref(isAuthed)}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#8CFF00] text-black font-extrabold text-sm px-7 py-3.5 rounded-xl hover:bg-[#7EE800] transition-all shadow-[0_0_20px_rgba(140,255,0,0.3)] hover:scale-[1.02]"
    >
      <Zap className="h-4 w-4 fill-black" />
      <span>Launch Cloud Contract</span>
    </Link>
  );
}
