import { HttpError } from "./http";
import { MAX_MULTIPART, MAX_UPLOAD, MAX_UPLOAD_LABEL } from "./limits";
export async function readUpload(req: Request) {
  const max = MAX_MULTIPART;
  if (Number(req.headers.get("content-length") || 0) > max)
    throw new HttpError(
      `Максимальный размер файла — ${MAX_UPLOAD_LABEL}.`,
      413,
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError("Файл не найден.");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(
        `Максимальный размер файла — ${MAX_UPLOAD_LABEL}.`,
        413,
      );
    }
    chunks.push(value);
  }
  const reconstructed = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": req.headers.get("content-type") || "" },
    body: Buffer.concat(chunks),
  });
  const form = await reconstructed.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError("Выберите документ.");
  if (file.size > MAX_UPLOAD)
    throw new HttpError(
      `Максимальный размер файла — ${MAX_UPLOAD_LABEL}.`,
      413,
    );
  return { name: file.name, bytes: Buffer.from(await file.arrayBuffer()) };
}
