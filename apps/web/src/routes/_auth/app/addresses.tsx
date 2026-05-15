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
import { CustomerStatsSection } from "@repo/ui/components/customer-stats-section";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";

import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";

export const Route = createFileRoute("/_auth/app/addresses")({
  component: AddressesModule,
});

function AddressesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

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

  // Fetch address stats for selected address
  const { data: addressStats } = useQuery<{
    revenueByPeriod: Array<{
      fiscal_year: number;
      period_no: number;
      total_amount_net: string;
      total_profit: string;
    }>;
    recentDocuments: unknown[];
  }>({
    queryKey: ["stats", "address", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/address/${encodeURIComponent(focusState.recordId!)}`);
      if (!res.ok) throw new Error("Failed to fetch address stats");
      return res.json();
    },
    enabled: !!focusState.recordId,
  });

  // Fetch contacts for selected address (server-side FK filter)
  const { data: contacts = [] } = useQuery({
    queryKey: ["data", "addressContact", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/data/addressContact?addressId=${focusState.recordId}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!focusState.recordId,
  });

  // Register context commands
  useEffect(() => {
    const unregF3 = registerCommand({
      id: "create-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("commands.newRecord"), de: "Neuer Datensatz" },
      shortcut: "F3",
      isEnabled: () => true,
      handler: () => setShowCreate(true),
    });
    const unregEdit = registerCommand({
      id: "edit-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Edit", de: "Bearbeiten" },
      shortcut: "F2",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: () => setShowEdit(true),
    });
    const unregF4 = registerCommand({
      id: "archive-record",
      scope: "context",
      group: "recordOps",
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
    const unregDup = registerCommand({
      id: "duplicate-record",
      scope: "context",
      group: "recordOps",
      label: { en: "Duplicate", de: "Duplizieren" },
      shortcut: "F8",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: async (s) => {
        const src = addresses.find((a: any) => a.addressId === s.recordId);
        if (!src) return;
        const { addressId: _id, ...copy } = src as any;
        await fetch("/api/data/address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copy),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      },
    });
    return () => { unregF3(); unregEdit(); unregF4(); unregDup(); };
  }, [registerCommand, t, queryClient, addresses]);

  const selectedAddress = addresses.find((a: any) => a.addressId === focusState.recordId);

  const dependentTabs = [
    {
      id: "details",
      label: "Details",
      content: (
        <InspectorPanel
          title={selectedAddress?.companyName ?? "Address"}
          recordId={focusState.recordId ?? undefined}
          sections={[
            {
              title: "Identification",
              fields: [
                { label: "No.", value: <span className="font-mono tabular-nums">{selectedAddress?.addressNo}</span> },
                { label: "Company", value: selectedAddress?.companyName },
                { label: "Type", value: selectedAddress?.addressType },
              ],
            },
            {
              title: "Postal Address",
              fields: [
                { label: "Street", value: selectedAddress?.addressLine1 },
                { label: "City", value: selectedAddress?.city },
                { label: "Postal Code", value: selectedAddress?.postalCode },
                { label: "Country", value: selectedAddress?.countryCode },
              ],
            },
            {
              title: "Commercial",
              fields: [
                { label: "Payment Terms", value: selectedAddress?.paymentTermId },
                { label: "Tax Class", value: selectedAddress?.taxClassId },
                { label: "VAT ID", value: selectedAddress?.vatId },
              ],
            },
          ]}
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
    {
      id: "deliveryAddresses",
      label: "Delivery Addresses",
      content: (
        <DataGrid
          entityName="deliveryAddress"
          panelId="delivery-addresses-grid"
          data={[]}
          keyExtractor={(row: any) => row.deliveryAddressId || row.id}
          title="Delivery Addresses"
          toolbar={false}
          columns={[
            { key: "name", header: "Name" },
            { key: "addressLine1", header: "Street" },
            { key: "city", header: "City" },
            { key: "postalCode", header: "Postal Code" },
            { key: "countryCode", header: "Country" },
          ]}
          emptyTitle="No delivery addresses yet."
          emptySubtitle="Delivery addresses for this partner appear here."
          className="h-full border-none rounded-none"
        />
      ),
    },
    {
      id: "relatedDocuments",
      label: "Related Documents",
      content: (
        <DataGrid
          entityName="document"
          panelId="related-documents-grid"
          data={[]}
          keyExtractor={(row: any) => row.documentId || row.id}
          title="Related Documents"
          toolbar={false}
          columns={[
            { key: "documentNo", header: "No.", render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span> },
            { key: "documentDate", header: "Date", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatDate(r.documentDate)}</span> },
            { key: "documentTypeId", header: "Type" },
            { key: "totalGross", header: "Total", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatMoney(r.totalGross ?? 0)}</span> },
            { key: "status", header: "Status", render: (r: any) => <StatusDot status={r.status ?? "draft"} /> },
          ]}
          emptyTitle="No related documents."
          emptySubtitle="Documents linked to this address appear here."
          className="h-full border-none rounded-none"
        />
      ),
    },
    {
      id: "statistics",
      label: t("stats.revenue"),
      content: (
        <div className="overflow-auto h-full">
          {!addressStats || addressStats.revenueByPeriod.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-[13px] text-ink-mute">
              {t("empty.title")}
            </div>
          ) : (
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="h-8 border-b border-hairline">
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0">
                    {t("stats.fiscalYear")}
                  </th>
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-left px-3 py-0">
                    {t("stats.period")}
                  </th>
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0">
                    {t("stats.revenue")}
                  </th>
                  <th className="text-[11px] uppercase tracking-wider font-medium text-ink-mute text-right px-3 py-0">
                    {t("stats.profit")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {addressStats.revenueByPeriod.map((row) => (
                  <tr key={`${row.fiscal_year}-${row.period_no}`} className="h-9 border-b border-hairline last:border-0">
                    <td className="px-3 tabular-nums text-[13px]">{row.fiscal_year}</td>
                    <td className="px-3 tabular-nums text-[13px]">{row.period_no}</td>
                    <td className="px-3 tabular-nums font-mono text-[13px] text-right">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(row.total_amount_net))}
                    </td>
                    <td className="px-3 tabular-nums font-mono text-[13px] text-right">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(row.total_profit))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ),
    },
    {
      id: "open-items",
      label: t("stats.openItems"),
      content: (
        <DataGrid
          entityName="document"
          panelId="open-items-grid"
          data={(addressStats?.recentDocuments ?? []) as any[]}
          keyExtractor={(row: any) => row.documentId || row.id}
          title={t("stats.openItems")}
          toolbar={false}
          columns={[
            {
              key: "documentDate",
              header: "Datum",
              isNumeric: false,
              render: (r: any) => <span className="tabular-nums">{formatDate(r.documentDate)}</span>,
            },
            {
              key: "documentNo",
              header: "Beleg-Nr",
              render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span>,
            },
            { key: "documentType", header: "Typ" },
            {
              key: "totalGross",
              header: "Betrag",
              isNumeric: true,
              render: (r: any) => (
                <span className="tabular-nums">{formatMoney(r.totalGross ?? 0)}</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (r: any) => <StatusDot status={r.status ?? "draft"} />,
            },
          ]}
          emptyTitle="Keine offenen Posten."
          emptySubtitle="Unbezahlte Rechnungen erscheinen hier."
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
              setSubCrumb(cat?.label);
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
            columns={[
              { key: "addressNo", header: "No.", render: (r: any) => <span className="font-mono tabular-nums text-ink-mute">{r.addressNo}</span> },
              { key: "companyName", header: "Company" },
              { key: "city", header: "City" },
              { key: "countryCode", header: "Country" },
              { key: "phone", header: "Phone", render: (r: any) => <span className="font-mono text-[12px]">{r.phone}</span> },
              { key: "addressType", header: "Segment" },
            ]}
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

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <EntityMask
            entityName="address"
            mode="edit"
            recordId={focusState.recordId ?? undefined}
            onCancel={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", "address"] });
            }}
            childSection={(record) =>
              record.isCustomer ? (
                <CustomerStatsSection addressId={record.addressId as string} />
              ) : null
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
