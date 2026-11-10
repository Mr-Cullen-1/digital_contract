import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs/promises";
import path from "node:path";
import { type DocNode, type Party, roleLabels } from "./domain";
import { HttpError } from "./http";

type Mark = "bold" | "italic" | "strike" | "underline";
type Run = { text: string; marks: Mark[] };
type FontEntry = {
  font: PDFFont;
  charset: Set<number>;
  bold: boolean;
  italic: boolean;
};
type FinalPdfInput = {
  title: string;
  number: string;
  closedAt: string;
  content: DocNode;
  creator: Party;
  recipient: Party;
  creatorSignature: Uint8Array;
  recipientSignature: Uint8Array;
  originalPdf?: Uint8Array;
};
const styles = [
  { weight: 400, style: "normal", bold: false, italic: false },
  { weight: 700, style: "normal", bold: true, italic: false },
  { weight: 400, style: "italic", bold: false, italic: true },
  { weight: 700, style: "italic", bold: true, italic: true },
];
async function loadFonts(doc: PDFDocument): Promise<FontEntry[]> {
  doc.registerFontkit(fontkit);
  return Promise.all(
    styles.flatMap((s) =>
      ["latin", "cyrillic"].map(async (subset) => {
        const bytes = await fs.readFile(
          path.join(
            process.cwd(),
            "node_modules/@fontsource/inter/files",
            `inter-${subset}-${s.weight}-${s.style}.woff`,
          ),
        );
        const font = await doc.embedFont(bytes, { subset: true });
        return {
          font,
          charset: new Set(font.getCharacterSet()),
          bold: s.bold,
          italic: s.italic,
        };
      }),
    ),
  );
}
function selectFont(fonts: FontEntry[], char: string, marks: Mark[]): PDFFont {
  const entry = fonts.find(
    (f) =>
      f.bold === marks.includes("bold") &&
      f.italic === marks.includes("italic") &&
      f.charset.has(char.codePointAt(0)!),
  );
  if (!entry)
    throw new HttpError(
      `Символ «${char}» не поддерживается шрифтом PDF. Замените его перед подписанием.`,
      400,
    );
  return entry.font;
}
export async function assertPdfTextSupported(text: string) {
  const fonts = await loadFonts(await PDFDocument.create());
  for (const char of new Set(Array.from(text)))
    if (!["\n", "\r", "\t"].includes(char)) selectFont(fonts, char, []);
}
function inline(node: DocNode): Run[] {
  if (node.type === "hardBreak") return [{ text: "\n", marks: [] }];
  if (node.type === "text")
    return [
      {
        text: node.text || "",
        marks: (node.marks || []).map((m) => m.type as Mark),
      },
    ];
  return (node.content || []).flatMap(inline);
}
export async function createFinalPdf(
  input: FinalPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  doc.setCreator("Vertex Contract");
  doc.setProducer("Vertex Studio");
  doc.setCreationDate(new Date(input.closedAt));
  doc.setModificationDate(new Date(input.closedAt));
  if (input.originalPdf) {
    const original = await PDFDocument.load(input.originalPdf);
    for (const p of await doc.copyPages(original, original.getPageIndices()))
      doc.addPage(p);
  }
  const originalCount = doc.getPageCount();
  const fonts = await loadFonts(doc);
  let page = doc.addPage([595.28, 841.89]),
    y = 780;
  const margin = 48;
  function newPage() {
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  }
  function renderRuns(runs: Run[], size = 10, gap = 8, indent = 0) {
    const limit = 499 - indent;
    let x = margin + indent;
    const newline = () => {
      y -= size * 1.65;
      x = margin + indent;
      if (y < 75) newPage();
    };
    for (const run of runs) {
      for (const word of run.text
        .replace(/\r/g, "")
        .replace(/\t/g, "    ")
        .split(/(\n| +)/)) {
        if (word === "\n") {
          newline();
          continue;
        }
        const chars = Array.from(word);
        const width = chars.reduce(
          (n, c) =>
            n + selectFont(fonts, c, run.marks).widthOfTextAtSize(c, size),
          0,
        );
        if (x > margin + indent && x + width > margin + indent + limit)
          newline();
        for (const char of chars) {
          const font = selectFont(fonts, char, run.marks),
            w = font.widthOfTextAtSize(char, size);
          if (x + w > margin + indent + limit) newline();
          if (y < 75) newPage();
          page.drawText(char, {
            x,
            y,
            size,
            font,
            color: rgb(0.14, 0.16, 0.2),
          });
          if (run.marks.includes("strike"))
            page.drawLine({
              start: { x, y: y + size * 0.32 },
              end: { x: x + w, y: y + size * 0.32 },
              thickness: 0.7,
              color: rgb(0.14, 0.16, 0.2),
            });
          if (run.marks.includes("underline"))
            page.drawLine({
              start: { x, y: y - 1.5 },
              end: { x: x + w, y: y - 1.5 },
              thickness: 0.6,
              color: rgb(0.14, 0.16, 0.2),
            });
          x += w;
        }
      }
    }
    y -= size * 1.65 + gap;
  }
  const text = (value: string, size = 10, gap = 8, bold = false) =>
    renderRuns([{ text: value, marks: bold ? ["bold"] : [] }], size, gap);
  function block(node: DocNode, indent = 0, prefix = "") {
    if (node.type === "bulletList" || node.type === "orderedList") {
      (node.content || []).forEach((item, i) => {
        const label =
          node.type === "orderedList"
            ? `${Number(node.attrs?.start || 1) + i}. `
            : "• ";
        (item.content || []).forEach((child, j) =>
          block(child, indent + 12, j === 0 ? label : ""),
        );
      });
      return;
    }
    if (node.type === "blockquote") {
      (node.content || []).forEach((n) => block(n, indent + 16));
      return;
    }
    if (node.type === "horizontalRule") {
      if (y < 90) newPage();
      page.drawLine({
        start: { x: margin + indent, y },
        end: { x: 547, y },
        thickness: 0.6,
        color: rgb(0.8, 0.81, 0.85),
      });
      y -= 16;
      return;
    }
    const heading = node.type === "heading";
    const runs = inline(node).map((run) =>
      heading
        ? { ...run, marks: Array.from(new Set([...run.marks, "bold" as Mark])) }
        : run,
    );
    if (prefix) runs.unshift({ text: prefix, marks: [] });
    renderRuns(
      runs,
      heading ? (node.attrs?.level === 1 ? 17 : 13) : 10,
      heading ? 9 : 7,
      indent,
    );
  }
  text("VERTEX CONTRACT", 9, 13, true);
  text(input.title, 19, 12, true);
  text(
    `${input.number}  •  ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tashkent" }).format(new Date(input.closedAt))} (Ташкент)`,
    9,
    18,
  );
  if (input.originalPdf)
    text(
      "Лист реквизитов и подписей к предшествующим страницам оригинального документа.",
      11,
      18,
    );
  else (input.content.content || []).forEach((n) => block(n));
  text("РЕКВИЗИТЫ И ПОДПИСИ СТОРОН", 12, 14, true);
  for (const [party, signature] of [
    [input.creator, input.creatorSignature],
    [input.recipient, input.recipientSignature],
  ] as const) {
    if (y < 260) newPage();
    text(`${roleLabels[party.role]}: ${party.name}`, 12, 5, true);
    text(
      `Адрес: ${party.address}\nТелефон: ${party.phone}${party.pinfl ? `\nПИНФЛ: ${party.pinfl}` : ""}${party.passport ? `\nПаспорт: ${party.passport}` : ""}`,
      10,
      5,
    );
    const image = await doc.embedPng(signature),
      fit = image.scaleToFit(180, 65);
    if (y < 110) newPage();
    page.drawImage(image, {
      x: margin,
      y: y - fit.height,
      width: fit.width,
      height: fit.height,
    });
    y -= fit.height + 22;
  }
  text(
    "Графические подписи фиксируют согласие сторон. Не являются квалифицированной ЭЦП.",
    8,
    10,
  );
  const pages = doc.getPages();
  pages.slice(originalCount).forEach((p, j) =>
    p.drawText(`${j + originalCount + 1} / ${pages.length}`, {
      x: 525,
      y: 22,
      size: 8,
      font: fonts[0].font,
      color: rgb(0.6, 0.62, 0.66),
    }),
  );
  return doc.save();
}
