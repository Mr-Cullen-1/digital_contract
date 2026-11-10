import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { configured, serverConfigured } from "./config";
export async function userClient() {
  if (!configured())
    throw new Error(
      "Supabase пока не подключён. Откройте раздел «Подключение».",
    );
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server components cannot write cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
export function adminClient() {
  if (!serverConfigured())
    throw new Error("Не настроен серверный ключ Supabase.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireUser() {
  const supabase = await userClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user)
    throw new Error("Войдите в аккаунт, чтобы продолжить.");
  return data.user;
}
