import nextEnv from "@next/env";
import { vercelOrigins } from "../lib/app-origin.mjs";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.VERCEL === "1") {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length)
    throw new Error(
      `Missing Vercel environment variables: ${missing.join(", ")}`,
    );
  vercelOrigins();
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (api.protocol !== "https:")
    throw new Error("Supabase URL must use HTTPS.");
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_secret_"))
    throw new Error(
      "Server key must never be assigned to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  console.log("Deployment environment validated (secret values hidden).");
}
