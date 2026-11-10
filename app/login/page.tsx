"use client";
import { useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Card,
  Field,
  Input,
  Message,
  Spinner,
} from "@/components/ui/primitives";
import { browserClient } from "@/lib/supabase/client";
import { configured } from "@/lib/supabase/config";
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const client = browserClient();
      const result = signup
        ? await client.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error)
        throw new Error(
          signup
            ? "Не удалось создать аккаунт. Проверьте email и пароль."
            : "Не удалось войти. Проверьте данные и подтверждение email.",
        );
      if (signup && !result.data.session)
        setNotice(
          "Проверьте почту и подтвердите email, затем войдите в аккаунт.",
        );
      else window.location.assign("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <Card className="auth-card">
        <Brand />
        <h1>
          {signup ? "Ваше рабочее пространство" : "Рады видеть вас снова"}
        </h1>
        <p>
          Контракты, подписи и договорённости —<br />в одном месте.
        </p>
        {!configured() ? (
          <>
            <Message>
              Supabase пока не подключён. Локальный интерфейс доступен без
              входа.
            </Message>
            <Button asChild className="wide-button" style={{ marginTop: 20 }}>
              <Link href="/">Открыть локальную версию</Link>
            </Button>
          </>
        ) : (
          <form onSubmit={submit} className="form-stack">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </Field>
            <Field label="Пароль">
              <Input
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Не менее 8 символов"
              />
            </Field>
            {error && <Message>{error}</Message>}
            {notice && <Message success>{notice}</Message>}
            <Button disabled={busy}>
              {busy ? <Spinner /> : null}
              {signup ? "Создать аккаунт" : "Войти"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSignup(!signup);
                setError("");
                setNotice("");
              }}
            >
              {signup ? "Уже есть аккаунт? Войти" : "Создать аккаунт"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await browserClient().auth.signOut();
                setNotice("Вы вышли из аккаунта.");
              }}
            >
              Выйти из текущего аккаунта
            </Button>
          </form>
        )}
        <div className="public-footer">A Vertex Studio Product</div>
      </Card>
    </div>
  );
}
