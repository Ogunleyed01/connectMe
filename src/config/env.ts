import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN must be provided in .env"),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  GEMINI_API_KEY: z.string().optional().or(z.literal("")),
  ADMIN_TELEGRAM_ID: z.coerce.number().optional(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function cleanSupabaseUrl(url?: string): string {
  if (!url) return "";
  return url.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    console.warn(`[Config Warning] Environment variables warning: ${missing}`);
    // Return with fallback for BOT_TOKEN if not set during build/checks
    return {
      BOT_TOKEN: process.env.BOT_TOKEN || "",
      SUPABASE_URL: cleanSupabaseUrl(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
      ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID ? Number(process.env.ADMIN_TELEGRAM_ID) : undefined,
      PORT: Number(process.env.PORT) || 3000,
      NODE_ENV: (process.env.NODE_ENV as "development" | "production" | "test") || "development",
    };
  }

  return {
    ...result.data,
    SUPABASE_URL: cleanSupabaseUrl(result.data.SUPABASE_URL),
  };
}

export const env = loadEnv();
