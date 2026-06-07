import { SparklesIcon, ScissorsIcon, LanguagesIcon, CheckIcon } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";
import ReactDOM from "react-dom";

interface FloatingToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onApplyAction: (replacementText: string) => void;
}

export function FloatingToolbar({ editorRef, onApplyAction }: FloatingToolbarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [loading, setLoading] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPosition(null);
        setSelectedText("");
        return;
      }

      // Check if selection is within our editor
      const container = editorRef.current;
      if (!container || !container.contains(selection.anchorNode)) {
        setPosition(null);
        setSelectedText("");
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setPosition(null);
        setSelectedText("");
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Position above the selection
        setPosition({
          top: rect.top + window.scrollY - 40,
          left: rect.left + window.scrollX + rect.width / 2,
        });
        setSelectedText(text);
      } catch {
        setPosition(null);
        setSelectedText("");
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [editorRef]);

  if (!position) return null;

  const handleAction = async (action: "improve" | "shorten" | "formal" | "translate") => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, action }),
      });

      if (!res.ok) throw new Error("Fehler beim Bearbeiten");
      const data = await res.json();

      onApplyAction(data.result);
      setPosition(null);
      setSelectedText("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
        zIndex: 50,
      }}
      className="flex animate-in items-center gap-1 rounded-md border border-hairline bg-canvas p-1 shadow-md duration-100 zoom-in-95 fade-in"
    >
      {loading ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-ink-mute">
          <span className="size-3 animate-spin rounded-full border border-primary border-t-transparent" />
          <span>KI arbeitet...</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => handleAction("improve")}
            title="Stil verbessern"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
          >
            <SparklesIcon size={12} className="text-primary" />
            <span>Verbessern</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("shorten")}
            title="Text kürzen"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
          >
            <ScissorsIcon size={12} />
            <span>Kürzen</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("formal")}
            title="Formeller formulieren"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
          >
            <CheckIcon size={12} />
            <span>Formell</span>
          </button>
          <button
            type="button"
            onClick={() => handleAction("translate")}
            title="Übersetzen (DE <-> EN)"
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-canvas-soft hover:text-primary"
          >
            <LanguagesIcon size={12} />
            <span>Übersetzen</span>
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
