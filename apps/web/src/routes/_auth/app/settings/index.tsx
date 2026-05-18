import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { useTranslation } from "react-i18next";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { cn } from "@repo/ui/lib/utils";
import { Skeleton } from "@repo/ui/components/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/app/settings/")({
  component: SettingsPage,
});

interface SettingsRegistryEntry {
  tableName: string;
  label: Record<string, string> | string;
  group: string | null;
}

const GROUP_ORDER = ["master", "organisation", "vertrieb", "lager_artikel", "finanzen", "geodaten"];
const SETTINGS_GRID_PANEL_ID = "settings-grid";

function resolveSettingsLabel(label: SettingsRegistryEntry["label"], language: string) {
  if (typeof label === "string") return label;
  return label[language] || label.en || label.de || "";
}

function resolveGroupLabel(groupId: string, t: (key: string, options?: { defaultValue?: string }) => string) {
  if (groupId === "master") {
    return t("settings.groups.master", { defaultValue: "Master" });
  }
  if (groupId === "other") {
    return t("settings.groups.other", { defaultValue: "Other" });
  }
  return t(`settings.groups.${groupId}`, { defaultValue: groupId });
}

function getSettingsRowId(selectedKey: string, row: Record<string, any>) {
  return (
    row[`${selectedKey}Id`] ??
    row.id ??
    row.code ??
    row.iso2Code ??
    row.accountNo ??
    row.batchId ??
    row.rowId
  );
}

function SettingsView() {
  const [selectedKey, setSelectedKey] = useState<string>("company");
  const { t, i18n } = useTranslation("ui");
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();
  const sidebarItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const settingsGridRef = useRef<DataGridHandle>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const gridState = useGridUrlState({ defaultPageSize: 50 });
  const { page, pageSize, sort, search, filters, setPageSize, setSort, setSearch, setFilters, queryParams } = gridState;
  const setPageRef = useRef(gridState.setPage);

  useEffect(() => {
    setPageRef.current = gridState.setPage;
  }, [gridState.setPage]);

  // Fetch the dynamic settings registry
  const { data: registry = [], isLoading: isRegistryLoading } = useQuery<SettingsRegistryEntry[]>({
    queryKey: ["metadata", "settings-registry"],
    queryFn: async () => {
      const res = await fetch("/api/metadata/settings-registry");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const orderedEntries = useMemo(() => {
    const localized = registry.map((entry) => ({
      tableName: entry.tableName,
      label: resolveSettingsLabel(entry.label, i18n.language),
      group: entry.group || "other",
    }));

    return localized.sort((a, b) => {
      const aGroup = GROUP_ORDER.indexOf(a.group);
      const bGroup = GROUP_ORDER.indexOf(b.group);
      const groupDelta = (aGroup === -1 ? GROUP_ORDER.length : aGroup) - (bGroup === -1 ? GROUP_ORDER.length : bGroup);
      if (groupDelta !== 0) return groupDelta;
      const labelDelta = a.label.localeCompare(b.label, i18n.language);
      if (labelDelta !== 0) return labelDelta;
      return a.tableName.localeCompare(b.tableName);
    });
  }, [registry, i18n.language]);

  const groupedEntries = useMemo(() => {
    const grouped = new Map<string, typeof orderedEntries>();
    for (const entry of orderedEntries) {
      if (!grouped.has(entry.group)) grouped.set(entry.group, []);
      grouped.get(entry.group)!.push(entry);
    }
    return GROUP_ORDER.filter((id) => grouped.has(id))
      .map((id) => ({ id, entities: grouped.get(id)! }))
      .concat(grouped.has("other") ? [{ id: "other", entities: grouped.get("other")! }] : []);
  }, [orderedEntries]);

  const selectedEntry = orderedEntries.find((e) => e.tableName === selectedKey);
  const tableLabel = selectedEntry?.label || t(`settings.entities.${selectedKey}`);
  const selectedIndex = useMemo(() => {
    const idx = orderedEntries.findIndex((entry) => entry.tableName === selectedKey);
    return idx >= 0 ? idx : 0;
  }, [orderedEntries, selectedKey]);

  useEffect(() => {
    setSubCrumb(tableLabel);
  }, [tableLabel, setSubCrumb]);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  useEffect(() => {
    sidebarItemRefs.current[selectedKey]?.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);

  const resetEntityDialogs = useCallback(() => {
    setShowCreate(false);
    setShowEdit(false);
    setDeleteConfirm(false);
    setEditId(null);
    setDeleteId(null);
  }, []);

  const selectEntityByIndex = useCallback((index: number) => {
    const entry = orderedEntries[index];
    if (!entry) return;
    resetEntityDialogs();
    setSelectedKey(entry.tableName);
    setPageRef.current(1);
    requestAnimationFrame(() => settingsGridRef.current?.restoreFocus(null));
  }, [orderedEntries, resetEntityDialogs]);

  const selectEntity = useCallback((entityName: string) => {
    resetEntityDialogs();
    setSelectedKey(entityName);
    setPageRef.current(1);
    requestAnimationFrame(() => settingsGridRef.current?.restoreFocus(null));
  }, [resetEntityDialogs]);

  // Fetch data for the selected entity — paginated
  const { data: entityData, isLoading: isDataLoading } = useQuery({
    queryKey: ["data", selectedKey, queryParams.page, queryParams.limit, queryParams.orderBy, queryParams.search, queryParams.filters],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(queryParams.page),
        limit: String(queryParams.limit),
      });
      if (queryParams.orderBy) p.set("orderBy", queryParams.orderBy);
      if (queryParams.search) p.set("search", queryParams.search);
      if (queryParams.filters) p.set("filters", JSON.stringify(queryParams.filters));
      const res = await fetch(`/api/data/${selectedKey}?${p}`);
      if (!res.ok) return { data: [], total: 0 };
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
    enabled: !!selectedKey,
  });

  const data = useMemo(() => entityData?.data ?? [], [entityData]);

  useEffect(() => {
    const modalOpen = showCreate || showEdit || deleteConfirm;
    const isFocusedRow = (state: { panel: string | null; entity: string | null; recordId: string | null }) =>
      state.panel === SETTINGS_GRID_PANEL_ID &&
      state.entity === selectedKey &&
      !!state.recordId;

    const unregDown = registerCommand({
      id: "settings-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Settings Item", de: "Nächster Einstellungs-Eintrag" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => !modalOpen && orderedEntries.length > 0,
      handler: () => selectEntityByIndex(Math.min(selectedIndex + 1, orderedEntries.length - 1)),
    });
    const unregUp = registerCommand({
      id: "settings-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Settings Item", de: "Vorheriger Einstellungs-Eintrag" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => !modalOpen && orderedEntries.length > 0,
      handler: () => selectEntityByIndex(Math.max(selectedIndex - 1, 0)),
    });
    const unregCreate = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neu" },
      shortcut: "F3",
      isEnabled: () => !modalOpen,
      handler: () => setShowCreate(true),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (state) => !modalOpen && isFocusedRow(state),
      handler: (state) => {
        if (!state.recordId) return;
        setEditId(state.recordId);
        setShowEdit(true);
      },
    });
    const unregDelete = registerCommand({
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Delete", de: "Löschen" },
      shortcut: "F4",
      isEnabled: (state) => !modalOpen && isFocusedRow(state) && selectedKey !== "company",
      handler: (state) => {
        if (!state.recordId) return;
        setDeleteId(state.recordId);
        setDeleteConfirm(true);
      },
    });
    return () => {
      unregDown();
      unregUp();
      unregCreate();
      unregEdit();
      unregDelete();
    };
  }, [registerCommand, selectedKey, orderedEntries, selectedIndex, showCreate, showEdit, deleteConfirm, selectEntityByIndex, t]);

  return (
    <div className="flex h-full w-full overflow-hidden sw-root">
      {/* Left sidebar */}
      <div className="w-60 shrink-0 bg-canvas-soft border-r border-hairline flex flex-col overflow-hidden">
        <div className="h-8 flex items-center px-3 shrink-0 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
          {t("nav.settings")}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {isRegistryLoading ? (
             <div className="px-3 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-2 w-16 opacity-50" />
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-full" />
                  </div>
                ))}
             </div>
          ) : groupedEntries.map((group) => (
            <div key={group.id} className="mb-4">
              <div className="px-3 mb-1 text-[10px] uppercase tracking-widest font-bold text-ink-mute/60">
                {resolveGroupLabel(group.id, t)}
              </div>
              {group.entities.map((entity) => {
                const isActive = selectedKey === entity.tableName;
                return (
                  <button
                    key={entity.tableName}
                    ref={(node) => { sidebarItemRefs.current[entity.tableName] = node; }}
                    onClick={() => selectEntity(entity.tableName)}
                    className={cn(
                      "w-full flex items-center h-7 px-3 text-left text-[13px] cursor-pointer transition-colors group",
                      isActive ? "bg-primary text-primary-fg" : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                    )}
                  >
                    <span>{entity.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 overflow-hidden bg-canvas flex flex-col">
        <DataGrid
          ref={settingsGridRef}
          entityName={selectedKey}
          data={data}
          keyExtractor={(row: any) => getSettingsRowId(selectedKey, row)}
          isLoading={isDataLoading}
          title={tableLabel}
          totalCount={entityData?.total}
          page={page}
          pageSize={pageSize}
          sort={sort}
          onPageChange={gridState.setPage}
          onPageSizeChange={setPageSize}
          onSortChange={setSort}
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onFiltersChange={setFilters}
          emptyTitle={`${t("empty.noData")} ${tableLabel}`}
          emptySubtitle={t("empty.subtitle")}
          emptyAction={{
            label: `${t("actions.new")} ${tableLabel}`,
            kbd: "F3",
            onClick: () => setShowCreate(true),
          }}
          onRowClick={(row: any) => {
            const id = getSettingsRowId(selectedKey, row);
            setEditId(id);
            setShowEdit(true);
          }}
          onRowOpen={(row: any) => {
            const id = getSettingsRowId(selectedKey, row);
            setEditId(id);
            setShowEdit(true);
          }}
          panelId={SETTINGS_GRID_PANEL_ID}
        />
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden sw-root">
        <EntityMask
          entityName={selectedKey}
          mode="create"
          title={`${t("actions.new")} ${tableLabel}`}
          onCancel={() => setShowCreate(false)}
          onSaved={(record) => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
            settingsGridRef.current?.restoreFocus((record as any)?.[`${selectedKey}Id`] ?? (record as any)?.id ?? null);
          }}
          className="border-none shadow-none rounded-none m-0"
        />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden sw-root">
        <EntityMask
          entityName={selectedKey}
          recordId={editId}
          mode="edit"
          title={`${t("actions.edit")} ${tableLabel}`}
          onCancel={() => setShowEdit(false)}
          onSaved={(record) => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
            settingsGridRef.current?.restoreFocus((record as any)?.[`${selectedKey}Id`] ?? editId ?? null);
          }}
          className="border-none shadow-none rounded-none m-0"
        />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm sw-root">
          <div className="p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="text-[13px] text-ink-mute mt-1">{t("form.deleteConfirmBody")}</p>
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] border border-hairline hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] bg-destructive text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  await fetch(`/api/data/${selectedKey}/${deleteId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ archived: true }),
                  });
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  setEditId(null);
                  queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
                  toast.success(t("form.archiveSuccess"));
                }}
              >
                {t("actions.archive")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsPage() {
  return <SettingsView />;
}
