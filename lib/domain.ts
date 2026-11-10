import { z } from "zod";
export const statuses = [
  "Draft",
  "Sent",
  "Signed",
  "Closed",
  "Cancelled",
] as const;
export type ContractStatus = (typeof statuses)[number];
export const statusLabels: Record<ContractStatus, string> = {
  Draft: "Черновик",
  Sent: "На подписании",
  Signed: "Ожидает закрытия",
  Closed: "Закрыт",
  Cancelled: "Отменён",
};
export const roleLabels = { customer: "Заказчик", provider: "Исполнитель" };
export type Role = keyof typeof roleLabels;
export function canTransition(from: ContractStatus, to: ContractStatus) {
  return (
    {
      Draft: ["Sent", "Cancelled"],
      Sent: ["Signed", "Cancelled"],
      Signed: ["Closed"],
      Closed: [],
      Cancelled: [],
    } as Record<ContractStatus, ContractStatus[]>
  )[from].includes(to);
}
export const partyFields = z.object({
  name: z.string().trim().max(200),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(30),
  pinfl: z.string().trim().max(14),
  passport: z.string().trim().max(30),
  role: z.enum(["customer", "provider"]),
});
export const partySchema = partyFields.superRefine((p, ctx) => {
  for (const key of ["name", "address", "phone"] as const)
    if (!p[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Заполните обязательное поле",
      });
  if (p.phone && !/^\+?[\d\s()-]{7,25}$/.test(p.phone))
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: "Укажите корректный телефон",
    });
  if (p.pinfl && !/^\d{14}$/.test(p.pinfl))
    ctx.addIssue({
      code: "custom",
      path: ["pinfl"],
      message: "ПИНФЛ должен содержать 14 цифр",
    });
  if (!p.pinfl && !/^[A-Za-zА-Яа-я]{2}\s?\d{7}$/.test(p.passport))
    ctx.addIssue({
      code: "custom",
      path: ["passport"],
      message: "Укажите ПИНФЛ или паспорт: AA1234567",
    });
});
export type Party = z.infer<typeof partyFields>;
export type DocNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
};
const nodeTypes = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "hardBreak",
  "horizontalRule",
]);
export function validDoc(value: unknown, depth = 0): value is DocNode {
  if (!value || typeof value !== "object" || depth > 20) return false;
  const n = value as DocNode;
  return (
    nodeTypes.has(n.type) &&
    (n.text === undefined || typeof n.text === "string") &&
    (n.attrs === undefined ||
      (n.attrs !== null &&
        typeof n.attrs === "object" &&
        !Array.isArray(n.attrs) &&
        Object.entries(n.attrs).every(([k, v]) =>
          k === "level"
            ? Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 3
            : k === "start"
              ? Number.isInteger(v) && Number(v) >= 1
              : k === "type"
                ? v === null || v === "1"
                : false,
        ))) &&
    (n.marks === undefined ||
      (Array.isArray(n.marks) &&
        n.marks.every(
          (m) =>
            m &&
            ["bold", "italic", "strike", "underline"].includes(m.type) &&
            !m.attrs,
        ))) &&
    (n.content === undefined ||
      (Array.isArray(n.content) &&
        n.content.length < 10000 &&
        n.content.every((c) => validDoc(c, depth + 1))))
  );
}
export const contentSchema = z.custom<DocNode>(
  (v) => validDoc(v) && v.type === "doc" && JSON.stringify(v).length <= 200000,
  "Некорректное или слишком большое содержимое документа",
);
export const draftSchema = z.object({
  title: z.string().trim().min(1, "Введите название контракта").max(200),
  content: contentSchema,
  creator: partyFields,
  recipientRole: z.enum(["customer", "provider"]),
  sourceKind: z.enum(["editor", "docx", "pdf"]).default("editor"),
});
export type DraftInput = z.infer<typeof draftSchema>;
export const signatureSchema = z
  .string()
  .min(200)
  .max(400000)
  .regex(
    /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/,
    "Нужна подпись в формате PNG",
  );
export const blankParty = (role: Role = "provider"): Party => ({
  name: "",
  address: "",
  phone: "",
  pinfl: "",
  passport: "",
  role,
});
export const emptyDoc: DocNode = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
export const documentText = (node: DocNode): string =>
  node.type === "text"
    ? node.text || ""
    : (node.content || [])
        .map(documentText)
        .join(
          ["doc", "bulletList", "orderedList"].includes(node.type) ? "\n" : "",
        );
export type Contract = {
  id: string;
  owner_id: string;
  title: string;
  status: ContractStatus;
  current_version_id: string;
  number: string | null;
  created_at: string;
  closed_at: string | null;
  source_kind: "editor" | "pdf" | "docx";
  recipient_role: Role;
  parties?: Array<Party & { side: "creator" | "recipient"; id: string }>;
  version?: {
    id: string;
    content: DocNode;
    version: number;
    content_hash: string;
  };
  files?: ContractFile[];
  signatures?: Array<{
    side: "creator" | "recipient";
    signed_at: string;
    url?: string;
  }>;
  events?: Array<{ id: string; event: string; created_at: string }>;
  final_sha256?: string | null;
};
export type ContractFile = {
  id: string;
  kind: "original" | "version" | "signature" | "final";
  bucket: string;
  path: string;
  name: string;
  sha256: string;
  mime: string;
  url?: string;
};
