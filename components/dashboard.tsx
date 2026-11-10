"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  FileText,
  Send,
  Clock3,
  CheckCheck,
  Check,
  Search,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Link2,
  ChevronRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, Input, Message, Spinner } from "./ui/primitives";
import { type Contract, type ContractStatus, statusLabels } from "@/lib/domain";
import { api, formatDate } from "@/lib/utils";
export function Dashboard({ configured }: { configured: boolean }) {
  const params = useSearchParams(),
    router = useRouter();
  const status = params.get("status") || "all";
  const [contracts, setContracts] = useState<Contract[]>([]),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(""),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (!configured) return;
    let active = true;
    api<{ contracts: Contract[] }>("/api/contracts")
      .then((d) => {
        if (active) setContracts(d.contracts);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [configured]);
  const filtered = contracts.filter(
    (c) =>
      (status === "all" || c.status === status) &&
      `${c.title} ${c.number || ""} ${c.parties?.map((p) => p.name).join(" ") || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const stats = [
    {
      title: "Всего контрактов",
      value: contracts.length,
      caption: "В вашем пространстве",
      icon: FileText,
    },
    {
      title: "На подписании",
      value: contracts.filter((c) => c.status === "Sent").length,
      caption: "Ожидают вторую сторону",
      icon: Send,
    },
    {
      title: "Ожидают закрытия",
      value: contracts.filter((c) => c.status === "Signed").length,
      caption: "Готовы к вашему решению",
      icon: Clock3,
    },
    {
      title: "Закрытые",
      value: contracts.filter((c) => c.status === "Closed").length,
      caption: "Подписаны и сохранены",
      icon: CheckCheck,
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Ваши контракты</h1>
          <p>Меньше формальностей. Больше ясности в работе.</p>
        </div>
        <div className="heading-actions">
          <Button asChild variant="secondary">
            <Link href="/contracts/upload">
              <Upload size={15} />
              Загрузить контракт
            </Link>
          </Button>
          <Button asChild>
            <Link href="/contracts/new">
              <Plus size={16} />
              Создать контракт
            </Link>
          </Button>
        </div>
      </div>
      <Card className="intro-panel">
        <div>
          <div className="eyebrow">VERTEX CONTRACT</div>
          <h2>Договорённости становятся делом.</h2>
          <p>
            Создайте контракт, поделитесь ссылкой и получите подпись.
            <br />
            Весь путь — в одном удобном пространстве.
          </p>
          <div className="intro-bottom">
            <span>
              <Check size={12} />
              Без регистрации для получателя
            </span>
            <span>
              <Check size={12} />
              Подпись с любого устройства
            </span>
          </div>
        </div>
        <div className="document-art" aria-hidden="true">
          <div className="art-sheet">
            <FileText className="art-logo" size={22} />
            <div className="art-line" />
            <div className="art-line short" />
            <div className="art-line" />
            <div className="art-line short" />
            <div className="art-sign">Vertex</div>
          </div>
          <span className="art-check">
            <Check size={21} />
          </span>
        </div>
      </Card>
      <div className="stats-grid">
        {stats.map((s) => (
          <Card className="stat" key={s.title}>
            <div className="stat-top">
              <span>{s.title}</span>
              <span className="stat-icon">
                <s.icon size={16} />
              </span>
            </div>
            <div className="stat-value">
              {loading ? "—" : s.value.toString().padStart(2, "0")}
            </div>
            <div className="stat-caption">{s.caption}</div>
          </Card>
        ))}
      </div>
      <div className="section-heading">
        <h2>
          {status === "all"
            ? "Все контракты"
            : statusLabels[status as ContractStatus] || "Контракты"}
          <span className="count-label">{contracts.length}</span>
        </h2>
        <span className="muted" style={{ fontSize: 10 }}>
          Ваше рабочее пространство
        </span>
      </div>
      {error && (
        <div className="notice-block">
          <Message>{error}</Message>
        </div>
      )}
      <Card>
        <div className="contracts-toolbar">
          <div className="tabs" aria-label="Фильтр контрактов">
            {[
              { key: "all", label: "Все" },
              { key: "Draft", label: "Черновики" },
              { key: "Sent", label: "Отправленные" },
              { key: "Signed", label: "К закрытию" },
              { key: "Closed", label: "Закрытые" },
            ].map((t) => (
              <button
                key={t.key}
                className={`tab ${status === t.key ? "active" : ""}`}
                onClick={() =>
                  router.push(t.key === "all" ? "/" : `/?status=${t.key}`)
                }
                aria-pressed={status === t.key}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="search">
            <Search size={14} />
            <Input
              aria-label="Поиск контрактов"
              placeholder="Найти контракт или участника…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Название контракта</th>
                <th>Участники</th>
                <th>Дата создания</th>
                <th>Статус</th>
                <th>
                  <span className="sr-only">Открыть</span>
                </th>
              </tr>
            </thead>
            {filtered.length > 0 && (
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/contracts/${c.id}`}
                        className="contract-name"
                      >
                        {c.title}
                      </Link>
                      <span className="contract-meta">
                        {c.number || "Номер после закрытия"}
                      </span>
                      {c.closed_at && (
                        <span
                          className="contract-meta"
                          style={{ display: "block", marginTop: 5 }}
                        >
                          Закрыт {formatDate(c.closed_at)}
                        </span>
                      )}
                    </td>
                    <td>
                      {c.parties
                        ?.map((p) => p.name || "Не заполнено")
                        .join(" / ") || "Не заполнены"}
                    </td>
                    <td>{formatDate(c.created_at)}</td>
                    <td>
                      <span className={`badge badge-${c.status}`}>
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/contracts/${c.id}`}
                        aria-label={`Открыть ${c.title}`}
                      >
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {loading ? (
          <div className="loading">
            <Spinner />
            Загружаем контракты
          </div>
        ) : (
          !filtered.length && (
            <div className="empty-state">
              <div className="empty-icon">
                <FileText size={24} />
              </div>
              <h3>
                {query
                  ? "Ничего не найдено"
                  : status !== "all"
                    ? "Здесь пока нет контрактов"
                    : "Место для ваших договорённостей"}
              </h3>
              <p>
                {query
                  ? "Попробуйте другое название или имя участника."
                  : "Создайте первый контракт с нуля, выберите шаблон или загрузите готовый документ."}
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link href="/contracts/new">
                  <Plus size={14} />
                  Создать первый контракт
                </Link>
              </Button>
            </div>
          )
        )}
        <div className="table-footer">
          <span>
            {filtered.length} контрактов{query ? " по вашему запросу" : ""}
          </span>
          <span>
            <ShieldCheck
              size={11}
              style={{ display: "inline", marginRight: 5 }}
            />
            Доступ к документам только у участников
          </span>
        </div>
      </Card>
      <div className="bottom-grid">
        <Card className="bottom-card">
          <div className="eyebrow">ПРОСТОЙ ПРОЦЕСС</div>
          <h3>Один контракт. Несколько простых шагов.</h3>
          <p>От первого слова до готового подписанного документа.</p>
          <div className="steps-mini">
            <span>
              <b>1</b>Создайте
            </span>
            <ArrowRight size={11} />
            <span>
              <b>2</b>Отправьте
            </span>
            <ArrowRight size={11} />
            <span>
              <b>3</b>Подпишите
            </span>
            <ArrowRight size={11} />
            <span>
              <b>4</b>Закройте
            </span>
          </div>
          <Link href="/guide">
            Посмотреть, как это работает <ArrowUpRight size={13} />
          </Link>
        </Card>
        <Card className="bottom-card">
          <div className="eyebrow">НЕ НУЖНО НАЧИНАТЬ С НУЛЯ</div>
          <h3>Хороший контракт начинается с шаблона.</h3>
          <p>
            Услуги, разработка и сотрудничество —<br />
            выберите основу и добавьте свои условия.
          </p>
          <Link href="/templates">
            Открыть библиотеку шаблонов <ArrowUpRight size={13} />
          </Link>
        </Card>
      </div>
      {!configured && (
        <div className="connection-note">
          <Link2 size={13} />
          <span>
            Локальная версия. Сохранение и отправка станут доступны после
            подключения Supabase.{" "}
            <Link href="/settings">Настроить подключение →</Link>
          </span>
        </div>
      )}
    </>
  );
}
