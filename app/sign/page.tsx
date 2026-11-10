"use client";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Download,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Card, Message, Spinner } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SignatureDialog } from "@/components/signature-pad";
import { PartyFields } from "@/components/party-fields";
import { DocumentContent, PartyPreview } from "@/components/document-content";
import {
  type Contract,
  type Party,
  blankParty,
  partySchema,
  roleLabels,
} from "@/lib/domain";
import { api } from "@/lib/utils";
export default function PublicSigning() {
  const [token, setToken] = useState(""),
    [c, setContract] = useState<Contract | null>(null),
    [canSign, setCanSign] = useState(false),
    [party, setParty] = useState<Party>(blankParty("customer")),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [step, setStep] = useState(0),
    [signing, setSigning] = useState(false),
    [done, setDone] = useState(false);
  async function load(value: string) {
    setError("");
    setLoading(true);
    try {
      if (!/^[a-f0-9]{64}$/.test(value))
        throw new Error(
          "В ссылке нет действующего приглашения. Попросите отправителя прислать новую ссылку.",
        );
      const data = await api<{ contract: Contract; canSign: boolean }>(
        "/api/public",
        {
          method: "POST",
          body: JSON.stringify({ action: "view", token: value }),
        },
      );
      setContract(data.contract);
      setCanSign(data.canSign);
      setParty(
        data.contract.parties?.find((p) => p.side === "recipient") ||
          blankParty(data.contract.recipient_role),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const value = window.location.hash.slice(1);
    setToken(value);
    void load(value);
  }, []);
  async function sign(signature: string) {
    if (!c) return;
    await api("/api/public", {
      method: "POST",
      body: JSON.stringify({
        action: "sign",
        token,
        signature,
        party,
        versionId: c.current_version_id,
        consent: true,
      }),
    });
    setDone(true);
    setCanSign(false);
    await load(token);
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", token }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = `${c?.number || "contract"}.pdf`;
      a.click();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const original = c?.files?.find((f) => f.kind === "original");
  return (
    <div className="public-shell">
      <header className="public-header">
        <Brand />
        <small>
          <ShieldCheck
            size={13}
            style={{ display: "inline", marginRight: 6 }}
          />
          Персональное приглашение
        </small>
      </header>
      {loading ? (
        <div className="loading">
          <Spinner />
          Открываем контракт…
        </div>
      ) : (
        <>
          {error && (
            <div className="notice-block">
              <Message>{error}</Message>
            </div>
          )}
          {c && (
            <>
              <div className="public-heading">
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  {c.status === "Closed"
                    ? "КОНТРАКТ ЗАКРЫТ"
                    : done || c.status === "Signed"
                      ? "ПОДПИСЬ ПРИНЯТА"
                      : "ВАС ПРИГЛАСИЛИ ПОДПИСАТЬ КОНТРАКТ"}
                </div>
                <h1>{c.title}</h1>
                <p>
                  {c.parties?.find((p) => p.side === "creator")?.name} · Вы
                  выступаете как {roleLabels[c.recipient_role].toLowerCase()}
                </p>
              </div>
              {canSign && (
                <div className="public-steps">
                  <span className={step === 0 ? "current" : ""}>
                    01 · Проверьте документ
                  </span>
                  <span className={step === 1 ? "current" : ""}>
                    02 · Ваши данные
                  </span>
                  <span>03 · Подпись</span>
                </div>
              )}
              {(done || c.status === "Signed") && (
                <Card className="success-panel" style={{ marginBottom: 25 }}>
                  <CheckCircle2 size={42} />
                  <h2>Ваша подпись принята</h2>
                  <p>
                    Отправитель проверит данные и закроет контракт.
                    <br />
                    Окончательный PDF появится здесь после закрытия.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => load(token)}
                    style={{ marginTop: 20 }}
                  >
                    <RefreshCw size={14} />
                    Проверить статус
                  </Button>
                </Card>
              )}
              {c.status === "Closed" && (
                <Card
                  className="panel-body"
                  style={{
                    marginBottom: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 15,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3>{c.number}</h3>
                    <p className="form-help" style={{ marginTop: 7 }}>
                      Обе стороны подписали. Документ недоступен для изменений.
                    </p>
                  </div>
                  <Button onClick={download} disabled={busy}>
                    {busy ? <Spinner /> : <Download size={15} />}Скачать PDF
                  </Button>
                </Card>
              )}
              {step === 0 || !canSign ? (
                <div className="document-preview">
                  <div className="eyebrow">ВЕРСИЯ {c.version?.version}</div>
                  <h2 className="document-title">{c.title}</h2>
                  {c.source_kind === "pdf" && original?.url ? (
                    <>
                      <iframe
                        title="Документ для подписания"
                        src={original.url}
                        className="file-frame"
                      />
                      <a
                        href={original.url}
                        target="_blank"
                        rel="noreferrer"
                        className="form-help"
                      >
                        Открыть PDF отдельно ↗
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
              ) : (
                <Card>
                  <div className="panel-heading">
                    <h2>Ваши реквизиты</h2>
                    <p>
                      Роль в приглашении: {roleLabels[c.recipient_role]}. Если
                      роль указана неверно, попросите отправителя исправить
                      приглашение.
                    </p>
                  </div>
                  <div className="panel-body">
                    <PartyFields value={party} onChange={setParty} />
                  </div>
                </Card>
              )}
              {canSign && (
                <div className="form-actions">
                  {step === 1 && (
                    <Button variant="secondary" onClick={() => setStep(0)}>
                      Назад к документу
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setError("");
                      if (step === 0) {
                        setStep(1);
                        return;
                      }
                      const result = partySchema.safeParse(party);
                      if (!result.success) {
                        setError(result.error.issues[0].message);
                        return;
                      }
                      setSigning(true);
                    }}
                  >
                    {step === 0
                      ? "Заполнить мои данные"
                      : "Перейти к подписанию"}
                    <ArrowRight size={15} />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
      <footer className="public-footer">
        Графическая подпись не является квалифицированной ЭЦП.
        <br />
        Digital Contract by Vertex Studio · A Vertex Studio Product
      </footer>
      <SignatureDialog
        open={signing}
        onOpenChange={setSigning}
        onConfirm={sign}
      />
    </div>
  );
}
