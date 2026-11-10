"use client";
import { createBrowserClient } from "@supabase/ssr";
import { configured } from "./config";
export function browserClient() {
  if (!configured()) throw new Error("Supabase пока не подключён.");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
