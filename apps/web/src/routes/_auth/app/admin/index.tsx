import { createFileRoute, redirect } from "@tanstack/react-router";
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

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const gridState = useGridUrlState({ defaultPageSize: 50 });

  const selectedEntry = ADMIN_ENTITIES.find((e) => e.key === selectedKey);
  const viewLabel = selectedEntry?.label || selectedKey;

  useEffect(() => {
    setSubCrumb(viewLabel);
  }, [viewLabel, setSubCrumb]);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const isEntity = selectedKey !== "llm-config";

  const { data: entityData, isLoading: isDataLoading } = useQuery({
    queryKey: ["admin", "data", selectedKey, gridState.queryParams.page, gridState.queryParams.limit, gridState.queryParams.orderBy, gridState.queryParams.search, gridState.queryParams.filters],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters) p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/admin/data/${selectedKey}?${p}`);
      if (!res.ok) return { data: [], total: 0 };
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
    enabled: isEntity,
  });

  const data = useMemo(() => entityData?.data ?? [], [entityData]);

  useEffect(() => {
    if (!isEntity) return;

    const unregCreate = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: t("commands.newRecord"), de: "Neu" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    
    const unregDelete = registerCommand({
      id: "delete-record",
      scope: "context",
      label: { en: "Delete", de: "Löschen" },
      shortcut: "F4",
      isEnabled: () => !!editId,
      handler: () => {
        if (editId) { setDeleteId(editId); setDeleteConfirm(true); }
      },
    });
    
    return () => {
      unregCreate();
      unregDelete();
    };
  }, [registerCommand, selectedKey, t, editId, isEntity]);

  return (
    <div className="flex h-full w-full overflow-hidden sw-root">
      {/* Left sidebar */}
      <div className="w-60 shrink-0 bg-canvas-soft border-r border-hairline flex flex-col overflow-hidden">
        <div className="h-8 flex items-center px-3 shrink-0 border-b border-hairline text-[11px] uppercase tracking-wider font-medium text-ink-mute">
          {t("nav.administration")}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="mb-4">
             <div className="px-3 mb-1 text-[10px] uppercase tracking-widest font-bold text-ink-mute/60">
                Infrastructure
             </div>
             {ADMIN_ENTITIES.filter(e => e.group === "infrastructure").map((entity) => (
                <button
                  key={entity.key}
                  onClick={() => { setSelectedKey(entity.key); gridState.setPage(1); }}
                  className={cn(
                    "w-full flex items-center h-7 px-3 text-left text-[13px] cursor-pointer transition-colors group",
                    selectedKey === entity.key ? "bg-primary text-primary-fg" : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                  )}
                >
                  <span>{entity.label}</span>
                </button>
             ))}
          </div>
          <div className="mb-4">
             <div className="px-3 mb-1 text-[10px] uppercase tracking-widest font-bold text-ink-mute/60">
                System
             </div>
             {ADMIN_ENTITIES.filter(e => e.group === "system").map((entity) => (
                <button
                  key={entity.key}
                  onClick={() => { setSelectedKey(entity.key); gridState.setPage(1); }}
                  className={cn(
                    "w-full flex items-center h-7 px-3 text-left text-[13px] cursor-pointer transition-colors group",
                    selectedKey === entity.key ? "bg-primary text-primary-fg" : "text-ink-secondary hover:bg-canvas-soft hover:text-ink"
                  )}
                >
                  <span>{entity.label}</span>
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-w-0 overflow-hidden bg-canvas flex flex-col">
        {selectedKey === "llm-config" ? (
          <LlmConfigView />
        ) : (
          <DataGrid
            entityName={selectedKey}
            data={data}
            keyExtractor={(row: any) =>
              row[`${selectedKey}Id`] ?? row.id ?? row.organizationId ?? row.companyId ?? row.userTenantId
            }
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
            onRowClick={(row: any) => {
              const id = row[`${selectedKey}Id`] ?? row.id ?? row.organizationId ?? row.companyId ?? row.userTenantId;
              setEditId(id);
              setShowEdit(true);
            }}
            onRowOpen={(row: any) => {
              const id = row[`${selectedKey}Id`] ?? row.id ?? row.organizationId ?? row.companyId ?? row.userTenantId;
              setEditId(id);
              setShowEdit(true);
            }}
            panelId="admin-grid"
          />
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden sw-root">
          <EntityMask
            entityName={selectedKey}
            mode="create"
            title={`${t("actions.new")} ${viewLabel}`}
            onCancel={() => setShowCreate(false)}
            onSaved={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
            }}
            apiBase="/api/admin/data"
            className="border-none shadow-none rounded-none m-0"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent 
            className={cn(
                "p-0 overflow-hidden sw-root",
                selectedKey === "user" ? "sm:max-w-4xl" : "sm:max-w-2xl"
            )}
        >
          {selectedKey === "user" && editId ? (
            <UserManagementView
              userId={editId}
              onCancel={() => setShowEdit(false)}
              onSaved={() => {
                setShowEdit(false);
                queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
              }}
            />
          ) : (
            <EntityMask
              entityName={selectedKey}
              recordId={editId}
              mode="edit"
              title={`${t("actions.edit")} ${viewLabel}`}
              onCancel={() => setShowEdit(false)}
              onSaved={() => {
                setShowEdit(false);
                queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
              }}
              apiBase="/api/admin/data"
              className="border-none shadow-none rounded-none m-0"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm sw-root">
          <div className="p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-[15px] font-medium text-ink">Eintrag deaktivieren?</h3>
              <p className="text-[13px] text-ink-mute mt-1">Der Eintrag wird deaktiviert und ist für Benutzer nicht mehr sichtbar.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] border border-hairline hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="h-8 px-4 rounded text-[13px] bg-destructive text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  await fetch(`/api/admin/data/${selectedKey}/${deleteId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ archived: true }),
                  });
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  setEditId(null);
                  queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
                }}
              >
                Deaktivieren
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
