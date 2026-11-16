import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (url: any, options?: any) => {
        // Return immediately for placeholder URLs to prevent browser timeout hangs
        if (typeof url === "string" && url.includes("placeholder.supabase.co")) {
          return Promise.resolve(
            new Response(JSON.stringify({ data: null, error: null }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return fetch(url, options);
      },
    },
  });
}
