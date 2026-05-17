import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";

// ─── types ────────────────────────────────────────────────────────────────────

interface TrackingEditorProps {
  documentId: string;
  documentLineId: string;
  trackingMode: "serial" | "batch";
  lineQty: number;
  documentType: string;
  articleId: string;
  warehouseId?: string | null;
  isPosted: boolean;
}

// ─── TrackingEditor ───────────────────────────────────────────────────────────

export function TrackingEditor({
  documentId,
  documentLineId,
  trackingMode,
  lineQty,
  documentType,
  articleId,
  warehouseId,
  isPosted,
}: TrackingEditorProps) {
  const queryClient = useQueryClient();

  // ── local input state ──
  const [inputVal, setInputVal] = useState("");
  const [inputQty, setInputQty] = useState("1");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  // ── derived ──
  const isOutbound = ["L", "R", "G", "E", "g", "e"].includes(documentType);
  const isNewLine = !documentLineId || documentLineId.startsWith("new-");

  // ── fetch existing tracking rows ──
  const { data: existingRows = [] } = useQuery({
    queryKey: ["tracking", documentId, documentLineId],
    queryFn: async () => {
      const r = await fetch(
        `/api/documents/${documentId}/lines/${documentLineId}/tracking`,
      );
      return r.ok ? r.json() : [];
    },
    enabled: !!documentLineId && !isNewLine,
  });

  // ── fetch available serial numbers (outbound + serial) ──
  const { data: availableSerials = [] } = useQuery({
    queryKey: ["serial-numbers", articleId, "in_stock"],
    queryFn: async () => {
      const r = await fetch(
        `/api/articles/${articleId}/serial-numbers?status=in_stock`,
      );
      return r.ok ? r.json() : [];
    },
    enabled: trackingMode === "serial" && isOutbound && !!articleId,
  });

  // ── fetch available batches (outbound + batch) ──
  const { data: availableBatches = [] } = useQuery({
    queryKey: ["batches", articleId, warehouseId],
    queryFn: async () => {
      const params = warehouseId ? `?warehouseId=${warehouseId}` : "";
      const r = await fetch(`/api/articles/${articleId}/batches${params}`);
      return r.ok ? r.json() : [];
    },
    enabled: trackingMode === "batch" && isOutbound && !!articleId,
  });

  // ── mutations ──
  const addMutation = useMutation({
    mutationFn: async (row: {
      serialNumberId?: string;
      batchNo?: string;
      qty: string;
    }) => {
      const r = await fetch(
        `/api/documents/${documentId}/lines/${documentLineId}/tracking`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        },
      );
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tracking", documentId, documentLineId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      const r = await fetch(
        `/api/documents/${documentId}/lines/${documentLineId}/tracking/${trackingId}`,
        { method: "DELETE" },
      );
      if (!r.ok) throw new Error(await r.text());
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tracking", documentId, documentLineId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // ── completion state ──
  const trackingSum = (existingRows as any[]).reduce(
    (s: number, r: any) => s + Number(r.qty),
    0,
  );
  const isComplete = trackingSum >= lineQty;
  const isOvershot = trackingSum > lineQty;

  // ── submit helpers ──
  function submitSerial() {
    const sn = inputVal.trim();
    if (!sn) return;
    const found = (availableSerials as any[]).find(
      (s: any) => s.serialNo === sn,
    );
    if (isOutbound && !found) {
      toast.error(`Seriennummer "${sn}" nicht verfügbar`);
      return;
    }
    addMutation.mutate({ serialNumberId: found?.serialNumberId, qty: "1" });
    setInputVal("");
    setSuggestions([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submitBatch() {
    const charge = inputVal.trim();
    const qty = Number(inputQty);
    if (!charge || !qty || isNaN(qty)) return;
    addMutation.mutate({ batchNo: charge, qty: String(qty) });
    setInputVal("");
    setInputQty("1");
    setSuggestions([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function selectSuggestion(s: any) {
    if (trackingMode === "serial") {
      setInputVal(s.serialNo);
      setSuggestions([]);
      addMutation.mutate({ serialNumberId: s.serialNumberId, qty: "1" });
      setInputVal("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputVal(s.batchNo);
      setSuggestions([]);
      setTimeout(() => qtyRef.current?.focus(), 50);
    }
  }

  // ── keyboard handlers ──
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionIdx((i) => Math.max(i - 1, 0));
    } else if (
      (e.key === "Enter" || e.key === "Tab") &&
      suggestions.length > 0 &&
      suggestions[suggestionIdx]
    ) {
      e.preventDefault();
      selectSuggestion(suggestions[suggestionIdx]);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (trackingMode === "serial" && inputVal.trim()) {
        e.preventDefault();
        submitSerial();
      } else if (
        trackingMode === "batch" &&
        inputVal.trim() &&
        e.key === "Tab"
      ) {
        e.preventDefault();
        qtyRef.current?.focus();
        qtyRef.current?.select();
      } else if (
        trackingMode === "batch" &&
        inputVal.trim() &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        submitBatch();
      }
    }
  }

  function handleQtyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      submitBatch();
    } else if (e.key === "Escape") {
      inputRef.current?.focus();
    }
  }

  // ── render ──
  return (
    <div className="bg-canvas-soft border-t border-hairline px-4 py-3 ml-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-mute">
          {trackingMode === "serial" ? "Seriennummern" : "Chargen"}
        </span>
        {(!isComplete || isOvershot) && (
          <span
            className={cn(
              "text-[11px] font-medium",
              isOvershot ? "text-destructive" : "text-amber-600",
            )}
          >
            {trackingSum}/{lineQty} erfasst
          </span>
        )}
        {isComplete && !isOvershot && (
          <span className="text-[11px] font-medium text-emerald-600">
            vollständig
          </span>
        )}
      </div>

      {/* Existing rows */}
      {(existingRows as any[]).map((row: any) => (
        <div
          key={row.trackingId}
          className="flex items-center gap-2 py-0.5 text-[13px]"
        >
          <span className="text-ink flex-1">
            {trackingMode === "serial"
              ? (row.serialNo ?? row.serialNumberId)
              : row.batchNo}
          </span>
          {trackingMode === "batch" && (
            <span className="text-ink-mute w-16 text-right">{row.qty}</span>
          )}
          {!isPosted && (
            <button
              onClick={() => deleteMutation.mutate(row.trackingId)}
              className="text-ink-mute hover:text-destructive transition-colors"
              title="Entfernen"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* Input row (only when not posted) */}
      {!isPosted && !isNewLine && (
        <div className="flex items-center gap-2 mt-1">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              className="h-6 w-full border bg-canvas rounded px-2 text-[13px] outline-none border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary"
              placeholder={
                trackingMode === "serial"
                  ? "Seriennummer..."
                  : "Chargennummer..."
              }
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                const q = e.target.value.toLowerCase();
                if (trackingMode === "serial" && isOutbound) {
                  setSuggestions(
                    (availableSerials as any[])
                      .filter((s: any) =>
                        s.serialNo.toLowerCase().includes(q),
                      )
                      .slice(0, 8),
                  );
                  setSuggestionIdx(0);
                } else if (trackingMode === "batch" && isOutbound) {
                  setSuggestions(
                    (availableBatches as any[])
                      .filter((b: any) =>
                        b.batchNo.toLowerCase().includes(q),
                      )
                      .slice(0, 8),
                  );
                  setSuggestionIdx(0);
                }
              }}
              onKeyDown={handleKeyDown}
            />
            {/* Dropdown */}
            {suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded border border-hairline bg-canvas shadow-md">
                {suggestions.map((s: any, i: number) => (
                  <button
                    type="button"
                    key={s.serialNumberId ?? s.batchNo}
                    className={cn(
                      "w-full text-left px-2 py-1 text-[13px] cursor-pointer hover:bg-canvas-soft",
                      i === suggestionIdx && "bg-canvas-soft",
                    )}
                    onMouseEnter={() => setSuggestionIdx(i)}
                    onClick={() => selectSuggestion(s)}
                  >
                    {trackingMode === "serial"
                      ? s.serialNo
                      : `${s.batchNo} (${s.balance} verfügbar)`}
                  </button>
                ))}
              </div>
            )}
          </div>
          {trackingMode === "batch" && (
            <input
              ref={qtyRef}
              className="h-6 w-20 border bg-canvas rounded px-2 text-[13px] text-right outline-none border-hairline-input focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)] focus-visible:border-primary"
              placeholder="Menge"
              value={inputQty}
              onChange={(e) => setInputQty(e.target.value)}
              onKeyDown={handleQtyKeyDown}
            />
          )}
        </div>
      )}
    </div>
  );
}
