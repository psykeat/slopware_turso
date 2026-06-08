"use client";

import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createQuoteNode, $createHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { mergeRegister } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  LexicalEditor,
} from "lexical";
import {
  SparklesIcon,
  SearchIcon,
  BookOpenIcon,
  RefreshCwIcon,
  CheckIcon,
  XIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  UndoIcon,
  RedoIcon,
  EraserIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function getDOMRangeRect(nativeSelection: Selection, rootElement: HTMLElement): DOMRect {
  const domRange = nativeSelection.getRangeAt(0);
  let rect;
  if (nativeSelection.anchorNode === rootElement) {
    let inner = rootElement;
    while (inner.firstElementChild != null) {
      inner = inner.firstElementChild as HTMLElement;
    }
    rect = inner.getBoundingClientRect();
  } else {
    rect = domRange.getBoundingClientRect();
  }
  return rect;
}

export function AiFloatingMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isText, setIsText] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");

  // AI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    text: string;
    type: "rephrase" | "lookup" | "explain";
  } | null>(null);

  // Format states
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isLink, setIsLink] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      const nativeSelection = window.getSelection();
      const rootElement = editor.getRootElement();

      if (
        nativeSelection === null ||
        rootElement === null ||
        !rootElement.contains(nativeSelection.anchorNode) ||
        !$isRangeSelection(selection) ||
        selection.isCollapsed()
      ) {
        setIsText(false);
        setPosition(null);
        setAiSuggestion(null);
        return;
      }

      const text = selection.getTextContent().trim();
      if (!text) {
        setIsText(false);
        setPosition(null);
        return;
      }

      setIsText(true);
      setSelectedText(text);
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));

      // Simple link check (would normally require traversing nodes, but we'll use a basic approximation here)
      const nodes = selection.getNodes();
      setIsLink(
        nodes.some((node) => node.getParent()?.getType() === "link" || node.getType() === "link"),
      );

      const rect = getDOMRangeRect(nativeSelection, rootElement);

      // We position it above the selection
      setPosition({
        top: rect.top + window.scrollY - 55, // higher offset for the bigger menu
        left: rect.left + window.scrollX + rect.width / 2,
      });
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateMenuPosition();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateMenuPosition();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateMenuPosition]);

  const handleAiAction = async (action: "rephrase" | "lookup" | "explain") => {
    if (!selectedText) return;
    setIsProcessing(true);

    try {
      const res = await fetch("/api/ai/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, action }),
      });

      if (!res.ok) throw new Error("Fehler bei der KI-Anfrage");
      const data = await res.json();

      setAiSuggestion({ text: data.result, type: action });
    } catch (err) {
      console.error(err);
      setAiSuggestion({
        text: "Ein Fehler ist bei der Anfrage an die AI aufgetreten.",
        type: action,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const applySuggestion = () => {
    if (!aiSuggestion || aiSuggestion.type !== "rephrase") return;

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(aiSuggestion.text);
      }
    });
    setAiSuggestion(null);
    setIsText(false);
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createQuoteNode());
      }
    });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        nodes.forEach((node) => {
          if (node.getType() === "text") {
            node.setFormat(0);
            node.setStyle("");
          }
        });
      }
    });
  };

  const toggleLink = () => {
    if (!isLink) {
      const url = window.prompt("URL eingeben:");
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  };

  if (!isText || !position) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translate(-50%, -100%)",
        zIndex: 100,
      }}
      onPointerDown={(e) => {
        e.preventDefault();
      }}
      className="mb-2 flex animate-in flex-col gap-1 rounded-md border border-hairline bg-canvas p-1 shadow-xl duration-100 zoom-in-95 fade-in"
    >
      {isProcessing ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-ink-mute">
          <RefreshCwIcon className="size-4 animate-spin" />
          <span>AI arbeitet...</span>
        </div>
      ) : aiSuggestion ? (
        <div className="flex max-w-[320px] min-w-[250px] flex-col gap-2 p-2">
          <div className="mb-1 flex items-center justify-between border-b border-hairline pb-1 text-sm font-medium text-ink">
            {aiSuggestion.type === "rephrase"
              ? "Vorschlag"
              : aiSuggestion.type === "lookup"
                ? "Info-Lookup"
                : "Erklärung"}
            <button onClick={() => setAiSuggestion(null)} className="text-ink-mute hover:text-ink">
              <XIcon size={14} />
            </button>
          </div>
          <div className="max-h-[150px] overflow-y-auto pr-1 text-[13px] whitespace-pre-wrap text-ink">
            {aiSuggestion.type === "rephrase" ? `"${aiSuggestion.text}"` : aiSuggestion.text}
          </div>

          {aiSuggestion.type === "rephrase" ? (
            <div className="mt-1 flex items-center gap-1 pt-1">
              <button
                onClick={applySuggestion}
                className="flex flex-1 items-center justify-center gap-1 rounded bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_25%,transparent)]"
              >
                <CheckIcon size={12} />
                Ersetzen
              </button>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1 pt-1">
              <button
                onClick={() => setAiSuggestion(null)}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-hairline bg-canvas-soft px-2 py-1 text-[12px] font-medium text-ink transition-colors hover:bg-muted"
              >
                Schließen
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {/* Top row: Format Tools */}
          <div className="flex items-center gap-0.5 border-b border-hairline px-1 pb-1">
            <button
              onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
              className="flex cursor-pointer items-center justify-center rounded p-1.5 text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
              title="Rückgängig (Cmd/Ctrl+Z)"
            >
              <UndoIcon size={14} />
            </button>
            <button
              onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
              className="flex cursor-pointer items-center justify-center rounded p-1.5 text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
              title="Wiederherstellen (Cmd/Ctrl+Y)"
            >
              <RedoIcon size={14} />
            </button>
            <div className="mx-0.5 h-4 w-[1px] bg-hairline" />
            <button
              onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
              className={`flex cursor-pointer items-center justify-center rounded p-1.5 transition-colors ${isBold ? "bg-primary/10 text-primary" : "text-ink-mute hover:bg-canvas-soft hover:text-ink"}`}
              title="Fett (Cmd/Ctrl+B)"
            >
              <BoldIcon size={14} />
            </button>
            <button
              onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
              className={`flex cursor-pointer items-center justify-center rounded p-1.5 transition-colors ${isItalic ? "bg-primary/10 text-primary" : "text-ink-mute hover:bg-canvas-soft hover:text-ink"}`}
              title="Kursiv (Cmd/Ctrl+I)"
            >
              <ItalicIcon size={14} />
            </button>
            <button
              onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
              className={`flex cursor-pointer items-center justify-center rounded p-1.5 transition-colors ${isUnderline ? "bg-primary/10 text-primary" : "text-ink-mute hover:bg-canvas-soft hover:text-ink"}`}
              title="Unterstrichen (Cmd/Ctrl+U)"
            >
              <UnderlineIcon size={14} />
            </button>
            <button
              onClick={toggleLink}
              className={`flex cursor-pointer items-center justify-center rounded p-1.5 transition-colors ${isLink ? "bg-primary/10 text-primary" : "text-ink-mute hover:bg-canvas-soft hover:text-ink"}`}
              title="Link einfügen/entfernen"
            >
              <LinkIcon size={14} />
            </button>
            <div className="mx-0.5 h-4 w-[1px] bg-hairline" />
            <button
              onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
              className="flex cursor-pointer items-center justify-center rounded p-1.5 text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
              title="Aufzählung"
            >
              <ListIcon size={14} />
            </button>
            <button
              onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
              className="flex cursor-pointer items-center justify-center rounded p-1.5 text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
              title="Nummerierung"
            >
              <ListOrderedIcon size={14} />
            </button>
            <button
              onClick={formatQuote}
              className="flex cursor-pointer items-center justify-center rounded p-1.5 text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
              title="Zitat (Blockquote)"
            >
              <QuoteIcon size={14} />
            </button>
            <div className="mx-0.5 h-4 w-[1px] bg-hairline" />
            <button
              onClick={clearFormatting}
              className="flex cursor-pointer items-center justify-center rounded p-1.5 text-ink-mute transition-colors hover:bg-canvas-soft hover:text-ink"
              title="Formatierung entfernen"
            >
              <EraserIcon size={14} />
            </button>
          </div>

          {/* Bottom row: AI Tools */}
          <div className="flex items-center px-1 py-0.5">
            <button
              onClick={() => handleAiAction("rephrase")}
              title="Rephrase Text"
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-canvas-soft"
            >
              <SparklesIcon size={13} />
              <span>Rephrase</span>
            </button>
            <button
              onClick={() => handleAiAction("lookup")}
              title="Lookup in Knowledge Base"
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
            >
              <SearchIcon size={13} />
              <span>Lookup</span>
            </button>
            <button
              onClick={() => handleAiAction("explain")}
              title="Explain Concept"
              className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-canvas-soft hover:text-ink"
            >
              <BookOpenIcon size={13} />
              <span>Explain</span>
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
