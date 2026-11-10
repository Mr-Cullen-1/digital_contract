"use client";
import { MAX_UPLOAD, MAX_UPLOAD_LABEL } from "@/lib/limits";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Save,
  Send,
  Upload,
  FileText,
  ArrowUpRight,
  ShieldCheck,
  Copy,
  Check,
  PenLine,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, Field, Input, Message, Spinner, Modal } from "./ui/primitives";
import { PartyFields } from "./party-fields";
import { RichEditor } from "./rich-editor";
import { SignatureDialog } from "./signature-pad";
import { DocumentContent, PartyPreview } from "./document-content";
import {
  type Contract,
  type DocNode,
  type Party,
  type Role,
  emptyDoc,
  blankParty,
  partySchema,
  draftSchema,
  documentText,
} from "@/lib/domain";
import { templates } from "@/lib/templates";
import { api } from "@/lib/utils";
export function ContractEditor({
  initial,
  upload = false,
  configured,
}: {
  initial?: Contract;
  upload?: boolean;
  configured: boolean;
}) {
  const params = useSearchParams(),
    router = useRouter();
  const template = templates.find((t) => t.id === params.get("template"));
  const [id, setId] = useState(initial?.id || ""),
    [title, setTitle] = useState(initial?.title || template?.title || ""),
    [content, setContent] = useState<DocNode>(
      initial?.version?.content || template?.content || emptyDoc,
    ),
    [editorKey, setEditorKey] = useState(0);
  const [creator, setCreator] = useState<Party>(
      initial?.parties?.find((p) => p.side === "creator") || blankParty(),
    ),
    [recipientRole, setRole] = useState<Role>(
      initial?.recipient_role || "customer",
    );
  const [sourceKind, setKind] = useState<"editor" | "docx" | "pdf">(
      initial?.source_kind || "editor",
    ),
    [file, setFile] = useState<File | null>(null),
    [fileUrl, setFileUrl] = useState(""),
    [uploaded, setUploaded] = useState(
      Boolean(initial?.files?.some((f) => f.kind === "original")),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [preview, setPreview] = useState(false),
    [signing, setSigning] = useState(false),
    [share, setShare] = useState(""),
    [copied, setCopied] = useState(false),
    [drag, setDrag] = useState(false);
  const dirty = useRef(false),
    picker = useRef<HTMLInputElement>(null);
  const changed = () => {
    dirty.current = true;
    setNotice("");
  };
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a");
      if (
        dirty.current &&
        link &&
        link.href &&
        new URL(link.href).origin === location.origin &&
        !link.target
      ) {
        if (
          !window.confirm("Есть несохранённые изменения. Покинуть страницу?")
        ) {
          e.preventDefault();
          e.stopPropagation();
        } else dirty.current = false;
      }
    };
    window.addEventListener("beforeunload", listener);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", listener);
      document.removeEventListener("click", navigate, true);
    };
  }, []);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const data = () => ({
    title,
    content,
    creator: {
      ...creator,
      role: recipientRole === "customer" ? "provider" : "customer",
    },
    recipientRole,
    sourceKind,
  });
  async function chooseFile(f?: File) {
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      if (f.size > MAX_UPLOAD)
        throw new Error(`Максимальный размер файла — ${MAX_UPLOAD_LABEL}.`);
      const form = new FormData();
      form.set("file", f);
      const result = await api<{
        kind: "pdf" | "docx";
        content?: DocNode;
        name: string;
      }>("/api/import", { method: "POST", body: form });
      setFile(f);
      setKind(result.kind);
      setTitle(f.name.replace(/\.(pdf|docx)$/i, ""));
      if (result.content) {
        setContent(result.content);
        setEditorKey((k) => k + 1);
      }
      setUploaded(false);
      changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function persist() {
    if (!configured)
      throw new Error(
        "Для сохранения подключите Supabase. Сейчас документ доступен только в этой вкладке.",
      );
    const parsed = draftSchema.safeParse(data());
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const result = await api<{ id: string; versionId: string }>(
      id ? `/api/contracts/${id}` : "/api/contracts",
      { method: id ? "PATCH" : "POST", body: JSON.stringify(parsed.data) },
    );
    setId(result.id);
    if (file && !uploaded) {
      const form = new FormData();
      form.set("file", file);
      await api(`/api/contracts/${result.id}/upload`, {
        method: "POST",
        body: form,
      });
      setUploaded(true);
    }
    dirty.current = false;
    return result;
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await persist();
      setNotice("Черновик сохранён в Supabase.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function startSign() {
    setError("");
    const parsed = partySchema.safeParse({
      ...creator,
      role: recipientRole === "customer" ? "provider" : "customer",
    });
    if (!title.trim()) {
      setError("Введите название контракта.");
      return;
    }
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (sourceKind !== "pdf" && !documentText(content).trim()) {
      setError("Добавьте условия контракта.");
      return;
    }
    setSigning(true);
  }
  async function sign(png: string) {
    const result = await persist();
    const sent = await api<{ url: string }>(
      `/api/contracts/${result.id}/action`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "send",
          signature: png,
          versionId: result.versionId,
          consent: true,
        }),
      },
    );
    setShare(sent.url);
    dirty.current = false;
  }
  const originalUrl =
    fileUrl || initial?.files?.find((f) => f.kind === "original")?.url;
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
              gap: 5,
              alignItems: "center",
              marginBottom: 13,
            }}
          >
            <ArrowLeft size={13} />
            Все контракты
          </Link>
          <h1>
            {upload && !file
              ? "Загрузить контракт"
              : initial
                ? "Редактировать контракт"
                : "Новый контракт"}
          </h1>
          <p>
            {upload
              ? "Ваш документ — основа. Мы поможем с остальным."
              : "Зафиксируйте условия. Остальное займёт несколько шагов."}
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="secondary" onClick={() => setPreview(!preview)}>
            <Eye size={15} />
            {preview ? "К редактору" : "Предпросмотр"}
          </Button>
          <Button variant="secondary" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <Save size={15} />}Сохранить черновик
          </Button>
        </div>
      </div>
      {error && (
        <div className="notice-block">
          <Message>{error}</Message>
        </div>
      )}
      {notice && (
        <div className="notice-block">
          <Message success>{notice}</Message>
        </div>
      )}
      {!configured && (
        <div className="notice-block">
          <Message>
            Локальная версия: можно подготовить и просмотреть документ.
            Сохранение и отправка требуют подключения Supabase.
          </Message>
        </div>
      )}
      {upload && !file && !initial ? (
        <Card className="panel-body">
          <input
            ref={picker}
            type="file"
            accept=".pdf,.docx"
            className="sr-only"
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <button
            className={`upload-zone wide-button ${drag ? "dragging" : ""}`}
            disabled={busy}
            onClick={() => picker.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              chooseFile(e.dataTransfer.files[0]);
            }}
          >
            {busy ? <Spinner /> : <Upload size={34} />}
            <h3>Перетащите документ сюда</h3>
            <p>или нажмите, чтобы выбрать файл</p>
            <small>PDF или DOCX · до {MAX_UPLOAD_LABEL}</small>
          </button>
          <div className="bottom-grid">
            <div>
              <h3>Документ Word</h3>
              <p className="form-help" style={{ marginTop: 9 }}>
                Извлечём текст для редактирования. Оригинал сохраним отдельно.
                Проверьте форматирование после импорта.
              </p>
            </div>
            <div>
              <h3>Документ PDF</h3>
              <p className="form-help" style={{ marginTop: 9 }}>
                Сохраним исходные страницы. Реквизиты и подписи добавим
                отдельным листом в конце документа.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="editor-grid">
          <div className="detail-stack">
            {preview ? (
              <div className="document-preview">
                <div className="eyebrow">ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР</div>
                <h2 className="document-title">
                  {title || "Название контракта"}
                </h2>
                {sourceKind === "pdf" && originalUrl ? (
                  <>
                    <iframe
                      title="Оригинальный PDF"
                      className="file-frame"
                      src={originalUrl}
                    />
                    <a
                      href={originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="form-help"
                    >
                      Открыть оригинал отдельно ↗
                    </a>
                  </>
                ) : (
                  <DocumentContent content={content} />
                )}
                <div className="document-parties">
                  <PartyPreview
                    party={{
                      ...creator,
                      role:
                        recipientRole === "customer" ? "provider" : "customer",
                    }}
                  />
                  <PartyPreview />
                </div>
              </div>
            ) : (
              <>
                <Card>
                  <div className="panel-body">
                    <Field label="Название контракта">
                      <Input
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          changed();
                        }}
                        placeholder="Например, договор на разработку сайта"
                        maxLength={200}
                      />
                    </Field>
                  </div>
                </Card>
                <Card>
                  {sourceKind === "pdf" ? (
                    <div className="panel-body">
                      <h3>Оригинальный PDF</h3>
                      <p className="form-help" style={{ marginTop: 10 }}>
                        Исходные страницы останутся без изменений. Реквизиты и
                        обе подписи будут добавлены отдельным листом.
                      </p>
                      {originalUrl && (
                        <iframe
                          title="Оригинальный PDF"
                          className="file-frame"
                          src={originalUrl}
                        />
                      )}
                    </div>
                  ) : (
                    <RichEditor
                      key={editorKey}
                      content={content}
                      onChange={(doc) => {
                        setContent(doc);
                        changed();
                      }}
                    />
                  )}
                </Card>
                <Card>
                  <div className="panel-heading">
                    <h2>Ваши реквизиты</h2>
                    <p>
                      Вы выступаете как{" "}
                      {recipientRole === "customer"
                        ? "исполнитель"
                        : "заказчик"}
                      .
                    </p>
                  </div>
                  <div className="panel-body">
                    <PartyFields
                      value={creator}
                      onChange={(p) => {
                        setCreator(p);
                        changed();
                      }}
                    />
                  </div>
                </Card>
              </>
            )}
            {file && (
              <div className="file-selected">
                <FileText size={24} />
                <div>
                  <strong>{file.name}</strong>
                  <p>
                    {(file.size / 1024).toFixed(0)} КБ · оригинал{" "}
                    {uploaded ? "сохранён" : "будет сохранён с черновиком"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="detail-stack sticky-panel">
            <Card>
              <div className="panel-heading">
                <div className="step-label">УЧАСТНИКИ КОНТРАКТА</div>
                <h3>Кто вторая сторона?</h3>
                <p>Получатель заполнит свои данные по ссылке.</p>
              </div>
              <div className="panel-body form-stack">
                <div className="role-options">
                  {(["customer", "provider"] as Role[]).map((r) => (
                    <button
                      type="button"
                      className={`role-option ${recipientRole === r ? "selected" : ""}`}
                      key={r}
                      onClick={() => {
                        setRole(r);
                        changed();
                      }}
                    >
                      {r === "customer" ? "Заказчик" : "Исполнитель"}
                    </button>
                  ))}
                </div>
                <p className="form-help">
                  Регистрация не потребуется. Ссылка на подписание будет
                  действовать 7 дней.
                </p>
                <Button
                  onClick={startSign}
                  disabled={busy}
                  className="wide-button"
                >
                  <Send size={14} />
                  Отправить на подписание
                </Button>
                <p className="form-help">
                  Сначала вы поставите свою подпись. После отправки текст
                  контракта будет зафиксирован.
                </p>
              </div>
            </Card>
            <Card className="panel-body">
              <ShieldCheck size={21} color="#16A37A" />
              <h3 style={{ margin: "13px 0 8px" }}>
                Проверьте перед отправкой
              </h3>
              <p className="form-help">
                Название, условия и реквизиты должны быть заполнены. Изменение
                отправленного документа потребует нового черновика и новых
                подписей.
              </p>
            </Card>
            <Link
              href="/templates"
              className="form-help"
              style={{ display: "flex", gap: 6, alignItems: "center" }}
            >
              <PenLine size={13} />
              Нужна основа? Выберите шаблон
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      )}
      <SignatureDialog
        open={signing}
        onOpenChange={setSigning}
        onConfirm={sign}
      />
      <Modal
        open={Boolean(share)}
        onOpenChange={(v) => {
          if (!v) router.push(`/contracts/${id}`);
        }}
        title="Контракт готов к подписанию"
        description="Скопируйте ссылку и передайте второй стороне. Регистрация получателю не нужна."
      >
        <Field label="Приглашение · действует 7 дней">
          <Input readOnly value={share} />
        </Field>
        <div className="form-actions">
          <Button
            variant="secondary"
            onClick={() => router.push(`/contracts/${id}`)}
          >
            Открыть контракт
          </Button>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share);
                setCopied(true);
              } catch {
                setError("Скопируйте ссылку вручную из поля.");
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}Скопировать
            ссылку
          </Button>
        </div>
      </Modal>
    </>
  );
}
