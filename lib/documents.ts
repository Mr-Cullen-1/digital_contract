import sharp from "sharp";
import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";
import { validateDocxZip } from "./zip";
import { HttpError } from "./http";
import { signatureSchema, type DocNode } from "./domain";
import { MAX_UPLOAD, MAX_UPLOAD_LABEL } from "./limits";
export { MAX_UPLOAD } from "./limits";
export function validateUpload(name: string, bytes: Buffer): "pdf" | "docx" {
  if (bytes.length > MAX_UPLOAD || !bytes.length)
    throw new Error(
      `Размер файла должен быть от 1 байта до ${MAX_UPLOAD_LABEL}.`,
    );
  if (
    name.toLowerCase().endsWith(".pdf") &&
    bytes.subarray(0, 5).toString() === "%PDF-"
  )
    return "pdf";
  if (
    name.toLowerCase().endsWith(".docx") &&
    bytes.length >= 4 &&
    bytes.readUInt16LE(0) === 0x4b50
  ) {
    validateDocxZip(bytes);
    return "docx";
  }
  throw new Error("Выберите корректный PDF или DOCX.");
}
export function plainTextDocument(text: string): DocNode {
  return {
    type: "doc",
    content: text
      .slice(0, 100000)
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };
}
export async function importDocx(bytes: Buffer) {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  if (value.length > 100000)
    throw new Error("Текст документа превышает 100 000 символов.");
  return plainTextDocument(value);
}
export async function inspectDocument(
  name: string,
  bytes: Buffer,
): Promise<{ kind: "pdf" | "docx"; pages?: number; content?: DocNode }> {
  try {
    const kind = validateUpload(name, bytes);
    if (kind === "pdf") {
      const doc = await PDFDocument.load(bytes);
      if (doc.getPageCount() < 1 || doc.getPageCount() > 150)
        throw new Error("PDF должен содержать от 1 до 150 страниц.");
      return { kind, pages: doc.getPageCount() };
    }
    return { kind, content: await importDocx(bytes) };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(
      `Не удалось прочитать документ. Нужен корректный PDF без пароля (до 150 страниц) или DOCX размером до ${MAX_UPLOAD_LABEL}.`,
    );
  }
}
export async function validateSignature(value: string) {
  signatureSchema.parse(value);
  const bytes = Buffer.from(value.split(",")[1], "base64");
  const decoder = sharp(bytes, { limitInputPixels: 2000000 });
  const meta = await decoder.metadata();
  if (
    meta.format !== "png" ||
    !meta.width ||
    !meta.height ||
    meta.width > 2000 ||
    meta.height > 1000 ||
    meta.width < 30 ||
    meta.height < 20
  )
    throw new Error("Некорректное изображение подписи.");
  const pixels = await decoder
    .flatten({ background: "white" })
    .greyscale()
    .raw()
    .toBuffer();
  let ink = 0;
  for (const p of pixels) if (p < 150) ink++;
  if (ink < 30 || ink > pixels.length * 0.7)
    throw new Error("Нарисуйте подпись в белом поле.");
  return bytes;
}
