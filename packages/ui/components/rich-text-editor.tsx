import React from "react";

import { cn } from "../lib/utils";
import Editor from "./editor";

const subscribeToClientSnapshot = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export interface RichTextEditorProps {
  initialValue?: string;
  onChange?: (value: string, mode: "plain" | "html") => void;
  className?: string;
  mode?: "plain" | "html";
  onChangeMode?: (mode: "plain" | "html") => void;
  onAttachmentsChange?: (attachments: File[]) => void;
}

export function RichTextEditor({
  initialValue,
  onChange,
  className,
  mode = "html",
  onChangeMode: _onChangeMode,
  onAttachmentsChange,
}: RichTextEditorProps) {
  // Convert standard HTML string to Novel/Tiptap format or pass directly
  // Tiptap can usually parse HTML strings directly as initialContent
  const isClient = React.useSyncExternalStore(
    subscribeToClientSnapshot,
    getClientSnapshot,
    getServerSnapshot,
  );

  if (!isClient) {
    return (
      <div
        className={cn(
          "flex min-h-[250px] flex-col overflow-hidden rounded-sm border border-hairline bg-canvas",
          className,
        )}
      >
        <div className="flex h-[36px] items-center justify-between border-b border-hairline bg-canvas-soft px-2 py-1.5" />
        <div className="flex-1 animate-pulse bg-canvas-soft" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-sm border border-hairline bg-canvas focus-within:border-primary",
        className,
      )}
    >
      {/* Removed the top mode switcher to avoid duplication with Compose Dialog */}

      <div className="relative flex flex-1 cursor-text flex-col p-2">
        {mode === "html" ? (
          <Editor
            initialValue={initialValue as any}
            onAttachmentsChange={onAttachmentsChange}
            onChange={(html) => {
              if (onChange) {
                onChange(html, "html");
              }
            }}
            placeholder="Nachricht verfassen... (Tippe '/' für KI oder Formatierung)"
          />
        ) : (
          <textarea
            className="h-full min-h-[200px] w-full resize-none bg-transparent text-[13px] text-ink outline-none"
            value={initialValue}
            onChange={(e) => {
              if (onChange) {
                onChange(e.target.value, "plain");
              }
            }}
            placeholder="Reinen Text verfassen..."
          />
        )}
      </div>
    </div>
  );
}
