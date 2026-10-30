import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

let supabase: SupabaseClient | null = null;

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log("[Supabase] Client initialized successfully.");
  } catch (error) {
    console.error("[Supabase] Failed to initialize Supabase client:", error);
  }
} else {
  console.warn(
    "[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Running in memory/mock persistence mode."
  );
}

export { supabase };
