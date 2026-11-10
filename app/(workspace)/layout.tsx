import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { configured } from "@/lib/supabase/config";
import { userClient } from "@/lib/supabase/server";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (configured()) {
    const { data } = await (await userClient()).auth.getUser();
    if (!data.user) redirect("/login");
  }
  return (
    <Suspense
      fallback={<div className="loading">Загрузка рабочего пространства…</div>}
    >
      <AppShell configured={configured()}>{children}</AppShell>
    </Suspense>
  );
}
