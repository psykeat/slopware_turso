import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGridUrlState } from "#/hooks/use-grid-url-state";
import { useTranslation } from "react-i18next";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { DataGrid } from "@repo/ui/components/data-grid";
import { ContextTabs } from "@repo/ui/components/context-tabs";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { InlineEditGrid } from "@repo/ui/components/inline-edit-grid";
import { CustomerStatsSection } from "@repo/ui/components/customer-stats-section";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";

import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_auth/app/addresses")({
  component: AddressesModule,
});

const ADDRESS_FIELD_OVERRIDES = [
  { key: "addressNo", sectionLabel: "Identification", sectionLabelDe: "Identifikation" },
  { key: "addressLine1", sectionLabel: "Postal Address", sectionLabelDe: "Postanschrift" },
  { key: "vatId", sectionLabel: "Commercial", sectionLabelDe: "Kaufmännisch" },
];

function AddressesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFkViolation, setDeleteFkViolation] = useState(false);
  const gridState = useGridUrlState({ defaultPageSize: 50 });

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  // Fetch addresses — paginated
  const { data: addressData, isLoading: isDataLoading } = useQuery({
    queryKey: ["data", "address", selectedCategoryId, gridState.queryParams.page, gridState.queryParams.limit, gridState.queryParams.orderBy, gridState.queryParams.search, gridState.queryParams.filters],
    queryFn: async () => {
      const p = new URLSearchParams({
        paginated: "true",
        page: String(gridState.queryParams.page),
        limit: String(gridState.queryParams.limit),
      });
      if (selectedCategoryId) p.set("addressCategoryId", selectedCategoryId);
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters) p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/data/address?${p}`);
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
  });

  const addresses = useMemo(() => addressData?.data ?? [], [addressData]);

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


  const { data: contacts = [] } = useQuery({
    queryKey: ["data", "addressContact", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/data/addressContact?addressId=${focusState.recordId}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!focusState.recordId,
  });

  const { data: deliveryAddresses = [] } = useQuery({
    queryKey: ["data", "deliveryAddress", focusState.recordId],
    queryFn: async () => {
      const res = await fetch(`/api/data/deliveryAddress?addressId=${focusState.recordId}`);
      if (!res.ok) throw new Error("Failed to fetch delivery addresses");
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
      id: "delete-record",
      scope: "context",
      group: "recordOps",
      label: { en: t("actions.delete"), de: "Löschen" },
      shortcut: "F4",
      isEnabled: (s) => !!s.recordId && s.entity === "address",
      handler: (s) => {
        if (!s.recordId) return;
        setDeleteId(s.recordId);
        setDeleteConfirm(true);
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
        if (!s.recordId) return;
        const srcRes = await fetch(`/api/data/address/${s.recordId}`);
        if (!srcRes.ok) return;
        const { addressId: _id, ...copy } = await srcRes.json();
        await fetch("/api/data/address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(copy),
        });
        queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      },
    });
    return () => { unregF3(); unregEdit(); unregF4(); unregDup(); };
  }, [registerCommand, t, queryClient]);

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
          columns={[
            { key: "firstName", header: "First" },
            { key: "lastName", header: "Last" },
            { key: "email", header: "Email" },
            { key: "phoneMobile", header: "Mobile" },
            { key: "roleFunction", header: "Role" },
          ]}
          emptyTitle="No contacts yet."
          emptySubtitle="Open the address edit mask (F2) to add contacts."
          className="h-full border-none rounded-none"
        />
      ),
    },
    {
      id: "deliveryAddresses",
      label: "Delivery Addresses",
      count: deliveryAddresses.length || undefined,
      content: (
        <DataGrid
          entityName="deliveryAddress"
          panelId="delivery-addresses-grid"
          data={deliveryAddresses}
          keyExtractor={(row: any) => row.deliveryAddressId || row.id}
          title="Delivery Addresses"
          toolbar={false}
          columns={[
            { key: "name", header: "Name" },
            { key: "addressLine1", header: "Street" },
            { key: "postalCode", header: "ZIP" },
            { key: "city", header: "City" },
            { key: "countryCode", header: "Country" },
          ]}
          emptyTitle="No delivery addresses yet."
          emptySubtitle="Open the address edit mask (F2) to add delivery addresses."
          className="h-full border-none rounded-none"
        />
      ),
    },
    {
      id: "relatedDocuments",
      label: "Related Documents",
      count: (addressStats?.recentDocuments?.length || undefined),
      content: (
        <DataGrid
          entityName="document"
          panelId="related-documents-grid"
          data={(addressStats?.recentDocuments ?? []) as any[]}
          keyExtractor={(row: any) => row.documentId || row.id}
          title="Related Documents"
          toolbar={false}
          columns={[
            { key: "documentNo", header: "No.", render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span> },
            { key: "documentDate", header: "Date", isNumeric: true, render: (r: any) => <span className="tabular-nums">{formatDate(r.documentDate)}</span> },
            { key: "documentType", header: "Type" },
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
          data={(addressStats?.recentDocuments ?? []).filter((d: any) => !d.isPaid) as any[]}
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
              setSelectedCategoryId(id);
              gridState.setPage(1);
            }}
          />
        }
        primaryGrid={
          <DataGrid
            entityName="address"
            panelId="address-grid"
            virtualized
            data={addresses}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.addressId}
            title={t("nav.addresses")}
            columns={[
              { key: "addressNo", header: "No.", sortable: true, render: (r: any) => <span className="font-mono tabular-nums text-ink-mute">{r.addressNo}</span> },
              { key: "companyName", header: "Company", sortable: true },
              { key: "city", header: "City", sortable: true },
              { key: "countryCode", header: "Country" },
              { key: "isCustomer", header: "Type", render: (r: any) => {
                const tags = [r.isCustomer && "C", r.isSupplier && "S"].filter(Boolean).join("/");
                return <span className="font-mono text-[11px] text-ink-mute">{tags || "—"}</span>;
              }},
              { key: "addressType", header: "Segment", sortable: true },
            ]}
            totalCount={addressData?.total}
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
            selectable
            bulkActions={[{
              label: "Archive",
              variant: "destructive" as const,
              onClick: async (keys: string[]) => {
                await Promise.all(keys.map(id =>
                  fetch(`/api/data/address/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ archived: true }),
                  })
                ));
                queryClient.invalidateQueries({ queryKey: ["data", "address"] });
              },
            }]}
            onRowOpen={() => setShowEdit(true)}
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
            fieldOverrides={ADDRESS_FIELD_OVERRIDES}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm} onOpenChange={(open) => { setDeleteConfirm(open); if (!open) setDeleteFkViolation(false); }}>
        <DialogContent className="max-w-sm">
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
                    await fetch(`/api/data/address/${deleteId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ archivedAt: new Date().toISOString() }),
                    });
                    setDeleteConfirm(false);
                    setDeleteFkViolation(false);
                    setDeleteId(null);
                    queryClient.invalidateQueries({ queryKey: ["data", "address"] });
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
                    const res = await fetch(`/api/data/address/${deleteId}`, {
                      method: "DELETE",
                    });
                    if (res.status === 409) {
                      setDeleteFkViolation(true);
                      return;
                    }
                    setDeleteConfirm(false);
                    setDeleteFkViolation(false);
                    setDeleteId(null);
                    queryClient.invalidateQueries({ queryKey: ["data", "address"] });
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

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-7xl h-[85vh] p-0 overflow-hidden">
          <EntityMask
            entityName="address"
            mode="edit"
            layout="single"
            recordId={focusState.recordId ?? undefined}
            onCancel={() => setShowEdit(false)}
            onSaved={() => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ["data", "address"] });
            }}
            fieldOverrides={ADDRESS_FIELD_OVERRIDES}
            embedded
            childLayout="side"
            childSection={(record) => (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="text-[11px] font-medium text-ink-mute uppercase tracking-wider mb-2">Contacts</div>
                  <InlineEditGrid
                    entityName="addressContact"
                    parentKey={{ addressId: record.addressId as string }}
                    keyColumn="contactId"
                    columns={[
                      { key: "firstName", header: "First Name", type: "text" },
                      { key: "lastName", header: "Last Name", type: "text", required: true },
                      { key: "email", header: "Email", type: "text" },
                      { key: "phoneMobile", header: "Mobile", type: "text" },
                      { key: "roleFunction", header: "Role", type: "text" },
                      { key: "isPrimary", header: "Primary", type: "boolean", width: "60px" },
                    ]}
                  />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-ink-mute uppercase tracking-wider mb-2">Delivery Addresses</div>
                  <InlineEditGrid
                    entityName="deliveryAddress"
                    parentKey={{ addressId: record.addressId as string }}
                    keyColumn="deliveryAddressId"
                    columns={[
                      { key: "name", header: "Name", type: "text" },
                      { key: "addressLine1", header: "Street", type: "text", required: true },
                      { key: "postalCode", header: "ZIP", type: "text", required: true, width: "80px" },
                      { key: "city", header: "City", type: "text", required: true },
                      { key: "countryCode", header: "Country", type: "text", required: true, width: "70px" },
                      { key: "defaultForShipping", header: "Default", type: "boolean", width: "60px" },
                    ]}
                  />
                </div>
                {!!record.isCustomer && <CustomerStatsSection addressId={record.addressId as string} />}
              </div>
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
