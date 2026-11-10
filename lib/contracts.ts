import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { adminClient, requireUser } from "./supabase/server";
import { serverConfigured } from "./supabase/config";
import {
  type Contract,
  type ContractFile,
  type Party,
  partySchema,
} from "./domain";
import { HttpError } from "./http";
import { validateSignature } from "./documents";
import { createFinalPdf } from "./pdf";
export const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export async function owner() {
  if (!serverConfigured())
    throw new HttpError(
      "Supabase не подключён. Настройте подключение, чтобы сохранять и отправлять контракты.",
      503,
    );
  try {
    return await requireUser();
  } catch {
    throw new HttpError("Войдите в аккаунт, чтобы продолжить.", 401);
  }
}
export async function mutate(
  action: string,
  ownerId: string | null,
  id: string | null,
  data: object = {},
) {
  const { data: result, error } = await adminClient().rpc("vc_mutate", {
    p_action: action,
    p_owner: ownerId,
    p_id: id,
    p_data: data,
  });
  if (error)
    throw new HttpError(
      "Действие недоступно: статус, версия или права доступа изменились. Обновите страницу.",
      409,
    );
  return result as Record<string, string>;
}
export async function readContract(
  id: string,
  ownerId?: string,
): Promise<Contract> {
  z.uuid().parse(id);
  const db = adminClient();
  let query = db.from("contracts").select("*").eq("id", id);
  if (ownerId) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.single();
  if (error || !data)
    throw new HttpError("Контракт не найден или недоступен.", 404);
  const [parties, version, files, signatures, events] = await Promise.all([
    db.from("contract_parties").select("*").eq("contract_id", id),
    db
      .from("contract_versions")
      .select("*")
      .eq("id", data.current_version_id)
      .single(),
    db.from("contract_files").select("*").eq("contract_id", id),
    db.from("contract_signatures").select("*").eq("contract_id", id),
    db
      .from("contract_events")
      .select("id,event,created_at")
      .eq("contract_id", id)
      .order("created_at"),
  ]);
  if ([parties, version, files, signatures, events].some((r) => r.error))
    throw new HttpError("Не удалось прочитать документ.", 503);
  return {
    ...data,
    parties: parties.data,
    version: version.data,
    files: files.data,
    signatures: signatures.data,
    events: events.data,
  } as Contract;
}
export async function withUrls(c: Contract) {
  const db = adminClient();
  const link = async (bucket: string, path: string) => {
    const { data, error } = await db.storage
      .from(bucket)
      .createSignedUrl(path, 60);
    if (error) throw new HttpError("Не удалось открыть файл.", 503);
    return data.signedUrl;
  };
  return {
    ...c,
    files: await Promise.all(
      (c.files || []).map(async (f) => ({
        ...f,
        url: await link(f.bucket, f.path),
      })),
    ),
    signatures: await Promise.all(
      (c.signatures || []).map(async (s) => ({
        side: s.side,
        signed_at: s.signed_at,
        url: await link("signatures", (s as unknown as { path: string }).path),
      })),
    ),
  };
}
export async function storeFile(
  bucket: string,
  id: string,
  bytes: Uint8Array,
  extension: string,
  mime: string,
) {
  const path = `${id}/${randomUUID()}.${extension}`;
  const { error } = await adminClient()
    .storage.from(bucket)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error)
    throw new HttpError("Не удалось сохранить файл. Повторите попытку.", 503);
  return path;
}
export async function fileBytes(
  file: Pick<ContractFile, "bucket" | "path" | "sha256">,
) {
  const { data, error } = await adminClient()
    .storage.from(file.bucket)
    .download(file.path);
  if (error || !data) throw new HttpError("Файл недоступен.", 503);
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (sha256(bytes) !== file.sha256)
    throw new HttpError(
      "Контрольная сумма файла не совпадает. Скачивание остановлено.",
      409,
    );
  return bytes;
}
export async function signingData(signature: string, id: string) {
  let bytes: Buffer;
  try {
    bytes = await validateSignature(signature);
  } catch {
    throw new HttpError("Нарисуйте корректную подпись в белом поле.", 400);
  }
  return {
    signaturePath: await storeFile("signatures", id, bytes, "png", "image/png"),
    signatureHash: sha256(bytes),
  };
}
export async function verifiedDownload(
  file: Pick<ContractFile, "bucket" | "path" | "sha256">,
  name: string,
) {
  await fileBytes(file);
  const { data, error } = await adminClient()
    .storage.from(file.bucket)
    .createSignedUrl(file.path, 60, { download: name });
  if (error || !data)
    throw new HttpError("Не удалось создать ссылку для скачивания.", 503);
  return { url: data.signedUrl, sha256: file.sha256 };
}
// Only call after an acknowledged successful mutation. On a lost RPC response the
// transaction can still commit, so retain its object for later reconciliation.
export async function discardUnreferenced(bucket: string, path: string) {
  try {
    const db = adminClient();
    const [file, signature] = await Promise.all([
      db.from("contract_files").select("id").eq("path", path).limit(1),
      db.from("contract_signatures").select("id").eq("path", path).limit(1),
    ]);
    if (
      file.error ||
      signature.error ||
      file.data.length ||
      signature.data.length
    )
      return;
    await db.storage.from(bucket).remove([path]);
  } catch {
    /* A transient cleanup failure must never undo a completed signature. */
  }
}
export async function applySignature(
  action: "send" | "sign",
  ownerId: string | null,
  id: string,
  signature: string,
  data: object,
) {
  const stored = await signingData(signature, id);
  const result = await mutate(action, ownerId, id, { ...data, ...stored });
  await discardUnreferenced("signatures", stored.signaturePath);
  return result;
}
export async function tokenContract(token: string) {
  if (!serverConfigured())
    throw new HttpError("Сервис пока не подключён к базе.", 503);
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(token);
  const hash = sha256(token);
  const { data, error } = await adminClient()
    .from("contract_links")
    .select("*")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();
  if (error || !data)
    throw new HttpError(
      "Ссылка недействительна, отозвана или срок её действия истёк.",
      404,
    );
  const c = await readContract(data.contract_id);
  if (c.status === "Cancelled" || c.current_version_id !== data.version_id)
    throw new HttpError("Это приглашение больше не действует.", 410);
  return { contract: c, link: data, hash };
}
export async function closeContract(id: string, ownerId: string) {
  const c = await readContract(id, ownerId);
  if (c.status === "Closed") return c;
  const reservation = await mutate("reserve_close", ownerId, id);
  const creator = partySchema.parse(
      c.parties?.find((p) => p.side === "creator"),
    ),
    recipient = partySchema.parse(
      c.parties?.find((p) => p.side === "recipient"),
    );
  const signatures = await adminClient()
    .from("contract_signatures")
    .select("*")
    .eq("contract_id", id)
    .eq("version_id", c.current_version_id);
  if (signatures.error) throw new HttpError("Подписи недоступны.", 503);
  const getSignature = async (side: string) => {
    const s = signatures.data.find((s) => s.side === side);
    if (!s) throw new HttpError("Не хватает подписи стороны.");
    return fileBytes({ bucket: "signatures", path: s.path, sha256: s.sha256 });
  };
  const original = c.files?.find((f) => f.kind === "original");
  const bytes = await createFinalPdf({
    title: c.title,
    number: reservation.number,
    closedAt: reservation.reserved_at,
    content: c.version!.content,
    creator: creator as Party,
    recipient: recipient as Party,
    creatorSignature: await getSignature("creator"),
    recipientSignature: await getSignature("recipient"),
    originalPdf:
      c.source_kind === "pdf" && original
        ? await fileBytes(original)
        : undefined,
  });
  const hash = sha256(bytes),
    path = await storeFile("finals", id, bytes, "pdf", "application/pdf");
  await fileBytes({ bucket: "finals", path, sha256: hash });
  await mutate("complete_close", ownerId, id, {
    number: reservation.number,
    path,
    sha256: hash,
  });
  await discardUnreferenced("finals", path);
  return readContract(id, ownerId);
}
