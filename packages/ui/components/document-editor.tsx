import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRightIcon } from "lucide-react";
import { EntityMask } from "./entity-mask";
import { DataGrid } from "./data-grid";
import { formatMoney } from "../lib/formatters";
import { useCommands } from "../platform/command-registry";

export interface DocumentEditorProps {
  documentId: string;
  onClose: () => void;
}

export function DocumentEditor({ documentId, onClose }: DocumentEditorProps) {
  const queryClient = useQueryClient();
  const { registerCommand } = useCommands();

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

  const docStatus: string = doc?.status ?? "draft";
  const docType: string = doc?.documentType ?? "";

  // Fetch document lines (server-side filtered by documentId)
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["data", "documentLine", documentId],
    queryFn: async () => {
      const res = await fetch(`/api/data/documentLine?documentId=${documentId}`);
      if (!res.ok) throw new Error("Failed to fetch document lines");
      return res.json();
    },
  });

  // Post mutation (F9)
  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/post`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
    },
  });

  // Register F9 post-document command
  useEffect(() => {
    return registerCommand({
      id: "post-document",
      label: { en: "Post Document", de: "Beleg buchen" },
      shortcut: "F9",
      group: "workflow",
      scope: "context",
      isEnabled: () => docStatus === "draft",
      handler: () => postMutation.mutate(),
    });
  }, [registerCommand, docStatus, postMutation]);

  // Convert (Wandeln) mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/convert`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      onClose();
    },
  });

  // Storno mutation
  const stornoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${documentId}/storno`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "document"] });
      onClose();
    },
  });

  // Escape closes the editor; F10 is handled by the embedded EntityMask
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Button visibility
  const canPost = docStatus === "draft";
  const canWandeln = docStatus === "draft" || docStatus === "posted";
  const canStornieren = docStatus === "posted" && ["R", "r"].includes(docType);

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
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: ["data", "document"] })
            }
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
            columns={[
              { key: "lineNo", header: "Pos.", isNumeric: true, render: (r: any) => <span className="font-mono tabular-nums">{String(r.lineNo ?? 0).padStart(3, "0")}</span> },
              { key: "articleId", header: "Article", render: (r: any) => <span className="font-mono text-[12px]">{r.articleId}</span> },
              { key: "articleTextSnapshot", header: "Description" },
              { key: "quantity", header: "Qty", isNumeric: true, render: (r: any) => <span className="tabular-nums">{r.quantity} {r.unit}</span> },
              { key: "netPrice", header: "Unit Price", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.netPrice ?? 0)}</span> },
              { key: "discountPercentage", header: "Disc.", isNumeric: true, render: (r: any) => <span className="tabular-nums">{r.discountPercentage ?? 0}%</span> },
              { key: "lineTotalNet", header: "Total", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.lineTotalNet ?? 0)}</span> },
            ]}
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
          onClick={async () => {
            await fetch("/api/data/documentLine", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentId,
                position: lines.length + 1,
              }),
            });
            queryClient.invalidateQueries({
              queryKey: ["data", "documentLine"],
            });
          }}
          className="h-6 px-3 rounded-full text-[13px] border border-hairline bg-canvas text-ink-secondary hover:border-primary hover:text-primary transition-colors flex items-center gap-1.5"
        >
          Add Line
        </button>
        <button
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", bubbles: true }));
          }}
          className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors"
        >
          Save (F10)
        </button>

        <div className="flex-1" />

        {/* Wandeln button */}
        {canWandeln && (
          <button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className={`h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors${convertMutation.isPending ? " opacity-40 pointer-events-none" : ""}`}
          >
            Wandeln
          </button>
        )}

        {/* Stornieren button */}
        {canStornieren && (
          <button
            onClick={() => stornoMutation.mutate()}
            disabled={stornoMutation.isPending}
            className={`h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink hover:border-hairline-input transition-colors${stornoMutation.isPending ? " opacity-40 pointer-events-none" : ""}`}
          >
            Stornieren
          </button>
        )}

        {/* Post button */}
        {canPost && (
          <button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending}
            className={`h-7 px-4 rounded-full text-[13px]${postMutation.isPending ? " opacity-40 pointer-events-none" : ""}`}
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
          >
            Post (F9)
          </button>
        )}
      </div>
    </div>
  );
}
