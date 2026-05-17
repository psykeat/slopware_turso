import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { useTranslation } from "react-i18next";
import { DataGrid } from "@repo/ui/components/data-grid";
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
  label: any;
  group: string;
}

const GROUP_ORDER = ["master", "organisation", "vertrieb", "lager_artikel", "finanzen", "geodaten"];

function SettingsView() {
  const [selectedKey, setSelectedKey] = useState<string>("company");
  const { t, i18n } = useTranslation("ui");
  const { registerCommand } = useCommands();
  const location = useLocation();
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteFkViolation, setDeleteFkViolation] = useState(false);
  const gridState = useGridUrlState({ defaultPageSize: 50 });

  // Fetch the dynamic settings registry
  const { data: registry = [], isLoading: isRegistryLoading } = useQuery<SettingsRegistryEntry[]>({
    queryKey: ["metadata", "settings-registry"],
    queryFn: async () => {
      const res = await fetch("/api/metadata/settings-registry");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const groups = useMemo(() => {
    const grouped = new Map<string, SettingsRegistryEntry[]>();
    for (const entry of registry) {
      const g = entry.group || "other";
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g)!.push(entry);
    }
    return GROUP_ORDER.filter(id => grouped.has(id)).map(id => ({
      id,
      entities: grouped.get(id)!
    }));
  }, [registry]);

  const selectedEntry = registry.find((e) => e.tableName === selectedKey);
  const tableLabel = selectedEntry 
    ? (typeof selectedEntry.label === 'object' ? (selectedEntry.label[i18n.language] || selectedEntry.label.en) : selectedEntry.label)
    : t(`settings.entities.${selectedKey}`);

  useEffect(() => {
    setSubCrumb(tableLabel);
  }, [tableLabel, setSubCrumb]);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  // Fetch data for the selected entity — paginated
  const { data: entityData, isLoading: isDataLoading } = useQuery({
    queryKey: ["data", selectedKey, gridState.queryParams.page, gridState.queryParams.limit, gridState.queryParams.orderBy, gridState.queryParams.search, gridState.queryParams.filters],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters) p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/data/${selectedKey}?${p}`);
      if (!res.ok) return { data: [], total: 0 };
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
    enabled: !!selectedKey,
  });

  const data = useMemo(() => entityData?.data ?? [], [entityData]);

  useEffect(() => {
    const isDeletable = selectedKey !== "company";
    const unregCreate = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: t("commands.newRecord"), de: "Neu" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: () => true,
      handler: () => {
        // Handled via onRowClick
      },
    });
    const unregDelete = registerCommand({
      id: "delete-record",
      scope: "context",
      label: { en: "Delete", de: "Löschen" },
      shortcut: "F4",
      isEnabled: () => isDeletable && !!editId,
      handler: () => {
        if (editId) { setDeleteId(editId); setDeleteConfirm(true); }
      },
    });
    return () => {
      unregCreate();
      unregEdit();
      unregDelete();
    };
  }, [registerCommand, selectedKey, t, editId]);

  return (
    <div className="flex h-full w-full overflow-hidden sw-root">
      {/* Left sidebar */}
      <div className="w-60 shrink-0 bg-canvas-soft border-r border-hairline flex flex-col overflow-hidden">
        <div className="h-8 flex items-center px-3 shrink-0 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
          {t("nav.settings")}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {/* Custom pages */}
          <div className="mb-4">
            <div className="px-3 mb-1 text-[10px] uppercase tracking-widest font-bold text-ink-mute/60">
              Integration
            </div>
            <Link
              to="/app/settings/import-profiles"
              className={cn(
                "w-full flex items-center h-7 px-3 text-left text-[13px] cursor-pointer transition-colors",
                location.pathname === "/app/settings/import-profiles"
                  ? "bg-primary text-primary-fg"
                  : "text-ink-secondary hover:bg-canvas-soft hover:text-ink",
              )}
            >
              Import Profiles
            </Link>
          </div>

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
          ) : groups.map((group) => (
            <div key={group.id} className="mb-4">
              <div className="px-3 mb-1 text-[10px] uppercase tracking-widest font-bold text-ink-mute/60">
                {t(`settings.groups.${group.id}`)}
              </div>
              {group.entities.map((entity) => {
                const isActive = selectedKey === entity.tableName;
                const label = typeof entity.label === 'object' ? (entity.label[i18n.language] || entity.label.en) : entity.label;
                return (
                  <button
                    key={entity.tableName}
                    onClick={() => { setSelectedKey(entity.tableName); gridState.setPage(1); }}
                    className={cn(
                      "w-full flex items-center h-7 px-3 text-left text-[13px] cursor-pointer transition-colors group",
                      isActive ? "bg-primary text-primary-fg" : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                    )}
                  >
                    <span>{label}</span>
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
          entityName={selectedKey}
          data={data}
          keyExtractor={(row: any) =>
            row[`${selectedKey}Id`] ??
            row.id ??
            row.code ??
            row.iso2Code ??
            row.accountNo ??
            row.batchId ??
            row.rowId
          }
          isLoading={isDataLoading}
          title={tableLabel}
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
          emptyTitle={`${t("empty.noData")} ${tableLabel}`}
          emptySubtitle={t("empty.subtitle")}
          emptyAction={{
            label: `${t("actions.new")} ${tableLabel}`,
            kbd: "F3",
            onClick: () => setShowCreate(true),
          }}
          onRowClick={(row: any) => {
            const id = row[`${selectedKey}Id`] ?? row.id ?? row.code;
            setEditId(id);
            setShowEdit(true);
          }}
          onRowOpen={(row: any) => {
            const id = row[`${selectedKey}Id`] ?? row.id ?? row.code;
            setEditId(id);
            setShowEdit(true);
          }}
          panelId="settings-grid"
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
            onSaved={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
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
            onSaved={() => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
            }}
            className="border-none shadow-none rounded-none m-0"
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={(open) => { setDeleteConfirm(open); if (!open) setDeleteFkViolation(false); }}>
        <DialogContent className="max-w-sm sw-root">
          <div className="p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="text-[13px] text-ink-mute mt-1">{t("form.deleteConfirmBody")}</p>
              {deleteFkViolation && (
                <p className="text-[13px] text-destructive mt-2">{t("form.fkViolationError")}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] border border-hairline hover:bg-canvas-soft"
                onClick={() => { setDeleteConfirm(false); setDeleteFkViolation(false); }}
              >
                {t("actions.cancel")}
              </button>
              {deleteFkViolation && (
                <button
                  type="button"
                  className="h-8 px-4 rounded text-[13px] border border-hairline hover:bg-canvas-soft"
                  onClick={async () => {
                    if (!deleteId) return;
                    await fetch(`/api/data/${selectedKey}/${deleteId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ archived: true }),
                    });
                    setDeleteConfirm(false);
                    setDeleteFkViolation(false);
                    setDeleteId(null);
                    setEditId(null);
                    queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
                    toast.success(t("form.archiveSuccess"));
                  }}
                >
                  {t("actions.archiveInstead")}
                </button>
              )}
              {!deleteFkViolation && (
                <button
                  type="button"
                  className="h-8 px-4 rounded text-[13px] bg-destructive text-white hover:opacity-90"
                  onClick={async () => {
                    if (!deleteId) return;
                    const res = await fetch(`/api/data/${selectedKey}/${deleteId}`, {
                      method: "DELETE",
                    });
                    if (res.status === 409) {
                      setDeleteFkViolation(true);
                      return;
                    }
                    setDeleteConfirm(false);
                    setDeleteFkViolation(false);
                    setDeleteId(null);
                    setEditId(null);
                    queryClient.invalidateQueries({ queryKey: ["data", selectedKey] });
                    toast.success(t("form.deleteSuccess"));
                  }}
                >
                  {t("actions.delete")}
                </button>
              )}
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
