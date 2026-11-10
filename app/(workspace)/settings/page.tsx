import Link from "next/link";
import { Database, CheckCircle2, ArrowUpRight } from "lucide-react";
import { configured, serverConfigured } from "@/lib/supabase/config";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
export default function Settings() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Подключение пространства</h1>
          <p>Настройте хранение документов и доступ для участников.</p>
        </div>
      </div>
      <div className="settings-grid">
        <Card>
          <div className="panel-heading">
            <Database size={24} color="#635BFF" />
            <h2 style={{ marginTop: 17 }}>Supabase</h2>
            <p>
              {serverConfigured()
                ? "Параметры подключения заданы. Доступность базы проверяется при выполнении запросов."
                : "Локальный проект готов к подключению. Облачная база пока не используется."}
            </p>
          </div>
          <div className="panel-body">
            <ol className="settings-list">
              <li>Подготовьте отдельный проект Supabase.</li>
              <li>
                Примените SQL-миграции из папки{" "}
                <code className="code">supabase/migrations</code>.
              </li>
              <li>
                Скопируйте <code className="code">.env.example</code> в{" "}
                <code className="code">.env.local</code>.
              </li>
              <li>Укажите URL, публичный и серверный ключи.</li>
              <li>
                Настройте адрес возврата авторизации и перезапустите приложение.
              </li>
            </ol>
            <p className="form-help" style={{ marginTop: 20 }}>
              Подробные команды и порядок проверки — в README проекта. Секретный
              ключ хранится только на сервере.
            </p>
          </div>
        </Card>
        <div className="detail-stack">
          <Card className="panel-body">
            <h3>Состояние конфигурации</h3>
            <div className="detail-stack" style={{ marginTop: 20 }}>
              <div className="detail-item">
                <span>Supabase Auth</span>
                <strong>{configured() ? "Настроен" : "Не подключён"}</strong>
              </div>
              <div className="detail-item">
                <span>Серверный доступ</span>
                <strong>
                  {serverConfigured() ? "Настроен" : "Не подключён"}
                </strong>
              </div>
              <div className="detail-item">
                <span>Локальные изменения</span>
                <strong>
                  {serverConfigured()
                    ? "Сохранение через Supabase"
                    : "Не сохраняются в облаке"}
                </strong>
              </div>
            </div>
          </Card>
          <Card className="panel-body">
            <CheckCircle2 size={22} color="#16A37A" />
            <h3 style={{ margin: "15px 0 10px" }}>Приватность по умолчанию</h3>
            <p className="form-help">
              Документы и подписи хранятся в закрытых хранилищах. Перед
              использованием реальных персональных данных определите место
              хранения и условия обработки.
            </p>
          </Card>
          {configured() && (
            <Button asChild variant="secondary">
              <Link href="/login">
                Управление входом <ArrowUpRight size={14} />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
