import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeContext";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "TMF Cloud | The Mining Future Hashrate Platform",
  description: "Enterprise cloud hashrate portal. High-efficiency Bitcoin mining power hosted in Clean Energy Infrastructure with real-time Stratum telemetry.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialUser = null;
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    initialUser = data.user ?? null;
  } catch {
    initialUser = null;
  }

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/styles.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem('tmf-theme') || 'dark';
                if (savedTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-[#F8FAFC] text-slate-900 dark:bg-[#000000] dark:text-[#F8FAFC] flex flex-col min-h-screen selection:bg-tmf-green selection:text-tmf-black transition-colors duration-150">
        <ThemeProvider>
          <Navbar initialUser={initialUser} />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
