"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "./ui/button";
import { type DocNode } from "@/lib/domain";
export function RichEditor({
  content,
  onChange,
}: {
  content: DocNode;
  onChange: (doc: DocNode) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
        codeBlock: false,
        code: false,
        dropcursor: false,
      }),
      Placeholder.configure({
        placeholder:
          "Начните с предмета договора. Опишите условия, сроки и обязательства сторон…",
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as DocNode),
  });
  if (!editor) return <div className="loading">Загрузка редактора…</div>;
  return (
    <>
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Форматирование документа"
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Заголовок"
          aria-label="Заголовок"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 size={17} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Полужирный"
          aria-label="Полужирный"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Курсив"
          aria-label="Курсив"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Маркированный список"
          aria-label="Маркированный список"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={17} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Нумерованный список"
          aria-label="Нумерованный список"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={17} />
        </Button>
        <span style={{ flex: 1 }} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Отменить изменение"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Повторить изменение"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </Button>
      </div>
      <EditorContent editor={editor} />
      <div className="editor-footer">
        <span>Условия контракта</span>
        <span>{editor.getText().length.toLocaleString("ru-RU")} символов</span>
      </div>
    </>
  );
}
