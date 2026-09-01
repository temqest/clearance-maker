import { createBrowserClient } from "@supabase/ssr";

let browserClient;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window !== "undefined") {
      console.warn("Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing in build/deployment settings.");
    }
    return null;
  }

  try {
    browserClient = createBrowserClient(url, anonKey);
    return browserClient;
  } catch (err) {
    console.warn("Failed to initialize Supabase client:", err);
    return null;
  }
}
