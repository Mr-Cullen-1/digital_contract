import type { ReactNode } from "react";
import { type DocNode, type Party, roleLabels } from "@/lib/domain";
function render(node: DocNode, key: number): ReactNode {
  const children = node.content?.map(render);
  switch (node.type) {
    case "text": {
      let text: ReactNode = node.text;
      for (const m of node.marks || []) {
        if (m.type === "bold") text = <strong>{text}</strong>;
        if (m.type === "italic") text = <em>{text}</em>;
        if (m.type === "strike") text = <s>{text}</s>;
        if (m.type === "underline") text = <u>{text}</u>;
      }
      return <span key={key}>{text}</span>;
    }
    case "heading":
      return node.attrs?.level === 1 ? (
        <h1 key={key}>{children}</h1>
      ) : node.attrs?.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(node.attrs?.start || 1)}>
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "hardBreak":
      return <br key={key} />;
    default:
      return <p key={key}>{children}</p>;
  }
}
export function DocumentContent({ content }: { content: DocNode }) {
  return <div className="tiptap">{content.content?.map(render)}</div>;
}
export function PartyPreview({
  party,
  signatureUrl,
}: {
  party?: Party;
  signatureUrl?: string;
}) {
  return (
    <div>
      <h3>{party ? roleLabels[party.role] : "Вторая сторона"}</h3>
      {party ? (
        <>
          <p>
            <strong>{party.name || "Не заполнено"}</strong>
          </p>
          <p>{party.address || "Адрес не заполнен"}</p>
          <p>{party.phone}</p>
          {party.pinfl && <p>ПИНФЛ: {party.pinfl}</p>}
          {party.passport && <p>Паспорт: {party.passport}</p>}
        </>
      ) : (
        <p className="muted">Получатель заполнит данные по ссылке.</p>
      )}
      {signatureUrl && (
        <img
          src={signatureUrl}
          alt="Графическая подпись стороны"
          className="signature-image"
        />
      )}
    </div>
  );
}
