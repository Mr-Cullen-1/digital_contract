import { ZodError } from "zod";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function fail(e: unknown) {
  if (e instanceof ZodError)
    return json(
      { error: e.issues[0]?.message || "Проверьте заполненные поля." },
      400,
    );
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  return json(
    {
      error:
        "Не удалось выполнить действие. Проверьте подключение и повторите попытку.",
    },
    500,
  );
}
export function requestOrigin(request: Request) {
  const url = new URL(request.url),
    host = request.headers.get("host");
  // Next normalizes the internal URL to localhost. Preserve only known loopback Host values.
  if (
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    host &&
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  )
    return `${url.protocol}//${host}`;
  if (process.env.NEXT_PUBLIC_APP_URL)
    return new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
  return url.origin;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin(request))
    throw new HttpError("Недопустимый источник запроса.", 403);
}
export async function readJson(request: Request) {
  const max = 700000;
  if (Number(request.headers.get("content-length") || 0) > max)
    throw new HttpError("Слишком большой запрос.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Пустой запрос.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError("Слишком большой запрос.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError("Некорректный запрос.");
  }
}
