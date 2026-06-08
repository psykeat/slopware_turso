import {
  HistoryIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  GripVerticalIcon,
  SaveIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "../lib/utils";
import { useDesigner } from "../platform/designer-context";
import { useFocus } from "../platform/focus-manager";
import { Input } from "./input";

type DragItemKind = "frame" | "field";

function parseDragItem(value: string | null): { kind: DragItemKind; id: string } | null {
  if (!value) return null;
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if ((kind !== "frame" && kind !== "field") || !id) return null;
  return { kind, id };
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "∅";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <dt className="text-ink-muted w-24 shrink-0 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className={cn("min-w-0 text-[12px] text-ink-secondary", mono && "font-mono text-[11px]")}>
        {value}
      </dd>
    </div>
  );
}

function CompactSection({
  title,
  icon,
  right,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <h3 className="text-ink-muted text-[10px] font-bold tracking-[0.18em] uppercase">
            {title}
          </h3>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(root: HTMLElement | null) {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

export function InlineDesigner() {
  const { t } = useTranslation("ui");
  const { state: focusState } = useFocus();
  const {
    isDesignMode,
    activeSurface,
    activeSurfaceState,
    delta,
    selectedNodes,
    closeDesignMode,
    resetDelta,
    saveDesign,
    applyDesign,
    reconcileDesign,
    moveFrame,
    moveField,
    moveFieldToEnd,
    updateFrameLabel,
    updateDelta,
    selectDesignerNodes,
  } = useDesigner();
  const [busyAction, setBusyAction] = useState<"save" | "apply" | "reconcile" | null>(null);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [editingFrameLabel, setEditingFrameLabel] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const frameLabelInputRef = useRef<HTMLInputElement>(null);
  const ignoreNextFrameBlurRef = useRef(false);

  const snapshot = useMemo(
    () => ({
      entityName: activeSurfaceState?.entityName ?? focusState.entity ?? null,
      surface: activeSurfaceState?.surface ?? activeSurface,
      versionInfo: activeSurfaceState?.versionInfo ?? null,
      patchOps: activeSurfaceState?.draftPatchOps ?? [],
      conflicts: activeSurfaceState?.conflicts ?? [],
      history: activeSurfaceState?.history ?? [],
      selectedNodes,
    }),
    [
      activeSurface,
      activeSurfaceState?.conflicts,
      activeSurfaceState?.draftPatchOps,
      activeSurfaceState?.entityName,
      activeSurfaceState?.history,
      activeSurfaceState?.surface,
      activeSurfaceState?.versionInfo,
      focusState.entity,
      selectedNodes,
    ],
  );

  const frameNodes = useMemo(
    () =>
      [...(activeSurfaceState?.nodes ?? [])]
        .filter((node) => node.kind === "group-frame")
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
        ),
    [activeSurfaceState?.nodes],
  );

  const fieldNodes = useMemo(
    () =>
      [...(activeSurfaceState?.nodes ?? [])]
        .filter((node) => node.kind === "field-ref" || node.kind === "jsonb-field")
        .sort(
          (left, right) =>
            left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
        ),
    [activeSurfaceState?.nodes],
  );

  const nodeById = useMemo(
    () => new Map((activeSurfaceState?.nodes ?? []).map((item) => [item.id, item])),
    [activeSurfaceState?.nodes],
  );

  const fieldsByFrameId = useMemo(() => {
    const grouped = new Map<string, typeof fieldNodes>();
    for (const field of fieldNodes) {
      const frameId = field.parentId ?? "default";
      const bucket = grouped.get(frameId);
      if (bucket) {
        bucket.push(field);
      } else {
        grouped.set(frameId, [field]);
      }
    }
    return grouped;
  }, [fieldNodes]);

  const node = selectedNodes[0] ?? null;
  const patchOps = snapshot.patchOps;
  const history = snapshot.history;
  const conflicts = snapshot.conflicts;
  const versionInfo = snapshot.versionInfo;
  const entityName = snapshot.entityName;

  const handleSave = async () => {
    setBusyAction("save");
    try {
      await saveDesign();
    } finally {
      setBusyAction(null);
    }
  };

  const handleApply = async () => {
    setBusyAction("apply");
    try {
      await applyDesign();
    } finally {
      setBusyAction(null);
    }
  };

  const handleReconcile = async () => {
    setBusyAction("reconcile");
    try {
      await reconcileDesign();
    } finally {
      setBusyAction(null);
    }
  };

  const handleReset = () => {
    resetDelta();
  };

  const handleClose = () => {
    closeDesignMode();
  };

  const clearDragState = () => {
    updateDelta({ activeDragId: null, hoverTargetId: null });
  };

  const handleDragStart = (kind: DragItemKind, id: string) => (event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${kind}:${id}`);
    updateDelta({ activeDragId: id, hoverTargetId: id });
  };

  const handleDragEnd = () => {
    clearDragState();
  };

  const handleFrameDrop = (targetFrameId: string) => (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = parseDragItem(event.dataTransfer.getData("text/plain"));
    const sourceId = payload?.id ?? delta.activeDragId;
    const sourceNode = sourceId ? nodeById.get(sourceId) : null;

    if (!sourceNode || sourceId === targetFrameId) {
      clearDragState();
      return;
    }

    if (sourceNode.kind === "group-frame") {
      moveFrame(sourceId!, targetFrameId);
    } else if (sourceNode.kind === "field-ref" || sourceNode.kind === "jsonb-field") {
      moveFieldToEnd(sourceId!, targetFrameId);
    }

    clearDragState();
  };

  const handleFieldDrop = (targetFieldId: string) => (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = parseDragItem(event.dataTransfer.getData("text/plain"));
    const sourceId = payload?.id ?? delta.activeDragId;
    const sourceNode = sourceId ? nodeById.get(sourceId) : null;

    if (!sourceNode || sourceId === targetFieldId) {
      clearDragState();
      return;
    }

    if (sourceNode.kind === "group-frame") {
      clearDragState();
      return;
    }

    moveField(sourceId!, targetFieldId);
    clearDragState();
  };

  useEffect(() => {
    if (!isDesignMode) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const preferred = closeButtonRef.current;
      const focusable = getFocusableElements(panelRef.current);
      (preferred ?? focusable[0] ?? panelRef.current)?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [isDesignMode]);

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeDesignMode();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(panelRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const lastIndex = focusable.length - 1;

    if (event.shiftKey) {
      if (currentIndex <= 0) {
        event.preventDefault();
        focusable[lastIndex]?.focus();
      }
      return;
    }

    if (currentIndex === -1 || currentIndex === lastIndex) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  };

  useEffect(() => {
    if (!editingFrameId) {
      return;
    }

    requestAnimationFrame(() => {
      frameLabelInputRef.current?.focus();
      frameLabelInputRef.current?.select();
    });
  }, [editingFrameId]);

  const startFrameEdit = (frameId: string, label: string) => {
    ignoreNextFrameBlurRef.current = false;
    setEditingFrameId(frameId);
    setEditingFrameLabel(label);
  };

  const commitFrameEdit = (frameId: string, nextLabel: string) => {
    const frame = frameNodes.find((item) => item.id === frameId);
    setEditingFrameId(null);

    if (!frame) {
      return;
    }

    if (nextLabel !== frame.label) {
      updateFrameLabel(frameId, nextLabel);
    }
  };

  const cancelFrameEdit = () => {
    ignoreNextFrameBlurRef.current = true;
    setEditingFrameId(null);
  };

  if (!isDesignMode) {
    return null;
  }

  const historyPreview = history.slice().reverse().slice(0, 6);

  return (
    <aside className="pointer-events-none fixed right-3 bottom-3 z-50 w-[min(94vw,420px)]">
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={t("designer.title", "Inline Designer")}
        className="pointer-events-auto flex max-h-[min(72vh,680px)] flex-col overflow-hidden rounded-xl border border-hairline bg-canvas shadow-[0_24px_48px_rgba(13,37,61,0.18)] outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline bg-canvas-soft px-3 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Settings2Icon className="size-4 text-primary" />
              <div className="truncate text-[14px] font-semibold text-ink">
                {t("designer.title", "Inline Designer")}
              </div>
            </div>
            <div className="text-ink-muted mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 font-mono">
                {entityName ?? t("designer.noEntity", "No entity")}
              </span>
              <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 font-mono">
                {snapshot.surface ?? t("designer.noSurface", "No surface")}
              </span>
              <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5 font-mono">
                {focusState.area ?? t("designer.focus.none", "no focus")}
              </span>
            </div>
          </div>

          <button
            type="button"
            ref={closeButtonRef}
            onClick={handleClose}
            className="text-ink-muted grid size-7 shrink-0 place-items-center rounded-full border border-hairline transition-colors hover:border-hairline-input hover:text-ink"
            title={t("designer.close", "Close designer")}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <CompactSection
            title={t("designer.frames", "Frames")}
            icon={<Settings2Icon className="text-ink-muted size-3.5" />}
          >
            {frameNodes.length > 0 ? (
              <div className="space-y-2">
                {frameNodes.map((frame) => {
                  const isEditing = editingFrameId === frame.id;
                  const frameFields = fieldsByFrameId.get(frame.id) ?? [];
                  const isDraggingFrame = delta.activeDragId === frame.id;
                  const isHoverTarget = delta.hoverTargetId === frame.id;

                  return (
                    <div
                      key={frame.id}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        updateDelta({ hoverTargetId: frame.id });
                      }}
                      onDragLeave={(event) => {
                        if (
                          event.relatedTarget instanceof Node &&
                          event.currentTarget.contains(event.relatedTarget)
                        ) {
                          return;
                        }
                        if (delta.hoverTargetId === frame.id) {
                          updateDelta({ hoverTargetId: null });
                        }
                      }}
                      onDrop={handleFrameDrop(frame.id)}
                      className={cn(
                        "rounded-lg border border-hairline bg-canvas-soft px-2.5 py-2 text-[11px] transition-colors",
                        isDraggingFrame && "opacity-60",
                        isHoverTarget &&
                          "border-primary/55 bg-primary/[0.04] ring-1 ring-primary/20",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          draggable
                          onDragStart={handleDragStart("frame", frame.id)}
                          onDragEnd={handleDragEnd}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          className="text-ink-muted grid size-6 shrink-0 place-items-center rounded border border-hairline bg-canvas transition-colors hover:border-hairline-input hover:text-ink"
                          aria-label={t("designer.frameDrag", "Drag frame")}
                        >
                          <GripVerticalIcon className="size-3" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-ink-muted font-mono">{frame.id}</span>
                            <span className="text-ink-muted rounded-full border border-hairline bg-canvas px-2 py-0.5 font-mono text-[10px]">
                              {frameFields.length}
                            </span>
                          </div>
                          <div className="mt-2">
                            {isEditing ? (
                              <Input
                                ref={frameLabelInputRef}
                                value={editingFrameLabel}
                                onChange={(event) => setEditingFrameLabel(event.target.value)}
                                onBlur={() => {
                                  if (ignoreNextFrameBlurRef.current) {
                                    ignoreNextFrameBlurRef.current = false;
                                    return;
                                  }
                                  commitFrameEdit(frame.id, editingFrameLabel);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    commitFrameEdit(frame.id, editingFrameLabel);
                                  }
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelFrameEdit();
                                  }
                                }}
                                className="h-7 text-[12px]"
                                aria-label={t("designer.frameLabel", "Frame label")}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => startFrameEdit(frame.id, frame.label)}
                                className={cn(
                                  "w-full rounded-md border border-transparent px-2 py-1 text-left text-[12px] font-medium text-ink transition-colors",
                                  "hover:border-hairline hover:bg-canvas",
                                )}
                              >
                                {frame.label || t("designer.node.unlabeled", "Unlabeled")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {frameFields.length > 0 ? (
                          frameFields.map((field) => {
                            const isDraggingField = delta.activeDragId === field.id;
                            const isHoveringField = delta.hoverTargetId === field.id;

                            return (
                              <div
                                key={field.id}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  updateDelta({ hoverTargetId: field.id });
                                }}
                                onDragLeave={(event) => {
                                  if (
                                    event.relatedTarget instanceof Node &&
                                    event.currentTarget.contains(event.relatedTarget)
                                  ) {
                                    return;
                                  }
                                  if (delta.hoverTargetId === field.id) {
                                    updateDelta({ hoverTargetId: null });
                                  }
                                }}
                                onDrop={handleFieldDrop(field.id)}
                                className={cn(
                                  "flex items-center gap-2 rounded-md border border-transparent bg-canvas px-2 py-1.5 transition-colors",
                                  isDraggingField && "opacity-60",
                                  isHoveringField &&
                                    "border-primary/55 bg-primary/[0.04] ring-1 ring-primary/20",
                                )}
                              >
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={handleDragStart("field", field.id)}
                                  onDragEnd={handleDragEnd}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    selectDesignerNodes("triview-detail", [field.id], entityName);
                                  }}
                                  className="text-ink-muted grid size-5 shrink-0 place-items-center rounded border border-hairline transition-colors hover:border-hairline-input hover:text-ink"
                                  aria-label={t("designer.fieldDrag", "Drag field")}
                                >
                                  <GripVerticalIcon className="size-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectDesignerNodes("triview-detail", [field.id], entityName)
                                  }
                                  className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-ink transition-colors hover:text-primary"
                                >
                                  {field.label}
                                </button>
                                <span className="text-ink-muted shrink-0 font-mono text-[9px] uppercase">
                                  {field.kind === "jsonb-field" ? "jsonb" : "schema"}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-ink-muted rounded-md border border-dashed border-hairline px-2 py-2 text-[11px]">
                            {t("designer.frameEmpty", "Drop a field here")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-ink-muted rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px]">
                {t("designer.frames.empty", "No frames available.")}
              </div>
            )}
          </CompactSection>

          <CompactSection
            title={t("designer.selection", "Selection")}
            icon={<HistoryIcon className="text-ink-muted size-3.5" />}
            right={
              <div className="text-ink-muted flex items-center gap-1.5 text-[10px]">
                <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5">
                  {selectedNodes.length}
                </span>
                <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5">
                  {conflicts.length}
                </span>
                <span className="rounded-full border border-hairline bg-canvas px-2 py-0.5">
                  {patchOps.length}
                </span>
              </div>
            }
          >
            {node ? (
              <dl className="space-y-1 rounded-lg border border-hairline bg-canvas-soft p-2.5">
                <InfoRow label={t("designer.node.id", "Node")} value={node.id} mono />
                <InfoRow label={t("designer.node.kind", "Kind")} value={node.kind} mono />
                <InfoRow
                  label={t("designer.node.label", "Label")}
                  value={node.label || t("designer.node.unlabeled", "Unlabeled")}
                />
                <InfoRow label={t("designer.node.surface", "Surface")} value={node.surface} mono />
                <InfoRow
                  label={t("designer.node.parent", "Parent")}
                  value={node.parentId ?? t("designer.node.root", "root")}
                  mono
                />
                <InfoRow label={t("designer.node.order", "Order")} value={node.displayOrder} />
                <InfoRow
                  label={t("designer.node.flags", "Flags")}
                  value={[
                    node.visible
                      ? t("designer.visible", "visible")
                      : t("designer.hidden", "hidden"),
                    node.readonly
                      ? t("designer.readonly", "readonly")
                      : t("designer.editable", "editable"),
                    node.required
                      ? t("designer.required", "required")
                      : t("designer.notRequired", "not required"),
                  ].join(" · ")}
                />
                <InfoRow
                  label={t("designer.node.conflict", "Conflict")}
                  value={node.conflictState}
                  mono
                />
                <InfoRow
                  label={t("designer.node.version", "Version")}
                  value={node.versionInfo.clientRevision}
                  mono
                />
                {node.path ? (
                  <InfoRow label={t("designer.node.path", "Path")} value={node.path} mono />
                ) : null}
                {node.styleTokenBinding ? (
                  <InfoRow
                    label={t("designer.node.style", "Style")}
                    value={node.styleTokenBinding}
                    mono
                  />
                ) : null}
                <InfoRow
                  label={t("designer.node.base", "Base")}
                  value={node.versionInfo.baseVersion ?? t("designer.node.none", "none")}
                  mono
                />
                <InfoRow
                  label={t("designer.node.derived", "Derived")}
                  value={node.versionInfo.derivedFromVersion ?? t("designer.node.none", "none")}
                  mono
                />
                {node.width || node.pin ? (
                  <InfoRow
                    label={t("designer.node.layout", "Layout")}
                    value={[node.width ?? "auto", node.pin ?? "none"].join(" · ")}
                    mono
                  />
                ) : null}
              </dl>
            ) : (
              <div className="text-ink-muted rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px]">
                {t("designer.node.empty", "No node selected.")}
              </div>
            )}
          </CompactSection>

          <CompactSection
            title={t("designer.patches", "Queued patches")}
            icon={<SaveIcon className="text-ink-muted size-3.5" />}
          >
            {patchOps.length > 0 ? (
              <div className="space-y-1.5">
                {patchOps.slice(0, 8).map((op, index) => (
                  <div
                    key={`${op.op}-${op.nodeKey}-${index}`}
                    className="rounded-lg border border-hairline bg-canvas-soft px-2.5 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink uppercase">{op.op}</span>
                      <span className="text-ink-muted font-mono">{op.nodeKey}</span>
                    </div>
                    <div className="text-ink-muted mt-1 space-y-0.5">
                      {op.path ? <div className="font-mono">{op.path}</div> : null}
                      {op.parentKey ? (
                        <div className="font-mono">
                          {t("designer.patch.parent", "parent")}: {op.parentKey}
                        </div>
                      ) : null}
                      {op.index !== undefined ? (
                        <div className="font-mono">
                          {t("designer.patch.index", "index")}: {op.index}
                        </div>
                      ) : null}
                      {"value" in op ? (
                        <div className="truncate font-mono">
                          {t("designer.patch.value", "value")}: {formatValue(op.value)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-ink-muted rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px]">
                {t("designer.patch.empty", "No queued patch operations.")}
              </div>
            )}
          </CompactSection>

          <CompactSection
            title={t("designer.conflicts", "Conflicts")}
            icon={<RefreshCwIcon className="text-ink-muted size-3.5" />}
          >
            {conflicts.length > 0 ? (
              <div className="space-y-1.5">
                {conflicts.slice(0, 4).map((conflict) => (
                  <div
                    key={conflict.id}
                    className="rounded-lg border border-amber-200 bg-[color-mix(in_oklab,var(--canvas)_82%,var(--primary)_4%)] px-2.5 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink uppercase">{conflict.state}</span>
                      <span className="text-ink-muted font-mono">{conflict.nodeKey}</span>
                    </div>
                    <div className="mt-1 text-ink-secondary">{conflict.message}</div>
                    {conflict.reviewNote ? (
                      <div className="text-ink-muted mt-1 font-mono">{conflict.reviewNote}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-ink-muted rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px]">
                {t("designer.conflicts.empty", "No conflicts queued.")}
              </div>
            )}
          </CompactSection>

          <CompactSection
            title={t("designer.history", "History")}
            icon={<HistoryIcon className="text-ink-muted size-3.5" />}
            right={
              versionInfo ? (
                <div className="text-ink-muted rounded-full border border-hairline bg-canvas px-2 py-0.5 font-mono text-[10px]">
                  {versionInfo.clientRevision}
                </div>
              ) : null
            }
          >
            {historyPreview.length > 0 ? (
              <div className="space-y-1.5">
                {historyPreview.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-hairline bg-canvas-soft px-2.5 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink uppercase">{entry.action}</span>
                      <span className="text-ink-muted font-mono">{entry.revision}</span>
                    </div>
                    <div className="mt-1 text-ink-secondary">{entry.summary}</div>
                    <div className="text-ink-muted mt-1 font-mono">
                      {entry.nodeKey ?? t("designer.history.scope", "surface")} ·{" "}
                      {new Date(entry.at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-ink-muted rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px]">
                {t("designer.history.empty", "No history yet.")}
              </div>
            )}
          </CompactSection>
        </div>

        <div className="border-t border-hairline bg-canvas-soft p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-hairline-input hover:text-ink"
            >
              <RotateCcwIcon className="size-3.5" />
              {t("designer.reset", "Reset")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busyAction !== null}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] text-[var(--primary-fg)] transition-colors disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              <SaveIcon className="size-3.5" />
              {busyAction === "save" ? t("designer.saving", "Saving…") : t("designer.save", "Save")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={busyAction !== null}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] text-[var(--primary-fg)] transition-colors disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              <SaveIcon className="size-3.5" />
              {busyAction === "apply"
                ? t("designer.applying", "Applying…")
                : t("designer.apply", "Apply")}
            </button>
            <button
              type="button"
              onClick={handleReconcile}
              disabled={busyAction !== null}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-hairline-input hover:text-ink disabled:opacity-50"
            >
              <RefreshCwIcon className="size-3.5" />
              {busyAction === "reconcile"
                ? t("designer.reconciling", "Reconciling…")
                : t("designer.reconcile", "Reconcile")}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-ink-muted text-[10px]">
              {t(
                "designer.focusHint",
                "Focus is locked to the designer while active. Escape closes the surface.",
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-hairline-input hover:text-ink"
            >
              <XIcon className="size-3.5" />
              {t("designer.close", "Close")}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
