"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  FilePenLine,
  Send,
  CircleCheck,
  CircleX,
  Clock3,
  Layers3,
  ArrowUpRight,
  Menu,
  X,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
const navigation = [
  { label: "Все контракты", icon: LayoutDashboard, href: "/" },
  { label: "Черновики", icon: FilePenLine, href: "/?status=Draft" },
  { label: "Отправленные", icon: Send, href: "/?status=Sent" },
  { label: "Ожидают закрытия", icon: Clock3, href: "/?status=Signed" },
  { label: "Закрытые", icon: CircleCheck, href: "/?status=Closed" },
  { label: "Отменённые", icon: CircleX, href: "/?status=Cancelled" },
];
export function AppShell({
  children,
  configured,
}: {
  children: ReactNode;
  configured: boolean;
}) {
  const [mobile, setMobile] = useState(false);
  const path = usePathname();
  const search = useSearchParams();
  const status = search.get("status");
  const title =
    path === "/templates"
      ? "Шаблоны"
      : path === "/settings"
        ? "Подключение"
        : path === "/contracts/new"
          ? "Создать контракт"
          : path === "/contracts/upload"
            ? "Загрузить контракт"
            : path.startsWith("/contracts/")
              ? "Контракт"
              : "Обзор";
  return (
    <div className="app-shell">
      <button
        className={`sidebar-scrim ${mobile ? "visible" : ""}`}
        aria-label="Закрыть меню"
        onClick={() => setMobile(false)}
      />
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <Button
            variant="ghost"
            size="icon"
            className="mobile-only"
            onClick={() => setMobile(false)}
            aria-label="Закрыть меню"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="workspace">
          <span className="workspace-avatar">V</span>
          <div>
            <strong>Рабочее пространство</strong>
            <small>Vertex Studio</small>
          </div>
          <span className="workspace-dot" />
        </div>
        <p className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</p>
        <nav aria-label="Основная навигация">
          {navigation.map((item) => {
            const active =
              path === "/" &&
              (item.href === "/"
                ? !status
                : item.href === `/?status=${status}`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobile(false)}
                className={`nav-item ${active ? "active" : ""}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                {active && <span className="nav-active-dot" />}
              </Link>
            );
          })}
          <div className="nav-divider" />
          <Link
            href="/templates"
            onClick={() => setMobile(false)}
            className={`nav-item ${path === "/templates" ? "active" : ""}`}
          >
            <Layers3 size={18} />
            Шаблоны
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <FileText size={18} />
            </span>
            <strong>От текста до подписи</strong>
            <p>
              Все этапы вашего контракта —<br />в одном пространстве.
            </p>
            <Link href="/guide">
              Как это работает <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link
            className="nav-item"
            href="/settings"
            onClick={() => setMobile(false)}
          >
            <Settings2 size={18} />
            Подключение
          </Link>
          <div className="studio-credit">
            <span className="studio-symbol">↗</span>
            <div>
              <strong>Vertex Studio</strong>
              <small>A Vertex Studio Product</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              className="mobile-only"
              variant="ghost"
              size="icon"
              onClick={() => setMobile(true)}
              aria-label="Открыть меню"
            >
              <Menu size={20} />
            </Button>
            <span className="breadcrumb-home">Рабочее пространство</span>
            <ChevronRight size={14} />
            <span>{title}</span>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <span className={configured ? "dot green" : "dot"} />
              {configured ? "Supabase" : "Локальная версия"}
            </span>
            <span className="language">RU</span>
            <Link
              href="/settings"
              className="user-avatar"
              aria-label="Настройки рабочего пространства"
            >
              V
            </Link>
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="app-footer">
          <span>Digital Contract by Vertex Studio</span>
          <Link href="/guide">
            Подписание без лишних шагов <ArrowUpRight size={12} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
