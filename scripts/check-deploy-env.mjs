import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.VERCEL === "1") {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_APP_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length)
    throw new Error(
      `Missing Vercel environment variables: ${missing.join(", ")}`,
    );
  const app = new URL(process.env.NEXT_PUBLIC_APP_URL);
  if (
    app.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) ||
    app.origin !== process.env.NEXT_PUBLIC_APP_URL
  )
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be the exact public HTTPS origin without a trailing slash.",
    );
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (api.protocol !== "https:")
    throw new Error("Supabase URL must use HTTPS.");
  if (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_secret_"))
    throw new Error(
      "Server key must never be assigned to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  console.log("Deployment environment validated (secret values hidden).");
}
