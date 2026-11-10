import {
  owner,
  readContract,
  storeFile,
  mutate,
  sha256,
  discardUnreferenced,
} from "@/lib/contracts";
import { inspectDocument } from "@/lib/documents";
import { readUpload } from "@/lib/upload";
import { fail, json, sameOrigin, HttpError } from "@/lib/http";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(req);
    const user = await owner(),
      id = (await ctx.params).id,
      c = await readContract(id, user.id);
    if (c.status !== "Draft")
      throw new HttpError("Документ уже зафиксирован.", 409);
    const { name, bytes } = await readUpload(req);
    const { kind } = await inspectDocument(name, bytes);
    if (kind !== c.source_kind)
      throw new HttpError("Тип оригинала не совпадает с контрактом.");
    const existing = c.files?.find((f) => f.kind === "original");
    if (existing) {
      if (existing.sha256 === sha256(bytes)) return json({ uploaded: true });
      throw new HttpError(
        "Оригинал уже сохранён. Для другого файла создайте новый контракт.",
        409,
      );
    }
    const mime =
      kind === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const path = await storeFile("originals", id, bytes, kind, mime);
    await mutate("attach", user.id, id, {
      path,
      name: name.slice(0, 200),
      mime,
      sha256: sha256(bytes),
    });
    await discardUnreferenced("originals", path);
    return json({ uploaded: true });
  } catch (e) {
    return fail(e);
  }
}
