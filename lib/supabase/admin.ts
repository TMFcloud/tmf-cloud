import { createClient } from "@supabase/supabase-js";

export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url: any, options?: any) => {
        // Return immediately for placeholder URLs to prevent server timeout hangs
        if (typeof url === "string" && url.includes("placeholder.supabase.co")) {
          return Promise.resolve(
            new Response(JSON.stringify({ data: null, error: null }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
        return fetch(url, {
          ...options,
          cache: "no-store",
        });
      },
    },
  });
}
