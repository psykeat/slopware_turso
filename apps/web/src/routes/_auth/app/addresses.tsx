import { ContextTabs } from "@repo/ui/components/context-tabs";
import { CustomerStatsSection } from "@repo/ui/components/customer-stats-section";
import { DataGrid, type DataGridHandle } from "@repo/ui/components/data-grid";
import { Dialog, DialogContent } from "@repo/ui/components/dialog";
import { EntityMask } from "@repo/ui/components/entity-mask";
import { InlineEditGrid } from "@repo/ui/components/inline-edit-grid";
import { InspectorPanel } from "@repo/ui/components/inspector-panel";
import { LangTextRecordPanel } from "@repo/ui/components/langtext-record-panel";
import { NavigationTree, type TreeNode } from "@repo/ui/components/navigation-tree";
import { TriViewWorkspace } from "@repo/ui/components/triview-workspace";
import { formatMoney, formatDate, StatusDot } from "@repo/ui/lib/formatters";
import { cn } from "@repo/ui/lib/utils";
import { useActionBar } from "@repo/ui/platform/action-bar-context";
import { useCommands } from "@repo/ui/platform/command-registry";
import { useFocus } from "@repo/ui/platform/focus-manager";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useGridUrlState } from "#/hooks/use-grid-url-state";

export const Route = createFileRoute("/_auth/app/addresses")({
  component: AddressesModule,
});

const EMPTY_ARRAY: any[] = [];

const ADDRESS_FIELD_OVERRIDES = [
  { key: "addressNo", sectionLabel: "Identification", sectionLabelDe: "Identifikation" },
  { key: "addressLine1", sectionLabel: "Postal Address", sectionLabelDe: "Postanschrift" },
  { key: "vatId", sectionLabel: "Commercial", sectionLabelDe: "Kaufmännisch" },
];

const ADDRESS_TEXT_FIELD_OVERRIDES = [
  { key: "notiztext", visible: false },
  { key: "warntext", visible: false },
  { key: "langtext", visible: false },
];

const ADDRESS_LANGTEXT_FIELDS = [
  { field: "notiztext", label: "Notiztext" },
  { field: "warntext", label: "Warntext" },
  { field: "langtext", label: "Langtext" },
];

function AddressesModule() {
  const { state: focusState } = useFocus();
  const { registerCommand } = useCommands();
  const { setSubCrumb } = useActionBar();
  const { t } = useTranslation("ui");
  const queryClient = useQueryClient();
  const addressGridRef = useRef<DataGridHandle>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const [activeAddressId, setActiveAddressId] = useState<string | null>(
    focusState.entity === "address" ? focusState.recordId : null,
  );
  const lastSyncIdRef = useRef<string | null>(activeAddressId);

  useEffect(() => {
    if (
      focusState.entity === "address" &&
      focusState.recordId &&
      focusState.recordId !== lastSyncIdRef.current
    ) {
      lastSyncIdRef.current = focusState.recordId;
      setActiveAddressId(focusState.recordId);
    }
  }, [focusState.entity, focusState.recordId]);

  const gridState = useGridUrlState({ defaultPageSize: 50 });

  useEffect(() => () => setSubCrumb(undefined), [setSubCrumb]);

  const restoreAddressGrid = useCallback(
    (recordId?: string | null) => {
      addressGridRef.current?.restoreFocus(recordId ?? activeAddressId ?? null);
    },
    [activeAddressId],
  );

  // Fetch addresses — paginated
  const { data: addressData, isLoading: isDataLoading } = useQuery({
    queryKey: [
      "data",
      "address",
      selectedCategoryId,
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
      if (selectedCategoryId) p.set("addressCategoryId", selectedCategoryId);
      if (gridState.queryParams.orderBy) p.set("orderBy", gridState.queryParams.orderBy);
      if (gridState.queryParams.search) p.set("search", gridState.queryParams.search);
      if (gridState.queryParams.filters)
        p.set("filters", JSON.stringify(gridState.queryParams.filters));
      const res = await fetch(`/api/data/address?${p}`);
      if (!res.ok) throw new Error("Failed to fetch addresses");
      return res.json() as Promise<{ data: any[]; total: number }>;
    },
  });

  const addresses = useMemo(() => addressData?.data ?? EMPTY_ARRAY, [addressData]);

  // Fetch categories for tree
  const { data: categories = EMPTY_ARRAY, isLoading: isTreeLoading } = useQuery({
    queryKey: ["data", "addressCategory"],
    queryFn: async () => {
      const res = await fetch("/api/data/addressCategory");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
    select: useCallback(
      (data: any[]) =>
        data.map(
          (c: any): TreeNode => ({
            id: c.categoryId,
            label: c.name?.en || c.name?.de || c.name || "Unnamed Category",
            count: undefined,
          }),
        ),
      [],
    ),
    placeholderData: keepPreviousData,
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
    queryKey: ["stats", "address", activeAddressId],
    queryFn: async () => {
      const res = await fetch(`/api/stats/address/${encodeURIComponent(activeAddressId!)}`);
      if (!res.ok) throw new Error("Failed to fetch address stats");
      return res.json();
    },
    enabled: !!activeAddressId,
    placeholderData: keepPreviousData,
  });

  const { data: contacts = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "addressContact", activeAddressId],
    queryFn: async () => {
      const res = await fetch(`/api/data/addressContact?addressId=${activeAddressId}`);
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return res.json();
    },
    enabled: !!activeAddressId,
    placeholderData: keepPreviousData,
  });

  const { data: deliveryAddresses = EMPTY_ARRAY } = useQuery({
    queryKey: ["data", "deliveryAddress", activeAddressId],
    queryFn: async () => {
      const res = await fetch(`/api/data/deliveryAddress?addressId=${activeAddressId}`);
      if (!res.ok) throw new Error("Failed to fetch delivery addresses");
      return res.json();
    },
    enabled: !!activeAddressId,
    placeholderData: keepPreviousData,
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
    return () => {
      unregF3();
      unregEdit();
      unregF4();
      unregDup();
    };
  }, [registerCommand, t, queryClient]);

  const selectedAddress = useMemo(
    () => addresses.find((a: any) => a.addressId === activeAddressId),
    [addresses, activeAddressId],
  );

  const getContactId = useCallback(
    (row: any) => row.contactId || row.addressContactId || row.id || null,
    [],
  );

  const getContactLabel = useCallback((contact: any) => {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    const tail = contact.roleFunction ? ` · ${contact.roleFunction}` : "";
    return `${name || contact.email || contact.phoneMobile || "Kontakt"}${tail}`;
  }, []);

  const resolvedContactId = useMemo(() => {
    if (contacts.length === 0) return null;
    if (
      selectedContactId &&
      contacts.some((contact: any) => getContactId(contact) === selectedContactId)
    ) {
      return selectedContactId;
    }
    return getContactId(contacts[0]);
  }, [contacts, getContactId, selectedContactId]);

  const contactOptions = useMemo(
    () =>
      contacts
        .map((contact: any) => {
          const id = getContactId(contact);
          if (!id) return null;
          return {
            id,
            label: getContactLabel(contact),
            isPrimary: !!contact.isPrimary,
            email: contact.email ?? null,
            phone: contact.phoneMobile ?? null,
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        label: string;
        isPrimary: boolean;
        email: string | null;
        phone: string | null;
      }>,
    [contacts, getContactId, getContactLabel],
  );

  const dependentTabs = useMemo(
    () => [
      {
        id: "details",
        label: "Details",
        content: (
          <InspectorPanel
            title={selectedAddress?.companyName ?? "Address"}
            recordId={activeAddressId ?? undefined}
            sections={[
              {
                title: "Identification",
                fields: [
                  {
                    label: "No.",
                    value: (
                      <span className="font-mono tabular-nums">{selectedAddress?.addressNo}</span>
                    ),
                  },
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
        id: "langtexte",
        label: "Langtexte",
        content: (
          <div className="h-full p-2">
            <LangTextRecordPanel
              entityName="address"
              recordId={activeAddressId}
              title="Langtexte"
              fields={ADDRESS_LANGTEXT_FIELDS}
              className="h-full"
            />
          </div>
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
              {
                key: "notiztext",
                header: "Note Text",
                render: (row: any) => (
                  <span className="block max-w-[240px] truncate text-ink-secondary">
                    {row.notiztext ?? "—"}
                  </span>
                ),
              },
              { key: "email", header: "Email" },
              { key: "phoneMobile", header: "Mobile" },
              { key: "roleFunction", header: "Role" },
            ]}
            emptyTitle="No contacts yet."
            emptySubtitle="Open the address edit mask (F2) to add contacts."
            className="h-full rounded-none border-none"
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
            className="h-full rounded-none border-none"
          />
        ),
      },
      {
        id: "relatedDocuments",
        label: "Related Documents",
        count: addressStats?.recentDocuments?.length || undefined,
        content: (
          <DataGrid
            entityName="document"
            panelId="related-documents-grid"
            data={(addressStats?.recentDocuments ?? []) as any[]}
            keyExtractor={(row: any) => row.documentId || row.id}
            title="Related Documents"
            toolbar={false}
            columns={[
              {
                key: "documentNo",
                header: "No.",
                render: (r: any) => <span className="font-mono tabular-nums">{r.documentNo}</span>,
              },
              {
                key: "documentDate",
                header: "Date",
                isNumeric: true,
                render: (r: any) => (
                  <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                ),
              },
              { key: "documentType", header: "Type" },
              {
                key: "totalGross",
                header: "Total",
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
            emptyTitle="No related documents."
            emptySubtitle="Documents linked to this address appear here."
            className="h-full rounded-none border-none"
          />
        ),
      },
      {
        id: "statistics",
        label: t("stats.revenue"),
        content: (
          <div className="h-full overflow-auto">
            {!addressStats || addressStats.revenueByPeriod.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-[13px] text-ink-mute">
                {t("empty.title")}
              </div>
            ) : (
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="h-8 border-b border-hairline">
                    <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.fiscalYear")}
                    </th>
                    <th className="px-3 py-0 text-left text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.period")}
                    </th>
                    <th className="px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.revenue")}
                    </th>
                    <th className="px-3 py-0 text-right text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                      {t("stats.profit")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {addressStats.revenueByPeriod.map((row) => (
                    <tr
                      key={`${row.fiscal_year}-${row.period_no}`}
                      className="h-9 border-b border-hairline last:border-0"
                    >
                      <td className="px-3 text-[13px] tabular-nums">{row.fiscal_year}</td>
                      <td className="px-3 text-[13px] tabular-nums">{row.period_no}</td>
                      <td className="px-3 text-right font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Number(row.total_amount_net))}
                      </td>
                      <td className="px-3 text-right font-mono text-[13px] tabular-nums">
                        {new Intl.NumberFormat("de-DE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(Number(row.total_profit))}
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
                render: (r: any) => (
                  <span className="tabular-nums">{formatDate(r.documentDate)}</span>
                ),
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
            className="h-full rounded-none border-none"
          />
        ),
      },
    ],
    [selectedAddress, activeAddressId, contacts, deliveryAddresses, addressStats, t],
  );

  const selectCategoryNode = useCallback(
    (id: string) => {
      const cat = categories.find((c: TreeNode) => c.id === id);
      setSubCrumb(cat?.label);
      setSelectedCategoryId(id);
      gridState.setPage(1);
    },
    [categories, gridState, setSubCrumb],
  );

  const handleCreateSaved = useCallback(
    (record: any) => {
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      restoreAddressGrid(record?.addressId ?? record?.id ?? null);
    },
    [queryClient, restoreAddressGrid],
  );

  const handleEditSaved = useCallback(
    (record: any) => {
      setShowEdit(false);
      queryClient.invalidateQueries({ queryKey: ["data", "address"] });
      restoreAddressGrid(record?.addressId ?? record?.id ?? activeAddressId);
    },
    [activeAddressId, queryClient, restoreAddressGrid],
  );

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
            onSelect={selectCategoryNode}
            onSelectCommit={() => restoreAddressGrid()}
          />
        }
        primaryGrid={
          <DataGrid
            ref={addressGridRef}
            entityName="address"
            panelId="address-grid"
            virtualized
            data={addresses}
            isLoading={isDataLoading}
            keyExtractor={(row: any) => row.addressId}
            title={t("nav.addresses")}
            columns={[
              {
                key: "addressNo",
                header: "No.",
                sortable: true,
                render: (r: any) => (
                  <span className="font-mono text-ink-mute tabular-nums">{r.addressNo}</span>
                ),
              },
              { key: "companyName", header: "Company", sortable: true },
              { key: "city", header: "City", sortable: true },
              { key: "countryCode", header: "Country" },
              {
                key: "isCustomer",
                header: "Type",
                render: (r: any) => {
                  const tags = [r.isCustomer && "C", r.isSupplier && "S"].filter(Boolean).join("/");
                  return <span className="font-mono text-[11px] text-ink-mute">{tags || "—"}</span>;
                },
              },
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
            bulkActions={[
              {
                label: "Delete",
                variant: "destructive" as const,
                onClick: async (keys: string[]) => {
                  try {
                    await Promise.all(
                      keys.map(async (id) => {
                        const res = await fetch(`/api/data/address/${id}`, {
                          method: "DELETE",
                        });
                        if (!res.ok) throw new Error(await res.text());
                      }),
                    );
                    queryClient.invalidateQueries({ queryKey: ["data", "address"] });
                  } catch (err) {
                    toast.error(
                      err instanceof Error && err.message
                        ? err.message
                        : t("form.fkViolationError"),
                    );
                  }
                },
              },
            ]}
            onRowOpen={() => setShowEdit(true)}
            emptyTitle="No addresses yet."
            emptySubtitle="Create the first address in this category."
            emptyAction={{
              label: `${t("actions.new")} Address`,
              kbd: "F3",
              onClick: () => setShowCreate(true),
            }}
            className="h-full rounded-none border-none"
          />
        }
        dependentContext={<ContextTabs tabs={dependentTabs} />}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <EntityMask
            entityName="address"
            mode="create"
            layout="single"
            title="New Address"
            onCancel={() => setShowCreate(false)}
            onSaved={handleCreateSaved}
            className="rounded-none border-none shadow-none"
            fieldOverrides={[...ADDRESS_FIELD_OVERRIDES, ...ADDRESS_TEXT_FIELD_OVERRIDES]}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h3 className="text-[15px] font-medium text-ink">{t("form.deleteConfirmTitle")}</h3>
              <p className="mt-1 text-[13px] text-ink-mute">{t("form.deleteConfirmBody")}</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="h-8 rounded border border-hairline px-4 text-[13px] hover:bg-canvas-soft"
                onClick={() => setDeleteConfirm(false)}
              >
                {t("actions.cancel")}
              </button>
              <button
                type="button"
                className="h-8 rounded bg-destructive px-4 text-[13px] text-white hover:opacity-90"
                onClick={async () => {
                  if (!deleteId) return;
                  const res = await fetch(`/api/data/address/${deleteId}`, {
                    method: "DELETE",
                  });
                  if (!res.ok) {
                    const message = await res.text();
                    toast.error(message || t("form.fkViolationError"));
                    return;
                  }
                  setDeleteConfirm(false);
                  setDeleteId(null);
                  queryClient.invalidateQueries({ queryKey: ["data", "address"] });
                  toast.success(t("form.deleteSuccess"));
                }}
              >
                {t("actions.delete")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="h-[85vh] max-w-7xl overflow-hidden p-0">
          <EntityMask
            entityName="address"
            mode="edit"
            layout="single"
            recordId={activeAddressId ?? undefined}
            onCancel={() => setShowEdit(false)}
            onSaved={handleEditSaved}
            fieldOverrides={[...ADDRESS_FIELD_OVERRIDES, ...ADDRESS_TEXT_FIELD_OVERRIDES]}
            embedded
            childLayout="side"
            childSection={(record, onChange) => (
              <div className="flex flex-col gap-6">
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    Langtexte
                  </div>
                  <LangTextRecordPanel
                    entityName="address"
                    recordId={activeAddressId}
                    title="Langtexte"
                    fields={ADDRESS_LANGTEXT_FIELDS}
                    className="min-h-[220px]"
                    controlledValues={{
                      notiztext: record.notiztext as string,
                      warntext: record.warntext as string,
                      langtext: record.langtext as string,
                    }}
                    onControlledChange={(field, value) => onChange(field, value)}
                  />
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    Contacts
                  </div>
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
                  <div className="mt-3 rounded-xl border border-hairline bg-canvas shadow-sm">
                    <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
                      <div>
                        <div className="text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                          Ansprechpartner-Langtext
                        </div>
                        <div className="mt-0.5 text-[12px] text-ink-secondary">
                          {resolvedContactId
                            ? "Ausgewählter Kontakt wird rechts als Text-Inspector bearbeitet."
                            : "Wähle einen Kontakt, damit der Text-Inspector aktiv wird."}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-ink-mute">
                        {contactOptions.length} Kontakte
                      </div>
                    </div>
                    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                      <div className="space-y-2">
                        {contactOptions.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-hairline px-3 py-4 text-[12px] text-ink-mute">
                            Noch keine Kontakte vorhanden.
                          </div>
                        ) : (
                          contactOptions.map((contact) => {
                            const isSelected = contact.id === resolvedContactId;
                            return (
                              <button
                                key={contact.id}
                                type="button"
                                className={cn(
                                  "flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                                  isSelected
                                    ? "border-primary bg-[color-mix(in_oklab,var(--primary)_8%,var(--canvas))] shadow-sm"
                                    : "border-hairline bg-canvas hover:border-primary hover:bg-canvas-soft",
                                )}
                                onClick={() => setSelectedContactId(contact.id)}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-[13px] font-medium text-ink">
                                      {contact.label}
                                    </span>
                                    {contact.isPrimary ? (
                                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-700 uppercase">
                                        Primär
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 truncate text-[11px] text-ink-mute">
                                    {[contact.email, contact.phone].filter(Boolean).join(" · ") ||
                                      " "}
                                  </div>
                                </div>
                                <span
                                  className={cn(
                                    "mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                                    isSelected
                                      ? "border-primary/30 bg-primary/10 text-primary"
                                      : "border-hairline text-ink-mute",
                                  )}
                                >
                                  {isSelected ? "Aktiv" : "Wählen"}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                      <LangTextRecordPanel
                        entityName="addressContact"
                        recordId={resolvedContactId}
                        title="Notiztext"
                        fields={[
                          {
                            field: "notiztext",
                            label: "Notiztext",
                          },
                        ]}
                        className="min-h-[220px]"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    Delivery Addresses
                  </div>
                  <InlineEditGrid
                    entityName="deliveryAddress"
                    parentKey={{ addressId: record.addressId as string }}
                    keyColumn="deliveryAddressId"
                    columns={[
                      { key: "name", header: "Name", type: "text" },
                      { key: "addressLine1", header: "Street", type: "text", required: true },
                      {
                        key: "postalCode",
                        header: "ZIP",
                        type: "text",
                        required: true,
                        width: "80px",
                      },
                      { key: "city", header: "City", type: "text", required: true },
                      {
                        key: "countryCode",
                        header: "Country",
                        type: "text",
                        required: true,
                        width: "70px",
                      },
                      {
                        key: "defaultForShipping",
                        header: "Default",
                        type: "boolean",
                        width: "60px",
                      },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-medium tracking-wider text-ink-mute uppercase">
                    Bank Accounts
                  </div>
                  <InlineEditGrid
                    entityName="bankAccount"
                    parentKey={{ addressId: record.addressId as string }}
                    keyColumn="bankAccountId"
                    columns={[
                      { key: "iban", header: "IBAN", type: "text", required: true },
                      { key: "bic", header: "BIC", type: "text" },
                      { key: "bankName", header: "Bank", type: "text" },
                      { key: "isDefault", header: "Default", type: "boolean", width: "60px" },
                    ]}
                  />
                </div>
                {!!record.isCustomer && (
                  <CustomerStatsSection addressId={record.addressId as string} />
                )}
              </div>
            )}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
