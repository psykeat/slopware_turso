import { BoldIcon, ItalicIcon, UnderlineIcon } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/utils";
import { FloatingToolbar } from "./floating-toolbar";

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

function sanitizeHtml(html: string) {
  if (typeof window === "undefined") return html;
  const template = document.createElement("template");
  template.innerHTML = html;

  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "SPAN", "BR", "P", "DIV", "FONT"]);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const elements: Element[] = [];
  while (walker.nextNode()) elements.push(walker.currentNode as Element);

  for (const element of elements) {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ""));
      continue;
    }

    for (const attr of [...element.attributes]) {
      if (attr.name === "style") {
        const style = attr.value.toLowerCase();
        const keep =
          /color\s*:/.test(style) ||
          /font-weight\s*:/.test(style) ||
          /text-decoration\s*:/.test(style);
        if (!keep) element.removeAttribute("style");
      } else if (element.tagName === "FONT" && attr.name === "color") {
        // Keep color attribute on FONT elements
      } else {
        element.removeAttribute(attr.name);
      }
    }
  }

  return template.innerHTML;
}

function applyFormat(command: "bold" | "italic" | "underline" | "foreColor", value?: string) {
  if (typeof document === "undefined") return;
  // Intentional fallback: contentEditable formatting is still handled via execCommand here.
  // eslint-disable-next-line typescript-eslint/no-deprecated
  document.execCommand(command, false, value);
}

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
  const editorRef = useRef<HTMLDivElement>(null);
  const appliedDraftsRef = useRef<Record<string, string>>(buildDraftMap(items));
  const syncKeyRef = useRef(syncKey);
  const renderContextRef = useRef<{ syncKey: string | undefined; itemKey: string | null }>({
    syncKey,
    itemKey: null,
  });
  const commitHandler = onCommit ?? onChange;

  const selectedKeyCandidate = activeKey ?? internalKey;
  const resolvedSelectedKey = items.some((item) => item.key === selectedKeyCandidate)
    ? selectedKeyCandidate
    : (items[0]?.key ?? "");
  const selectedItem = items.find((item) => item.key === resolvedSelectedKey) ?? null;
  const selectedItemKey = selectedItem?.key ?? null;
  const selectedHtml = drafts[selectedItem?.key ?? ""] ?? selectedItem?.value ?? "";

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

  useEffect(() => {
    if (!editorRef.current || !selectedItemKey) return;

    const previousContext = renderContextRef.current;
    const isContextSwitch =
      previousContext.syncKey !== syncKey || previousContext.itemKey !== selectedItemKey;
    if (!isContextSwitch && editorRef.current === document.activeElement) return;

    const nextHtml = selectedHtml ?? "";
    if (sanitizeHtml(editorRef.current.innerHTML) === nextHtml) return;
    editorRef.current.innerHTML = nextHtml;
    renderContextRef.current = { syncKey, itemKey: selectedItemKey };
  }, [selectedHtml, selectedItemKey, syncKey]);

  const commitCurrent = async () => {
    if (!selectedItem || !commitHandler) return;
    const html = sanitizeHtml(editorRef.current?.innerHTML ?? selectedHtml ?? "");
    setDrafts((prev) => ({ ...prev, [selectedItem.key]: html }));
    appliedDraftsRef.current = { ...appliedDraftsRef.current, [selectedItem.key]: html };
    try {
      await commitHandler(selectedItem.key, html);
    } catch (err) {
      console.error("Langtext commit failed", err);
    }
  };

  const selectField = (key: string) => {
    if (!activeKey) setInternalKey(key);
    onActiveKeyChange?.(key);
  };

  const handleApplyReplacement = (replacementText: string) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    try {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(replacementText);
      range.insertNode(textNode);

      if (editorRef.current) {
        const html = sanitizeHtml(editorRef.current.innerHTML);
        setDrafts((prev) => ({ ...prev, [selectedItem?.key ?? ""]: html }));
        if (onChange && selectedItem) {
          void onChange(selectedItem.key, html);
        }
      }
    } catch (err) {
      console.error("Failed to apply inline replacement:", err);
    }
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-hairline bg-canvas shadow-sm",
        className,
      )}
    >
      <style>{`
        .langtext-contenteditable b, 
        .langtext-contenteditable strong { 
          font-weight: bold !important; 
        }
      `}</style>
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

      <div className="flex shrink-0 flex-wrap items-center justify-start gap-1 border-b border-hairline bg-canvas px-3 py-2">
        <button
          type="button"
          disabled={readOnly}
          className="inline-flex size-8 items-center justify-center rounded border border-hairline-input text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat("bold")}
          aria-label="Bold"
        >
          <BoldIcon size={14} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          className="inline-flex size-8 items-center justify-center rounded border border-hairline-input text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat("italic")}
          aria-label="Italic"
        >
          <ItalicIcon size={14} />
        </button>
        <button
          type="button"
          disabled={readOnly}
          className="inline-flex size-8 items-center justify-center rounded border border-hairline-input text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyFormat("underline")}
          aria-label="Underline"
        >
          <UnderlineIcon size={14} />
        </button>
        <div className="mx-1 h-5 w-px bg-hairline" />
        <select
          disabled={readOnly}
          className="h-8 cursor-pointer rounded border border-hairline-input bg-canvas px-2 text-[11px] text-ink transition-colors outline-none hover:border-primary"
          onChange={(e) => {
            if (e.target.value !== "placeholder") {
              applyFormat("foreColor", e.target.value || "inherit");
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

      <div className="min-h-0 flex-1 overflow-hidden">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          contentEditable={!readOnly}
          suppressContentEditableWarning
          className={cn(
            "langtext-contenteditable h-full min-h-40 overflow-y-auto px-3 py-3 text-[13px] leading-6 text-ink outline-none",
            readOnly ? "cursor-default bg-canvas-soft/30" : "bg-canvas",
            selectedHtml ? "" : "text-ink-mute",
          )}
          onInput={(event) => {
            const html = sanitizeHtml((event.currentTarget as HTMLDivElement).innerHTML);
            setDrafts((prev) => ({ ...prev, [selectedItem?.key ?? ""]: html }));
            if (html !== (event.currentTarget as HTMLDivElement).innerHTML) {
              (event.currentTarget as HTMLDivElement).innerHTML = html;
            }
            if (onChange && selectedItem) {
              void onChange(selectedItem.key, html);
            }
          }}
          onBlur={() => {
            void commitCurrent();
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
              event.preventDefault();
              void commitCurrent();
            }
          }}
        />
        {!selectedHtml ? (
          <div className="pointer-events-none -mt-[calc(100%-2.25rem)] px-3 py-3 text-[13px] leading-6 text-ink-mute">
            {placeholder}
          </div>
        ) : null}
      </div>
      {!readOnly && (
        <FloatingToolbar editorRef={editorRef} onApplyAction={handleApplyReplacement} />
      )}
    </div>
  );
}
