import { DataGrid } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

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
        if (editId) {
          setDeleteId(editId);
          setDeleteConfirm(true);
        }
      },
    });

    return () => {
      unregCreate();
      unregDelete();
    };
  }, [registerCommand, selectedKey, t, editId, isEntity]);

  return (
    <div className="sw-root flex h-full w-full overflow-hidden">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-hairline bg-canvas-soft">
        <div className="flex h-8 shrink-0 items-center border-b border-hairline px-3 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
          {t("nav.administration")}
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="mb-4">
            <div className="mb-1 px-3 text-[10px] font-bold tracking-widest text-ink-mute/60 uppercase">
              Infrastructure
            </div>
            {ADMIN_ENTITIES.filter((e) => e.group === "infrastructure").map((entity) => (
              <button
                key={entity.key}
                onClick={() => {
                  setSelectedKey(entity.key);
                  gridState.setPage(1);
                }}
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
          <div className="mb-4">
            <div className="mb-1 px-3 text-[10px] font-bold tracking-widest text-ink-mute/60 uppercase">
              System
            </div>
            {ADMIN_ENTITIES.filter((e) => e.group === "system").map((entity) => (
              <button
                key={entity.key}
                onClick={() => {
                  setSelectedKey(entity.key);
                  gridState.setPage(1);
                }}
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
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
        {selectedKey === "llm-config" ? (
          <LlmConfigView />
        ) : (
          <DataGrid
            entityName={selectedKey}
            data={data}
            keyExtractor={(row: any) =>
              row[`${selectedKey}Id`] ??
              row.id ??
              row.organizationId ??
              row.companyId ??
              row.userTenantId
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
              const id =
                row[`${selectedKey}Id`] ??
                row.id ??
                row.organizationId ??
                row.companyId ??
                row.userTenantId;
              setEditId(id);
              setShowEdit(true);
            }}
            onRowOpen={(row: any) => {
              const id =
                row[`${selectedKey}Id`] ??
                row.id ??
                row.organizationId ??
                row.companyId ??
                row.userTenantId;
              setEditId(id);
              setShowEdit(true);
            }}
            panelId="admin-grid"
          />
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sw-root max-w-2xl overflow-hidden p-0">
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
            className="m-0 rounded-none border-none shadow-none"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent
          className={cn(
            "sw-root overflow-hidden p-0",
            selectedKey === "user" ? "max-w-4xl" : "max-w-2xl",
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
              className="m-0 rounded-none border-none shadow-none"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
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
                onClick={() => setDeleteConfirm(false)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="h-8 rounded bg-destructive px-4 text-[13px] text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  await fetch(`/api/admin/data/${selectedKey}/${deleteId}`, {
                    method: "DELETE",
                  });
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  setEditId(null);
                  queryClient.invalidateQueries({ queryKey: ["admin", "data", selectedKey] });
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
