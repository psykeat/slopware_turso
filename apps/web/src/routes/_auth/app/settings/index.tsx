import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DataGrid } from "@repo/ui/components/data-grid";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { cn } from "@repo/ui/lib/utils";
import { Skeleton } from "@repo/ui/components/skeleton";

export const Route = createFileRoute("/_auth/app/settings/")({
  component: SettingsPage,
});

interface SettingsRegistryEntry {
  tableName: string;
  label: any;
  group: string;
}

const GROUP_ORDER = ["organisation", "vertrieb", "lager_artikel", "finanzen", "geodaten"];

function SettingsView() {
  const [selectedKey, setSelectedKey] = useState<string>("company");
  const { t, i18n } = useTranslation("ui");
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

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

  // Fetch data for the selected entity
  const { data = [], isLoading: isDataLoading } = useQuery({
    queryKey: ["data", selectedKey],
    queryFn: async () => {
      const res = await fetch(`/api/data/${selectedKey}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedKey,
  });

  useEffect(() => {
    const isSingleton = selectedKey === "company";
    const unregCreate = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: t("commands.newRecord"), de: "Neu" },
      shortcut: "F3",
      isEnabled: () => !isSingleton,
      handler: () => setShowCreate(true),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: () => !isSingleton,
      handler: () => {
        // Handled via onRowClick
      },
    });
    return () => {
      unregCreate();
      unregEdit();
    };
  }, [registerCommand, selectedKey, t]);

  const firstCompanyId = (selectedKey === "company" && data && data.length > 0) 
    ? (data[0].companyId || data[0].id || data[0].code) 
    : null;

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
                    onClick={() => setSelectedKey(entity.tableName)}
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
        {selectedKey === "company" ? (
          <div className="flex-1 overflow-auto p-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-2xl font-light mb-8">{tableLabel}</h1>
              {isDataLoading ? (
                <div className="space-y-4">
                  <div className="h-8 w-64 bg-canvas-soft animate-pulse rounded" />
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-20 bg-canvas-soft animate-pulse rounded" />
                    ))}
                  </div>
                </div>
              ) : firstCompanyId ? (
                <EntityMask
                  entityName={selectedKey}
                  recordId={firstCompanyId}
                  mode="edit"
                  embedded
                  className="p-0 border-none shadow-none"
                  onSaved={() => queryClient.invalidateQueries({ queryKey: ["data", selectedKey] })}
                />
              ) : (
                <div className="p-12 text-center border-2 border-dashed border-hairline rounded-xl">
                  <p className="text-ink-mute">{t("empty.noData")}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
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
            emptyTitle={`${t("empty.noData")} ${tableLabel}`}
            emptySubtitle={t("empty.subtitle")}
            emptyAction={{
              label: `${t("actions.new")} ${tableLabel}`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            onRowClick={(row: any) => {
              setEditId(row[`${selectedKey}Id`] ?? row.id ?? row.code);
              setShowEdit(true);
            }}
            panelId="settings-grid"
          />
        )}
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
    </div>
  );
}

function SettingsPage() {
  return <SettingsView />;
}
