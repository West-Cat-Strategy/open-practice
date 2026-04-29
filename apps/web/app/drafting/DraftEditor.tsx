"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { TipTapDocument } from "@open-practice/domain";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Underline as UnderlineIcon,
  Undo,
} from "lucide-react";
import { useCallback } from "react";

interface DraftEditorProps {
  content: TipTapDocument;
  onChange: (content: TipTapDocument) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function DraftEditor({
  content,
  onChange,
  placeholder = "Start drafting...",
  readOnly = false,
}: DraftEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getJSON() as TipTapDocument);
    },
  });

  const toggleLink = useCallback(() => {
    if (!editor) return;
    const previousHref = editor.getAttributes("link").href;
    const url = window.prompt("URL", typeof previousHref === "string" ? previousHref : "");

    if (url === null) return;
    if (url.trim().length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="draft-editor">
      {!readOnly ? (
        <div className="draft-editor-toolbar" aria-label="Draft editor toolbar">
          <div className="toolbar-group">
            <button
              aria-label="Bold"
              className={editor.isActive("bold") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
              type="button"
            >
              <Bold size={16} />
            </button>
            <button
              aria-label="Italic"
              className={editor.isActive("italic") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
              type="button"
            >
              <Italic size={16} />
            </button>
            <button
              aria-label="Underline"
              className={editor.isActive("underline") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline"
              type="button"
            >
              <UnderlineIcon size={16} />
            </button>
          </div>

          <div className="toolbar-group">
            <button
              aria-label="Heading 1"
              className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              title="Heading 1"
              type="button"
            >
              <Heading1 size={16} />
            </button>
            <button
              aria-label="Heading 2"
              className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
              type="button"
            >
              <Heading2 size={16} />
            </button>
          </div>

          <div className="toolbar-group">
            <button
              aria-label="Bullet list"
              className={editor.isActive("bulletList") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Bullet list"
              type="button"
            >
              <List size={16} />
            </button>
            <button
              aria-label="Ordered list"
              className={editor.isActive("orderedList") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Ordered list"
              type="button"
            >
              <ListOrdered size={16} />
            </button>
          </div>

          <div className="toolbar-group">
            <button
              aria-label="Link"
              className={editor.isActive("link") ? "is-active" : ""}
              onClick={toggleLink}
              title="Link"
              type="button"
            >
              <LinkIcon size={16} />
            </button>
            <button
              aria-label="Block quote"
              className={editor.isActive("blockquote") ? "is-active" : ""}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Block quote"
              type="button"
            >
              <Quote size={16} />
            </button>
          </div>

          <div className="toolbar-group toolbar-group-end">
            <button
              aria-label="Undo"
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
              title="Undo"
              type="button"
            >
              <Undo size={16} />
            </button>
            <button
              aria-label="Redo"
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
              title="Redo"
              type="button"
            >
              <Redo size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="draft-editor-surface">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
