import React from "react";
import { Dialog, DialogContent } from "./dialog";
import { cn } from "../lib/utils";

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
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-hairline">
          <h3 className="text-[15px] font-medium text-ink">{title}</h3>
          <p className="text-[13px] text-ink-mute mt-0.5">{description}</p>
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
                  isSelected ? "bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] text-ink" : "hover:bg-canvas-soft",
                )}
                onClick={() => onSelectGroupId(c.documentGroupId)}
              >
                <span className="font-mono text-[12px] text-ink-secondary mr-2">
                  {c.documentType}
                  {String(c.groupNumber).padStart(2, "0")}
                </span>
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-hairline flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-7 px-4 rounded-full text-[13px] border border-hairline text-ink-secondary hover:text-ink transition-colors"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-4 rounded-full text-[13px] disabled:opacity-40 transition-colors"
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
