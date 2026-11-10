import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="empty-state">
        <h1>Страница не найдена</h1>
        <p>Проверьте адрес или вернитесь в рабочее пространство.</p>
        <Button asChild>
          <Link href="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
