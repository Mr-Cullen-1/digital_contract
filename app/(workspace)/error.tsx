"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h2>Не удалось открыть страницу</h2>
      <p>Проверьте подключение и повторите попытку.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
