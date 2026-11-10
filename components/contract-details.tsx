"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  LockKeyhole,
  Send,
  Trash2,
  FilePenLine,
  RefreshCw,
} from "lucide-react";
import { type Contract, statusLabels } from "@/lib/domain";
import { api, formatDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Card, Message, Modal, Input, Field, Spinner } from "./ui/primitives";
import { DocumentContent, PartyPreview } from "./document-content";
const eventLabels: Record<string, string> = {
  created: "Создан черновик",
  saved: "Сохранена новая версия",
  send: "Отправлен на подписание",
  sign: "Получена подпись второй стороны",
  cancelled: "Контракт отменён",
  closed: "Контракт закрыт",
  link_rotated: "Приглашение перевыпущено",
  links_revoked: "Все ссылки отозваны",
};
export function ContractDetails({ initial }: { initial: Contract }) {
  const [c, setContract] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [confirm, setConfirm] = useState<
      "close" | "cancel" | "delete" | "revoke_links" | null
    >(null),
    [copied, setCopied] = useState(false);
  const router = useRouter();
  async function action(name: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string; url?: string }>(
        `/api/contracts/${c.id}/action`,
        { method: "POST", body: JSON.stringify({ action: name }) },
      );
      if (result.url) {
        setLink(result.url);
        setCopied(false);
      }
      if (name === "copy") {
        router.push(`/contracts/${result.id}/edit`);
        return;
      }
      setContract(
        (await api<{ contract: Contract }>(`/api/contracts/${c.id}`)).contract,
      );
      setConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/contracts/${c.id}`, { method: "DELETE" });
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts/${c.id}/download`);
      if (!response.ok) throw new Error((await response.json()).error);
      const { url } = await response.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${c.number}.pdf`;
      a.click();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const original = c.files?.find((f) => f.kind === "original");
  return (
    <>
      <div className="page-heading">
        <div>
          <Link
            href="/"
            className="muted"
            style={{
              fontSize: 11,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 13,
            }}
          >
            <ArrowLeft size={13} />
            Все контракты
          </Link>
          <h1>{c.title}</h1>
          <p>
            {c.number || "Номер будет присвоен при закрытии"} · Создан{" "}
            {formatDate(c.created_at)}
          </p>
        </div>
        <div className="heading-actions">
          {c.status === "Draft" && (
            <Button asChild>
              <Link href={`/contracts/${c.id}/edit`}>
                <FilePenLine size={15} />
                Редактировать
              </Link>
            </Button>
          )}
          {c.status === "Closed" && (
            <Button disabled={busy} onClick={download}>
              <Download size={15} />
              Скачать PDF
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => action("copy")}
          >
            <Copy size={14} />
            Создать копию
          </Button>
        </div>
      </div>
      {error && (
        <div className="notice-block">
          <Message>{error}</Message>
        </div>
      )}
      <div className="editor-grid">
        <div className="document-preview">
          <span className={`badge badge-${c.status}`}>
            {statusLabels[c.status]}
          </span>
          <h2 className="document-title">{c.title}</h2>
          {c.source_kind === "pdf" && original?.url ? (
            <>
              <iframe
                title="Оригинальный PDF"
                className="file-frame"
                src={original.url}
              />
              <a
                href={original.url}
                target="_blank"
                rel="noreferrer"
                className="form-help"
              >
                Открыть оригинал ↗
              </a>
            </>
          ) : (
            <DocumentContent content={c.version!.content} />
          )}
          <div className="document-parties">
            <PartyPreview
              party={c.parties?.find((p) => p.side === "creator")}
              signatureUrl={
                c.signatures?.find((s) => s.side === "creator")?.url
              }
            />
            <PartyPreview
              party={c.parties?.find((p) => p.side === "recipient")}
              signatureUrl={
                c.signatures?.find((s) => s.side === "recipient")?.url
              }
            />
          </div>
        </div>
        <div className="detail-stack sticky-panel">
          <Card>
            <div className="panel-heading">
              <h3>Информация о контракте</h3>
            </div>
            <div className="panel-body detail-stack">
              <div className="detail-item">
                <span>Статус</span>
                <strong>{statusLabels[c.status]}</strong>
              </div>
              <div className="detail-item">
                <span>Версия</span>
                <strong>{c.version?.version}</strong>
              </div>
              <div className="detail-item">
                <span>Создан</span>
                <strong>{formatDate(c.created_at)}</strong>
              </div>
              {c.closed_at && (
                <div className="detail-item">
                  <span>Закрыт</span>
                  <strong>{formatDate(c.closed_at)}</strong>
                </div>
              )}
              {c.signatures?.map((s) => (
                <div className="detail-item" key={s.side}>
                  <span>
                    {s.side === "creator"
                      ? "Подпись создателя"
                      : "Подпись получателя"}
                  </span>
                  <strong>{formatDate(s.signed_at)}</strong>
                </div>
              ))}
              {c.status === "Signed" && (
                <>
                  <Message success>
                    Обе стороны подписали документ. Проверьте данные и закройте
                    контракт.
                  </Message>
                  <Button disabled={busy} onClick={() => setConfirm("close")}>
                    <LockKeyhole size={14} />
                    Закрыть контракт
                  </Button>
                </>
              )}
              {c.status === "Sent" && (
                <>
                  <p className="form-help">
                    Ожидаем заполнение данных и подпись получателя. При
                    перевыпуске приглашения прежняя ссылка перестанет работать.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => action("rotate_link")}
                  >
                    <Send size={14} />
                    Перевыпустить ссылку
                  </Button>
                </>
              )}
              {c.status === "Closed" && (
                <>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => action("share")}
                  >
                    <Copy size={14} />
                    Ссылка для просмотра
                  </Button>
                  <p className="form-help">
                    Контракт закрыт и недоступен для редактирования. Новые
                    условия оформляются отдельным контрактом.
                  </p>
                </>
              )}
              {["Signed", "Closed"].includes(c.status) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm("revoke_links")}
                >
                  Отозвать все ссылки
                </Button>
              )}
              {["Draft", "Sent"].includes(c.status) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirm("cancel")}
                >
                  Отменить контракт
                </Button>
              )}
              {c.status === "Draft" && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => setConfirm("delete")}
                >
                  <Trash2 size={14} />
                  Удалить черновик
                </Button>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setContract(
                      (
                        await api<{ contract: Contract }>(
                          `/api/contracts/${c.id}`,
                        )
                      ).contract,
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={13} />
                Обновить статус
              </Button>
            </div>
          </Card>
          {c.final_sha256 && (
            <Card className="panel-body">
              <h3>Целостность PDF</h3>
              <p className="form-help" style={{ margin: "10px 0" }}>
                SHA-256 проверяется сервером перед скачиванием.
              </p>
              <div className="hash">{c.final_sha256}</div>
            </Card>
          )}
          <Card className="panel-body">
            <h3 style={{ marginBottom: 22 }}>История контракта</h3>
            {c.events?.map((e) => (
              <div className="event" key={e.id}>
                <p>{eventLabels[e.event] || e.event}</p>
                <small>
                  {new Date(e.created_at).toLocaleString("ru-RU", {
                    timeZone: "Asia/Tashkent",
                  })}
                </small>
              </div>
            ))}
          </Card>
        </div>
      </div>
      <Modal
        open={Boolean(link)}
        onOpenChange={(v) => {
          if (!v) setLink("");
        }}
        title="Поделиться контрактом"
        description="Передайте ссылку только нужному участнику. Срок действия — 7 дней."
      >
        <Field label="Защищённая ссылка">
          <Input value={link} readOnly />
        </Field>
        <div className="form-actions">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setError("Скопируйте ссылку вручную.");
              }
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}Скопировать
            ссылку
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(confirm)}
        onOpenChange={(v) => {
          if (!v && !busy) setConfirm(null);
        }}
        title={
          confirm === "revoke_links"
            ? "Отозвать ссылки?"
            : confirm === "close"
              ? "Закрыть контракт?"
              : confirm === "delete"
                ? "Удалить черновик?"
                : "Отменить контракт?"
        }
        description={
          confirm === "revoke_links"
            ? "Выданные ссылки перестанут открывать контракт. Уже скачанные файлы останутся у получателей."
            : confirm === "close"
              ? "Будет сформирован окончательный PDF. После закрытия изменить этот контракт нельзя."
              : confirm === "delete"
                ? "Черновик и связанные документы будут удалены. Это действие нельзя отменить."
                : "Ссылка на подписание перестанет работать. Для новых условий можно создать копию."
        }
      >
        <div className="form-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setConfirm(null)}
          >
            Назад
          </Button>
          <Button
            disabled={busy}
            variant={confirm === "close" ? "default" : "danger"}
            onClick={() => (confirm === "delete" ? remove() : action(confirm!))}
          >
            {busy ? <Spinner /> : null}
            {confirm === "revoke_links"
              ? "Отозвать ссылки"
              : confirm === "close"
                ? "Подтвердить закрытие"
                : confirm === "delete"
                  ? "Удалить"
                  : "Отменить контракт"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
