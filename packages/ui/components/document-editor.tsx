import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import { EntityMask } from "./entity-mask";
import { DataGrid } from "./data-grid";

export interface DocumentEditorProps {
  documentId: string;
  onClose: () => void;
}

export function DocumentEditor({ documentId, onClose }: DocumentEditorProps) {
  // Fetch document header
  const { data: allDocuments = [] } = useQuery({
    queryKey: ["data", "document", documentId],
    queryFn: async () => {
      const res = await fetch("/api/data/document");
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
  });

  const doc = (allDocuments as any[]).find(
    (d: any) => d.documentId === documentId,
  );
  const documentNo: string | undefined =
    doc?.documentNo ?? doc?.no ?? doc?.code;

  // Fetch document lines
  const { data: allLines = [], isLoading } = useQuery({
    queryKey: ["data", "documentLine", documentId],
    queryFn: async () => {
      const res = await fetch("/api/data/documentLine");
      if (!res.ok) throw new Error("Failed to fetch document lines");
      return res.json();
    },
  });

  const lines = (allLines as any[]).filter(
    (l: any) => l.documentId === documentId,
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F10") {
        e.preventDefault();
        // Save stub — wired to full save in future
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-canvas flex flex-col">
      {/* Header bar */}
      <div className="h-9 flex items-center gap-2 px-3 bg-canvas-soft border-b border-hairline shrink-0">
        <span className="text-[13px] text-ink-mute">Documents</span>
        <ChevronRightIcon className="size-3 text-hairline-input" />
        <span className="text-[13px] text-ink">
          {documentNo || documentId}
        </span>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4 min-h-0">
        {/* Document header form */}
        <div className="border border-hairline rounded-lg overflow-hidden bg-canvas shrink-0">
          <EntityMask
            entityName="document"
            recordId={documentId}
            mode="edit"
            embedded={true}
          />
        </div>

        {/* Lines grid — fills remaining space */}
        <div className="flex-1 min-h-0 border border-hairline rounded-lg overflow-hidden">
          <DataGrid
            entityName="documentLine"
            panelId="editor-lines-grid"
            data={lines}
            isLoading={isLoading}
            keyExtractor={(row: any) => row.documentLineId || row.id}
            title="Document Lines"
            emptyTitle="No lines yet."
            emptySubtitle="Add the first line to this document."
            className="h-full border-none rounded-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="h-12 border-t border-hairline flex items-center px-4 gap-3 bg-canvas shrink-0">
        <button
          onClick={onClose}
          className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors"
        >
          Close (Esc)
        </button>
        <button
          className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors"
        >
          Save (F10)
        </button>
        <div className="flex-1" />
        <button
          className="h-7 px-4 rounded-full text-[13px]"
          style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
        >
          Post (F9)
        </button>
      </div>
    </div>
  );
}
