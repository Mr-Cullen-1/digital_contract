import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { templates } from "@/lib/templates";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
export default function TemplatesPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Основа для договорённостей</h1>
          <p>Выберите шаблон и адаптируйте условия под вашу задачу.</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/contracts/new">
            <Plus size={15} />
            Пустой документ
          </Link>
        </Button>
      </div>
      <div className="template-grid">
        {templates.map((t) => (
          <Card className="template-card" key={t.id}>
            <div className="template-preview" aria-hidden="true">
              <div className="template-paper">
                <b>ДОГОВОР</b>
                {Array.from({ length: 9 }, (_, i) => (
                  <i key={i} style={{ width: i % 3 === 0 ? "65%" : "100%" }} />
                ))}
              </div>
            </div>
            <h3>{t.title}</h3>
            <p>{t.description}</p>
            <Button asChild variant="secondary" size="sm">
              <Link href={`/contracts/new?template=${t.id}`}>
                Использовать шаблон
                <ArrowUpRight size={14} />
              </Link>
            </Button>
          </Card>
        ))}
      </div>
      <p className="connection-note">
        Шаблоны — заготовки для редактирования. Заполните все поля в квадратных
        скобках и проверьте условия перед отправкой.
      </p>
    </>
  );
}
