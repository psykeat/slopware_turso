import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { executeCapability } from "../lib/capability-client";
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
  autoFocusToken?: string | null;
  onAdvance?: () => void;
  onAutoFocusConsumed?: () => void;
}

interface TrackingRow {
  trackingId: string;
  serialNumberId: string | null;
  serialNo: string | null;
  batchNo: string | null;
  qty: string;
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
  autoFocusToken,
  onAdvance,
  onAutoFocusConsumed,
}: TrackingEditorProps) {
  const queryClient = useQueryClient();

  // ── local input state ──
  const [inputVal, setInputVal] = useState("");
  const [inputQty, setInputQty] = useState("1");
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  // ── derived ──
  const isOutbound = ["L", "R", "G", "E", "g", "e"].includes(documentType);
  const isNewLine = !documentLineId || documentLineId.startsWith("new-");
  const trimmedInput = inputVal.trim();

  // ── fetch existing tracking rows ──
  const { data: existingRows = [] } = useQuery({
    queryKey: ["tracking", documentId, documentLineId],
    queryFn: async () => {
      const { data } = await executeCapability<{ items: TrackingRow[] }>(
        "sales.documentLine.tracking",
        { documentLineId },
      );
      return data.items;
    },
    enabled: !!documentLineId && !isNewLine,
  });

  // ── fetch available serial numbers (outbound + serial) ──
  const { data: availableSerials = [] } = useQuery({
    queryKey: ["serial-numbers", articleId, "in_stock"],
    queryFn: async () => {
      const r = await fetch(`/api/articles/${articleId}/serial-numbers?status=in_stock`);
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

  const availableSerialRows = useMemo(
    () => availableSerials as Array<{ serialNumberId: string; serialNo: string; status?: string }>,
    [availableSerials],
  );
  const availableBatchRows = useMemo(
    () =>
      availableBatches as Array<{
        batchNo: string;
        balance: string | number;
        warehouseId?: string | null;
      }>,
    [availableBatches],
  );

  const serialSuggestions = useMemo(
    () =>
      availableSerialRows
        .filter((row) => row.serialNo.toLowerCase().includes(trimmedInput.toLowerCase()))
        .slice(0, 8),
    [availableSerialRows, trimmedInput],
  );

  const batchSuggestions = useMemo(() => {
    const grouped = new Map<string, { batchNo: string; balance: number }>();
    for (const row of availableBatchRows) {
      const balance = Number(row.balance ?? 0);
      const current = grouped.get(row.batchNo);
      grouped.set(row.batchNo, {
        batchNo: row.batchNo,
        balance: (current?.balance ?? 0) + balance,
      });
    }
    return Array.from(grouped.values())
      .filter((row) => row.batchNo.toLowerCase().includes(trimmedInput.toLowerCase()))
      .slice(0, 8);
  }, [availableBatchRows, trimmedInput]);

  const serialLookup = useMemo(
    () => new Map(availableSerialRows.map((row) => [row.serialNo, row] as const)),
    [availableSerialRows],
  );

  const batchLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of availableBatchRows) {
      map.set(row.batchNo, (map.get(row.batchNo) ?? 0) + Number(row.balance ?? 0));
    }
    return map;
  }, [availableBatchRows]);

  const activeSuggestions = trackingMode === "serial" ? serialSuggestions : batchSuggestions;
  const exactSerial = trimmedInput ? (serialLookup.get(trimmedInput) ?? null) : null;
  const exactBatchBalance = trimmedInput ? (batchLookup.get(trimmedInput) ?? null) : null;
  const hasInput = trimmedInput.length > 0;

  // ── mutations ──
  const addMutation = useMutation({
    mutationFn: async (row: {
      serialNumberId?: string;
      serialNo?: string;
      batchNo?: string;
      qty: string;
    }) => {
      const { data } = await executeCapability("sales.documentLineTracking.add", {
        documentId,
        documentLineId,
        ...row,
      });
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tracking", documentId, documentLineId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (trackingId: string) => {
      await executeCapability("sales.documentLineTracking.remove", {
        documentId,
        documentLineId,
        trackingId,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tracking", documentId, documentLineId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // ── completion state ──
  const trackingSum = (existingRows as any[]).reduce((s: number, r: any) => s + Number(r.qty), 0);
  const isComplete = trackingSum >= lineQty;
  const isOvershot = trackingSum > lineQty;

  useEffect(() => {
    if (!autoFocusToken || isPosted) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    onAutoFocusConsumed?.();
  }, [autoFocusToken, isPosted, onAutoFocusConsumed]);

  // ── submit helpers ──
  function submitSerial() {
    const sn = trimmedInput;
    if (!sn) return;
    const found = serialLookup.get(sn);
    if (isOutbound && !found) {
      toast.error(`Seriennummer "${sn}" nicht verfügbar`);
      return;
    }
    if (isOutbound) {
      addMutation.mutate({ serialNumberId: found?.serialNumberId, qty: "1" });
    } else {
      addMutation.mutate({ serialNo: sn, qty: "1" });
    }
    setInputVal("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submitBatch() {
    const charge = trimmedInput;
    const qty = Number(inputQty);
    if (!charge || !qty || isNaN(qty)) return;
    addMutation.mutate({ batchNo: charge, qty: String(qty) });
    setInputVal("");
    setInputQty("1");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function selectSuggestion(s: any) {
    if (trackingMode === "serial") {
      setInputVal(s.serialNo);
      addMutation.mutate({ serialNumberId: s.serialNumberId, qty: "1" });
      setInputVal("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputVal(s.batchNo);
      setTimeout(() => qtyRef.current?.focus(), 50);
    }
  }

  // ── keyboard handlers ──
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === "Tab") && isComplete) {
      e.preventDefault();
      onAdvance?.();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeSuggestions.length === 0) return;
      setSuggestionIdx((i) => Math.min(i + 1, activeSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeSuggestions.length === 0) return;
      setSuggestionIdx((i) => Math.max(i - 1, 0));
    } else if (
      (e.key === "Enter" || e.key === "Tab") &&
      activeSuggestions.length > 0 &&
      activeSuggestions[suggestionIdx]
    ) {
      e.preventDefault();
      selectSuggestion(activeSuggestions[suggestionIdx]);
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (trackingMode === "serial" && inputVal.trim()) {
        e.preventDefault();
        submitSerial();
      } else if (trackingMode === "batch" && inputVal.trim() && e.key === "Tab") {
        e.preventDefault();
        qtyRef.current?.focus();
        qtyRef.current?.select();
      } else if (trackingMode === "batch" && inputVal.trim() && e.key === "Enter") {
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
    <div className="ml-6 border-t border-hairline bg-canvas-soft px-4 py-3">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
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
          <span className="text-[11px] font-medium text-emerald-600">vollständig</span>
        )}
      </div>

      {/* Existing rows */}
      {(existingRows as any[]).map((row: any) => (
        <div key={row.trackingId} className="flex items-center gap-2 py-0.5 text-[13px]">
          <span className="flex-1 text-ink">
            {trackingMode === "serial" ? (row.serialNo ?? row.serialNumberId) : row.batchNo}
          </span>
          {trackingMode === "batch" && (
            <span className="w-16 text-right text-ink-mute">{row.qty}</span>
          )}
          {!isPosted && (
            <button
              onClick={() => deleteMutation.mutate(row.trackingId)}
              className="text-ink-mute transition-colors hover:text-destructive"
              title="Entfernen"
            >
              <Trash2Icon className="size-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* Input row (only when not posted) */}
      {!isPosted && !isNewLine && (
        <div className="mt-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              className="h-6 w-full rounded border border-hairline-input bg-canvas px-2 text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)]"
              placeholder={trackingMode === "serial" ? "Seriennummer..." : "Chargennummer..."}
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                setSuggestionIdx(0);
              }}
              onKeyDown={handleKeyDown}
            />
            {hasInput && isOutbound && (
              <div className="mt-1 text-[11px] text-ink-mute">
                {trackingMode === "serial" ? (
                  exactSerial ? (
                    <span className="text-emerald-600">Verfügbar: {exactSerial.serialNo}</span>
                  ) : (
                    <span className="text-destructive">Nicht verfügbar</span>
                  )
                ) : (
                  <span>
                    Verfügbar:{" "}
                    <span
                      className={
                        exactBatchBalance != null ? "text-emerald-600" : "text-ink-secondary"
                      }
                    >
                      {exactBatchBalance != null ? `${exactBatchBalance}` : "0"}
                    </span>
                  </span>
                )}
              </div>
            )}
            {hasInput && !isOutbound && (
              <div className="mt-1 text-[11px] text-ink-mute">
                Keine Verfügbarkeitsprüfung in diesem Belegtyp
              </div>
            )}
            {/* Dropdown */}
            {activeSuggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded border border-hairline bg-canvas shadow-md">
                {activeSuggestions.map((s: any, i: number) => (
                  <button
                    type="button"
                    key={s.serialNumberId ?? s.batchNo}
                    className={cn(
                      "w-full cursor-pointer px-2 py-1 text-left text-[13px] hover:bg-canvas-soft",
                      i === suggestionIdx && "bg-canvas-soft",
                    )}
                    onMouseEnter={() => setSuggestionIdx(i)}
                    onClick={() => selectSuggestion(s)}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate">
                        {trackingMode === "serial" ? s.serialNo : s.batchNo}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-mute">
                        {trackingMode === "serial"
                          ? "available"
                          : `${Number(s.balance ?? 0)} verfügbar`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {trackingMode === "batch" && (
            <input
              ref={qtyRef}
              className="h-6 w-20 rounded border border-hairline-input bg-canvas px-2 text-right text-[13px] outline-none focus-visible:border-primary focus-visible:ring-[2px] focus-visible:ring-[color-mix(in_oklab,var(--primary)_20%,transparent)]"
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
