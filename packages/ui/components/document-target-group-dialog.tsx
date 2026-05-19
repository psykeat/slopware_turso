import React from "react";

import { cn } from "../lib/utils";
import { Dialog, DialogContent } from "./dialog";

export interface DocumentTargetGroupCandidate {
  documentGroupId: string;
  name: string;
  documentType: string;
  groupNumber: number;
}

export interface DocumentTargetGroupDialogProps {
  open: boolean;
  title: string;
  description: string;
  candidates: DocumentTargetGroupCandidate[];
  selectedGroupId: string | null;
  confirmLabel: string;
  confirmPendingLabel?: string;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectGroupId: (groupId: string) => void;
  onConfirm: () => void;
}

export function DocumentTargetGroupDialog({
  open,
  title,
  description,
  candidates,
  selectedGroupId,
  confirmLabel,
  confirmPendingLabel,
  isPending = false,
  onOpenChange,
  onSelectGroupId,
  onConfirm,
}: DocumentTargetGroupDialogProps) {
  const effectiveSelected = selectedGroupId ?? candidates[0]?.documentGroupId ?? null;
  const canConfirm = !isPending && !!effectiveSelected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <div className="border-b border-hairline px-5 py-4">
          <h3 className="text-[15px] font-medium text-ink">{title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-mute">{description}</p>
        </div>
        <div className="flex flex-col py-1">
          {candidates.map((c) => {
            const isSelected = effectiveSelected === c.documentGroupId;
            return (
              <button
                key={c.documentGroupId}
                type="button"
                className={cn(
                  "h-9 px-5 text-left text-[13px] transition-colors",
                  isSelected
                    ? "bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] text-ink"
                    : "hover:bg-canvas-soft",
                )}
                onClick={() => onSelectGroupId(c.documentGroupId)}
              >
                <span className="mr-2 font-mono text-[12px] text-ink-secondary">
                  {c.documentType}
                  {String(c.groupNumber).padStart(2, "0")}
                </span>
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-4">
          <button
            type="button"
            className="h-7 rounded-full border border-hairline px-4 text-[13px] text-ink-secondary transition-colors hover:text-ink"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 rounded-full px-4 text-[13px] transition-colors disabled:opacity-40"
            style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
            disabled={!canConfirm}
            onClick={onConfirm}
          >
            {isPending ? (confirmPendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
