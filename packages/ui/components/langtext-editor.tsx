import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import { Color } from "@tiptap/extension-color";
import TextStyle from "@tiptap/extension-text-style";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  BoldIcon,
  CheckIcon,
  ItalicIcon,
  LanguagesIcon,
  ScissorsIcon,
  SparklesIcon,
  UnderlineIcon,
} from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/utils";

export interface LangTextField {
  key: string;
  label: string;
  value: string;
  sourceLabel?: string | null;
  linked?: boolean;
  overridden?: boolean;
}

export type LangTextEntry = LangTextField;

export interface LangtextEditorProps {
  fields?: LangTextField[];
  entries?: LangTextField[];
  placeholder?: string;
  onCommit?: (fieldKey: string, html: string) => void | Promise<void>;
  onChange?: (fieldKey: string, html: string) => void | Promise<void>;
  activeKey?: string;
  onActiveKeyChange?: (fieldKey: string) => void;
  syncKey?: string;
  readOnly?: boolean;
  className?: string;
  title?: string;
}

const COLORS = [
  { label: "Standard", value: "" },
  { label: "Blau", value: "#2563eb" },
  { label: "Rot", value: "#dc2626" },
  { label: "Grün", value: "#15803d" },
  { label: "Orange", value: "#c2410c" },
];

const TIPTAP_EXTENSIONS = [
  StarterKit.configure({
    codeBlock: false,
    code: false,
    horizontalRule: false,
    blockquote: false,
  }),
  Underline,
  TextStyle,
  Color,
];

function buildDraftMap(items: LangTextField[]) {
  const drafts: Record<string, string> = {};
  for (const item of items) drafts[item.key] = item.value ?? "";
  return drafts;
}

export function LangtextEditor({
  fields,
  entries,
  placeholder = "Langtext eingeben …",
  onCommit,
  onChange,
  activeKey,
  onActiveKeyChange,
  syncKey,
  readOnly = false,
  className,
  title,
}: LangtextEditorProps) {
  const { t } = useTranslation("ui");
  const items = useMemo(() => fields ?? entries ?? [], [entries, fields]);
  const initialKey = activeKey ?? items[0]?.key ?? "";
  const [internalKey, setInternalKey] = useState(initialKey);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => buildDraftMap(items));
  const appliedDraftsRef = useRef<Record<string, string>>(buildDraftMap(items));
  const syncKeyRef = useRef(syncKey);
  const [bubbleLoading, setBubbleLoading] = useState(false);

  const selectedKeyCandidate = activeKey ?? internalKey;
  const resolvedSelectedKey = items.some((item) => item.key === selectedKeyCandidate)
    ? selectedKeyCandidate
    : (items[0]?.key ?? "");
  const selectedItem = items.find((item) => item.key === resolvedSelectedKey) ?? null;
  const selectedItemKey = selectedItem?.key ?? null;
  const selectedHtml = drafts[selectedItem?.key ?? ""] ?? selectedItem?.value ?? "";

  const commitHandler = onCommit ?? onChange;

  // Keep a ref so editor callbacks always see the latest selectedItem
  const selectedItemRef = useRef(selectedItem);
  useLayoutEffect(() => {
    selectedItemRef.current = selectedItem;
  });

  // Keep a ref to commitCurrent so the onBlur callback doesn't capture a stale closure
  const commitCurrentRef = useRef<() => Promise<void>>(async () => {});

  const editor = useEditor({
    extensions: TIPTAP_EXTENSIONS,
    content: selectedHtml || "",
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const key = selectedItemRef.current?.key ?? "";
      if (!key) return;
      setDrafts((prev) => ({ ...prev, [key]: html }));
      if (onChange && selectedItemRef.current) {
        void onChange(selectedItemRef.current.key, html);
      }
    },
    onBlur: () => {
      void commitCurrentRef.current?.();
    },
  });

  const commitCurrent = async () => {
    if (!selectedItemRef.current || !commitHandler || !editor) return;
    const html = editor.getHTML();
    const key = selectedItemRef.current.key;
    setDrafts((prev) => ({ ...prev, [key]: html }));
    appliedDraftsRef.current = { ...appliedDraftsRef.current, [key]: html };
    try {
      await commitHandler(key, html);
    } catch (err) {
      console.error("Langtext commit failed", err);
    }
  };

  useEffect(() => {
    commitCurrentRef.current = commitCurrent;
  });

  // Sync drafts when items / syncKey change
  useEffect(() => {
    const next = buildDraftMap(items);

    if (syncKeyRef.current !== syncKey) {
      syncKeyRef.current = syncKey;
      appliedDraftsRef.current = next;
      setDrafts(next);
      return;
    }

    setDrafts((prev) => {
      let changed = false;
      const merged = { ...prev };

      for (const item of items) {
        const incoming = next[item.key] ?? "";
        const previousBase = appliedDraftsRef.current[item.key];
        const hasLocalEdit = prev[item.key] !== previousBase;

        if (!hasLocalEdit && prev[item.key] !== incoming) {
          merged[item.key] = incoming;
          changed = true;
        } else if (!(item.key in merged)) {
          merged[item.key] = incoming;
          changed = true;
        }
      }

      appliedDraftsRef.current = next;
      return changed ? merged : prev;
    });
  }, [items, syncKey]);

  // Sync editor content when selected field or syncKey changes
  useEffect(() => {
    if (!editor || !selectedItemKey) return;
    const nextHtml = selectedHtml ?? "";
    if (editor.getHTML() === nextHtml) return;
    editor.commands.setContent(nextHtml, false);
  }, [editor, selectedHtml, selectedItemKey, syncKey]);

  // Keep editor editability in sync with readOnly prop
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const selectField = (key: string) => {
    if (!activeKey) setInternalKey(key);
    onActiveKeyChange?.(key);
  };

  const handleBubbleAction = async (action: "improve" | "shorten" | "formal" | "translate") => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    setBubbleLoading(true);
    try {
      const res = await fetch("/api/ai/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, action }),
      });
      if (!res.ok) throw new Error("Fehler beim Bearbeiten");
      const data = (await res.json()) as { result: string };
      editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, data.result).run();
    } catch (err) {
      console.error(err);
    } finally {
      setBubbleLoading(false);
    }
  };

  const isBold = editor?.isActive("bold") ?? false;
  const isItalic = editor?.isActive("italic") ?? false;
  const isUnderline = editor?.isActive("underline") ?? false;

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-canvas shadow-sm",
        className,
      )}
    >
      <style>{`
        .langtext-tiptap b,
        .langtext-tiptap strong {
          font-weight: bold !important;
        }
        .langtext-tiptap .tiptap {
          height: 100%;
          min-height: 10rem;
          overflow-y: auto;
          padding: 0.75rem;
          font-size: 13px;
          line-height: 1.5rem;
          color: var(--ink);
          outline: none;
        }
        .langtext-tiptap .tiptap p { margin: 0; }
        .langtext-tiptap .tiptap p + p { margin-top: 0.25rem; }
      `}</style>

      {/* Language / field tabs */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-hairline bg-canvas-soft px-3 py-2">
        <div className="text-[11px] font-semibold tracking-[0.16em] text-ink-mute uppercase">
          {title ?? t("langtextEditor.title", { defaultValue: "Langtexte" })}
        </div>
        <div className="flex flex-wrap justify-start gap-1">
          {items.map((item) => {
            const isActive = item.key === resolvedSelectedKey;
            return (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "min-w-[4.5rem] rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-primary bg-[color-mix(in_oklab,var(--primary)_12%,var(--canvas))] text-primary shadow-sm"
                    : "border-hairline-input bg-canvas text-ink-secondary hover:border-primary hover:text-primary",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectField(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex shrink-0 flex-wrap items-center justify-start gap-1 border-b border-hairline bg-canvas px-3 py-2">
        <button
          type="button"
          disabled={readOnly}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded border border-hairline-input text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-40",
            isBold && "border-primary bg-canvas-soft text-primary",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <BoldIcon size={14} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded border border-hairline-input text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-40",
            isItalic && "border-primary bg-canvas-soft text-primary",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <ItalicIcon size={14} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded border border-hairline-input text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-40",
            isUnderline && "border-primary bg-canvas-soft text-primary",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <UnderlineIcon size={14} />
        </button>
        <div className="mx-1 h-5 w-px bg-hairline" />
        <select
          disabled={readOnly}
          className="h-8 cursor-pointer rounded border border-hairline-input bg-canvas px-2 text-[11px] text-ink transition-colors outline-none hover:border-primary"
          onChange={(e) => {
            const val = e.target.value;
            if (val !== "placeholder") {
              if (val === "") {
                editor?.chain().focus().unsetColor().run();
              } else {
                editor?.chain().focus().setColor(val).run();
              }
              e.target.value = "placeholder";
            }
          }}
          defaultValue="placeholder"
        >
          <option value="placeholder" disabled>
            {t("langtextEditor.color", { defaultValue: "Farbe..." })}
          </option>
          {COLORS.map((color) => (
            <option key={color.label} value={color.value}>
              {color.label}
            </option>
          ))}
        </select>
      </div>

      {/* Editor area */}
      <div className="langtext-tiptap relative min-h-0 flex-1 overflow-hidden">
        <EditorContent
          editor={editor}
          className={cn("h-full", readOnly ? "cursor-default opacity-70" : "")}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              void commitCurrentRef.current?.();
            }
          }}
        />
        {!selectedHtml && !editor?.getText() ? (
          <div className="pointer-events-none absolute left-3 top-3 text-[13px] leading-6 text-ink-mute">
            {placeholder}
          </div>
        ) : null}
      </div>

      {/* BubbleMenu for AI actions */}
      {!readOnly && editor ? (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-1 rounded-md border border-hairline bg-canvas p-1 shadow-md">
            {bubbleLoading ? (
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-ink-mute">
                <span className="size-3 animate-spin rounded-full border border-primary border-t-transparent" />
                <span>KI arbeitet...</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => void handleBubbleAction("improve")}
                  title="Stil verbessern"
                  className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
                >
                  <SparklesIcon size={12} className="text-primary" />
                  <span>Verbessern</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleBubbleAction("shorten")}
                  title="Text kürzen"
                  className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
                >
                  <ScissorsIcon size={12} />
                  <span>Kürzen</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleBubbleAction("formal")}
                  title="Formeller formulieren"
                  className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
                >
                  <CheckIcon size={12} />
                  <span>Formell</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleBubbleAction("translate")}
                  title="Übersetzen (DE <-> EN)"
                  className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
                >
                  <LanguagesIcon size={12} />
                  <span>Übersetzen</span>
                </button>
              </>
            )}
          </div>
        </BubbleMenu>
      ) : null}
    </div>
  );
}
