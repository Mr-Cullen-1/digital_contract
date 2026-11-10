import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import {
  validateSignature,
  validateUpload,
  plainTextDocument,
  inspectDocument,
} from "../lib/documents";
import { createFinalPdf } from "../lib/pdf";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import JSZip from "jszip";
describe("document boundaries", () => {
  it("rejects uploads above the Vercel-compatible 4 MiB application limit", () => {
    const bytes = Buffer.alloc(4 * 1024 * 1024 + 1);
    bytes.write("%PDF-1.7");
    expect(() => validateUpload("large.pdf", bytes)).toThrow();
  });
  it("extracts a real DOCX as text and rejects a forged ZIP expansion size", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    );
    zip.file(
      "_rels/.rels",
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    );
    zip.file(
      "word/document.xml",
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Проверка импорта</w:t></w:r></w:p></w:body></w:document>',
    );
    const bytes = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    const result = await inspectDocument("test.docx", bytes);
    expect(result.content?.content?.[0].content?.[0].text).toBe(
      "Проверка импорта",
    );
    const forged = Buffer.from(bytes);
    const central = forged.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    forged.writeUInt32LE(1, central + 24);
    await expect(inspectDocument("bad.docx", forged)).rejects.toThrow();
  });
  it("rejects embedded false EOCD that hides an oversized decompressed entry", async () => {
    const zip = new JSZip();
    const fake = Buffer.alloc(22);
    fake.writeUInt32LE(0x06054b50, 0);
    zip.file("fake.bin", fake, { compression: "STORE" });
    zip.file("large.bin", Buffer.alloc(41 * 1024 * 1024, 65), {
      compression: "DEFLATE",
    });
    const bytes = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });
    expect(() => validateUpload("attack.docx", bytes)).toThrow();
  });
  it("rejects empty white signature, accepts drawn pixels", async () => {
    const blank = await sharp({
      create: { width: 400, height: 150, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      validateSignature(`data:image/png;base64,${blank.toString("base64")}`),
    ).rejects.toThrow();
    const drawn = await sharp(
      Buffer.from(
        '<svg width="400" height="150"><rect width="400" height="150" fill="white"/><path d="M30 100 L100 30 L120 105 L250 50" fill="none" stroke="black" stroke-width="3"/></svg>',
      ),
    )
      .png()
      .toBuffer();
    expect(
      (
        await validateSignature(
          `data:image/png;base64,${drawn.toString("base64")}`,
        )
      ).length,
    ).toBeGreaterThan(100);
  });
  it("rejects disguised executables and oversized files", () => {
    expect(() =>
      validateUpload("fake.pdf", Buffer.from("MZ executable")),
    ).toThrow();
    expect(() =>
      validateUpload("huge.pdf", Buffer.alloc(11 * 1024 * 1024)),
    ).toThrow();
  });
  it("keeps imported markup as text, never executable HTML", () => {
    const doc = plainTextDocument("<script>alert(1)</script>\nУсловия");
    expect(doc.content?.[0].content?.[0].text).toBe(
      "<script>alert(1)</script>",
    );
  });
  it("preserves original PDF pages and appends both parties and signatures", async () => {
    const source = await PDFDocument.create();
    source.addPage([200, 300]);
    const signature = await sharp({
      create: { width: 100, height: 50, channels: 3, background: "#333333" },
    })
      .png()
      .toBuffer();
    const p = {
      name: "Тестовый участник",
      address: "Ташкент",
      phone: "+998901234567",
      pinfl: "12345678901234",
      passport: "",
      role: "customer" as const,
    };
    const result = await createFinalPdf({
      title: "Договор об услугах",
      number: "CTR-2026-000001",
      closedAt: "2026-11-10T06:00:00Z",
      content: plainTextDocument("Тестовые условия"),
      creator: p,
      recipient: { ...p, role: "provider" },
      creatorSignature: signature,
      recipientSignature: signature,
      originalPdf: await source.save(),
    });
    const pdf = await PDFDocument.load(result);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdf.getPage(0).getWidth()).toBe(200);
    expect(pdf.getTitle()).toBe("Договор об услугах");
    const parsed = await getDocument({
      data: result,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;
    const text = (await (await parsed.getPage(2)).getTextContent()).items
      .map((i) => ("str" in i ? i.str : ""))
      .join("")
      .replace(/\s+/g, " ");
    expect(text).toContain("Тестовый участник");
    expect(text).toContain("Телефон: +998901234567");
    expect(text).not.toContain("?");
    await parsed.cleanup();
  });
  it("preserves numbered list labels and hard line breaks in final content", async () => {
    const signature = await sharp({
      create: { width: 100, height: 50, channels: 3, background: "#333333" },
    })
      .png()
      .toBuffer();
    const p = {
      name: "Test",
      address: "Tashkent",
      phone: "+998901234567",
      pinfl: "12345678901234",
      passport: "",
      role: "customer" as const,
    };
    const result = await createFinalPdf({
      title: "Test",
      number: "CTR-2026-000002",
      closedAt: "2026-11-10T06:00:00Z",
      content: {
        type: "doc",
        content: [
          {
            type: "orderedList",
            attrs: { start: 3 },
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      { type: "text", text: "Первая строка" },
                      { type: "hardBreak" },
                      { type: "text", text: "Вторая строка" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      creator: p,
      recipient: { ...p, role: "provider" },
      creatorSignature: signature,
      recipientSignature: signature,
    });
    const parsed = await getDocument({
      data: result,
      useSystemFonts: true,
      disableFontFace: true,
    }).promise;
    const items = (
      await (await parsed.getPage(1)).getTextContent()
    ).items.filter((i) => "str" in i);
    const text = items
      .map((i) => ("str" in i ? i.str : ""))
      .join("")
      .replace(/\s+/g, " ");
    expect(text).toContain("3. Первая строка");
    expect(text).toContain("Вторая строка");
    expect(text).not.toContain("?");
    await parsed.cleanup();
  });
  it("rejects malformed PDFs and files above the page limit at the persistence boundary", async () => {
    await expect(
      inspectDocument("bad.pdf", Buffer.from("%PDF-1.7\nnot a PDF")),
    ).rejects.toThrow();
    const huge = await PDFDocument.create();
    for (let i = 0; i < 151; i++) huge.addPage();
    await expect(
      inspectDocument("huge.pdf", Buffer.from(await huge.save())),
    ).rejects.toThrow();
  });
});
