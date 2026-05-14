import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";

export const Route = createFileRoute("/_auth/app/addresses")({
  component: AddressesModule,
});

function AddressesModule() {
  const { state: focusState, setFocus } = useFocus();
  const { registerCommand, executeCommand } = useCommands();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | undefined>();

  // Fetch addresses
  const { data: addresses = [], isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "address"],
    queryFn: async () => {
      const res = await fetch("/api/data/address");
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json();
    },
  });

  // Fetch categories for tree
  const { data: categories = [], isLoading: isTreeLoading } = useQuery({
    queryKey: ["data", "addressCategory"],
    queryFn: async () => {
      const res = await fetch("/api/data/addressCategory");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      return data.map((c: any): TreeNode => ({
        id: c.categoryId,
        label: c.name?.en || c.name?.de || c.name || "Unnamed Category",
        count: undefined,
      }));
    },
  });

  // Fetch contacts for selected address
  const { data: contacts = [] } = useQuery({
    queryKey: ["data", "addressContact", focusState.recordId],
    queryFn: async () => {
      const res = await fetch("/api/data/addressContact");
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const all = await res.json();
      // filter client-side by addressId since API is entity-level
      return all.filter((c: any) => c.addressId === focusState.recordId);
    },
    enabled: !!focusState.recordId,
  });

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    const unregF4 = registerCommand({
      id: "archive-record",
      scope: "context",
      label: { en: t("commands.archive"), de: "Archivieren" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: async (s) => {
        if (!s.recordId) return;
        await fetch(`/api/data/address/${s.recordId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: true }),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      },
    });
    return () => { unregF3(); unregF4(); };
  }, [registerCommand, t, queryClient]);

  const selectedAddress = addresses.find((a: any) => a.addressId === focusState.recordId);

  const dependentTabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <EntityMask
          entityName="address"
          recordId={focusState.recordId}
          mode="edit"
          embedded={true}
          className="border-none shadow-none rounded-none"
        />
      ),
    },
    {
      id: "contacts",
      label: "Contacts",
      count: contacts.length || undefined,
      content: (
        <DataGrid
          entityName="addressContact"
          panelId="contacts-grid"
          data={contacts}
          keyExtractor={(row: any) => row.contactId || row.addressContactId || row.id}
          title="Contacts"
          toolbar={false}
          emptyTitle="No contacts yet."
          emptySubtitle="Add the first contact for this address."
          className="h-full border-none rounded-none"
        />
      ),
    },
  ];

  return (
    <>
      <TriViewWorkspace
        navigationTree={
          <NavigationTree
            entityName="addressCategory"
            panelId="address-tree"
            data={categories}
            header={t("tree.categories")}
            isLoading={isTreeLoading}
            onSelect={(id) => {
              const cat = categories.find((c: TreeNode) => c.id === id);
              setSelectedCategoryLabel(cat?.label);
            }}
          />
        }
        primaryGrid={
          <DataGrid
            entityName="address"
            panelId="address-grid"
            data={addresses}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.addressId}
            title={t("nav.addresses")}
            emptyTitle="No addresses yet."
            emptySubtitle="Create the first address in this category."
            emptyAction={{
              label: `${t("actions.new")} Address`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            className="h-full border-none rounded-none"
          />
        }
        dependentContext={<ContextTabs tabs={dependentTabs} />}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <EntityMask
            entityName="address"
            mode="create"
            title="New Address"
            onCancel={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
            className="border-none shadow-none rounded-none"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
