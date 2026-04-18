'use client';

import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { useEffect, useCallback, useRef, useState } from 'react';

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  dir?: string;
}

function MenuBar({ editor, onImageUpload }: { editor: ReturnType<typeof useEditor>; onImageUpload: () => void }) {
  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-xs transition-colors ${
      active ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-700'
    }`;

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-slate-700" dir="ltr">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))} title="Bold">
        <b>B</b>
      </button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))} title="Italic">
        <i>I</i>
      </button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))} title="Underline">
        <u>U</u>
      </button>
      <button onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))} title="Strikethrough">
        <s>S</s>
      </button>

      <div className="w-px bg-slate-700 mx-1" />

      <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive('heading', { level: 1 }))} title="H1">
        H1
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive('heading', { level: 2 }))} title="H2">
        H2
      </button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btn(editor.isActive('heading', { level: 3 }))} title="H3">
        H3
      </button>

      <div className="w-px bg-slate-700 mx-1" />

      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))} title="Bullet list">
        •≡
      </button>
      <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))} title="Numbered list">
        1.
      </button>

      <div className="w-px bg-slate-700 mx-1" />

      <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btn(editor.isActive({ textAlign: 'right' }))} title="Align right">
        ⇉
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btn(editor.isActive({ textAlign: 'center' }))} title="Align center">
        ≡
      </button>
      <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btn(editor.isActive({ textAlign: 'left' }))} title="Align left">
        ⇇
      </button>

      <div className="w-px bg-slate-700 mx-1" />

      <button
        onClick={() => {
          const url = window.prompt('הכנס קישור:');
          if (url) editor.chain().focus().setLink({ href: url, target: '_blank' }).run();
        }}
        className={btn(editor.isActive('link'))}
        title="Link"
      >
        🔗
      </button>
      {editor.isActive('link') && (
        <button onClick={() => editor.chain().focus().unsetLink().run()} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-slate-700" title="Remove link">
          ✕🔗
        </button>
      )}

      <div className="w-px bg-slate-700 mx-1" />

      <button onClick={onImageUpload} className="px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700" title="Upload image">
        🖼️ תמונה
      </button>

      <div className="w-px bg-slate-700 mx-1" />

      <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30" title="Undo">
        ↩
      </button>
      <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="px-2 py-1 rounded text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-30" title="Redo">
        ↪
      </button>
    </div>
  );
}

export default function RichEditor({ content, onChange, dir = 'rtl' }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const skipNextUpdate = useRef(false);
  const uploadRef = useRef<((file: File, pos?: number) => Promise<void>) | null>(null);

  // Create a stable TipTap extension for image drop/paste using ProseMirror plugin
  const ImageDropPaste = useRef(
    Extension.create({
      name: 'imageDropPaste',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            key: new PluginKey('imageDropPaste'),
            props: {
              handleDOMEvents: {
                drop(view, event) {
                  const dt = event.dataTransfer;
                  if (!dt?.files?.length) return false;
                  const file = dt.files[0];
                  if (!file.type.startsWith('image/')) return false;
                  event.preventDefault();
                  event.stopPropagation();
                  // Get drop position
                  const coords = { left: event.clientX, top: event.clientY };
                  const pos = view.posAtCoords(coords)?.pos ?? view.state.selection.from;
                  if (uploadRef.current) uploadRef.current(file, pos);
                  return true;
                },
                paste(view, event) {
                  const items = event.clipboardData?.items;
                  if (!items) return false;
                  for (const item of Array.from(items)) {
                    if (item.type.startsWith('image/')) {
                      event.preventDefault();
                      event.stopPropagation();
                      const file = item.getAsFile();
                      if (file && uploadRef.current) {
                        uploadRef.current(file, view.state.selection.from);
                      }
                      return true;
                    }
                  }
                  return false;
                },
              },
            },
          }),
        ];
      },
    })
  ).current;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageDropPaste,
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none p-4 min-h-[40vh] outline-none text-sm leading-relaxed',
        dir,
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false;
        return;
      }
      onChange(ed.getHTML());
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      skipNextUpdate.current = true;
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  const uploadImage = useCallback(async (file: File, pos?: number) => {
    if (!editor) return;
    setUploading(true);
    setDragOver(false);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        // Use dataUri for immediate display, url for after deploy
        const src = data.dataUri || data.url;
        if (pos !== undefined) {
          editor.chain().focus().insertContentAt(pos, `<img src="${src}" alt="${file.name}" />`).run();
        } else {
          editor.chain().focus().setImage({ src, alt: file.name }).run();
        }
        onChange(editor.getHTML());
      } else {
        alert(data.error || 'שגיאה בהעלאת תמונה');
      }
    } catch {
      alert('שגיאה בהעלאת תמונה');
    } finally {
      setUploading(false);
    }
  }, [editor, onChange]);

  // Keep uploadRef in sync so the ProseMirror plugin can call it
  useEffect(() => {
    uploadRef.current = uploadImage;
  }, [uploadImage]);

  const handleImageUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadImage]);

  return (
    <div
      className={`rounded-xl overflow-hidden transition-colors ${dragOver ? 'ring-2 ring-blue-400/60' : ''}`}
      style={{ background: '#0f172a', border: '1px solid #1e293b' }}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        // Only clear if leaving the wrapper entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOver(false);
        }
      }}
      onDrop={() => setDragOver(false)}
    >
      <MenuBar editor={editor} onImageUpload={handleImageUpload} />
      {uploading && (
        <div className="px-4 py-2 text-xs text-amber-400 bg-amber-500/10">מעלה תמונה...</div>
      )}
      {dragOver && (
        <div className="px-4 py-2 text-xs text-blue-400 bg-blue-500/10 text-center">שחרר כדי להעלות תמונה 📷</div>
      )}
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <style jsx global>{`
        .ProseMirror { min-height: 40vh; }
        .ProseMirror p { margin: 0.5em 0; }
        .ProseMirror h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror h2 { font-size: 1.25em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror h3 { font-size: 1.1em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror strong { font-weight: bold; }
        .ProseMirror em { font-style: italic; }
        .ProseMirror u { text-decoration: underline; }
        .ProseMirror a { color: #60a5fa; text-decoration: underline; }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.5em 0; cursor: pointer; }
        .ProseMirror img.ProseMirror-selectednode { outline: 2px solid #3b82f6; }
        .ProseMirror ul { list-style: disc; padding-right: 1.5em; }
        .ProseMirror ol { list-style: decimal; padding-right: 1.5em; }
        .ProseMirror li { margin: 0.25em 0; }
        .ProseMirror blockquote { border-right: 3px solid #334155; padding-right: 1em; color: #94a3b8; }
      `}</style>
    </div>
  );
}
