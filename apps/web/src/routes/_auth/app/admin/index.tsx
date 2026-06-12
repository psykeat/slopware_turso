import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useGridUrlState } from "#/hooks/use-grid-url-state";

import { LlmConfigView } from "./-llm-config";
import { UserManagementView } from "./-user-management";

export const Route = createFileRoute("/_auth/app/admin/")({
  beforeLoad: ({ context }) => {
    if (!(context.user as any)?.isSystemAdmin) {
      throw redirect({ to: "/app/addresses" });
    }
  },
  component: AdminPage,
});

const ADMIN_ENTITIES = [
  { key: "tenant", label: "Tenants", group: "infrastructure" },
  { key: "user", label: "Users", group: "infrastructure" },
  { key: "organization", label: "Organizations", group: "infrastructure" },
  { key: "company", label: "Companies", group: "infrastructure" },
  { key: "llm-config", label: "KI-Konfiguration", group: "system" },
];

function AdminView() {
  const [selectedKey, setSelectedKey] = useState<string>("tenant");
  const { t } = useTranslation("ui");
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();
  const { state: focusState } = useFocus();
  const gridRef = useRef<DataGridHandle>(null);
  const lastSyncRef = useRef<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const gridState = useGridUrlState({ defaultPageSize: 50 });
  const selectedEntry = ADMIN_ENTITIES.find((e) => e.key === selectedKey);
  const viewLabel = selectedEntry?.label ?? selectedKey;
  const isEntity = selectedKey !== "llm-config";
  const modalOpen = showCreate || showEdit || deleteConfirm;

  // Sync DataGrid focus → activeId
  useEffect(() => {
    if (focusState.entity === selectedKey && focusState.recordId !== lastSyncRef.current) {
      lastSyncRef.current = focusState.recordId;
      setActiveId(focusState.recordId ?? null);
    }
  }, [focusState.entity, focusState.recordId, selectedKey]);

  const switchEntity = useCallback(
    (entityKey: string) => {
      setSelectedKey(entityKey);
      setActiveId(null);
      lastSyncRef.current = null;
      gridState.setPage(1);
      gridState.setSearch("");
      gridState.setFilters([]);
      gridState.setSort(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridState.setPage, gridState.setSearch, gridState.setFilters, gridState.setSort],
  );

  const restoreGrid = useCallback(
    (id?: string | null) => {
      gridRef.current?.restoreFocus(id !== undefined ? id : (activeId ?? null));
    },
    [activeId],
  );

  useEffect(() => {
    setSubCrumb(viewLabel);
  }, [viewLabel, setSubCrumb]);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const { data: entityData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "admin",
      "data",
      selectedKey,
      gridState.queryParams.page,
      gridState.queryParams.limit,
      gridState.queryParams.orderBy,
      gridState.queryParams.search,
      gridState.queryParams.filters,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters)
        p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/admin/data/${selectedKey}?${p}`);
      if (!res.ok) return { data: [], total: 0 };
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
    enabled: isEntity,
  });

  const data = useMemo(() => entityData?.data ?? [], [entityData]);

  const getRowId = useCallback(
    (row: any): string =>
      row[`${selectedKey}Id`] ??
      row.id ??
      row.organizationId ??
      row.companyId ??
      row.userTenantId,
    [selectedKey],
  );

  // Sidebar navigation: Ctrl+ArrowDown / Ctrl+ArrowUp
  useEffect(() => {
    const allKeys = ADMIN_ENTITIES.map((e) => e.key);

    const navigate = (delta: number) => {
      const currentIndex = allKeys.indexOf(selectedKey);
      const nextIndex = (currentIndex + delta + allKeys.length) % allKeys.length;
      switchEntity(allKeys[nextIndex]!);
      setTimeout(() => gridRef.current?.focusContainer(), 0);
    };

    const unregDown = registerCommand({
      id: "admin-tree-nav-down",
      scope: "context",
      group: "navigation",
      label: { en: "Next Entity", de: "Nächste Entität" },
      shortcut: "Ctrl+ArrowDown",
      isEnabled: () => !modalOpen,
      handler: () => navigate(1),
    });
    const unregUp = registerCommand({
      id: "admin-tree-nav-up",
      scope: "context",
      group: "navigation",
      label: { en: "Previous Entity", de: "Vorherige Entität" },
      shortcut: "Ctrl+ArrowUp",
      isEnabled: () => !modalOpen,
      handler: () => navigate(-1),
    });

    return () => {
      unregDown();
      unregUp();
    };
  }, [registerCommand, selectedKey, switchEntity, modalOpen]);

  // CRUD commands: F3 New · F2 Edit · F4 Delete
  useEffect(() => {
    if (!isEntity) return;

    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });

    const unregF2 = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (s) => !!s.recordId && s.entity === selectedKey,
      handler: () => setShowEdit(true),
    });

    const unregF4 = registerCommand({
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("actions.delete"), de: "Löschen" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === selectedKey,
      handler: (s) => {
        if (!s.recordId) return;
        setDeleteId(s.recordId);
        setDeleteConfirm(true);
      },
    });

    return () => {
      unregF3();
      unregF2();
      unregF4();
    };
  }, [registerCommand, selectedKey, t, isEntity]);

  return (
    <div className="sw-root flex h-full w-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
        <div className="flex h-8 shrink-0 items-center border-b border-hairline px-3 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {t("nav.administration")}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {(["infrastructure", "system"] as const).map((group) => (
            <div key={group} className="mb-4">
              <div className="mb-1 px-3 text-[10px] font-bold tracking-widest text-ink-mute/60 uppercase">
                {group === "infrastructure" ? "Infrastructure" : "System"}
              </div>
              {ADMIN_ENTITIES.filter((e) => e.group === group).map((entity) => (
                <button
                  key={entity.key}
                  onClick={() => switchEntity(entity.key)}
                  className={cn(
                    "group flex h-7 w-full cursor-pointer items-center px-3 text-left text-[13px] transition-colors",
                    selectedKey === entity.key
                      ? "bg-primary text-primary-fg"
                      : "text-ink-secondary hover:bg-canvas-soft hover:text-ink",
                  )}
                >
                  <span>{entity.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        {selectedKey === "llm-config" ? (
          <LlmConfigView />
        ) : (
          <DataGrid
            ref={gridRef}
            entityName={selectedKey}
            data={data}
            keyExtractor={getRowId}
            isLoading={isDataLoading}
            title={viewLabel}
            totalCount={entityData?.total}
            page={gridState.page}
            pageSize={gridState.pageSize}
            sort={gridState.sort}
            onPageChange={gridState.setPage}
            onPageSizeChange={gridState.setPageSize}
            onSortChange={gridState.setSort}
            search={gridState.search}
            onSearchChange={gridState.setSearch}
            filters={gridState.filters}
            onFiltersChange={gridState.setFilters}
            onRowOpen={() => setShowEdit(true)}
            panelId="admin-grid"
            emptyTitle={`No ${viewLabel} yet.`}
            emptySubtitle={`Press F3 to create the first ${viewLabel.toLowerCase()}.`}
            emptyAction={{
              label: `${t("actions.new")} ${viewLabel}`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            className="h-full rounded-none border-none"
          />
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sw-root max-w-2xl overflow-hidden p-0">
          <EntityMask
            entityName={selectedKey}
            mode="create"
            title={`${t("actions.new")} ${viewLabel}`}
            onCancel={() => setShowCreate(false)}
            onSaved={(record: any) => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
              restoreGrid(record?.[`${selectedKey}Id`] ?? record?.id ?? null);
            }}
            apiBase="/api/admin/data"
            className="m-0 rounded-none border-none shadow-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={(open) => { if (!open) { setShowEdit(false); restoreGrid(); } }}>
        <DialogContent
          className={cn(
            "sw-root overflow-hidden p-0",
            selectedKey === "user" ? "max-w-4xl" : "max-w-2xl",
          )}
        >
          {selectedKey === "user" && activeId ? (
            <UserManagementView
              userId={activeId}
              onCancel={() => { setShowEdit(false); restoreGrid(); }}
              onSaved={() => {
                setShowEdit(false);
                queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
                restoreGrid();
              }}
            />
          ) : activeId ? (
            <EntityMask
              entityName={selectedKey}
              recordId={activeId}
              mode="edit"
              title={`${t("actions.edit")} ${viewLabel}`}
              onCancel={() => { setShowEdit(false); restoreGrid(); }}
              onSaved={(record: any) => {
                setShowEdit(false);
                queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
                restoreGrid(record?.[`${selectedKey}Id`] ?? record?.id ?? activeId);
              }}
              apiBase="/api/admin/data"
              className="m-0 rounded-none border-none shadow-none"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(false); restoreGrid(); } }}>
        <DialogContent className="sw-root max-w-sm">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">Eintrag hart löschen?</h3>
              <p className="mt-1 text-[13px] text-ink-mute">
                Diese Aktion ist dauerhaft und nur für Administration bzw. Tests gedacht.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => { setDeleteConfirm(false); restoreGrid(); }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="h-8 rounded bg-destructive px-4 text-[13px] text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  const res = await fetch(`/api/admin/data/${selectedKey}/${deleteId}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    if ((body as any).fkViolation) {
                      toast.error(
                        "Datensatz kann nicht gelöscht werden: abhängige Einträge vorhanden.",
                      );
                    } else {
                      toast.error("Löschen fehlgeschlagen.");
                    }
                    setDeleteConfirm(false);
                    restoreGrid();
                    return;
                  }
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  setActiveId(null);
                  lastSyncRef.current = null;
                  setShowEdit(false);
                  queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
                  toast.success("Datensatz gelöscht.");
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminPage() {
  return <AdminView />;
}
