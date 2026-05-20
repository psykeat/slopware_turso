import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/tabs";
import { cn } from "@repo/ui/lib/utils";
import { useDesigner } from "@repo/ui/platform/designer-context";
import { useFocus } from "@repo/ui/platform/focus-manager";
import {
  LayoutGridIcon,
  FormInputIcon,
  Settings2Icon,
  EyeIcon,
  EyeOffIcon,
  PinIcon,
  GripVerticalIcon,
  RotateCcwIcon,
  SaveIcon,
  HistoryIcon,
  CheckIcon,
} from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

// ─── DnD Item ───────────────────────────────────────────────────────────────

interface DnDItem {
  id: string;
  label: string;
  visible: boolean;
  extra?: React.ReactNode;
}

/**
 * Keyboard-first sortable list.
 * Pattern: Tab → handle, Space/Enter → pick-up, Arrows → move, Space/Enter → drop, Esc → cancel.
 */
function SortableList({
  items,
  onMove,
  onToggleVisible,
  renderExtra,
}: {
  items: DnDItem[];
  onMove: (fromId: string, toId: string) => void;
  onToggleVisible: (id: string) => void;
  renderExtra?: (item: DnDItem) => React.ReactNode;
}) {
  const { t } = useTranslation("ui");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  const handleHandleKeyDown = (e: React.KeyboardEvent, id: string) => {
    const idx = items.findIndex((it) => it.id === id);

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (activeId === id) {
        // Drop
        setActiveId(null);
        setStatusMsg(t("designer.dnd.dropped", "Item dropped."));
      } else {
        setActiveId(id);
        setStatusMsg(
          t("designer.dnd.picked", `Picked up ${items[idx]?.label}. Use arrow keys to move.`),
        );
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setActiveId(null);
      setStatusMsg(t("designer.dnd.cancelled", "Move cancelled."));
    } else if (activeId === id) {
      if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        const targetId = items[idx - 1].id;
        onMove(id, targetId);
        setStatusMsg(`Moved to position ${idx}.`);
      } else if (e.key === "ArrowDown" && idx < items.length - 1) {
        e.preventDefault();
        const targetId = items[idx + 1].id;
        onMove(id, targetId);
        setStatusMsg(`Moved to position ${idx + 2}.`);
      }
    }
  };

  return (
    <div className="space-y-1">
      {/* Live region for screen readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {statusMsg}
      </div>

      {items.map((item) => {
        const isActive = activeId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md border px-2 transition-all",
              isActive
                ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] shadow-sm"
                : "border-transparent hover:border-hairline hover:bg-canvas-soft",
              !item.visible && "opacity-50",
            )}
            aria-label={`${item.label}, position ${items.indexOf(item) + 1} of ${items.length}`}
          >
            {/* Drag handle */}
            <button
              type="button"
              className={cn(
                "flex-none cursor-grab rounded-[3px] p-0.5 text-ink-mute transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isActive && "cursor-grabbing text-primary",
              )}
              aria-label={
                isActive
                  ? t(
                      "designer.dnd.handleActive",
                      `Moving ${item.label}. Press Space to drop, Escape to cancel.`,
                    )
                  : t("designer.dnd.handle", `Drag ${item.label}. Press Space or Enter to pick up.`)
              }
              aria-pressed={isActive}
              onKeyDown={(e) => handleHandleKeyDown(e, item.id)}
            >
              <GripVerticalIcon className="size-3.5" />
            </button>

            {/* Label */}
            <span className="flex-1 truncate text-[12px] text-ink">{item.label}</span>

            {/* Extra slot */}
            {renderExtra?.(item)}

            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => onToggleVisible(item.id)}
              className="flex-none rounded-[3px] p-0.5 text-ink-mute transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={item.visible ? t("designer.hide", "Hide") : t("designer.show", "Show")}
              title={item.visible ? t("designer.hide", "Hide") : t("designer.show", "Show")}
            >
              {item.visible ? (
                <EyeIcon className="size-3.5" />
              ) : (
                <EyeOffIcon className="size-3.5" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────

function DesignerSection({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-bold tracking-widest text-ink-mute uppercase">{title}</h3>
      <div className="space-y-1">
        {children ?? (
          <div className="py-2 text-[12px] text-ink-mute italic">No options available.</div>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ entityName }: { entityName: string | null }) {
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!entityName) return;
    setLoading(true);
    fetch(`/api/metadata/history/${entityName}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [entityName]);

  if (!entityName) {
    return <div className="p-2 text-[12px] text-ink-mute italic">No entity selected.</div>;
  }

  if (loading) {
    return <div className="p-2 text-[12px] text-ink-mute">Loading history…</div>;
  }

  if (history.length === 0) {
    return <div className="p-2 text-[12px] text-ink-mute italic">No changes recorded yet.</div>;
  }

  return (
    <div className="space-y-2">
      {history.slice(0, 20).map((entry: any, i: number) => (
        <div
          key={i}
          className="flex flex-col gap-0.5 rounded-md border border-hairline bg-canvas-soft p-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-ink capitalize">{entry.changeType}</span>
            <span className="text-[10px] text-ink-mute">
              {entry.metadataType} · {entry.metadataKey}
            </span>
          </div>
          <div className="text-[10px] text-ink-mute">
            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Designer ────────────────────────────────────────────────────────────

export function InlineDesigner() {
  const {
    isDesignMode,
    toggleDesignMode,
    delta,
    updateColumn,
    moveColumn,
    updateField,
    moveField,
    resetDelta,
  } = useDesigner();
  const { state: focusState } = useFocus();
  const { t } = useTranslation("ui");
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("grid");

  // Auto-switch to relevant tab based on focus area
  React.useEffect(() => {
    if (focusState.area === "grid") setActiveTab("grid");
    else if (focusState.area === "form") setActiveTab("form");
  }, [focusState.area]);

  const entityName = focusState.entity ?? null;

  // ── Column helpers ──────────────────────────────────────────────
  const columnItems: DnDItem[] = delta.columns.map((c) => ({
    id: c.key,
    label: c.key,
    visible: c.visible,
  }));

  const handleSaveLayout = useCallback(async () => {
    if (!entityName) return;
    setIsSaving(true);
    try {
      const layoutDef = {
        columns: delta.columns,
      };
      const res = await fetch(`/api/metadata/layout/${entityName}/grid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(layoutDef),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t("designer.saved", "Layout gespeichert."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [entityName, delta.columns, t]);

  const handleSaveFields = useCallback(async () => {
    if (!entityName) return;
    setIsSaving(true);
    try {
      const promises = delta.fieldConfigs.map((fc) =>
        fetch(`/api/metadata/fields/${entityName}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fieldName: fc.key,
            data: {
              isVisible: fc.visible,
              displayOrder: fc.order,
              ...(fc.labelEnOverride != null && {
                label: { en: fc.labelEnOverride, de: fc.labelDeOverride ?? fc.labelEnOverride },
              }),
              ...(fc.readonlyOverride != null && { readonly: fc.readonlyOverride }),
              ...(fc.requiredOverride != null && { isRequired: fc.requiredOverride }),
            },
          }),
        }),
      );
      await Promise.all(promises);
      toast.success(t("designer.saved", "Felder gespeichert."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [entityName, delta.fieldConfigs, t]);

  const handleReset = useCallback(() => {
    resetDelta();
    toast.info(t("designer.reset", "Zurückgesetzt auf vererbten Zustand."));
  }, [resetDelta, t]);

  return (
    <Sheet open={isDesignMode} onOpenChange={toggleDesignMode} modal={false}>
      <SheetContent
        side="right"
        showCloseButton={true}
        className="flex w-[380px] flex-col border-l border-hairline bg-canvas p-0 shadow-2xl sm:max-w-[380px]"
      >
        {/* Header */}
        <SheetHeader className="shrink-0 border-b border-hairline bg-canvas-soft p-4">
          <div className="flex items-center gap-2">
            <Settings2Icon className="size-4 text-primary" />
            <SheetTitle className="text-[14px] font-semibold">
              {t("designer.title", "Inline Designer")}
            </SheetTitle>
          </div>
          {entityName && (
            <div className="mt-0.5 font-mono text-[11px] tracking-wider text-ink-mute uppercase">
              {entityName}
            </div>
          )}
        </SheetHeader>

        {/* Tabs */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <div className="shrink-0 border-b border-hairline bg-canvas-soft px-4 py-2">
              <TabsList variant="line" className="w-full justify-start gap-4">
                <TabsTrigger value="grid" className="gap-1.5 text-[12px]">
                  <LayoutGridIcon className="size-3.5" />
                  {t("designer.tabs.grid", "Grid")}
                </TabsTrigger>
                <TabsTrigger value="form" className="gap-1.5 text-[12px]">
                  <FormInputIcon className="size-3.5" />
                  {t("designer.tabs.form", "Maske")}
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5 text-[12px]">
                  <HistoryIcon className="size-3.5" />
                  {t("designer.tabs.history", "Verlauf")}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {/* ── Grid Tab ── */}
              <TabsContent value="grid" className="m-0 mt-0 space-y-6">
                {delta.columns.length === 0 ? (
                  <div className="py-4 text-center text-[12px] text-ink-mute italic">
                    {t(
                      "designer.grid.noActiveGrid",
                      "Fokussiere ein Grid, um Spalten zu konfigurieren.",
                    )}
                  </div>
                ) : (
                  <>
                    <DesignerSection title={t("designer.grid.columns", "Spalten")}>
                      <SortableList
                        items={columnItems}
                        onMove={moveColumn}
                        onToggleVisible={(id) =>
                          updateColumn(id, {
                            visible: !delta.columns.find((c) => c.key === id)?.visible,
                          })
                        }
                        renderExtra={(item) => {
                          const col = delta.columns.find((c) => c.key === item.id);
                          return (
                            <button
                              type="button"
                              title={col?.pin ? "Pinning entfernen" : "Links pinnen"}
                              onClick={() =>
                                updateColumn(item.id, { pin: col?.pin ? null : "left" })
                              }
                              className={cn(
                                "flex-none rounded-[3px] p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                col?.pin ? "text-primary" : "text-ink-mute hover:text-ink",
                              )}
                            >
                              <PinIcon className="size-3.5" />
                            </button>
                          );
                        }}
                      />
                    </DesignerSection>
                  </>
                )}
              </TabsContent>

              {/* ── Form Tab ── */}
              <TabsContent value="form" className="m-0 mt-0 space-y-6">
                {delta.fieldConfigs.length === 0 ? (
                  <div className="py-4 text-center text-[12px] text-ink-mute italic">
                    {t(
                      "designer.form.noActiveForm",
                      "Fokussiere eine Maske, um Felder zu konfigurieren.",
                    )}
                  </div>
                ) : (
                  <DesignerSection title={t("designer.form.fields", "Felder")}>
                    <SortableList
                      items={delta.fieldConfigs.map((f) => ({
                        id: f.key,
                        label: f.labelEnOverride ?? f.key,
                        visible: f.visible,
                      }))}
                      onMove={moveField}
                      onToggleVisible={(id) =>
                        updateField(id, {
                          visible: !delta.fieldConfigs.find((f) => f.key === id)?.visible,
                        })
                      }
                    />
                  </DesignerSection>
                )}
              </TabsContent>

              {/* ── History Tab ── */}
              <TabsContent value="history" className="m-0 mt-0">
                <HistoryTab entityName={entityName} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-hairline bg-canvas-soft p-3">
          <div className="text-[10px] text-ink-mute">
            {t(
              "designer.keyboardHint",
              "Space/Enter → aufnehmen  ·  Pfeile → verschieben  ·  Esc → abbrechen",
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="flex h-7 items-center gap-1.5 rounded-full border border-hairline px-3 text-[12px] text-ink-secondary transition-colors hover:border-hairline-input hover:text-ink disabled:opacity-50"
              title={t("designer.reset", "Zurücksetzen")}
            >
              <RotateCcwIcon className="size-3" />
              {t("designer.reset", "Zurücksetzen")}
            </button>
            <button
              type="button"
              onClick={activeTab === "grid" ? handleSaveLayout : handleSaveFields}
              disabled={isSaving || !entityName}
              className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[12px] transition-colors disabled:opacity-50"
              style={{ background: "var(--primary)", color: "var(--primary-fg)" }}
            >
              <SaveIcon className="size-3" />
              {isSaving ? t("designer.saving", "Speichert…") : t("designer.save", "Speichern")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
