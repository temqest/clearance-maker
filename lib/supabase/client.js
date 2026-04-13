import { createBrowserClient } from "@supabase/ssr";

let browserClient;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window === "undefined") {
      return null;
    }

    throw new Error("Missing Supabase environment variables.");
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
